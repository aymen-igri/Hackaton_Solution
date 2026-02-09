const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const incidentService = require('../services/incidentService');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

// POST /api/incidents – Create incident
router.post('/', async (req, res) => {
  try {
    const { title, severity, source, description, alert_id } = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO incidents (id, title, severity, source, description, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'open', $6, $6)
      RETURNING *`;
    const { rows } = await pool.query(sql, [id, title, severity, source, description || '', now, now]);

    // Link the originating alert
    if (alert_id) {
      await pool.query(
        'INSERT INTO incident_alerts (alert_id, incident_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [alert_id, id],
      );
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[incidents] Error creating incident:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/incidents – List incidents
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status; // optional filter
    let sql = 'SELECT * FROM incidents';
    const params = [];
    if (status) {
      sql += ' WHERE status = $1';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/incidents/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM incidents WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Incident not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/incidents/:id – Update status (acknowledge, resolve)
router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const now = new Date().toISOString();
    const validStatuses = ['open', 'acknowledged', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const extra = {};
    if (status === 'acknowledged') extra.acknowledged_at = now;
    if (status === 'resolved') extra.resolved_at = now;

    let setClauses = ['status = $1', 'updated_at = $2'];
    let params = [status, now];
    let idx = 3;
    for (const [col, val] of Object.entries(extra)) {
      setClauses.push(`${col} = $${idx}`);
      params.push(val);
      idx++;
    }
    params.push(req.params.id);

    const sql = `UPDATE incidents SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
    const { rows } = await pool.query(sql, params);
    if (!rows.length) return res.status(404).json({ error: 'Incident not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[incidents] Error updating incident:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/incidents/metrics/sre – MTTA / MTTR
router.get('/metrics/sre', async (_req, res) => {
  try {
    const metrics = await incidentService.computeSREMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
