const { Router } = require('express');
const rotationService = require('../services/rotationService');

const router = Router();

// GET /api/oncall/current – Who is on call right now?
router.get('/current', async (req, res) => {
  try {
    const scheduleId = req.query.schedule_id;
    const current = await rotationService.getCurrentOnCall(scheduleId);
    res.json(current);
  } catch (err) {
    console.error('[oncall] Error getting current on-call:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/oncall/next – Who is next on call?
router.get('/next', async (req, res) => {
  try {
    const scheduleId = req.query.schedule_id;
    const next = await rotationService.getNextOnCall(scheduleId);
    res.json(next);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
