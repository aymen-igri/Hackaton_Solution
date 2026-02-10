/**
 * Notification Service Configuration
 */
module.exports = {
  // Server
  port: process.env.PORT || 8004,

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Queue names
  queues: {
    notifications: process.env.NOTIFICATION_QUEUE || 'notifications:queue',
    deadLetter: process.env.DEAD_LETTER_QUEUE || 'notifications:dead-letter'
  },

  // Email configuration (SMTP)
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    from: process.env.EMAIL_FROM || 'noreply@incident-platform.com',
    // For development/testing without real SMTP
    testMode: process.env.EMAIL_TEST_MODE === 'true'
  },

  // SMS configuration (Twilio)
  sms: {
    enabled: process.env.SMS_ENABLED === 'true',
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    // For development/testing without real Twilio
    testMode: process.env.SMS_TEST_MODE === 'true'
  },

  // Notification settings
  notification: {
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS) || 5000,
    batchSize: parseInt(process.env.BATCH_SIZE) || 10
  },

  // Incident dashboard URL (for links in notifications)
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:8080',
  
  // Incident management API URL (for acknowledge links)
  incidentApiUrl: process.env.INCIDENT_API_URL || 'http://localhost:8002'
};
