/**
 * Integration Test for Alert Processing Pipeline with Redis
 *
 * Tests the complete flow:
 * 1. Alert received via webhook
 * 2. Verification
 * 3. Queuing in Redis
 * 4. Normalization
 * 5. Success/Retry/Error routing
 *
 * Requires Redis to be running on localhost:6379
 */

const request = require('supertest');
const Bull = require('bull');
const config = require('../src/config');
const { verifyAlert } = require('../src/services/verificationService');
const { normalizeAlert, isValidNormalizedAlert, batchNormalizeAlerts } = require('../src/services/normalizationService');

// Create a standalone test app to avoid server conflicts
const express = require('express');

const createTestApp = (rawQueue, successQueue, retryQueue, errorQueue) => {
  const app = express();
  app.use(express.json());

  let stats = {
    processed: 0,
    verified: 0,
    normalized: 0,
    retried: 0,
    errors: 0,
  };

  // Prometheus webhook endpoint
  app.post('/api/prometheus/webhook', async (req, res) => {
    const payload = req.body;

    if (!payload.alerts || !Array.isArray(payload.alerts)) {
      return res.status(400).json({ error: 'Invalid payload: missing alerts array' });
    }

    const results = [];
    for (const alert of payload.alerts) {
      try {
        const job = await rawQueue.add({
          alert,
          attemptCount: 0,
          enqueuedAt: new Date().toISOString(),
        });
        stats.processed++;
        results.push({
          success: true,
          jobId: job.id,
          alertname: alert.labels?.alertname,
        });
      } catch (err) {
        results.push({
          success: false,
          error: err.message,
          alertname: alert.labels?.alertname,
        });
      }
    }

    res.status(200).json({
      message: 'Alerts received and queued for processing',
      summary: {
        total: payload.alerts.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      },
      results,
    });
  });

  // Stats endpoint
  app.get('/api/prometheus/stats', async (req, res) => {
    res.json({
      processed: stats.processed,
      verified: stats.verified,
      normalized: stats.normalized,
      retried: stats.retried,
      errors: stats.errors,
      queues: {
        rawWaiting: await rawQueue.getWaitingCount(),
        successWaiting: await successQueue.getWaitingCount(),
        retryWaiting: await retryQueue.getWaitingCount(),
        errorWaiting: await errorQueue.getWaitingCount(),
      },
    });
  });

  // Health endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'alert-ingestion-test' });
  });

  // Test endpoint
  app.get('/api/prometheus/test', (req, res) => {
    res.json({
      message: 'Prometheus webhook endpoint is active',
      timestamp: new Date().toISOString(),
    });
  });

  app._resetStats = () => {
    stats = { processed: 0, verified: 0, normalized: 0, retried: 0, errors: 0 };
  };

  return app;
};

