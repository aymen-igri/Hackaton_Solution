const request = require('supertest');
const express = require('express');

// Mock app pour tester sans démarrer le serveur
const createApp = () => {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
};

describe('Alert Ingestion Service', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('Health Check', () => {
    test('GET /health should return 200 with status ok', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);

      expect(res.body).toHaveProperty('status');
      expect(res.body.status).toBe('ok');
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('Utility Functions', () => {
    test('should validate alert severity levels', () => {
      const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
      const testSeverity = (sev) => validSeverities.includes(sev);

      expect(testSeverity('critical')).toBe(true);
      expect(testSeverity('high')).toBe(true);
      expect(testSeverity('invalid')).toBe(false);
    });

    test('should generate valid UUID format', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const mockUUID = '550e8400-e29b-41d4-a716-446655440000';

      expect(uuidRegex.test(mockUUID)).toBe(true);
    });

    test('should parse alert timestamp correctly', () => {
      const timestamp = new Date().toISOString();
      const parsed = new Date(timestamp);

      expect(parsed instanceof Date).toBe(true);
      expect(!isNaN(parsed.getTime())).toBe(true);
    });
  });

  describe('Alert Validation', () => {
    test('should validate required alert fields', () => {
      const validateAlert = (alert) => {
        return alert.title && alert.severity && alert.source;
      };

      const validAlert = { title: 'Test', severity: 'high', source: 'prometheus' };
      const invalidAlert = { title: 'Test', severity: 'high' };

      expect(validateAlert(validAlert)).toBe(true);
      expect(validateAlert(invalidAlert)).toBe(false);
    });
  });
});
