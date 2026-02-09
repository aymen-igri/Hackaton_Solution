const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/queries');
const correlationService = require('../services/correlationService');
const { alertsReceived, alertProcessingDuration } = require('../metrics');

const router = Router();

// POST /api/alerts  – Ingest a new alert
router.post('/', async (req, res) => {
  const end = alertProcessingDuration.startTimer();
  try {
    const { source, severity, title, description, labels } = req.body;

    if (!source || !severity || !title) {
      return res.status(400).json({ error: 'source, severity, and title are required' });
    }

    const alert = {
      id: uuidv4(),
      source,
      severity,
      title,
      description: description || '',
      labels: labels || {},
      received_at: new Date().toISOString(),
    };

    // Persist alert
    await db.insertAlert(alert);
    alertsReceived.inc({ source, severity });

    // Correlate – may attach to existing incident or create a new one
    const incident = await correlationService.correlate(alert);

    end();
    res.status(201).json({ alert, incident });
  } catch (err) {
    end();
    console.error('[alerts] Error ingesting alert:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/alerts  – List recent alerts
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const alerts = await db.getRecentAlerts(limit);
    res.json(alerts);
  } catch (err) {
    console.error('[alerts] Error fetching alerts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/alerts/:id
router.get('/:id', async (req, res) => {
  try {
    const alert = await db.getAlertById(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
