/**
 * Email Service - Sends email notifications using Nodemailer
 */
const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.testEmails = []; // Store emails in test mode
  }

  /**
   * Initialize the email transporter
   */
  async initialize() {
    if (config.email.testMode) {
      logger.info('Email service running in TEST MODE - emails will be logged only');
      return;
    }

    if (!config.email.enabled) {
      logger.info('Email service is DISABLED');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: {
        user: config.email.auth.user,
        pass: config.email.auth.pass
      }
    });

    // Verify connection
    try {
      await this.transporter.verify();
      logger.info('Email transporter verified and ready');
    } catch (error) {
      logger.error('Email transporter verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Send incident assignment email
   */
  async sendIncidentAssignment(notification) {
    const { incident, engineer } = notification;

    const subject = `[${incident.severity.toUpperCase()}] Incident Assigned: ${incident.title}`;
    
    const html = this._buildIncidentEmailHtml(incident, engineer);
    const text = this._buildIncidentEmailText(incident, engineer);

    return this.send({
      to: engineer.email,
      subject,
      html,
      text
    });
  }

  /**
   * Send generic email
   */
  async send({ to, subject, html, text }) {
    const mailOptions = {
      from: config.email.from,
      to,
      subject,
      html,
      text
    };

    // Test mode - just log
    if (config.email.testMode) {
      logger.info('TEST MODE - Email would be sent:', {
        to,
        subject,
        preview: text.substring(0, 100) + '...'
      });
      this.testEmails.push(mailOptions);
      return { messageId: `test-${Date.now()}`, testMode: true };
    }

    // Disabled
    if (!config.email.enabled || !this.transporter) {
      logger.warn('Email not sent - service disabled', { to, subject });
      return { skipped: true, reason: 'disabled' };
    }

    // Send for real
    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', {
        messageId: info.messageId,
        to,
        subject
      });
      return info;
    } catch (error) {
      logger.error('Failed to send email:', {
        error: error.message,
        to,
        subject
      });
      throw error;
    }
  }

  /**
   * Build HTML email content for incident assignment
   */
  _buildIncidentEmailHtml(incident, engineer) {
    const severityColor = {
      critical: '#dc3545',
      high: '#fd7e14',
      warning: '#ffc107',
      low: '#28a745',
      info: '#17a2b8'
    }[incident.severity] || '#6c757d';

    const incidentUrl = `${config.dashboardUrl}/incidents/${incident.id}`;

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${severityColor}; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #495057; }
    .value { margin-top: 5px; }
    .severity-badge { 
      display: inline-block; 
      padding: 4px 12px; 
      border-radius: 4px; 
      background: ${severityColor}; 
      color: white; 
      font-weight: bold;
      text-transform: uppercase;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin-top: 15px;
      margin-right: 10px;
    }
    .button-ack {
      display: inline-block;
      padding: 12px 24px;
      background: #28a745;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      margin-top: 15px;
      font-weight: bold;
    }
    .footer { padding: 15px; font-size: 12px; color: #6c757d; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">🚨 Incident Assigned to You</h2>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Incident ID</div>
        <div class="value">#${incident.id}</div>
      </div>
      <div class="field">
        <div class="label">Title</div>
        <div class="value">${incident.title}</div>
      </div>
      <div class="field">
        <div class="label">Severity</div>
        <div class="value"><span class="severity-badge">${incident.severity}</span></div>
      </div>
      <div class="field">
        <div class="label">Description</div>
        <div class="value">${incident.description || 'No description provided'}</div>
      </div>
      <div class="field">
        <div class="label">Created At</div>
        <div class="value">${new Date(incident.created_at).toLocaleString()}</div>
      </div>
      <div class="field">
        <div class="label">Assigned To</div>
        <div class="value">${engineer.name} (${engineer.email})</div>
      </div>
      ${incident.ack_token ? `<a href="${config.incidentApiUrl}/api/incidents/ack/${incident.ack_token}" class="button-ack">✅ ACKNOWLEDGE NOW</a>` : ''}
      <a href="${incidentUrl}" class="button">View Details</a>
    </div>
    <div class="footer">
      <p>This is an automated notification from the Incident Management Platform.</p>
      <p>Click "ACKNOWLEDGE NOW" to confirm you've received this incident.</p>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Build plain text email content for incident assignment
   */
  _buildIncidentEmailText(incident, engineer) {
    const ackLink = incident.ack_token 
      ? `\n✅ ACKNOWLEDGE NOW: ${config.incidentApiUrl}/api/incidents/ack/${incident.ack_token}\n`
      : '';

    return `
🚨 INCIDENT ASSIGNED TO YOU

Incident ID: #${incident.id}
Title: ${incident.title}
Severity: ${incident.severity.toUpperCase()}
Description: ${incident.description || 'No description provided'}
Created At: ${new Date(incident.created_at).toLocaleString()}
Assigned To: ${engineer.name} (${engineer.email})
${ackLink}
View Incident: ${config.dashboardUrl}/incidents/${incident.id}

---
This is an automated notification from the Incident Management Platform.
Click the ACKNOWLEDGE link to confirm you've received this incident.
`.trim();
  }

  /**
   * Get test emails (for testing purposes)
   */
  getTestEmails() {
    return this.testEmails;
  }

  /**
   * Clear test emails
   */
  clearTestEmails() {
    this.testEmails = [];
  }
}

module.exports = new EmailService();
