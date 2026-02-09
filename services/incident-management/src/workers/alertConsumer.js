const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const config = require('../config');
const redis = require('../redis');

// IMPORTANT: BRPOP blocks the connection, so we need a DEDICATED connection for it
const brpopRedis = new Redis(config.redisUrl);

const pool = new Pool({ connectionString: config.databaseUrl });

/**
 * Process a single alert from the queue:
 *   1. Create an incident in PostgreSQL
 *   2. Link alert → incident
 *   3. Push incident to incidents:queue
 */
async function processAlert(alertData) {
  const id = uuidv4();
  const now = new Date().toISOString();

  // 1. Create incident
  const sql = `
    INSERT INTO incidents (id, title, severity, source, description, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'open', $6, $6)
    RETURNING *`;
  const { rows } = await pool.query(sql, [
    id,
    alertData.title,
    alertData.severity,
    alertData.source,
    alertData.description || '',
    now,
  ]);
  const incident = rows[0];

  // 2. Link alert to incident
  if (alertData.alert_id) {
    await pool.query(
      'INSERT INTO incident_alerts (alert_id, incident_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [alertData.alert_id, id],
    );
  }

  console.log(`[alertConsumer] ✅ Incident ${id} created from alert ${alertData.alert_id}`);

  // 3. Push to incidents:queue for the incidentWorker to pick up
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

  console.log(`[alertConsumer] → Pushed incident ${id} to "${config.queues.incidents}"`);
}

/**
 * Main loop — blocks on BRPOP waiting for messages
 */
async function startAlertConsumer() {
  console.log(`[alertConsumer] 🟢 Listening on "${config.queues.alerts}"...`);

  while (true) {
    try {
      // BRPOP blocks until a message arrives (or timeout)
      const result = await brpopRedis.brpop(config.queues.alerts, config.worker.brpopTimeoutSec);

      if (result) {
        const [, message] = result;   // result = ["alerts:queue", "{...json...}"]
        const alertData = JSON.parse(message);
        await processAlert(alertData);
      }
      // null means timeout — just loop and wait again
    } catch (err) {
      console.error('[alertConsumer] ❌ Error:', err.message);
      await new Promise((r) => setTimeout(r, config.worker.retryDelayMs));
    }
  }
}

module.exports = { startAlertConsumer };