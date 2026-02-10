const Redis = require('ioredis');
const axios = require('axios');
const { Pool } = require('pg');
const config = require('../config');
const redis = require('../redis');

// DEDICATED connection for BRPOP (separate from the shared one)
const brpopRedis = new Redis(config.redisUrl);

const pool = new Pool({ connectionString: config.databaseUrl });

/**
 * Process a single incident from the queue:
 *   1. Call on-call service to get primary and secondary engineers
 *   2. Assign the incident to the PRIMARY engineer in PostgreSQL
 *   3. Send notification to notifications:queue
 *   4. Schedule escalation check (5 minutes)
 */
async function processIncident(incidentData) {
  const { incident_id } = incidentData;

  try {
    // 1. Get primary and secondary on-call engineers
    const { data: rotationData } = await axios.get(
      `${config.oncallServiceUrl}/api/oncall/rotation`,
    );

    const primaryEmail = rotationData.primary;
    const secondaryEmail = rotationData.secondary;

    if (!primaryEmail) {
      console.warn(`[incidentWorker] ⚠️ No primary on-call engineer found for incident ${incident_id}`);
      return;
    }

    // 2. Get engineer details for notification
    let primaryEngineer = null;
    try {
      const { data } = await axios.get(
        `${config.oncallServiceUrl}/api/oncall/engineer/${encodeURIComponent(primaryEmail)}`,
      );
      primaryEngineer = data;
    } catch (err) {
      console.warn(`[incidentWorker] ⚠️ Could not fetch engineer details for ${primaryEmail}`);
      primaryEngineer = { email: primaryEmail, name: primaryEmail.split('@')[0], phone: null };
    }

    // 3. Assign primary engineer to incident
    const now = new Date().toISOString();
    const { rows } = await pool.query(
      `UPDATE incidents 
       SET assigned_to = $1, updated_at = $2 
       WHERE id = $3 
       RETURNING *`,
      [primaryEmail, now, incident_id],
    );

    if (!rows.length) {
      console.error(`[incidentWorker] ❌ Incident ${incident_id} not found in database`);
      return;
    }

    const incident = rows[0];
    console.log(`[incidentWorker] ✅ Incident ${incident_id} assigned to PRIMARY: ${primaryEmail}`);

    // 4. Send notification to the primary engineer
    const notificationPayload = {
      type: 'incident_assignment',
      incident: {
        id: incident.id,
        title: incident.title,
        severity: incident.severity,
        description: incident.description,
        source: incident.source,
        status: incident.status,
        ack_token: incident.ack_token,
        created_at: incident.created_at,
      },
      engineer: primaryEngineer,
      channels: ['email', 'sms'],
      metadata: {
        assignment_type: 'primary',
        secondary_email: secondaryEmail,
        escalation_at: new Date(Date.now() + config.escalation.timeoutMinutes * 60 * 1000).toISOString(),
      },
    };

    await redis.lpush(config.queues.notifications, JSON.stringify(notificationPayload));
    console.log(`[incidentWorker] 📧 Notification queued for ${primaryEmail}`);

    // 5. Schedule escalation check (will be picked up by escalation worker)
    const escalationPayload = {
      incident_id: incident.id,
      primary_email: primaryEmail,
      secondary_email: secondaryEmail,
      assigned_at: now,
      escalation_at: new Date(Date.now() + config.escalation.timeoutMinutes * 60 * 1000).toISOString(),
    };

    // Use ZADD with score = escalation timestamp for sorted set (easy to check due items)
    const escalationTime = Date.now() + config.escalation.timeoutMinutes * 60 * 1000;
    await redis.zadd('escalation:pending', escalationTime, JSON.stringify(escalationPayload));
    console.log(`[incidentWorker] ⏰ Escalation scheduled for ${config.escalation.timeoutMinutes} minutes`);

  } catch (err) {
    console.error(`[incidentWorker] ❌ Failed for incident ${incident_id}:`, err.message);

    // Retry logic — re-queue or send to dead-letter
    incidentData._retries = (incidentData._retries || 0) + 1;

    if (incidentData._retries < config.worker.maxRetries) {
      console.log(`[incidentWorker] 🔄 Re-queuing (retry ${incidentData._retries}/${config.worker.maxRetries})`);
      await redis.lpush(config.queues.incidents, JSON.stringify(incidentData));
    } else {
      console.error(`[incidentWorker] 💀 Max retries — moving to dead-letter queue`);
      await redis.lpush(config.queues.deadLetter, JSON.stringify(incidentData));
    }
  }
}

/**
 * Main loop — blocks on BRPOP waiting for incidents
 */
async function startIncidentWorker() {
  console.log(`[incidentWorker] 🟢 Listening on "${config.queues.incidents}"...`);

  while (true) {
    try {
      const result = await brpopRedis.brpop(config.queues.incidents, config.worker.brpopTimeoutSec);

      if (result) {
        const [, message] = result;
        const incidentData = JSON.parse(message);
        await processIncident(incidentData);
      }
    } catch (err) {
      console.error('[incidentWorker] ❌ Error:', err.message);
      await new Promise((r) => setTimeout(r, config.worker.retryDelayMs));
    }
  }
}

module.exports = { startIncidentWorker };