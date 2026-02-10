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

describe('Incident Management Service', () => {
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

  describe('Incident Status Validation', () => {
    test('should validate incident status values', () => {
      const validStatuses = ['open', 'acknowledged', 'resolved', 'closed'];
      const isValidStatus = (status) => validStatuses.includes(status);

      expect(isValidStatus('open')).toBe(true);
      expect(isValidStatus('acknowledged')).toBe(true);
      expect(isValidStatus('invalid')).toBe(false);
    });
  });

  describe('MTTA/MTTR Calculations', () => {
    test('should calculate MTTA in seconds', () => {
      const created = new Date('2026-02-09T08:00:00Z');
      const acknowledged = new Date('2026-02-09T08:05:30Z');
      const mtta = Math.floor((acknowledged - created) / 1000);

      expect(mtta).toBe(330);
    });

    test('should calculate MTTR in seconds', () => {
      const created = new Date('2026-02-09T08:00:00Z');
      const resolved = new Date('2026-02-09T09:15:00Z');
      const mttr = Math.floor((resolved - created) / 1000);

      expect(mttr).toBe(4500);
    });

    test('should handle null values for unresolved incidents', () => {
      const incident = {
        created_at: new Date().toISOString(),
        resolved_at: null
      };

      expect(incident.resolved_at).toBe(null);
    });
  });

  describe('Incident Data Validation', () => {
    test('should validate incident creation payload', () => {
      const validateIncident = (incident) => {
        return incident.title && incident.severity && incident.source;
      };

      const valid = { title: 'CPU High', severity: 'high', source: 'prometheus' };
      const invalid = { title: 'CPU High' };

      expect(validateIncident(valid)).toBe(true);
      expect(validateIncident(invalid)).toBe(false);
    });
  });
});
