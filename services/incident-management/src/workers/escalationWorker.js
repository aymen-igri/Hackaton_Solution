const Redis = require('ioredis');
const axios = require('axios');
const { Pool } = require('pg');
const config = require('../config');
const redis = require('../redis');

const pool = new Pool({ connectionString: config.databaseUrl });


async function processEscalation(escalationData) {
  const { incident_id, primary_email, secondary_email } = escalationData;

  try {
    // 1. Check if incident is still open (not acknowledged)
    const { rows } = await pool.query(
      'SELECT * FROM incidents WHERE id = $1',
      [incident_id]
    );

    if (!rows.length) {
      console.log(`[escalationWorker]  Incident ${incident_id} not found, skipping`);
      return;
    }

    const incident = rows[0];

    if (incident.status !== 'open') {
      console.log(`[escalationWorker]  Incident ${incident_id} already ${incident.status}, no escalation needed`);
      return;
    }

    if (!secondary_email) {
      console.warn(`[escalationWorker]  No secondary engineer for incident ${incident_id}, cannot escalate`);
      return;
    }

    // 2. Get secondary engineer details
    let secondaryEngineer = null;
    try {
      const { data } = await axios.get(
        `${config.oncallServiceUrl}/api/oncall/engineer/${encodeURIComponent(secondary_email)}`,
      );
      secondaryEngineer = data;
    } catch (err) {
      console.warn(`[escalationWorker] Could not fetch engineer details for ${secondary_email}`);
      secondaryEngineer = { email: secondary_email, name: secondary_email.split('@')[0], phone: null };
    }

    // 3. Get primary engineer details for the escalation message
    let primaryEngineer = null;
    try {
      const { data } = await axios.get(
        `${config.oncallServiceUrl}/api/oncall/engineer/${encodeURIComponent(primary_email)}`,
      );
      primaryEngineer = data;
    } catch (err) {
      primaryEngineer = { email: primary_email, name: primary_email.split('@')[0] };
    }

    // 4. Reassign incident to secondary engineer
    const now = new Date().toISOString();
    const { rows: updated } = await pool.query(
      `UPDATE incidents 
       SET assigned_to = $1, updated_at = $2 
       WHERE id = $3 
       RETURNING *`,
      [secondary_email, now, incident_id],
    );

    console.log(`[escalationWorker]  ESCALATED: Incident ${incident_id} reassigned from ${primary_email} to ${secondary_email}`);

    // 5. Send escalation notification to secondary engineer
    const notificationPayload = {
      type: 'escalation',
      incident: {
        id: incident.id,
        title: `[ESCALATED] ${incident.title}`,
        severity: incident.severity,
        description: ` ESCALATED: Primary engineer (${primaryEngineer.name}) did not acknowledge within ${config.escalation.timeoutMinutes} minutes.\n\n${incident.description || ''}`,
        source: incident.source,
        status: incident.status,
        ack_token: incident.ack_token,
        created_at: incident.created_at,
      },
      engineer: secondaryEngineer,
      originalEngineer: primaryEngineer,
      channels: ['email', 'sms'],
      metadata: {
        assignment_type: 'escalation',
        reason: `Primary engineer (${primaryEngineer.name}) did not acknowledge within ${config.escalation.timeoutMinutes} minutes`,
        escalated_at: now,
      },
    };

    await redis.lpush(config.queues.notifications, JSON.stringify(notificationPayload));
    console.log(`[escalationWorker]  Escalation notification queued for ${secondary_email}`);

  } catch (err) {
    console.error(`[escalationWorker]  Failed to escalate incident ${incident_id}:`, err.message);
  }
}

async function startEscalationWorker() {
  console.log(`[escalationWorker] Started - checking every ${config.escalation.checkIntervalMs / 1000}s for unacknowledged incidents`);

  while (true) {
    try {
      const now = Date.now();

      // Get all escalations that are due (score <= now)
      const dueEscalations = await redis.zrangebyscore('escalation:pending', 0, now);

      for (const escalationJson of dueEscalations) {
        const escalationData = JSON.parse(escalationJson);

        // Process the escalation
        await processEscalation(escalationData);

        // Remove from sorted set
        await redis.zrem('escalation:pending', escalationJson);
      }

      if (dueEscalations.length > 0) {
        console.log(`[escalationWorker] Processed ${dueEscalations.length} escalation(s)`);
      }

    } catch (err) {
      console.error('[escalationWorker]  Error:', err.message);
    }

    await new Promise((r) => setTimeout(r, config.escalation.checkIntervalMs));
  }
}

module.exports = { startEscalationWorker };
