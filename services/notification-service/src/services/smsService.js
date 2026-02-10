/**
 * SMS Service - Sends SMS notifications using Twilio
 */
const config = require('../config');
const logger = require('../logger');

class SmsService {
  constructor() {
    this.client = null;
    this.testMessages = []; // Store messages in test mode
  }

  /**
   * Initialize the Twilio client
   */
  async initialize() {
    if (config.sms.testMode) {
      logger.info('SMS service running in TEST MODE - messages will be logged only');
      return;
    }

    if (!config.sms.enabled) {
      logger.info('SMS service is DISABLED');
      return;
    }

    if (!config.sms.accountSid || !config.sms.authToken) {
      logger.warn('SMS service: Twilio credentials not configured');
      return;
    }

    try {
      const twilio = require('twilio');
      this.client = twilio(config.sms.accountSid, config.sms.authToken);
      logger.info('Twilio SMS client initialized');
    } catch (error) {
      logger.error('Failed to initialize Twilio client:', error.message);
      throw error;
    }
  }

  /**
   * Send incident assignment SMS
   */
  async sendIncidentAssignment(notification) {
    const { incident, engineer } = notification;

    if (!engineer.phone) {
      logger.warn('Cannot send SMS - engineer has no phone number', {
        engineerId: engineer.id,
        engineerName: engineer.name
      });
      return { skipped: true, reason: 'no_phone' };
    }

    const message = this._buildIncidentSmsMessage(incident, engineer);

    return this.send({
      to: engineer.phone,
      body: message
    });
  }

  /**
   * Send generic SMS
   */
  async send({ to, body }) {
    // Normalize phone number
    const normalizedPhone = this._normalizePhoneNumber(to);

    // Test mode - just log
    if (config.sms.testMode) {
      logger.info('TEST MODE - SMS would be sent:', {
        to: normalizedPhone,
        body: body.substring(0, 50) + '...'
      });
      this.testMessages.push({ to: normalizedPhone, body });
      return { sid: `test-${Date.now()}`, testMode: true };
    }

    // Disabled
    if (!config.sms.enabled || !this.client) {
      logger.warn('SMS not sent - service disabled', { to: normalizedPhone });
      return { skipped: true, reason: 'disabled' };
    }

    // Send for real
    try {
      const message = await this.client.messages.create({
        body,
        from: config.sms.fromNumber,
        to: normalizedPhone
      });

      logger.info('SMS sent successfully', {
        sid: message.sid,
        to: normalizedPhone,
        status: message.status
      });

      return {
        sid: message.sid,
        status: message.status
      };
    } catch (error) {
      logger.error('Failed to send SMS:', {
        error: error.message,
        code: error.code,
        to: normalizedPhone
      });
      throw error;
    }
  }

  /**
   * Build SMS message for incident assignment
   */
  _buildIncidentSmsMessage(incident, engineer) {
    const severityEmoji = {
      critical: '🔴',
      high: '🟠',
      warning: '🟡',
      low: '🟢',
      info: '🔵'
    }[incident.severity] || '⚪';

    // If ack_token exists, use magic link for acknowledgment
    if (incident.ack_token) {
      const ackUrl = `${config.dashboardUrl}/acknowledge/${incident.ack_token}`;
      return `${severityEmoji} INCIDENT #${incident.id.substring(0, 8)}
${incident.severity.toUpperCase()}: ${incident.title.substring(0, 40)}
ACK: ${ackUrl}`;
    }

    // Fallback without ack link
    const shortUrl = `${config.dashboardUrl}/i/${incident.id}`;
    return `${severityEmoji} INCIDENT #${incident.id.substring(0, 8)}
${incident.severity.toUpperCase()}: ${incident.title.substring(0, 50)}
View: ${shortUrl}`;
  }

  /**
   * Normalize phone number to E.164 format
   */
  _normalizePhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // If doesn't start with +, assume it needs country code
    if (!cleaned.startsWith('+')) {
      // Default to US (+1) if no country code
      // You can change this based on your needs
      cleaned = '+1' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Get test messages (for testing purposes)
   */
  getTestMessages() {
    return this.testMessages;
  }

  /**
   * Clear test messages
   */
  clearTestMessages() {
    this.testMessages = [];
  }
}

module.exports = new SmsService();
