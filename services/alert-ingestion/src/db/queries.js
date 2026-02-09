const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({ connectionString: config.databaseUrl });

// ─── Generic query helper ──────────────────────────────────
async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}

// ─── Alerts ────────────────────────────────────────────────
async function insertAlert(alert) {
  const sql = `
    INSERT INTO alerts (id, source, severity, title, description, labels, received_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`;
  const values = [alert.id, alert.source, alert.severity, alert.title, alert.description, JSON.stringify(alert.labels), alert.received_at];
  const { rows } = await pool.query(sql, values);
  return rows[0];
}

async function getRecentAlerts(limit = 50) {
  const { rows } = await pool.query('SELECT * FROM alerts ORDER BY received_at DESC LIMIT $1', [limit]);
  return rows;
}

async function getAlertById(id) {
  const { rows } = await pool.query('SELECT * FROM alerts WHERE id = $1', [id]);
  return rows[0] || null;
}

// ─── Correlation helpers ───────────────────────────────────
async function findOpenIncidentsBySourceAndWindow(source, windowMs) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const sql = `
    SELECT * FROM incidents
    WHERE source = $1
      AND status IN ('open', 'acknowledged')
      AND created_at >= $2
    ORDER BY created_at DESC`;
  const { rows } = await pool.query(sql, [source, since]);
  return rows;
}

async function linkAlertToIncident(alertId, incidentId) {
  const sql = `
    INSERT INTO incident_alerts (alert_id, incident_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING`;
  await pool.query(sql, [alertId, incidentId]);
}

module.exports = {
  query,
  insertAlert,
  getRecentAlerts,
  getAlertById,
  findOpenIncidentsBySourceAndWindow,
  linkAlertToIncident,
};
