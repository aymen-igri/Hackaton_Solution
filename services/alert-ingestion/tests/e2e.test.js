/**
 * End-to-End Test Suite
 *
 * Tests real scenarios from Prometheus webhook to queue processing
 */

const request = require('supertest');
const app = require('../src/server');

describe('E2E: Alert Ingestion Scenarios', () => {
  describe('Scenario 1: High Memory Alert', () => {
    it('should successfully process high memory alert', async () => {
      const payload = {
        version: '4',
        groupKey: '{}:{alertname="HighMemoryUsage"}',
        status: 'firing',
        receiver: 'webhook',
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'HighMemoryUsage',
              severity: 'high',
              instance: 'api-server-03',
              environment: 'production',
              team: 'platform',
              region: 'us-east-1',
            },
            annotations: {
              summary: 'Memory usage above 85% for 5 minutes',
              description: 'Instance api-server-03 has 92% memory usage',
            },
            startsAt: '2026-02-09T14:30:00Z',
            endsAt: '0001-01-01T00:00:00Z',
            generatorURL: 'http://prometheus:9090/graph?...',
            fingerprint: 'abc123def456',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.message).toBe('Alerts received and queued for processing');
      expect(response.body.summary.total).toBe(1);
      expect(response.body.summary.successful).toBe(1);
      expect(response.body.results[0].success).toBe(true);
      expect(response.body.results[0].alertname).toBe('HighMemoryUsage');
    });
  });

  describe('Scenario 2: Service Down Alert (Critical)', () => {
    it('should process critical service down alert', async () => {
      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'ServiceDown',
              severity: 'critical',
              instance: 'database-server-01',
              environment: 'production',
              team: 'infrastructure',
            },
            annotations: {
              summary: 'Service is down',
              description: 'Database service on database-server-01 is not responding',
            },
            startsAt: '2026-02-09T14:35:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.summary.successful).toBe(1);
    });
  });

  describe('Scenario 3: Multiple Alerts (Batch Processing)', () => {
    it('should process multiple alerts in one webhook call', async () => {
      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'HighCPUUsage',
              severity: 'warning',
              instance: 'web-server-01',
            },
            annotations: { summary: 'CPU usage above 80%' },
            startsAt: '2026-02-09T14:30:00Z',
          },
          {
            status: 'firing',
            labels: {
              alertname: 'DiskSpaceLow',
              severity: 'warning',
              instance: 'web-server-01',
            },
            annotations: { summary: 'Disk space below 10%' },
            startsAt: '2026-02-09T14:31:00Z',
          },
          {
            status: 'firing',
            labels: {
              alertname: 'HighMemoryUsage',
              severity: 'high',
              instance: 'web-server-01',
            },
            annotations: { summary: 'Memory usage above 85%' },
            startsAt: '2026-02-09T14:32:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.summary.total).toBe(3);
      expect(response.body.summary.successful).toBe(3);
      expect(response.body.summary.failed).toBe(0);
    });
  });

  describe('Scenario 4: Alert with Different Severity Formats', () => {
    it('should handle severity aliases correctly', async () => {
      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'PageableIncident',
              severity: 'page', // Should map to 'critical'
              instance: 'api-server',
            },
            annotations: { summary: 'Pageable incident detected' },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.summary.successful).toBe(1);
    });

    it('should handle priority field instead of severity', async () => {
      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'TestAlert',
              priority: 'urgent', // Should map to 'high'
              instance: 'test-server',
            },
            annotations: { summary: 'Urgent test alert' },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.summary.successful).toBe(1);
    });
  });

  describe('Scenario 5: Invalid Alerts', () => {
    it('should handle alert with resolved status', async () => {
      const payload = {
        alerts: [
          {
            status: 'resolved', // Invalid - should be 'firing'
            labels: {
              alertname: 'TestAlert',
              severity: 'high',
            },
            annotations: { summary: 'Test' },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      // Alert is enqueued but will fail verification
      expect(response.body.summary.total).toBe(1);
    });

    it('should handle alert with missing severity', async () => {
      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'TestAlert',
              // Missing severity
            },
            annotations: { summary: 'Test' },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.summary.total).toBe(1);
    });

    it('should handle alert with invalid severity value', async () => {
      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'TestAlert',
              severity: 'invalid-level',
            },
            annotations: { summary: 'Test' },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.summary.total).toBe(1);
    });
  });

  describe('Scenario 6: Different Annotation Formats', () => {
    it('should extract message from summary annotation', async () => {
      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'Test', severity: 'high', instance: 's1' },
            annotations: { summary: 'Message from summary' },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.summary.successful).toBe(1);
    });

    it('should extract message from message annotation', async () => {
      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'Test', severity: 'high', instance: 's1' },
            annotations: { message: 'Message from message field' },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.summary.successful).toBe(1);
    });

    it('should extract message from description annotation', async () => {
      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'Test', severity: 'high', instance: 's1' },
            annotations: { description: 'Message from description' },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.summary.successful).toBe(1);
    });
  });

  describe('Scenario 7: Service Name Extraction', () => {
    it('should extract service from instance label', async () => {
      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'Test',
              severity: 'high',
              instance: 'api-server-03',
            },
            annotations: { summary: 'Test' },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.summary.successful).toBe(1);
    });

    it('should extract service from service label', async () => {
      const payload = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'Test',
              severity: 'high',
              service: 'backend-api',
            },
            annotations: { summary: 'Test' },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(payload)
        .expect(200);

      expect(response.body.summary.successful).toBe(1);
    });
  });

  describe('Scenario 8: Health and Test Endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });

    it('should return test endpoint response', async () => {
      const response = await request(app)
        .get('/api/prometheus/test')
        .expect(200);

      expect(response.body.message).toBe('Prometheus webhook endpoint is active');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return processing statistics', async () => {
      const response = await request(app)
        .get('/api/prometheus/stats')
        .expect(200);

      expect(response.body).toHaveProperty('processed');
      expect(response.body).toHaveProperty('verified');
      expect(response.body).toHaveProperty('normalized');
    });
  });
});

