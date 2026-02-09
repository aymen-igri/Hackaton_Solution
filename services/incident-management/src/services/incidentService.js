const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * incidentService – MTTA / MTTR calculation
 *
 * MTTA = Mean Time To Acknowledge
 *   avg(acknowledged_at - created_at) for acknowledged or resolved incidents
 *
 * MTTR = Mean Time To Resolve
 *   avg(resolved_at - created_at) for resolved incidents
 */

async function computeSREMetrics() {
  // MTTA – only incidents that have been acknowledged
  const mttaResult = await pool.query(`
    SELECT
      AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at))) AS mtta_seconds,
      COUNT(*) AS acknowledged_count
    FROM incidents
    WHERE acknowledged_at IS NOT NULL
  `);

  // MTTR – only incidents that have been resolved
  const mttrResult = await pool.query(`
    SELECT
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) AS mttr_seconds,
      COUNT(*) AS resolved_count
    FROM incidents
    WHERE resolved_at IS NOT NULL
  `);

  // Current open incidents
  const openResult = await pool.query(`
    SELECT COUNT(*) AS open_count FROM incidents WHERE status = 'open'
  `);

  const mtta = mttaResult.rows[0];
  const mttr = mttrResult.rows[0];

  return {
    mtta: {
      seconds: parseFloat(mtta.mtta_seconds) || 0,
      human: formatDuration(parseFloat(mtta.mtta_seconds) || 0),
      sample_size: parseInt(mtta.acknowledged_count),
    },
    mttr: {
      seconds: parseFloat(mttr.mttr_seconds) || 0,
      human: formatDuration(parseFloat(mttr.mttr_seconds) || 0),
      sample_size: parseInt(mttr.resolved_count),
    },
    open_incidents: parseInt(openResult.rows[0].open_count),
    computed_at: new Date().toISOString(),
  };
}

function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

module.exports = { computeSREMetrics };
