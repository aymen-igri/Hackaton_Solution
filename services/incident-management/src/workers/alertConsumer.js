const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { Pool } = require('pg');
const config = require('../config');
const redis = require('../redis');

// IMPORTANT: BRPOP blocks the connection, so we need a DEDICATED connection for it
const brpopRedis = new Redis(config.redisUrl);

const pool = new Pool({ connectionString: config.databaseUrl });

const rules = config.incidentRules;

/**
 * Generate a secure random token for magic link acknowledgment
 */
function generateAckToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ─── DB helpers for decision logic ─────────────────────────

/**
 * Find open incidents for the same source created within the last N minutes.
 */
async function findOpenIncidentForService(source, windowMin) {
  const { rows } = await pool.query(
    `SELECT * FROM incidents
     WHERE source = $1
       AND status = 'open'
       AND created_at > NOW() - INTERVAL '1 minute' * $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [source, windowMin],
  );
  return rows[0] || null;
}

/**
 * Count similar alerts (same source + title) within the last N minutes.
 */
async function countSimilarAlerts(source, title, windowMin) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM alerts
     WHERE source = $1
       AND title  = $2
       AND received_at > NOW() - INTERVAL '1 minute' * $3`,
    [source, title, windowMin],
  );
  return rows[0].cnt;
}

// ─── Decision function ─────────────────────────────────────

/**
 * should_create_incident(alert) → { action, reason, existingIncident? }
 *
 * Create incident IF:
 *   1. severity = critical  (ALWAYS)
 *   2. No open incident for this source in last 15 min
 *      AND (severity = high  OR  firing_duration > 5 min)
 *   3. 3+ similar alerts in last 10 min (alert storm)
 *
 * Otherwise:
 *   - Attach to existing incident (if one exists)
 *   - Or just log and monitor
 */
async function shouldCreateIncident(alertData) {
  const severity = (alertData.severity || '').toLowerCase();
  const source   = alertData.source || 'unknown';
  const title    = alertData.title  || '';
  const firingMin = (alertData.firing_duration || 0) / 60;  // seconds → minutes

  // ── Rule 1: Critical always creates ──
  if (severity === 'critical') {
    return { action: 'create', reason: 'Rule 1: severity is critical — always create incident' };
  }

  // ── Check for existing open incident (used by Rules 2 & fallback) ──
  const existing = await findOpenIncidentForService(source, rules.deduplicationWindowMin);

  // ── Rule 3: Alert storm (3+ similar alerts in 10 min) ──
  const similarCount = await countSimilarAlerts(source, title, rules.alertStormWindowMin);
  if (similarCount >= rules.alertStormThreshold) {
    return {
      action: 'create',
      reason: `Rule 3: alert storm — ${similarCount} similar alerts in last ${rules.alertStormWindowMin} min`,
    };
  }

  // ── Rule 2: No open incident AND (high severity OR firing > 5 min) ──
  if (!existing && (severity === 'high' || firingMin > rules.firingDurationMin)) {
    return {
      action: 'create',
      reason: `Rule 2: no open incident for "${source}" and ${severity === 'high' ? 'severity is high' : `firing for ${firingMin.toFixed(1)} min`}`,
    };
  }

  // ── Fallback: attach to existing or just log ──
  if (existing) {
    return {
      action: 'attach',
      reason: `Dedup: open incident ${existing.id} exists for "${source}" — attaching alert`,
      existingIncident: existing,
    };
  }

  return {
    action: 'skip',
    reason: `No rules matched (severity=${severity}, similar=${similarCount}, firing=${firingMin.toFixed(1)}min) — logging only`,
  };
}

// ─── Actions ───────────────────────────────────────────────

/**
 * Create a brand-new incident and push to incidents:queue.
 */
