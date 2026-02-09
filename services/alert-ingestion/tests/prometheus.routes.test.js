const request = require('supertest');
const express = require('express');
const prometheusRoutes = require('../src/routes/prometheus');
const { getStats, resetStats } = require('../src/services/alertProcessor');

// Mock the alertProcessor
jest.mock('../src/services/alertProcessor', () => ({
  enqueueAlert: jest.fn(),
  getStats: jest.fn(),
  resetStats: jest.fn(),
  initializeProcessor: jest.fn(),
}));

describe('Prometheus Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/prometheus', prometheusRoutes);

    // Reset mocks
    jest.clearAllMocks();
    resetStats.mockClear();
  });

  describe('POST /api/prometheus/webhook', () => {
    it('should accept valid webhook payload', async () => {
      const { enqueueAlert } = require('../src/services/alertProcessor');
      enqueueAlert.mockResolvedValue({ jobId: '1', queueName: 'raw-alerts' });

      const payload = {
        version: '4',
        status: 'firing',
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'HighMemoryUsage',
              severity: 'high',
              instance: 'api-server-03',
            },
            annotations: {
              summary: 'Memory usage above 85%',
            },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Alerts received and queued for processing');
      expect(response.body.summary).toEqual({
        total: 1,
        successful: 1,
        failed: 0,
      });
      expect(enqueueAlert).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple alerts', async () => {
      const { enqueueAlert } = require('../src/services/alertProcessor');
      enqueueAlert.mockResolvedValue({ jobId: '1', queueName: 'raw-alerts' });

      const payload = {
        version: '4',
        status: 'firing',
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'Alert1', severity: 'high' },
            annotations: { summary: 'Test 1' },
            startsAt: '2026-02-09T14:30:00Z',
          },
          {
            status: 'firing',
            labels: { alertname: 'Alert2', severity: 'critical' },
            annotations: { summary: 'Test 2' },
            startsAt: '2026-02-09T14:31:00Z',
          },
          {
            status: 'firing',
            labels: { alertname: 'Alert3', severity: 'warning' },
            annotations: { summary: 'Test 3' },
            startsAt: '2026-02-09T14:32:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.summary).toEqual({
        total: 3,
        successful: 3,
        failed: 0,
      });
      expect(enqueueAlert).toHaveBeenCalledTimes(3);
    });

    it('should return 400 when alerts array is missing', async () => {
      const payload = {
        version: '4',
        status: 'firing',
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid payload: missing alerts array');
    });

    it('should return 400 when payload is not an object with alerts', async () => {
      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send({ something: 'else' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid payload: missing alerts array');
    });

    it('should handle enqueue failures gracefully', async () => {
      const { enqueueAlert } = require('../src/services/alertProcessor');
      enqueueAlert
        .mockResolvedValueOnce({ jobId: '1', queueName: 'raw-alerts' })
        .mockRejectedValueOnce(new Error('Queue error'))
        .mockResolvedValueOnce({ jobId: '3', queueName: 'raw-alerts' });

      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'Alert1', severity: 'high' },
            annotations: { summary: 'Test 1' },
            startsAt: '2026-02-09T14:30:00Z',
          },
          {
            status: 'firing',
            labels: { alertname: 'Alert2', severity: 'high' },
            annotations: { summary: 'Test 2' },
            startsAt: '2026-02-09T14:31:00Z',
          },
          {
            status: 'firing',
            labels: { alertname: 'Alert3', severity: 'high' },
            annotations: { summary: 'Test 3' },
            startsAt: '2026-02-09T14:32:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.summary).toEqual({
        total: 3,
        successful: 2,
        failed: 1,
      });
    });

    it('should include alertname in results', async () => {
      const { enqueueAlert } = require('../src/services/alertProcessor');
      enqueueAlert.mockResolvedValue({ jobId: '1', queueName: 'raw-alerts' });

      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'TestAlert', severity: 'high' },
            annotations: { summary: 'Test' },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.results[0]).toHaveProperty('alertname', 'TestAlert');
      expect(response.body.results[0]).toHaveProperty('success', true);
      expect(response.body.results[0]).toHaveProperty('jobId', '1');
    });
  });

  describe('GET /api/prometheus/stats', () => {
    it('should return processing statistics', async () => {
      getStats.mockReturnValue({
        processed: 100,
        verified: 95,
        normalized: 90,
        retried: 5,
        errors: 10,
        queues: {
          raw: 'raw-alerts',
          success: 'success-alerts',
          retry: 'retry-alerts',
          error: 'error-alerts',
        },
      });

      const response = await request(app)
        .get('/api/prometheus/stats')
        .expect(200);

      expect(response.body).toHaveProperty('processed', 100);
      expect(response.body).toHaveProperty('verified', 95);
      expect(response.body).toHaveProperty('normalized', 90);
      expect(response.body).toHaveProperty('retried', 5);
      expect(response.body).toHaveProperty('errors', 10);
      expect(response.body.queues).toHaveProperty('raw', 'raw-alerts');
      expect(getStats).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when getting stats', async () => {
      getStats.mockImplementation(() => {
        throw new Error('Stats error');
      });

      const response = await request(app)
        .get('/api/prometheus/stats')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('GET /api/prometheus/test', () => {
    it('should return test endpoint response', async () => {
      const response = await request(app)
        .get('/api/prometheus/test')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Prometheus webhook endpoint is active');
      expect(response.body).toHaveProperty('timestamp');

      // Verify timestamp is valid ISO string
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });
});

