/**
 * Notification routes - Manual notification endpoints
 */
const express = require('express');
const router = express.Router();
const redis = require('../redis');
const config = require('../config');
const notificationService = require('../services/notificationService');
const logger = require('../logger');

/**
 * POST /notifications/send
 * Manually send a notification (bypasses queue)
 */
router.post('/send', async (req, res) => {
  try {
    const { type, incident, engineer, channels } = req.body;

    if (!type || !incident || !engineer) {
      return res.status(400).json({
        error: 'Missing required fields: type, incident, engineer'
      });
    }

    let result;
    switch (type) {
      case 'incident_assignment':
        result = await notificationService.sendIncidentAssignmentNotification({
          incident,
          engineer,
          channels
        });
        break;
      case 'escalation':
        result = await notificationService.sendEscalationNotification(req.body);
        break;
      case 'resolved':
        result = await notificationService.sendIncidentResolvedNotification(req.body);
        break;
      default:
        return res.status(400).json({ error: `Unknown notification type: ${type}` });
    }

    res.status(200).json(result);
  } catch (error) {
    logger.error('Manual notification send failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /notifications/queue
 * Add a notification to the queue (for processing by worker)
 */
router.post('/queue', async (req, res) => {
  try {
    const { type, incident, engineer, channels, metadata } = req.body;

    if (!type || !incident || !engineer) {
      return res.status(400).json({
        error: 'Missing required fields: type, incident, engineer'
      });
    }

    const message = {
      type,
      incident,
      engineer,
      channels: channels || ['email', 'sms'],
      metadata,
      queuedAt: new Date().toISOString()
    };

    await redis.lpush(config.queues.notifications, JSON.stringify(message));

    logger.info('Notification queued', {
      type,
      incidentId: incident.id,
      engineerId: engineer.id
    });

    res.status(202).json({
      message: 'Notification queued successfully',
      queueName: config.queues.notifications
    });
  } catch (error) {
    logger.error('Failed to queue notification:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /notifications/history
 * Get recent notification history
 */
router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const history = notificationService.getHistory(limit);
  res.json({ history, count: history.length });
});

/**
 * GET /notifications/stats
 * Get notification statistics
 */
router.get('/stats', (req, res) => {
  const stats = notificationService.getStats();
  res.json(stats);
});

/**
 * POST /notifications/test/email
 * Send a test email (for configuration testing)
 */
router.post('/test/email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Missing required field: to' });
    }

    const emailService = require('../services/emailService');
    const result = await emailService.send({
      to,
      subject: subject || 'Test Notification',
      text: body || 'This is a test email from the Incident Management Platform.',
      html: `<h2>Test Notification</h2><p>${body || 'This is a test email from the Incident Management Platform.'}</p>`
    });

    res.json({ success: true, result });
  } catch (error) {
    logger.error('Test email failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /notifications/test/sms
 * Send a test SMS (for configuration testing)
 */
router.post('/test/sms', async (req, res) => {
  try {
    const { to, body } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Missing required field: to' });
    }

    const smsService = require('../services/smsService');
    const result = await smsService.send({
      to,
      body: body || 'Test SMS from Incident Management Platform'
    });

    res.json({ success: true, result });
  } catch (error) {
    logger.error('Test SMS failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /notifications/dead-letter
 * View messages in dead letter queue
 */
router.get('/dead-letter', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const messages = await redis.lrange(config.queues.deadLetter, 0, limit - 1);
    
    const parsed = messages.map(m => {
      try {
        return JSON.parse(m);
      } catch {
        return { raw: m };
      }
    });

    res.json({
      queue: config.queues.deadLetter,
      count: parsed.length,
      messages: parsed
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /notifications/dead-letter
 * Clear dead letter queue
 */
router.delete('/dead-letter', async (req, res) => {
  try {
    const count = await redis.llen(config.queues.deadLetter);
    await redis.del(config.queues.deadLetter);
    
    logger.info(`Dead letter queue cleared: ${count} messages removed`);
    res.json({ message: 'Dead letter queue cleared', removedCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
