const request = require('supertest');
const express = require('express');

const createApp = () => {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
};

describe('Notification Service', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('Health Check', () => {
    test('GET /health should return 200', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
    });
  });

  describe('Notification Channel Validation', () => {
    test('should validate supported channels', () => {
      const validChannels = ['email', 'sms', 'slack', 'webhook'];
      const isValidChannel = (channel) => validChannels.includes(channel);

      expect(isValidChannel('email')).toBe(true);
      expect(isValidChannel('telegram')).toBe(false);
    });
  });

  describe('Email Formatting', () => {
    test('should format email subject correctly', () => {
      const formatSubject = (severity, title) => {
        return `[${severity.toUpperCase()}] ${title}`;
      };

      expect(formatSubject('critical', 'Database Down')).toBe('[CRITICAL] Database Down');
    });

    test('should validate email recipient', () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test('user@example.com')).toBe(true);
    });
  });

  describe('Notification Payload', () => {
    test('should have required notification fields', () => {
      const validatePayload = (payload) => {
        return payload.channel && payload.recipient && payload.message;
      };

      const valid = {
        channel: 'email',
        recipient: 'user@example.com',
        message: 'Alert triggered'
      };

      const invalid = { channel: 'email', recipient: 'user@example.com' };

      expect(validatePayload(valid)).toBe(true);
      expect(validatePayload(invalid)).toBe(false);
    });
  });
});
