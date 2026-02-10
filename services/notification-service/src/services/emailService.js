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
      // Only use auth if credentials provided (MailHog doesn't need auth)
      ...(config.email.auth.user && config.email.auth.pass && {
        auth: {
          user: config.email.auth.user,
          pass: config.email.auth.pass
        }
      })
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
    const incidentUrl = `${config.dashboardUrl}/incidents/${incident.id}`;
    const ackUrl = incident.ack_token ? `${config.dashboardUrl}/acknowledge/${incident.ack_token}` : null;

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 40px auto; padding: 40px; background: #ffffff; text-align: center; }
    h1 { color: #000000; font-size: 24px; margin-bottom: 30px; }
    p { color: #000000; font-size: 16px; margin: 10px 0; }
    .info { text-align: left; margin: 30px 0; padding: 20px; background: #fafafa; }
    .info p { margin: 8px 0; }
    .label { font-weight: bold; }
    a.button { display: inline-block; padding: 15px 30px; margin: 10px; background: #000000; color: #ffffff; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Incident Assigned to You</h1>
    <div class="info">
      <p><span class="label">ID:</span> ${incident.id}</p>
      <p><span class="label">Title:</span> ${incident.title}</p>
      <p><span class="label">Severity:</span> ${incident.severity.toUpperCase()}</p>
      <p><span class="label">Description:</span> ${incident.description || 'No description'}</p>
      <p><span class="label">Assigned To:</span> ${engineer.name} (${engineer.email})</p>
    </div>
    ${ackUrl ? `<a href="${ackUrl}" class="button">ACKNOWLEDGE</a>` : ''}
    <a href="${incidentUrl}" class="button">VIEW DETAILS</a>
  </div>
</body>
</html>`;
  }

  /**
   * Build plain text email content for incident assignment
   */
  _buildIncidentEmailText(incident, engineer) {
    const ackLink = incident.ack_token 
      ? `\nACKNOWLEDGE NOW: ${config.dashboardUrl}/acknowledge/${incident.ack_token}\n`
      : '';

    return `
 INCIDENT ASSIGNED TO YOU

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
   * Send acknowledgment confirmation email with resolve link
   */
  async sendAcknowledgmentConfirmation(notification) {
    const { incident, engineer, resolveUrl } = notification;

    const subject = `Incident #${incident.id} Acknowledged - Resolve Link`;
    
    const html = this._buildAcknowledgmentConfirmationHtml(incident, engineer, resolveUrl);
    const text = this._buildAcknowledgmentConfirmationText(incident, engineer, resolveUrl);

    return this.send({
      to: engineer.email,
      subject,
      html,
      text
    });
  }

  /**
   * Build HTML email for acknowledgment confirmation
   */
  _buildAcknowledgmentConfirmationHtml(incident, engineer, resolveUrl) {
    const incidentUrl = `${config.dashboardUrl}/incidents/${incident.id}`;

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 40px auto; padding: 40px; background: #ffffff; text-align: center; }
    h1 { color: #000000; font-size: 24px; margin-bottom: 30px; }
    p { color: #000000; font-size: 16px; margin: 10px 0; }
    .info { text-align: left; margin: 30px 0; padding: 20px; background: #fafafa; }
    .info p { margin: 8px 0; }
    .label { font-weight: bold; }
    a.button { display: inline-block; padding: 15px 30px; margin: 10px; background: #000000; color: #ffffff; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Incident Acknowledged</h1>
    <p>Thank you. You have acknowledged this incident.</p>
    <div class="info">
      <p><span class="label">ID:</span> ${incident.id}</p>
      <p><span class="label">Title:</span> ${incident.title}</p>
      <p><span class="label">Severity:</span> ${incident.severity.toUpperCase()}</p>
      <p><span class="label">Status:</span> ACKNOWLEDGED - awaiting resolution</p>
      <p><span class="label">Acknowledged By:</span> ${engineer.name} (${engineer.email})</p>
    </div>
    <p>Once fixed, click below to resolve:</p>
    <a href="${resolveUrl}" class="button">RESOLVE INCIDENT</a>
    <a href="${incidentUrl}" class="button">VIEW DETAILS</a>
  </div>
</body>
</html>`;
  }

  /**
   * Build plain text for acknowledgment confirmation
   */
  _buildAcknowledgmentConfirmationText(incident, engineer, resolveUrl) {
    return `
 INCIDENT ACKNOWLEDGED

Thank you! You have successfully acknowledged this incident.

---

Incident ID: #${incident.id}
Title: ${incident.title}
Severity: ${incident.severity.toUpperCase()}
Status: ACKNOWLEDGED - awaiting resolution
Acknowledged By: ${engineer.name} (${engineer.email})
Acknowledged At: ${new Date().toLocaleString()}

---

NEXT STEP: Once you've fixed the issue, click the link below to mark it as resolved.

🔧 RESOLVE INCIDENT: ${resolveUrl}

View Incident: ${config.dashboardUrl}/incidents/${incident.id}

---
This is an automated notification from the Incident Management Platform.
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
