/**
 * Integration Test for Alert Processing Pipeline
 *
 * Tests the complete flow:
 * 1. Alert received via webhook
 * 2. Verification
 * 3. Queuing in Redis
 * 4. Normalization
 * 5. Success/Retry/Error routing
 */

const request = require('supertest');
const Bull = require('bull');
const { createClient } = require('redis');
const app = require('../src/server');
const config = require('../src/config');

// This is an integration test - requires Redis to be running
describe('Alert Processing Integration', () => {
  let redisClient;
  let rawAlertsQueue;
  let successQueue;
  let retryQueue;
  let errorQueue;

  beforeAll(async () => {
    // Connect to Redis
    redisClient = createClient({ url: config.redisUrl });
    await redisClient.connect();

    // Connect to queues
    rawAlertsQueue = new Bull('raw-alerts', config.redisUrl);
    successQueue = new Bull('success-alerts', config.redisUrl);
    retryQueue = new Bull('retry-alerts', config.redisUrl);
    errorQueue = new Bull('error-alerts', config.redisUrl);
  });

  afterAll(async () => {
    // Clean up
    await rawAlertsQueue.close();
    await successQueue.close();
    await retryQueue.close();
    await errorQueue.close();
    await redisClient.quit();
  });

  beforeEach(async () => {
    // Clear all queues before each test
    await rawAlertsQueue.empty();
    await successQueue.empty();
    await retryQueue.empty();
    await errorQueue.empty();
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
              description: 'The server is experiencing high memory usage',
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

      // Step 2: Verify alert was added to raw queue
      const rawCount = await rawAlertsQueue.getWaitingCount();
      expect(rawCount).toBeGreaterThan(0);

      // Step 3: Wait for processing (or manually process)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 4: Check success queue
      const successCount = await successQueue.getCompletedCount();
      expect(successCount).toBeGreaterThan(0);
    }, 10000);

    it('should route invalid alerts to error queue', async () => {
      const invalidAlert = {
        alerts: [
          {
            status: 'resolved', // Invalid - should be 'firing'
            labels: {
              alertname: 'TestAlert',
              severity: 'high',
            },
            annotations: {
              summary: 'Test alert',
            },
            startsAt: '2026-02-09T14:30:00Z',
          },
        ],
      };

      // Send invalid alert
      await request(app)
        .post('/api/prometheus/webhook')
        .send(invalidAlert)
        .expect(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check error queue
      const errorCount = await errorQueue.getCompletedCount();
      expect(errorCount).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Queue Metrics', () => {
    it('should track processing statistics', async () => {
      // Send some alerts
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

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get statistics
      const response = await request(app)
        .get('/api/prometheus/stats')
        .expect(200);

      expect(response.body).toHaveProperty('processed');
      expect(response.body).toHaveProperty('verified');
      expect(response.body).toHaveProperty('normalized');
      expect(response.body.processed).toBeGreaterThan(0);
    }, 10000);
  });

  describe('Redis Data Persistence', () => {
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

      // Check Redis keys exist
      const keys = await redisClient.keys('bull:raw-alerts:*');
      expect(keys.length).toBeGreaterThan(0);
    });
  });
});

