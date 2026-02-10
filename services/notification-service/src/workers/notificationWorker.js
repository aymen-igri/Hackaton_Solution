/**
 * Notification Worker - Consumes from notifications:queue
 * 
 * Expected message format:
 * {
 *   type: 'incident_assignment' | 'escalation' | 'resolved',
 *   incident: { id, title, severity, description, created_at, ... },
 *   engineer: { id, name, email, phone },
 *   channels: ['email', 'sms'], // optional, defaults to both
 *   metadata: { ... } // optional extra data
 * }
 */
const redis = require('../redis');
const config = require('../config');
const logger = require('../logger');
const notificationService = require('../services/notificationService');

class NotificationWorker {
  constructor() {
    this.running = false;
    this.processedCount = 0;
    this.errorCount = 0;
  }

  /**
   * Start the worker loop
   */
  async start() {
    if (this.running) {
      logger.warn('Notification worker is already running');
      return;
    }

    this.running = true;
    logger.info(`Notification worker started, listening on queue: ${config.queues.notifications}`);

    while (this.running) {
      try {
        await this.processNext();
      } catch (error) {
        logger.error('Worker loop error:', error.message);
        this.errorCount++;
        // Brief pause on error to prevent tight loop
        await this._sleep(1000);
      }
    }

    logger.info('Notification worker stopped');
  }

  /**
   * Stop the worker
   */
  stop() {
    logger.info('Stopping notification worker...');
    this.running = false;
  }

  /**
   * Process next message from queue
   */
  async processNext() {
    // BRPOP blocks until message available (timeout 5s to allow graceful shutdown)
    const result = await redis.brpop(config.queues.notifications, 5);

    if (!result) {
      // Timeout, no message - continue loop
      return;
    }

    const [queue, message] = result;
    logger.debug(`Received message from ${queue}`);

    let data;
    try {
      data = JSON.parse(message);
    } catch (parseError) {
      logger.error('Failed to parse notification message:', {
        error: parseError.message,
        message: message.substring(0, 200)
      });
      await this._sendToDeadLetter(message, 'parse_error');
      return;
    }

    // Process the notification
    await this.processNotification(data);
  }

  /**
   * Process a single notification
   */
  async processNotification(data) {
    const { type, incident, engineer, metadata } = data;

    if (!type || !incident || !engineer) {
      logger.error('Invalid notification data - missing required fields', {
        hasType: !!type,
        hasIncident: !!incident,
        hasEngineer: !!engineer
      });
      await this._sendToDeadLetter(JSON.stringify(data), 'invalid_data');
      return;
    }

    logger.info(`Processing ${type} notification`, {
      incidentId: incident.id,
      engineerId: engineer.id,
      engineerName: engineer.name
    });

    try {
      let result;

      switch (type) {
        case 'incident_assignment':
          result = await notificationService.sendIncidentAssignmentNotification(data);
          break;

        case 'escalation':
          result = await notificationService.sendEscalationNotification(data);
          break;

        case 'resolved':
          result = await notificationService.sendIncidentResolvedNotification(data);
          break;

        default:
          logger.warn(`Unknown notification type: ${type}`);
          await this._sendToDeadLetter(JSON.stringify(data), `unknown_type:${type}`);
          return;
      }

      this.processedCount++;
      logger.info(`Notification processed successfully`, {
        type,
        incidentId: incident.id,
        success: result.success
      });

    } catch (error) {
      logger.error(`Failed to process ${type} notification:`, {
        error: error.message,
        incidentId: incident.id
      });
      this.errorCount++;

      // Retry logic
      const retryCount = (data._retryCount || 0) + 1;
      if (retryCount <= config.notification.retryAttempts) {
        logger.info(`Scheduling retry ${retryCount}/${config.notification.retryAttempts}`);
        await this._scheduleRetry({ ...data, _retryCount: retryCount });
      } else {
        logger.error('Max retries exceeded, sending to dead letter queue');
        await this._sendToDeadLetter(JSON.stringify(data), 'max_retries');
      }
    }
  }

  /**
   * Schedule a retry
   */
  async _scheduleRetry(data) {
    // Simple retry: just push back to queue after delay
    await this._sleep(config.notification.retryDelayMs);
    await redis.lpush(config.queues.notifications, JSON.stringify(data));
  }

  /**
   * Send failed message to dead letter queue
   */
  async _sendToDeadLetter(message, reason) {
    const deadLetterEntry = {
      originalMessage: message,
      reason,
      timestamp: new Date().toISOString()
    };

    await redis.lpush(config.queues.deadLetter, JSON.stringify(deadLetterEntry));
    logger.warn(`Message sent to dead letter queue: ${reason}`);
  }

  /**
   * Get worker stats
   */
  getStats() {
    return {
      running: this.running,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      queueName: config.queues.notifications
    };
  }

  /**
   * Sleep utility
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new NotificationWorker();
