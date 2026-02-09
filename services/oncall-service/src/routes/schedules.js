const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

// POST /api/schedules – Create a rotation schedule
router.post('/', async (req, res) => {
  try {
    const { name, team_id, rotation_type, start_date, end_date, members } = req.body;
    if (!name || !rotation_type || !members?.length) {
      return res.status(400).json({ error: 'name, rotation_type, and members[] are required' });
    }

    const id = uuidv4();
    const sql = `
      INSERT INTO oncall_schedules (id, name, team_id, rotation_type, start_date, end_date, members, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *`;
    const { rows } = await pool.query(sql, [
      id, name, team_id || null, rotation_type,
      start_date || new Date().toISOString(),
      end_date || null,
      JSON.stringify(members),
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[schedules] Error creating schedule:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/schedules – List all schedules
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM oncall_schedules ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/schedules/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM oncall_schedules WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Schedule not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
