/**
 * Queue System Tests with Redis
 *
 * Tests the Redis queue system for alert processing:
 * - rawAlertsQueue: Stores unverified alerts from Prometheus
 * - successQueue: Stores successfully normalized alerts
 * - retryQueue: Stores alerts that failed normalization (to be retried)
 * - errorQueue: Stores alerts that exceeded max retries
 *
 * Requires Redis to be running on localhost:6379
 */

const Bull = require('bull');
const config = require('../src/config');
const { verifyAlert, normalizeSeverity, extractServiceName } = require('../src/services/verificationService');
const { normalizeAlert, batchNormalizeAlerts, isValidNormalizedAlert } = require('../src/services/normalizationService');

describe('Queue System Tests', () => {
  let rawAlertsQueue;
  let successQueue;
  let retryQueue;
  let errorQueue;

  beforeAll(async () => {
    // Create test queues with unique names to avoid conflicts
    const testPrefix = `test-${Date.now()}`;
    rawAlertsQueue = new Bull(`${testPrefix}-raw-alerts`, config.redisUrl);
    successQueue = new Bull(`${testPrefix}-success-alerts`, config.redisUrl);
    retryQueue = new Bull(`${testPrefix}-retry-alerts`, config.redisUrl);
    errorQueue = new Bull(`${testPrefix}-error-alerts`, config.redisUrl);
  });

  afterAll(async () => {
    // Clean up and close queues
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
    // Clear all queues before each test
    await rawAlertsQueue.empty();
    await successQueue.empty();
    await retryQueue.empty();
    await errorQueue.empty();
  });

  describe('Raw Alerts Queue', () => {
    it('should add valid alert to raw queue', async () => {
      const validAlert = {
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
      };

      const job = await rawAlertsQueue.add({
        alert: validAlert,
        attemptCount: 0,
        enqueuedAt: new Date().toISOString(),
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();

      const waitingCount = await rawAlertsQueue.getWaitingCount();
      expect(waitingCount).toBe(1);
    });

    it('should queue multiple alerts', async () => {
      const alerts = [
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
        {
          status: 'firing',
          labels: { alertname: 'Test3', severity: 'warning', instance: 's3' },
          annotations: { summary: 'Test 3' },
          startsAt: '2026-02-09T14:32:00Z',
        },
      ];

      for (const alert of alerts) {
        await rawAlertsQueue.add({ alert, attemptCount: 0 });
      }

      const waitingCount = await rawAlertsQueue.getWaitingCount();
      expect(waitingCount).toBe(3);
    });

    it('should retrieve jobs from raw queue', async () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'RetrieveTest', severity: 'high', instance: 'server' },
        annotations: { summary: 'Test retrieval' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      await rawAlertsQueue.add({ alert, attemptCount: 0 });

      const jobs = await rawAlertsQueue.getJobs(['waiting']);
      expect(jobs.length).toBe(1);
      expect(jobs[0].data.alert.labels.alertname).toBe('RetrieveTest');
    });
  });

  describe('Success Queue', () => {
    it('should add normalized alert to success queue', async () => {
      const rawAlert = {
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
        fingerprint: 'abc123',
      };

      // Verify alert
      const verification = verifyAlert(rawAlert);
      expect(verification.valid).toBe(true);

      // Normalize alert
      const normalizedAlert = normalizeAlert(rawAlert);
      expect(isValidNormalizedAlert(normalizedAlert)).toBe(true);

      // Add to success queue
      const job = await successQueue.add({
        alert: normalizedAlert,
        processedAt: new Date().toISOString(),
        attempts: 1,
      });

      expect(job).toBeDefined();

      const waitingCount = await successQueue.getWaitingCount();
      expect(waitingCount).toBe(1);

      const jobs = await successQueue.getJobs(['waiting']);
      expect(jobs[0].data.alert.service).toBe('api-server-03');
      expect(jobs[0].data.alert.severity).toBe('high');
    });

    it('should preserve normalized alert structure in queue', async () => {
      const rawAlert = {
        status: 'firing',
        labels: {
          alertname: 'ServiceDown',
          severity: 'critical',
          instance: 'db-server-01',
          environment: 'production',
          team: 'database',
        },
        annotations: {
          summary: 'Database service is down',
          description: 'The database is not responding',
        },
        startsAt: '2026-02-09T14:30:00Z',
        fingerprint: 'xyz789',
        generatorURL: 'http://prometheus:9090/graph',
      };

      const normalizedAlert = normalizeAlert(rawAlert);
      await successQueue.add({ alert: normalizedAlert });

      const jobs = await successQueue.getJobs(['waiting']);
      const queuedAlert = jobs[0].data.alert;

      expect(queuedAlert.id).toBeDefined();
      expect(queuedAlert.service).toBe('db-server-01');
      expect(queuedAlert.severity).toBe('critical');
      expect(queuedAlert.message).toBe('Database service is down');
      expect(queuedAlert.source).toBe('prometheus');
      expect(queuedAlert.labels.alertname).toBe('ServiceDown');
      expect(queuedAlert.labels.environment).toBe('production');
      expect(queuedAlert._raw.fingerprint).toBe('xyz789');
    });
  });

  describe('Retry Queue', () => {
    it('should add failed alert to retry queue with attempt count', async () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'RetryTest', severity: 'high', instance: 'server' },
        annotations: { summary: 'Retry test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      await retryQueue.add({
        alert,
        attemptCount: 1,
        lastError: 'Normalization failed',
        timestamp: new Date().toISOString(),
      });

      const waitingCount = await retryQueue.getWaitingCount();
      expect(waitingCount).toBe(1);

      const jobs = await retryQueue.getJobs(['waiting']);
      expect(jobs[0].data.attemptCount).toBe(1);
      expect(jobs[0].data.lastError).toBe('Normalization failed');
    });

    it('should increment attempt count on retry', async () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'MultiRetryTest', severity: 'high', instance: 'server' },
        annotations: { summary: 'Multi retry test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      // Simulate multiple retries
      for (let attempt = 1; attempt <= 3; attempt++) {
        await retryQueue.add({
          alert,
          attemptCount: attempt,
          lastError: `Failure attempt ${attempt}`,
          timestamp: new Date().toISOString(),
        });
      }

      const jobs = await retryQueue.getJobs(['waiting']);
      expect(jobs.length).toBe(3);

      // Jobs are returned in reverse order (newest first)
      const attempts = jobs.map(j => j.data.attemptCount).sort();
      expect(attempts).toEqual([1, 2, 3]);
    });
  });

  describe('Error Queue', () => {
    it('should add alert to error queue after max retries', async () => {
      const maxRetries = 3;
      const alert = {
        status: 'firing',
        labels: { alertname: 'MaxRetryAlert', severity: 'high', instance: 'server' },
        annotations: { summary: 'Max retry test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      await errorQueue.add({
        alert,
        reason: 'Normalization failed after 3 attempts',
        stage: 'normalization',
        attempts: maxRetries,
        timestamp: new Date().toISOString(),
      });

      const waitingCount = await errorQueue.getWaitingCount();
      expect(waitingCount).toBe(1);

      const jobs = await errorQueue.getJobs(['waiting']);
      expect(jobs[0].data.attempts).toBe(maxRetries);
      expect(jobs[0].data.stage).toBe('normalization');
    });

    it('should add verification failures directly to error queue', async () => {
      const invalidAlerts = [
        {
          status: 'resolved', // Invalid - not firing
          labels: { alertname: 'Test1', severity: 'high' },
          annotations: { summary: 'Test' },
          startsAt: '2026-02-09T14:30:00Z',
        },
        {
          status: 'firing',
          labels: { severity: 'high' }, // Missing alertname
          annotations: { summary: 'Test' },
          startsAt: '2026-02-09T14:30:00Z',
        },
      ];

      for (const alert of invalidAlerts) {
        const verification = verifyAlert(alert);
        expect(verification.valid).toBe(false);

        await errorQueue.add({
          alert,
          reason: verification.reason,
          stage: 'verification',
          timestamp: new Date().toISOString(),
        });
      }

      const waitingCount = await errorQueue.getWaitingCount();
      expect(waitingCount).toBe(2);

      const jobs = await errorQueue.getJobs(['waiting']);
      expect(jobs.every(j => j.data.stage === 'verification')).toBe(true);
    });

    it('should preserve error details for debugging', async () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'ErrorDetailTest', severity: 'invalid', instance: 'server' },
        annotations: { summary: 'Error detail test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const verification = verifyAlert(alert);

      await errorQueue.add({
        alert,
        reason: verification.reason,
        stage: 'verification',
        attempts: 1,
        timestamp: '2026-02-09T14:30:00Z',
      });

      const jobs = await errorQueue.getJobs(['waiting']);
      const errorJob = jobs[0];

      expect(errorJob.data.alert).toEqual(alert);
      expect(errorJob.data.reason).toContain('Invalid severity');
      expect(errorJob.data.stage).toBe('verification');
    });
  });

  describe('Queue Pipeline Flow', () => {
    it('should route valid alert through raw -> success queue', async () => {
      const validAlert = {
        status: 'firing',
        labels: {
          alertname: 'PipelineTest',
          severity: 'high',
          instance: 'api-server-03',
        },
        annotations: {
          summary: 'Pipeline flow test',
        },
        startsAt: '2026-02-09T14:30:00Z',
      };

      // Step 1: Add to raw queue
      await rawAlertsQueue.add({ alert: validAlert, attemptCount: 0 });
      expect(await rawAlertsQueue.getWaitingCount()).toBe(1);

      // Step 2: Simulate processing - verify alert
      const verification = verifyAlert(validAlert);
      expect(verification.valid).toBe(true);

      // Step 3: Normalize alert
      const normalizedAlert = normalizeAlert(validAlert);
      expect(isValidNormalizedAlert(normalizedAlert)).toBe(true);

      // Step 4: Add to success queue
      await successQueue.add({
        alert: normalizedAlert,
        processedAt: new Date().toISOString(),
      });

      expect(await successQueue.getWaitingCount()).toBe(1);
    });

    it('should route invalid alert through raw -> error queue', async () => {
      const invalidAlert = {
        status: 'resolved',
        labels: {
          alertname: 'InvalidPipelineTest',
          severity: 'high',
        },
        annotations: { summary: 'Invalid pipeline test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      // Step 1: Add to raw queue
      await rawAlertsQueue.add({ alert: invalidAlert, attemptCount: 0 });

      // Step 2: Verify (will fail)
      const verification = verifyAlert(invalidAlert);
      expect(verification.valid).toBe(false);

      // Step 3: Add to error queue
      await errorQueue.add({
        alert: invalidAlert,
        reason: verification.reason,
        stage: 'verification',
      });

      expect(await errorQueue.getWaitingCount()).toBe(1);
    });

    it('should handle batch processing correctly', async () => {
      const alerts = [
        {
          status: 'firing',
          labels: { alertname: 'Valid1', severity: 'high', instance: 's1' },
          annotations: { summary: 'Valid 1' },
          startsAt: '2026-02-09T14:30:00Z',
        },
        {
          status: 'resolved', // Invalid
          labels: { alertname: 'Invalid1', severity: 'high' },
          annotations: { summary: 'Invalid 1' },
          startsAt: '2026-02-09T14:30:00Z',
        },
        {
          status: 'firing',
          labels: { alertname: 'Valid2', severity: 'critical', instance: 's2' },
          annotations: { summary: 'Valid 2' },
          startsAt: '2026-02-09T14:31:00Z',
        },
        {
          status: 'firing',
          labels: { alertname: 'Invalid2' }, // Missing severity
          annotations: { summary: 'Invalid 2' },
          startsAt: '2026-02-09T14:32:00Z',
        },
      ];

      let successCount = 0;
      let errorCount = 0;

      for (const alert of alerts) {
        // Add to raw queue
        await rawAlertsQueue.add({ alert, attemptCount: 0 });

        // Verify
        const verification = verifyAlert(alert);

        if (verification.valid) {
          const normalized = normalizeAlert(alert);
          await successQueue.add({ alert: normalized });
          successCount++;
        } else {
          await errorQueue.add({
            alert,
            reason: verification.reason,
            stage: 'verification',
          });
          errorCount++;
        }
      }

      expect(await rawAlertsQueue.getWaitingCount()).toBe(4);
      expect(await successQueue.getWaitingCount()).toBe(2);
      expect(await errorQueue.getWaitingCount()).toBe(2);
      expect(successCount).toBe(2);
      expect(errorCount).toBe(2);
    });
  });

  describe('Alert Processing Scenarios', () => {
    it('should correctly process high severity alert', async () => {
      const criticalAlert = {
        status: 'firing',
        labels: {
          alertname: 'ServiceDown',
          severity: 'critical',
          instance: 'production-db-01',
          environment: 'production',
          team: 'infrastructure',
        },
        annotations: {
          summary: 'Database service is not responding',
        },
        startsAt: '2026-02-09T14:30:00Z',
        fingerprint: 'critical-db-down-123',
      };

      const verification = verifyAlert(criticalAlert);
      expect(verification.valid).toBe(true);

      const normalized = normalizeAlert(criticalAlert);
      expect(normalized.severity).toBe('critical');
      expect(normalized.service).toBe('production-db-01');

      await successQueue.add({ alert: normalized });
      const jobs = await successQueue.getJobs(['waiting']);
      const queuedAlert = jobs[0].data.alert;

      expect(queuedAlert.severity).toBe('critical');
      expect(queuedAlert.labels.environment).toBe('production');
    });

    it('should handle severity alias "page" as critical', async () => {
      const pageAlert = {
        status: 'firing',
        labels: {
          alertname: 'UrgentAlert',
          severity: 'page',
          instance: 'server-01',
        },
        annotations: { summary: 'Urgent issue' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const verification = verifyAlert(pageAlert);
      expect(verification.valid).toBe(true);

      const normalized = normalizeAlert(pageAlert);
      expect(normalized.severity).toBe('critical');
    });

    it('should handle priority field instead of severity', async () => {
      const priorityAlert = {
        status: 'firing',
        labels: {
          alertname: 'PriorityTest',
          priority: 'high',
          instance: 'server-01',
        },
        annotations: { summary: 'Priority test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const verification = verifyAlert(priorityAlert);
      expect(verification.valid).toBe(true);

      const normalized = normalizeAlert(priorityAlert);
      expect(normalized.severity).toBe('high');
    });
  });

  describe('Queue Cleanup', () => {
    it('should clear queue contents with empty()', async () => {
      // Add some jobs
      await rawAlertsQueue.add({ alert: {}, attemptCount: 0 });
      await rawAlertsQueue.add({ alert: {}, attemptCount: 0 });

      expect(await rawAlertsQueue.getWaitingCount()).toBe(2);

      // Clear queue
      await rawAlertsQueue.empty();

      expect(await rawAlertsQueue.getWaitingCount()).toBe(0);
    });
  });
});
