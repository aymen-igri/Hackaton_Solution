const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/incident_platform';

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// ─── Initialize ────────────────────────────────────────
async function init() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW()');
    console.log('[postgres-client] connection successful:', result.rows[0]);
  } finally {
    client.release();
  }
}

// ─── Get Incidents by Service ──────────────────────────
async function getIncidentsByService() {
  const query = `
    SELECT 
      source AS service,
      COUNT(*) AS total_incidents,
      COUNT(CASE WHEN status = 'open' THEN 1 END) AS open_count,
      COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) AS ack_count,
      COUNT(CASE WHEN status = 'resolved' THEN 1 END) AS resolved_count
    FROM incidents
    GROUP BY source
    ORDER BY open_count DESC
  `;

  try {
    const result = await pool.query(query);
    return {
      status: 'success',
      data: result.rows
    };
  } catch (err) {
    console.error('Error in getIncidentsByService:', err);
    throw err;
  }
}

// ─── Get Incidents with Details (MTTA, MTTR) ──────────
async function getIncidentsWithDetails() {
  const query = `
    SELECT 
      id,
      title,
      severity,
      source,
      status,
      created_at,
      acknowledged_at,
      resolved_at,
      EXTRACT(EPOCH FROM (acknowledged_at - created_at)) AS mtta_seconds,
      EXTRACT(EPOCH FROM (resolved_at - created_at)) AS mttr_seconds
    FROM incidents
    WHERE status != 'closed'
    ORDER BY created_at DESC
    LIMIT 100
  `;

  try {
    const result = await pool.query(query);
    return {
      status: 'success',
      data: result.rows
    };
  } catch (err) {
    console.error('Error in getIncidentsWithDetails:', err);
    throw err;
  }
}

// ─── Close connection ──────────────────────────────────
async function close() {
  await pool.end();
}

module.exports = {
  init,
  getIncidentsByService,
  getIncidentsWithDetails,
  close
};
