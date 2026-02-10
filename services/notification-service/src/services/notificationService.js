/**
 * Notification Service - Orchestrates email and SMS notifications
 */
const emailService = require('./emailService');
const smsService = require('./smsService');
const config = require('../config');
const logger = require('../logger');

class NotificationService {
  constructor() {
    this.notificationHistory = [];
  }

  /**
   * Initialize all notification channels
   */
  async initialize() {
    logger.info('Initializing notification services...');
    
    await Promise.all([
      emailService.initialize(),
      smsService.initialize()
    ]);

    logger.info('All notification services initialized');
  }

  /**
   * Send notifications for incident assignment
   * This is the main entry point called by the notification worker
   */
  async sendIncidentAssignmentNotification(data) {
    const { incident, engineer, channels = ['email', 'sms'] } = data;

    logger.info('Sending incident assignment notification', {
      incidentId: incident.id,
      engineerId: engineer.id,
      engineerName: engineer.name,
      channels
    });

    const results = {
      incidentId: incident.id,
      engineerId: engineer.id,
      timestamp: new Date().toISOString(),
      channels: {}
    };

    // Send email if requested
    if (channels.includes('email') && engineer.email) {
      try {
        results.channels.email = await emailService.sendIncidentAssignment({ incident, engineer });
        results.channels.email.success = true;
      } catch (error) {
        results.channels.email = {
          success: false,
          error: error.message
        };
        logger.error('Email notification failed', {
          incidentId: incident.id,
          error: error.message
        });
      }
    }

    // Send SMS if requested
    if (channels.includes('sms') && engineer.phone) {
      try {
        results.channels.sms = await smsService.sendIncidentAssignment({ incident, engineer });
        results.channels.sms.success = true;
      } catch (error) {
        results.channels.sms = {
          success: false,
          error: error.message
        };
        logger.error('SMS notification failed', {
          incidentId: incident.id,
          error: error.message
        });
      }
    }

    // Track notification
    this._trackNotification(results);

    // Determine overall success
    const anySuccess = Object.values(results.channels).some(ch => ch.success);
    results.success = anySuccess;

    if (!anySuccess && Object.keys(results.channels).length > 0) {
      logger.error('All notification channels failed', { incidentId: incident.id });
    }

    return results;
  }

  /**
   * Send escalation notification (when incident not acknowledged in time)
   */
  async sendEscalationNotification(data) {
    const { incident, originalEngineer, escalatedTo, reason } = data;

    logger.info('Sending escalation notification', {
      incidentId: incident.id,
      originalEngineerId: originalEngineer?.id,
      escalatedToId: escalatedTo.id,
      reason
    });

    const results = {
      incidentId: incident.id,
      type: 'escalation',
      timestamp: new Date().toISOString(),
      channels: {}
    };

    // Notify escalated engineer
    const escalationIncident = {
      ...incident,
      title: `[ESCALATED] ${incident.title}`,
      description: `${reason}\n\nOriginal assignee: ${originalEngineer?.name || 'Unknown'}\n\n${incident.description || ''}`
    };

    try {
      results.channels.email = await emailService.sendIncidentAssignment({
        incident: escalationIncident,
        engineer: escalatedTo
      });
      results.channels.email.success = true;
    } catch (error) {
      results.channels.email = { success: false, error: error.message };
    }

    try {
      results.channels.sms = await smsService.sendIncidentAssignment({
        incident: escalationIncident,
        engineer: escalatedTo
      });
      results.channels.sms.success = true;
    } catch (error) {
      results.channels.sms = { success: false, error: error.message };
    }

    this._trackNotification(results);
    return results;
  }

  /**
   * Send incident resolved notification
   */
  async sendIncidentResolvedNotification(data) {
    const { incident, resolvedBy, stakeholders = [] } = data;

    logger.info('Sending incident resolved notification', {
      incidentId: incident.id,
      resolvedBy: resolvedBy?.name,
      stakeholderCount: stakeholders.length
    });

    const results = {
      incidentId: incident.id,
      type: 'resolved',
      timestamp: new Date().toISOString(),
      notified: []
    };

    // Notify all stakeholders
    for (const stakeholder of stakeholders) {
      try {
        if (stakeholder.email) {
          await emailService.send({
            to: stakeholder.email,
            subject: `✅ Incident #${incident.id} Resolved: ${incident.title}`,
            text: `Incident #${incident.id} has been resolved by ${resolvedBy?.name || 'Unknown'}.\n\nTitle: ${incident.title}\nResolution: ${incident.resolution || 'Not specified'}`,
            html: `<h2>✅ Incident Resolved</h2><p>Incident #${incident.id} has been resolved by ${resolvedBy?.name || 'Unknown'}.</p><p><strong>Title:</strong> ${incident.title}</p><p><strong>Resolution:</strong> ${incident.resolution || 'Not specified'}</p>`
          });
          results.notified.push({ id: stakeholder.id, channel: 'email', success: true });
        }
      } catch (error) {
        results.notified.push({ id: stakeholder.id, channel: 'email', success: false, error: error.message });
      }
    }

    this._trackNotification(results);
    return results;
  }

  /**
   * Track notification in history
   */
  _trackNotification(notification) {
    this.notificationHistory.unshift(notification);
    // Keep only last 1000 notifications in memory
    if (this.notificationHistory.length > 1000) {
      this.notificationHistory.pop();
    }
  }

  /**
   * Get notification history
   */
  getHistory(limit = 50) {
    return this.notificationHistory.slice(0, limit);
  }

  /**
   * Get notification stats
   */
  getStats() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentNotifications = this.notificationHistory.filter(
      n => new Date(n.timestamp).getTime() > oneHourAgo
    );

    const dailyNotifications = this.notificationHistory.filter(
      n => new Date(n.timestamp).getTime() > oneDayAgo
    );

    return {
      total: this.notificationHistory.length,
      lastHour: recentNotifications.length,
      last24Hours: dailyNotifications.length,
      byChannel: {
        email: {
          total: this.notificationHistory.filter(n => n.channels?.email).length,
          success: this.notificationHistory.filter(n => n.channels?.email?.success).length
        },
        sms: {
          total: this.notificationHistory.filter(n => n.channels?.sms).length,
          success: this.notificationHistory.filter(n => n.channels?.sms?.success).length
        }
      }
    };
  }
}

module.exports = new NotificationService();
