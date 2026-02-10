/**
 * Health check routes for notification service
 */
const express = require('express');
const router = express.Router();
const redis = require('../redis');
const notificationWorker = require('../workers/notificationWorker');
const notificationService = require('../services/notificationService');
const config = require('../config');

/**
 * Basic health check
 */
router.get('/', async (req, res) => {
  try {
    // Check Redis connection
    const redisPing = await redis.ping();
    const redisOk = redisPing === 'PONG';

    const workerStats = notificationWorker.getStats();
    const notificationStats = notificationService.getStats();

    const healthy = redisOk && workerStats.running;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'notification-service',
      checks: {
        redis: redisOk ? 'ok' : 'error',
        worker: workerStats.running ? 'running' : 'stopped'
      },
      stats: {
        worker: workerStats,
        notifications: notificationStats
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Readiness check
 */
router.get('/ready', async (req, res) => {
  try {
    await redis.ping();
    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, error: error.message });
  }
});

/**
 * Liveness check
 */
router.get('/live', (req, res) => {
  res.status(200).json({ alive: true });
});

/**
 * Get queue stats
 */
router.get('/queue', async (req, res) => {
  try {
    const queueLength = await redis.llen(config.queues.notifications);
    const deadLetterLength = await redis.llen(config.queues.deadLetter);

    res.json({
      queues: {
        notifications: {
          name: config.queues.notifications,
          length: queueLength
        },
        deadLetter: {
          name: config.queues.deadLetter,
          length: deadLetterLength
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
