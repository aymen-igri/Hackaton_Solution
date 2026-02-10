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

describe('Service Metrics', () => {
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
      expect(res.body).toHaveProperty('timestamp');
    });
  });

  describe('Prometheus Value Parsing', () => {
    test('should parse Prometheus vector format', () => {
      const parseVector = (result) => {
        return result.map(item => ({
          metric: item.metric,
          value: parseInt(item.value[1])
        }));
      };

      const input = [
        {
          metric: { job: 'mock-metrics' },
          value: [1707472205, '1234']
        }
      ];

      const output = parseVector(input);
      expect(output[0].value).toBe(1234);
      expect(typeof output[0].value).toBe('number');
    });
  });

  describe('Incident Summary Aggregation', () => {
    test('should aggregate incidents by service', () => {
      const aggregateByService = (incidents) => {
        const result = {};
        incidents.forEach(inc => {
          if (!result[inc.service]) {
            result[inc.service] = { open: 0, ack: 0, resolved: 0 };
          }
          result[inc.service][inc.status]++;
        });
        return result;
      };

      const incidents = [
        { service: 'platform', status: 'open' },
        { service: 'platform', status: 'acknowledged' },
        { service: 'api', status: 'resolved' }
      ];

      const result = aggregateByService(incidents);
      expect(result.platform.open).toBe(1);
      expect(result.platform.ack).toBe(1);
      expect(result.api.resolved).toBe(1);
    });
  });

  describe('MTTA/MTTR Calculation', () => {
    test('should calculate metrics in seconds', () => {
      const calculateMTTA = (createdAt, acknowledgedAt) => {
        const created = new Date(createdAt);
        const acked = new Date(acknowledgedAt);
        return Math.floor((acked - created) / 1000);
      };

      const mtta = calculateMTTA('2026-02-09T08:00:00Z', '2026-02-09T08:05:30Z');
      expect(mtta).toBe(330);
    });
  });

  describe('WebSocket Message Validation', () => {
    test('should validate WebSocket message format', () => {
      const validateWSMessage = (msg) => {
        return msg.type && msg.timestamp && msg.data;
      };

      const valid = {
        type: 'instant_metrics',
        timestamp: new Date().toISOString(),
        data: {}
      };

      const invalid = { type: 'instant_metrics' };

      expect(validateWSMessage(valid)).toBe(true);
      expect(validateWSMessage(invalid)).toBe(false);
    });
  });
});