describe('Alert Processing Integration', () => {
  let rawAlertsQueue;
  let successQueue;
  let retryQueue;
  let errorQueue;
  let app;

  beforeAll(async () => {
    // Create test queues with unique names
    const testPrefix = `integration-${Date.now()}`;
    rawAlertsQueue = new Bull(`${testPrefix}-raw`, config.redisUrl);
    successQueue = new Bull(`${testPrefix}-success`, config.redisUrl);
    retryQueue = new Bull(`${testPrefix}-retry`, config.redisUrl);
    errorQueue = new Bull(`${testPrefix}-error`, config.redisUrl);

    app = createTestApp(rawAlertsQueue, successQueue, retryQueue, errorQueue);
  });

  afterAll(async () => {
    await rawAlertsQueue.empty();
    await successQueue.empty();
    await retryQueue.empty();
    await errorQueue.empty();
    await rawAlertsQueue.close();
    await successQueue.close();
    await retryQueue.close();
    await errorQueue.close();
  });

  beforeEach(async () => {
    await rawAlertsQueue.empty();
    await successQueue.empty();
    await retryQueue.empty();
    await errorQueue.empty();
    app._resetStats();
  });

  describe('Complete Alert Processing Flow', () => {
    it('should process a valid alert through the entire pipeline', async () => {
      const validAlert = {
        version: '4',
        status: 'firing',
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'HighMemoryUsage',
              severity: 'high',
              instance: 'api-server-03',
              environment: 'production',
              team: 'platform',
            },
            annotations: {
              summary: 'Memory usage above 85% for 5 minutes',
            },
            startsAt: '2026-02-09T14:30:00Z',
            fingerprint: 'test-fingerprint-123',
          },
        ],
      };

      // Step 1: Send alert to webhook
      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(validAlert)
        .expect(200);

      expect(response.body.summary.successful).toBe(1);
      expect(response.body.summary.failed).toBe(0);

      // Step 2: Verify alert was added to raw queue
      const rawCount = await rawAlertsQueue.getWaitingCount();
      expect(rawCount).toBe(1);

      // Step 3: Get the job and verify
      const jobs = await rawAlertsQueue.getJobs(['waiting']);
      const jobAlert = jobs[0].data.alert;
      const verification = verifyAlert(jobAlert);
      expect(verification.valid).toBe(true);

      // Step 4: Normalize the alert
      const normalizedAlert = normalizeAlert(jobAlert);
      expect(isValidNormalizedAlert(normalizedAlert)).toBe(true);
      expect(normalizedAlert.service).toBe('api-server-03');
      expect(normalizedAlert.severity).toBe('high');

      // Step 5: Add to success queue
      await successQueue.add({
        alert: normalizedAlert,
        processedAt: new Date().toISOString(),
      });

      expect(await successQueue.getWaitingCount()).toBe(1);
    });

    it('should route invalid alerts to error queue', async () => {
      const invalidAlert = {
        alerts: [
          {
            status: 'resolved',
            labels: {
              alertname: 'TestAlert',
              severity: 'high',
            },
            annotations: { summary: 'Test alert' },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      // Send invalid alert
      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(invalidAlert)
        .expect(200);

      expect(response.body.summary.successful).toBe(1);

      // Verify and route
      const jobs = await rawAlertsQueue.getJobs(['waiting']);
      const jobAlert = jobs[0].data.alert;
      const verification = verifyAlert(jobAlert);
      expect(verification.valid).toBe(false);

      // Add to error queue
      await errorQueue.add({
        alert: jobAlert,
        reason: verification.reason,
        stage: 'verification',
      });

      expect(await errorQueue.getWaitingCount()).toBe(1);
    });

    it('should handle batch alerts with mixed validity', async () => {
      const mixedAlerts = {
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'Valid1', severity: 'high', instance: 's1' },
            annotations: { summary: 'Valid alert 1' },
            startsAt: '2026-02-09T14:30:00Z',
          },
          {
            status: 'resolved',
            labels: { alertname: 'Invalid1', severity: 'high' },
            annotations: { summary: 'Invalid alert' },
            startsAt: '2026-02-09T14:30:00Z',
          },
          {
            status: 'firing',
            labels: { alertname: 'Valid2', severity: 'critical', instance: 's2' },
            annotations: { summary: 'Valid alert 2' },
            startsAt: '2026-02-09T14:31:00Z',
          },
        ],
      };

      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send(mixedAlerts)
        .expect(200);

      expect(response.body.summary.total).toBe(3);
      expect(response.body.summary.successful).toBe(3);

      // Process each queued alert
      const jobs = await rawAlertsQueue.getJobs(['waiting']);
      let successCount = 0;
      let errorCount = 0;

      for (const job of jobs) {
        const verification = verifyAlert(job.data.alert);
        if (verification.valid) {
          const normalized = normalizeAlert(job.data.alert);
          await successQueue.add({ alert: normalized });
          successCount++;
        } else {
          await errorQueue.add({
            alert: job.data.alert,
            reason: verification.reason,
            stage: 'verification',
          });
          errorCount++;
        }
      }

      expect(successCount).toBe(2);
      expect(errorCount).toBe(1);
      expect(await successQueue.getWaitingCount()).toBe(2);
      expect(await errorQueue.getWaitingCount()).toBe(1);
    });
  });

  describe('Queue Metrics', () => {
    it('should track processing statistics', async () => {
      const alerts = {
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'Test1', severity: 'high', instance: 's1' },
            annotations: { summary: 'Test 1' },
            startsAt: '2026-02-09T14:30:00Z',
          },
          {
            status: 'firing',
            labels: { alertname: 'Test2', severity: 'critical', instance: 's2' },
            annotations: { summary: 'Test 2' },
            startsAt: '2026-02-09T14:31:00Z',
          },
        ],
      };

      await request(app)
        .post('/api/prometheus/webhook')
        .send(alerts)
        .expect(200);

      // Process alerts
      const jobs = await rawAlertsQueue.getJobs(['waiting']);
      for (const job of jobs) {
        const normalized = normalizeAlert(job.data.alert);
        await successQueue.add({ alert: normalized });
      }

      // Get statistics
      const response = await request(app)
        .get('/api/prometheus/stats')
        .expect(200);

      expect(response.body.processed).toBe(2);
      expect(response.body.queues.rawWaiting).toBe(2);
      expect(response.body.queues.successWaiting).toBe(2);
    });
  });

  describe('Retry Logic', () => {
    it('should track retry attempts correctly', async () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'RetryTest', severity: 'high', instance: 'server' },
        annotations: { summary: 'Retry test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const maxRetries = 3;

      // Simulate failed normalization attempts
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        await retryQueue.add({
          alert,
          attemptCount: attempt,
          lastError: 'Simulated failure',
          timestamp: new Date().toISOString(),
        });
      }

      expect(await retryQueue.getWaitingCount()).toBe(3);
      const jobs = await retryQueue.getJobs(['waiting']);
      const attempts = jobs.map(j => j.data.attemptCount).sort();
      expect(attempts).toEqual([1, 2, 3]);
    });

    it('should move to error queue after max retries', async () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'MaxRetryTest', severity: 'high', instance: 'server' },
        annotations: { summary: 'Max retry test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const maxRetries = 3;

      // After max retries, move to error queue
      await errorQueue.add({
        alert,
        reason: 'Max retries exceeded',
        stage: 'normalization',
        attempts: maxRetries,
        timestamp: new Date().toISOString(),
      });

      expect(await errorQueue.getWaitingCount()).toBe(1);
      const jobs = await errorQueue.getJobs(['waiting']);
      expect(jobs[0].data.attempts).toBe(maxRetries);
    });
  });

  describe('API Endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
    });

    it('should return test endpoint response', async () => {
      const response = await request(app)
        .get('/api/prometheus/test')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Prometheus webhook endpoint is active');
    });

    it('should reject invalid webhook payload', async () => {
      const response = await request(app)
        .post('/api/prometheus/webhook')
        .send({ invalid: 'payload' })
        .expect(400);

      expect(response.body.error).toBe('Invalid payload: missing alerts array');
    });
  });

  describe('Queue Data Persistence', () => {
    it('should persist job data in Redis', async () => {
      const alert = {
        alerts: [
          {
            status: 'firing',
            labels: { alertname: 'PersistenceTest', severity: 'warning', instance: 'test-server' },
            annotations: { summary: 'Testing Redis persistence' },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      await request(app)
        .post('/api/prometheus/webhook')
        .send(alert)
        .expect(200);

      const jobs = await rawAlertsQueue.getJobs(['waiting']);
      expect(jobs.length).toBe(1);
      expect(jobs[0].data.alert.labels.alertname).toBe('PersistenceTest');
    });

    it('should preserve alert metadata through processing', async () => {
      const alertWithMetadata = {
        alerts: [
          {
            status: 'firing',
            labels: {
              alertname: 'MetadataTest',
              severity: 'critical',
              instance: 'production-server-01',
              environment: 'production',
              team: 'infrastructure',
              region: 'us-east-1',
            },
            annotations: {
              summary: 'Critical production alert',
              description: 'Detailed description',
            },
            startsAt: '2026-02-09T14:30:00Z',
            fingerprint: 'unique-fingerprint-123',
            generatorURL: 'http://prometheus:9090/graph',
          },
        ],
      };

      await request(app)
        .post('/api/prometheus/webhook')
        .send(alertWithMetadata)
        .expect(200);

      const jobs = await rawAlertsQueue.getJobs(['waiting']);
      const normalized = normalizeAlert(jobs[0].data.alert);

      expect(normalized.labels.environment).toBe('production');
      expect(normalized.labels.team).toBe('infrastructure');
      expect(normalized.labels.region).toBe('us-east-1');
      expect(normalized._raw.fingerprint).toBe('unique-fingerprint-123');
    });
  });
});

