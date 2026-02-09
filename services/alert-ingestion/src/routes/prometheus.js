const { Router } = require('express');
const { enqueueAlert, getStats } = require('../services/alertProcessor');

const router = Router();

/**
 * POST /api/prometheus/webhook
 * Receives alerts from Prometheus Alertmanager webhook
 *
 * Expected payload format:
 * {
 *   "version": "4",
 *   "groupKey": "{}:{alertname=\"HighMemoryUsage\"}",
 *   "status": "firing",
 *   "receiver": "webhook",
 *   "groupLabels": {...},
 *   "commonLabels": {...},
 *   "commonAnnotations": {...},
 *   "externalURL": "http://prometheus:9090",
 *   "alerts": [
 *     {
 *       "status": "firing",
 *       "labels": {
 *         "alertname": "HighMemoryUsage",
 *         "severity": "high",
 *         "instance": "api-server-03",
 *         "environment": "production"
 *       },
 *       "annotations": {
 *         "summary": "Memory usage above 85% for 5 minutes"
 *       },
 *       "startsAt": "2026-02-09T14:30:00Z",
 *       "endsAt": "0001-01-01T00:00:00Z",
 *       "generatorURL": "http://prometheus:9090/graph?...",
 *       "fingerprint": "abc123"
 *     }
 *   ]
 * }
 */
router.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;

    // Validate webhook payload
    if (!payload.alerts || !Array.isArray(payload.alerts)) {
      return res.status(400).json({
        error: 'Invalid payload: missing alerts array',
      });
    }

    console.log(`[Prometheus Webhook] Received ${payload.alerts.length} alerts`);

    // Enqueue each alert for processing
    const results = [];
    for (const alert of payload.alerts) {
      try {
        const job = await enqueueAlert(alert);
        results.push({
          success: true,
          jobId: job.jobId,
          alertname: alert.labels?.alertname,
        });
      } catch (err) {
        console.error(`[Prometheus Webhook] Failed to enqueue alert:`, err);
        results.push({
          success: false,
          error: err.message,
          alertname: alert.labels?.alertname,
        });
      }
    }

    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.status(200).json({
      message: 'Alerts received and queued for processing',
      summary: {
        total: payload.alerts.length,
        successful,
        failed,
      },
      results,
    });
  } catch (err) {
    console.error('[Prometheus Webhook] Error processing webhook:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  }
});

/**
 * GET /api/prometheus/stats
 * Get alert processing statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (err) {
    console.error('[Prometheus Stats] Error fetching stats:', err);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/prometheus/test
 * Test endpoint to verify Prometheus integration
 */
router.get('/test', (req, res) => {
  res.json({
    message: 'Prometheus webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

