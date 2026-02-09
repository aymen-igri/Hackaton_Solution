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
 *   1. Call on-call service to get current engineer
 *   2. Assign the incident to that engineer in PostgreSQL
 */
async function processIncident(incidentData) {
  const { incident_id } = incidentData;

  try {
    // 1. Get current on-call engineer
    const { data: oncallData } = await axios.get(
      `${config.oncallServiceUrl}/api/oncall/current`,
    );

    const engineer = oncallData.on_call;  // e.g. "alice@example.com"

    if (!engineer) {
      console.warn(`[incidentWorker] ⚠️ No on-call engineer found for incident ${incident_id}`);
      return;
    }

    // 2. Assign engineer to incident
    const now = new Date().toISOString();
    await pool.query(
      'UPDATE incidents SET assigned_to = $1, updated_at = $2 WHERE id = $3',
      [engineer, now, incident_id],
    );

    console.log(`[incidentWorker] ✅ Incident ${incident_id} assigned to ${engineer}`);

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