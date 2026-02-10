/**
 * Notification Service Server
 * 
 * Handles email and SMS notifications for incident management.
 * Consumes from notifications:queue after incidents are assigned.
 */
require('dotenv').config();

const express = require('express');
const config = require('./config');
const logger = require('./logger');
const notificationService = require('./services/notificationService');
const notificationWorker = require('./workers/notificationWorker');

// Routes
const healthRoutes = require('./routes/health');
const notificationRoutes = require('./routes/notifications');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.debug(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Routes
app.use('/health', healthRoutes);
app.use('/notifications', notificationRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'notification-service',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      notifications: '/notifications',
      queue: '/notifications/queue',
      send: '/notifications/send',
      history: '/notifications/history',
      stats: '/notifications/stats',
      testEmail: '/notifications/test/email',
      testSms: '/notifications/test/sms'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

/**
 * Start the server and worker
 */
async function start() {
  try {
    // Initialize notification services (email, sms)
    await notificationService.initialize();

    // Start Express server
    const server = app.listen(config.port, () => {
      logger.info(`Notification service listening on port ${config.port}`);
      logger.info(`Email enabled: ${config.email.enabled}, Test mode: ${config.email.testMode}`);
      logger.info(`SMS enabled: ${config.sms.enabled}, Test mode: ${config.sms.testMode}`);
    });

    // Start notification worker
    notificationWorker.start();

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      
      notificationWorker.stop();
      
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start notification service:', error);
    process.exit(1);
  }
}

start();

module.exports = app;
