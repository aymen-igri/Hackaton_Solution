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

// GET /api/oncall/rotation – Get primary and secondary on-call (for assignment & escalation)
router.get('/rotation', async (req, res) => {
  try {
    const scheduleId = req.query.schedule_id;
    const rotation = await rotationService.getPrimaryAndSecondary(scheduleId);
    res.json(rotation);
  } catch (err) {
    console.error('[oncall] Error getting rotation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/oncall/engineer/:email – Get engineer details by email
router.get('/engineer/:email', async (req, res) => {
  try {
    const engineer = await rotationService.getEngineerByEmail(req.params.email);
    if (!engineer) {
      return res.status(404).json({ error: 'Engineer not found' });
    }
    res.json(engineer);
  } catch (err) {
    console.error('[oncall] Error getting engineer:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
