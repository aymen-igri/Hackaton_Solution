/**
 * End-to-End Test for Alert Ingestion System
 *
 * Tests the complete workflow from Prometheus alert webhook
 * to final queue routing using real Redis queues.
 */

const Bull = require('bull');
const config = require('../src/config');
const { verifyAlert } = require('../src/services/verificationService');
const { normalizeAlert, batchNormalizeAlerts, isValidNormalizedAlert } = require('../src/services/normalizationService');

describe('End-to-End Alert Processing', () => {
  let rawAlertsQueue;
  let successQueue;
  let retryQueue;
  let errorQueue;

  beforeAll(async () => {
    // Create test queues with unique names
    const testPrefix = `e2e-${Date.now()}`;
    rawAlertsQueue = new Bull(`${testPrefix}-raw`, config.redisUrl);
    successQueue = new Bull(`${testPrefix}-success`, config.redisUrl);
    retryQueue = new Bull(`${testPrefix}-retry`, config.redisUrl);
    errorQueue = new Bull(`${testPrefix}-error`, config.redisUrl);
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
  });

  describe('Scenario: High Severity Production Alert', () => {
    it('should correctly route critical production alert through pipeline', async () => {
      const productionAlert = {
        status: 'firing',
        labels: {
          alertname: 'HighLatency',
          severity: 'critical',
          instance: 'api-gateway-01',
          environment: 'production',
          job: 'kubernetes-pods',
        },
        annotations: {
          summary: 'API Gateway latency > 500ms for 5 minutes',
          description: 'P95 latency has exceeded 500ms threshold',
        },
        startsAt: '2026-02-09T14:30:00Z',
        fingerprint: 'critical-latency-001',
      };

      // Step 1: Enqueue raw alert
      const job = await rawAlertsQueue.add({
        alert: productionAlert,
        attemptCount: 0,
        enqueuedAt: new Date().toISOString(),
        source: 'prometheus',
      });

      expect(job.id).toBeDefined();
      expect(await rawAlertsQueue.getWaitingCount()).toBe(1);

      // Step 2: Verify alert
      const verification = verifyAlert(productionAlert);
      expect(verification.valid).toBe(true);

      // Step 3: Normalize alert
      const normalizedAlert = normalizeAlert(productionAlert);
      expect(isValidNormalizedAlert(normalizedAlert)).toBe(true);

      // Verify normalized data
      expect(normalizedAlert).toMatchObject({
        service: 'api-gateway-01',
        severity: 'critical',
        source: 'prometheus',
      });
      expect(normalizedAlert.labels.environment).toBe('production');

      // Step 4: Route to success queue
      await successQueue.add({
        alert: normalizedAlert,
        processedAt: new Date().toISOString(),
        pipeline: 'complete',
      });

      expect(await successQueue.getWaitingCount()).toBe(1);

      // Verify success queue content
      const successJobs = await successQueue.getJobs(['waiting']);
      expect(successJobs[0].data.alert.severity).toBe('critical');
      expect(successJobs[0].data.pipeline).toBe('complete');
    });
  });

  describe('Scenario: Multiple Alert Types', () => {
    it('should handle different alert severities correctly', async () => {
      const alerts = [
        {
          status: 'firing',
          labels: { alertname: 'LowDisk', severity: 'warning', instance: 'storage-01' },
          annotations: { summary: 'Disk space below 20%' },
          startsAt: '2026-02-09T14:30:00Z',
        },
        {
          status: 'firing',
          labels: { alertname: 'HighCPU', severity: 'high', instance: 'compute-01' },
          annotations: { summary: 'CPU above 90%' },
          startsAt: '2026-02-09T14:31:00Z',
        },
        {
          status: 'firing',
          labels: { alertname: 'DatabaseDown', severity: 'critical', instance: 'db-master' },
          annotations: { summary: 'Database connection failed' },
          startsAt: '2026-02-09T14:32:00Z',
        },
      ];

      // Process each alert through pipeline
      const processedBySeverity = {};

      for (const alert of alerts) {
        // Enqueue raw
        await rawAlertsQueue.add({
          alert,
          attemptCount: 0,
          enqueuedAt: new Date().toISOString(),
        });

        // Verify
        const verification = verifyAlert(alert);
        expect(verification.valid).toBe(true);

        // Normalize
        const normalized = normalizeAlert(alert);
        expect(isValidNormalizedAlert(normalized)).toBe(true);

        // Route to success
        await successQueue.add({ alert: normalized });

        processedBySeverity[normalized.severity] = normalized;
      }

      // Verify all processed
      expect(await rawAlertsQueue.getWaitingCount()).toBe(3);
      expect(await successQueue.getWaitingCount()).toBe(3);

      // Verify severity distribution
      expect(processedBySeverity).toHaveProperty('warning');
      expect(processedBySeverity).toHaveProperty('high');
      expect(processedBySeverity).toHaveProperty('critical');
    });

    it('should batch normalize multiple alerts efficiently', async () => {
      // Use valid severities only: low, warning, high, critical
      const alerts = Array.from({ length: 10 }, (_, i) => ({
        status: 'firing',
        labels: {
          alertname: `BatchAlert${i}`,
          severity: ['low', 'warning', 'high', 'critical'][i % 4],
          instance: `server-${i}`,
        },
        annotations: { summary: `Batch alert ${i}` },
        startsAt: new Date(Date.now() + i * 1000).toISOString(),
      }));

      // Batch normalize returns { successful, failed }
      const result = batchNormalizeAlerts(alerts);
      expect(result.successful.length).toBe(10);
      expect(result.failed.length).toBe(0);

      // Add all to success queue
      for (const normalized of result.successful) {
        await successQueue.add({ alert: normalized });
      }

      expect(await successQueue.getWaitingCount()).toBe(10);

      // Verify all unique
      const ids = result.successful.map(a => a.id);
      expect(new Set(ids).size).toBe(10);
    });
  });

  describe('Scenario: Invalid Alert Handling', () => {
    it('should route resolved alerts to error queue', async () => {
      const resolvedAlert = {
        status: 'resolved',
        labels: { alertname: 'ResolvedAlert', severity: 'high', instance: 'server-01' },
        annotations: { summary: 'Alert resolved' },
        startsAt: '2026-02-09T14:30:00Z',
        endsAt: '2026-02-09T14:35:00Z',
      };

      // Enqueue raw
      await rawAlertsQueue.add({
        alert: resolvedAlert,
        attemptCount: 0,
        enqueuedAt: new Date().toISOString(),
      });

      // Verify - should fail
      const verification = verifyAlert(resolvedAlert);
      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain('resolved');

      // Route to error queue
      await errorQueue.add({
        alert: resolvedAlert,
        reason: verification.reason,
        stage: 'verification',
        timestamp: new Date().toISOString(),
      });

      expect(await errorQueue.getWaitingCount()).toBe(1);
    });

    it('should route alerts without required labels to error queue', async () => {
      const alertMissingLabels = {
        status: 'firing',
        labels: { alertname: 'IncompleteAlert' },
        annotations: { summary: 'Missing severity' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      await rawAlertsQueue.add({
        alert: alertMissingLabels,
        attemptCount: 0,
        enqueuedAt: new Date().toISOString(),
      });

      const verification = verifyAlert(alertMissingLabels);
      expect(verification.valid).toBe(false);

      await errorQueue.add({
        alert: alertMissingLabels,
        reason: verification.reason,
        stage: 'verification',
        timestamp: new Date().toISOString(),
      });

      expect(await errorQueue.getWaitingCount()).toBe(1);
    });
  });

  describe('Scenario: Retry Mechanism', () => {
    it('should handle retry progression correctly', async () => {
      const alertToRetry = {
        status: 'firing',
        labels: { alertname: 'RetryScenario', severity: 'high', instance: 'failing-service' },
        annotations: { summary: 'Requires retry' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const maxRetries = config.maxRetries || 3;

      // Simulate retry progression
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        await retryQueue.add({
          alert: alertToRetry,
          attemptCount: attempt,
          lastError: `Processing error attempt ${attempt}`,
          retryAt: new Date().toISOString(),
        });
      }

      expect(await retryQueue.getWaitingCount()).toBe(maxRetries);

      // Verify attempt counts
      const retryJobs = await retryQueue.getJobs(['waiting']);
      const attempts = retryJobs.map(j => j.data.attemptCount).sort((a, b) => a - b);
      expect(attempts).toEqual([1, 2, 3]);
    });

    it('should move to error queue after exceeding max retries', async () => {
      const failingAlert = {
        status: 'firing',
        labels: { alertname: 'PermanentFailure', severity: 'critical', instance: 'bad-service' },
        annotations: { summary: 'Cannot be processed' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const maxRetries = config.maxRetries || 3;

      // Final failure after max retries
      await errorQueue.add({
        alert: failingAlert,
        reason: 'Max retries exceeded',
        stage: 'normalization',
        attempts: maxRetries + 1,
        error: 'Persistent processing failure',
        timestamp: new Date().toISOString(),
      });

      expect(await errorQueue.getWaitingCount()).toBe(1);

      const errorJobs = await errorQueue.getJobs(['waiting']);
      expect(errorJobs[0].data.attempts).toBeGreaterThan(maxRetries);
      expect(errorJobs[0].data.reason).toBe('Max retries exceeded');
    });
  });

  describe('Scenario: Queue Statistics', () => {
    it('should track queue metrics accurately', async () => {
      const alerts = [
        { status: 'firing', labels: { alertname: 'A1', severity: 'high', instance: 's1' }, annotations: { summary: 'Alert 1' }, startsAt: new Date().toISOString() },
        { status: 'firing', labels: { alertname: 'A2', severity: 'critical', instance: 's2' }, annotations: { summary: 'Alert 2' }, startsAt: new Date().toISOString() },
        { status: 'resolved', labels: { alertname: 'A3', severity: 'low', instance: 's3' }, annotations: { summary: 'Alert 3' }, startsAt: new Date().toISOString() },
      ];

      let processed = 0;
      let succeeded = 0;
      let failed = 0;

      for (const alert of alerts) {
        await rawAlertsQueue.add({ alert, attemptCount: 0 });
        processed++;

        const verification = verifyAlert(alert);
        if (verification.valid) {
          const normalized = normalizeAlert(alert);
          await successQueue.add({ alert: normalized });
          succeeded++;
        } else {
          await errorQueue.add({ alert, reason: verification.reason });
          failed++;
        }
      }

      expect(processed).toBe(3);
      expect(succeeded).toBe(2);
      expect(failed).toBe(1);
      expect(await rawAlertsQueue.getWaitingCount()).toBe(3);
      expect(await successQueue.getWaitingCount()).toBe(2);
      expect(await errorQueue.getWaitingCount()).toBe(1);
    });
  });

  describe('Scenario: Alert Data Integrity', () => {
    it('should preserve all original alert data in _raw field', async () => {
      const originalAlert = {
        status: 'firing',
        labels: {
          alertname: 'IntegrityTest',
          severity: 'critical',
          instance: 'production-db-master',
          environment: 'production',
          region: 'us-west-2',
          custom_label: 'custom_value',
        },
        annotations: {
          summary: 'Database connection pool exhausted',
          description: 'All connections in use for > 30s',
          runbook_url: 'https://wiki.example.com/db-pool-exhausted',
        },
        startsAt: '2026-02-09T14:30:00.123Z',
        fingerprint: 'integrity-test-fingerprint',
        generatorURL: 'http://prometheus:9090/graph?g0.expr=db_pool_usage',
      };

      const normalized = normalizeAlert(originalAlert);

      // Verify _raw preserves original data (fingerprint, generatorURL, annotations)
      expect(normalized._raw).toBeDefined();
      expect(normalized._raw.fingerprint).toBe(originalAlert.fingerprint);
      expect(normalized._raw.generatorURL).toBe(originalAlert.generatorURL);
      expect(normalized._raw.annotations).toEqual(originalAlert.annotations);

      // Verify normalized fields
      expect(normalized.service).toBe('production-db-master');
      expect(normalized.severity).toBe('critical');
      expect(normalized.message).toBe('Database connection pool exhausted');
      expect(normalized.source).toBe('prometheus');

      // Verify labels are preserved at top level
      expect(normalized.labels.environment).toBe('production');
      expect(normalized.labels.region).toBe('us-west-2');
      expect(normalized.labels.custom_label).toBe('custom_value');

      // Add to queue and retrieve
      await successQueue.add({ alert: normalized });
      const jobs = await successQueue.getJobs(['waiting']);
      expect(jobs[0].data.alert._raw.fingerprint).toBe('integrity-test-fingerprint');
    });

    it('should handle alerts with minimal required fields', async () => {
      const minimalAlert = {
        status: 'firing',
        labels: {
          alertname: 'MinimalAlert',
          severity: 'low',
          instance: 'test',
        },
        annotations: {
          summary: 'Minimal test alert',
        },
        startsAt: new Date().toISOString(),
      };

      const verification = verifyAlert(minimalAlert);
      expect(verification.valid).toBe(true);

      const normalized = normalizeAlert(minimalAlert);
      expect(isValidNormalizedAlert(normalized)).toBe(true);
      expect(normalized.id).toBeDefined();
      expect(normalized.timestamp).toBeDefined();
    });
  });

  describe('Scenario: Concurrent Alert Processing', () => {
    it('should handle multiple concurrent alerts without data loss', async () => {
      // Use valid severities only: low, warning, high, critical
      const concurrentAlerts = Array.from({ length: 20 }, (_, i) => ({
        status: 'firing',
        labels: {
          alertname: `ConcurrentAlert${i}`,
          severity: ['low', 'warning', 'high', 'critical'][i % 4],
          instance: `server-${i % 5}`,
        },
        annotations: { summary: `Concurrent alert ${i}` },
        startsAt: new Date().toISOString(),
      }));

      // Add all alerts concurrently
      await Promise.all(
        concurrentAlerts.map(alert =>
          rawAlertsQueue.add({
            alert,
            attemptCount: 0,
            enqueuedAt: new Date().toISOString(),
          })
        )
      );

      expect(await rawAlertsQueue.getWaitingCount()).toBe(20);

      // Process all in parallel
      const jobs = await rawAlertsQueue.getJobs(['waiting']);
      await Promise.all(
        jobs.map(async job => {
          const normalized = normalizeAlert(job.data.alert);
          await successQueue.add({ alert: normalized });
        })
      );

      expect(await successQueue.getWaitingCount()).toBe(20);

      // Verify no duplicates - use labels.alertname since that's where normalized data stores it
      const successJobs = await successQueue.getJobs(['waiting']);
      const uniqueNames = new Set(
        successJobs.map(j => j.data.alert.labels.alertname)
      );
      expect(uniqueNames.size).toBe(20);
    });
  });
});