async function createIncident(alertData, reason) {
  const id  = uuidv4();
  const ack_token = generateAckToken();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO incidents (id, title, severity, source, description, status, ack_token, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $7)
    RETURNING *`;
  const { rows } = await pool.query(sql, [
    id,
    alertData.title,
    alertData.severity,
    alertData.source,
    alertData.description || '',
    ack_token,
    now,
  ]);
  const incident = rows[0];

  // Link alert → incident (alert_id is always set by processAlert)
  const linkResult = await pool.query(
    'INSERT INTO incident_alerts (alert_id, incident_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
    [alertData.alert_id, id],
  );

  console.log(`[alertConsumer] ✅ INCIDENT CREATED  ${id}`);
  console.log(`[alertConsumer]    🔗 Alert ${alertData.alert_id} linked to incident ${id}`);
  console.log(`[alertConsumer]    Reason: ${reason}`);
  console.log(`[alertConsumer]    Alert: severity=${alertData.severity}, source=${alertData.source}, title="${alertData.title}"`);

  // Push to incidents:queue for incidentWorker
  await redis.lpush(
    config.queues.incidents,
    JSON.stringify({
      incident_id: incident.id,
      title: incident.title,
      severity: incident.severity,
      source: incident.source,
      created_at: incident.created_at,
    }),
  );
  console.log(`[alertConsumer]    → Pushed to "${config.queues.incidents}"`);
}

/**
 * Attach an alert to an existing incident (deduplication).
 */
async function attachToExisting(alertData, existingIncident, reason) {
  // Link alert → existing incident (alert_id is always set by processAlert)
  const linkResult = await pool.query(
    'INSERT INTO incident_alerts (alert_id, incident_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
    [alertData.alert_id, existingIncident.id],
  );

  // Update the incident's updated_at to reflect new alert attached
  await pool.query(
    'UPDATE incidents SET updated_at = NOW() WHERE id = $1',
    [existingIncident.id],
  );

  // Count total alerts linked to this incident
  const countResult = await pool.query(
    'SELECT COUNT(*) as alert_count FROM incident_alerts WHERE incident_id = $1',
    [existingIncident.id],
  );
  const alertCount = countResult.rows[0].alert_count;

  console.log(`[alertConsumer] 🔗 ATTACHED to incident ${existingIncident.id}`);
  console.log(`[alertConsumer]    Alert ${alertData.alert_id} linked (total alerts: ${alertCount})`);
  console.log(`[alertConsumer]    Reason: ${reason}`);
  console.log(`[alertConsumer]    Alert: severity=${alertData.severity}, source=${alertData.source}, title="${alertData.title}"`);
}

// ─── Main process function ─────────────────────────────────

async function processAlert(alertData) {
  // Persist the alert in the alerts table so storm detection can count it
  if (!alertData.alert_id) {
    alertData.alert_id = uuidv4();
  }
  await pool.query(
    `INSERT INTO alerts (id, source, severity, title, description, received_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [alertData.alert_id, alertData.source || 'unknown', alertData.severity || 'unknown', alertData.title || '', alertData.description || ''],
  );

  const decision = await shouldCreateIncident(alertData);

  switch (decision.action) {
    case 'create':
      await createIncident(alertData, decision.reason);
      break;

    case 'attach':
      await attachToExisting(alertData, decision.existingIncident, decision.reason);
      break;

    case 'skip':
    default:
      // Alert is persisted but not linked to any incident (didn't meet criteria)
      console.log(`[alertConsumer] ⏭️  SKIPPED — ${decision.reason}`);
      console.log(`[alertConsumer]    Alert ${alertData.alert_id} persisted but not linked to incident`);
      console.log(`[alertConsumer]    Alert: severity=${alertData.severity}, source=${alertData.source}, title="${alertData.title}"`);
      break;
  }
}

// ─── Main loop ─────────────────────────────────────────────

async function startAlertConsumer() {
  console.log(`[alertConsumer] 🟢 Listening on "${config.queues.alerts}"...`);
  console.log(`[alertConsumer] 📋 Rules: critical=always | dedup=${rules.deduplicationWindowMin}min | storm=${rules.alertStormThreshold}alerts/${rules.alertStormWindowMin}min | firing>${rules.firingDurationMin}min`);

  while (true) {
    try {
      const result = await brpopRedis.brpop(config.queues.alerts, config.worker.brpopTimeoutSec);

      if (result) {
        const [, message] = result;
        const alertData = JSON.parse(message);
        await processAlert(alertData);
      }
    } catch (err) {
      console.error('[alertConsumer] ❌ Error:', err.message);
      await new Promise((r) => setTimeout(r, config.worker.retryDelayMs));
    }
  }
}

module.exports = { startAlertConsumer, shouldCreateIncident };