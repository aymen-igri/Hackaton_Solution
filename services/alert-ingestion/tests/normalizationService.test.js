const { normalizeAlert, batchNormalizeAlerts, isValidNormalizedAlert } = require('../src/services/normalizationService');

describe('Normalization Service', () => {
  describe('normalizeAlert', () => {
    it('should normalize a valid Prometheus alert', () => {
      const rawAlert = {
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
        fingerprint: 'abc123',
        generatorURL: 'http://prometheus:9090/graph',
      };

      const normalized = normalizeAlert(rawAlert);

      expect(normalized).toHaveProperty('id');
      expect(normalized).toHaveProperty('service', 'api-server-03');
      expect(normalized).toHaveProperty('severity', 'high');
      expect(normalized).toHaveProperty('message', 'Memory usage above 85% for 5 minutes');
      expect(normalized).toHaveProperty('timestamp', '2026-02-09T14:30:00Z');
      expect(normalized).toHaveProperty('source', 'prometheus');
      expect(normalized.labels).toHaveProperty('alertname', 'HighMemoryUsage');
      expect(normalized.labels).toHaveProperty('environment', 'production');
      expect(normalized._raw).toHaveProperty('fingerprint', 'abc123');
    });

    it('should use message from annotations.message', () => {
      const rawAlert = {
        labels: {
          alertname: 'Test',
          severity: 'high',
          instance: 'server-01',
        },
        annotations: {
          message: 'Test message from message field',
        },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const normalized = normalizeAlert(rawAlert);
      expect(normalized.message).toBe('Test message from message field');
    });

    it('should use message from annotations.description', () => {
      const rawAlert = {
        labels: {
          alertname: 'Test',
          severity: 'high',
          instance: 'server-01',
        },
        annotations: {
          description: 'Test message from description field',
        },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const normalized = normalizeAlert(rawAlert);
      expect(normalized.message).toBe('Test message from description field');
    });

    it('should fallback to alertname when no message is available', () => {
      const rawAlert = {
        labels: {
          alertname: 'HighCPUUsage',
          severity: 'warning',
          instance: 'server-01',
        },
        annotations: {},
        startsAt: '2026-02-09T14:30:00Z',
      };

      const normalized = normalizeAlert(rawAlert);
      expect(normalized.message).toBe('Alert: HighCPUUsage');
    });

    it('should normalize severity using priority field', () => {
      const rawAlert = {
        labels: {
          alertname: 'Test',
          priority: 'critical',
          instance: 'server-01',
        },
        annotations: { summary: 'Test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const normalized = normalizeAlert(rawAlert);
      expect(normalized.severity).toBe('critical');
    });

    it('should use timestamp field if startsAt is missing', () => {
      const rawAlert = {
        labels: {
          alertname: 'Test',
          severity: 'high',
          instance: 'server-01',
        },
        annotations: { summary: 'Test' },
        timestamp: '2026-02-09T15:00:00Z',
      };

      const normalized = normalizeAlert(rawAlert);
      expect(normalized.timestamp).toBe('2026-02-09T15:00:00Z');
    });

    it('should extract service name correctly', () => {
      const rawAlert = {
        labels: {
          alertname: 'Test',
          severity: 'high',
          service: 'backend-api',
        },
        annotations: { summary: 'Test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const normalized = normalizeAlert(rawAlert);
      expect(normalized.service).toBe('backend-api');
    });

    it('should generate a unique ID', () => {
      const rawAlert = {
        labels: {
          alertname: 'Test',
          severity: 'high',
          instance: 'server-01',
        },
        annotations: { summary: 'Test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const normalized1 = normalizeAlert(rawAlert);
      const normalized2 = normalizeAlert(rawAlert);

      expect(normalized1.id).toBeDefined();
      expect(normalized2.id).toBeDefined();
      expect(normalized1.id).not.toBe(normalized2.id);
    });

    it('should throw error for invalid severity', () => {
      const rawAlert = {
        labels: {
          alertname: 'Test',
          severity: 'invalid-severity',
          instance: 'server-01',
        },
        annotations: { summary: 'Test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      expect(() => normalizeAlert(rawAlert)).toThrow('Normalization failed');
    });

    it('should preserve all labels in normalized alert', () => {
      const rawAlert = {
        labels: {
          alertname: 'Test',
          severity: 'high',
          instance: 'server-01',
          environment: 'production',
          team: 'backend',
          region: 'us-east-1',
        },
        annotations: { summary: 'Test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const normalized = normalizeAlert(rawAlert);
      expect(normalized.labels).toHaveProperty('alertname', 'Test');
      expect(normalized.labels).toHaveProperty('severity', 'high');
      expect(normalized.labels).toHaveProperty('environment', 'production');
      expect(normalized.labels).toHaveProperty('team', 'backend');
      expect(normalized.labels).toHaveProperty('region', 'us-east-1');
    });

    it('should preserve raw data in _raw field', () => {
      const rawAlert = {
        labels: {
          alertname: 'Test',
          severity: 'high',
          instance: 'server-01',
        },
        annotations: { summary: 'Test alert' },
        startsAt: '2026-02-09T14:30:00Z',
        fingerprint: 'xyz789',
        generatorURL: 'http://test-url',
      };

      const normalized = normalizeAlert(rawAlert);
      expect(normalized._raw).toHaveProperty('fingerprint', 'xyz789');
      expect(normalized._raw).toHaveProperty('generatorURL', 'http://test-url');
      expect(normalized._raw).toHaveProperty('annotations');
    });
  });

  describe('batchNormalizeAlerts', () => {
    it('should normalize multiple valid alerts', () => {
      const alerts = [
        {
          labels: { alertname: 'Alert1', severity: 'high', instance: 'server-01' },
          annotations: { summary: 'Test 1' },
          startsAt: '2026-02-09T14:30:00Z',
        },
        {
          labels: { alertname: 'Alert2', severity: 'critical', instance: 'server-02' },
          annotations: { summary: 'Test 2' },
          startsAt: '2026-02-09T14:31:00Z',
        },
      ];

      const result = batchNormalizeAlerts(alerts);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.successful[0].service).toBe('server-01');
      expect(result.successful[1].service).toBe('server-02');
    });

    it('should separate successful and failed normalizations', () => {
      const alerts = [
        {
          labels: { alertname: 'ValidAlert', severity: 'high', instance: 'server-01' },
          annotations: { summary: 'Valid' },
          startsAt: '2026-02-09T14:30:00Z',
        },
        {
          labels: { alertname: 'InvalidAlert', severity: 'invalid-level', instance: 'server-02' },
          annotations: { summary: 'Invalid' },
          startsAt: '2026-02-09T14:31:00Z',
        },
      ];

      const result = batchNormalizeAlerts(alerts);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.successful[0].labels.alertname).toBe('ValidAlert');
      expect(result.failed[0].alert.labels.alertname).toBe('InvalidAlert');
      expect(result.failed[0].error).toContain('Normalization failed');
    });

    it('should handle empty array', () => {
      const result = batchNormalizeAlerts([]);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });
  });

  describe('isValidNormalizedAlert', () => {
    it('should validate a correctly normalized alert', () => {
      const normalized = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        service: 'api-server-03',
        severity: 'high',
        message: 'Memory usage above 85%',
        timestamp: '2026-02-09T14:30:00Z',
        labels: {
          alertname: 'HighMemoryUsage',
          environment: 'production',
        },
        source: 'prometheus',
      };

      expect(isValidNormalizedAlert(normalized)).toBe(true);
    });

    it('should reject alert without service', () => {
      const normalized = {
        severity: 'high',
        message: 'Test',
        timestamp: '2026-02-09T14:30:00Z',
        labels: { alertname: 'Test' },
        source: 'prometheus',
      };

      expect(isValidNormalizedAlert(normalized)).toBe(false);
    });

    it('should reject alert without severity', () => {
      const normalized = {
        service: 'test-service',
        message: 'Test',
        timestamp: '2026-02-09T14:30:00Z',
        labels: { alertname: 'Test' },
        source: 'prometheus',
      };

      expect(isValidNormalizedAlert(normalized)).toBe(false);
    });

    it('should reject alert without message', () => {
      const normalized = {
        service: 'test-service',
        severity: 'high',
        timestamp: '2026-02-09T14:30:00Z',
        labels: { alertname: 'Test' },
        source: 'prometheus',
      };

      expect(isValidNormalizedAlert(normalized)).toBe(false);
    });

    it('should reject alert without timestamp', () => {
      const normalized = {
        service: 'test-service',
        severity: 'high',
        message: 'Test',
        labels: { alertname: 'Test' },
        source: 'prometheus',
      };

      expect(isValidNormalizedAlert(normalized)).toBe(false);
    });

    it('should reject alert without labels', () => {
      const normalized = {
        service: 'test-service',
        severity: 'high',
        message: 'Test',
        timestamp: '2026-02-09T14:30:00Z',
        source: 'prometheus',
      };

      expect(isValidNormalizedAlert(normalized)).toBe(false);
    });

    it('should reject alert without alertname in labels', () => {
      const normalized = {
        service: 'test-service',
        severity: 'high',
        message: 'Test',
        timestamp: '2026-02-09T14:30:00Z',
        labels: {},
        source: 'prometheus',
      };

      expect(isValidNormalizedAlert(normalized)).toBe(false);
    });

    it('should reject alert with wrong source', () => {
      const normalized = {
        service: 'test-service',
        severity: 'high',
        message: 'Test',
        timestamp: '2026-02-09T14:30:00Z',
        labels: { alertname: 'Test' },
        source: 'other-source',
      };

      expect(isValidNormalizedAlert(normalized)).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(isValidNormalizedAlert(null)).toBe(false);
      expect(isValidNormalizedAlert(undefined)).toBe(false);
    });

    it('should reject non-object types', () => {
      expect(isValidNormalizedAlert('string')).toBe(false);
      expect(isValidNormalizedAlert(123)).toBe(false);
      expect(isValidNormalizedAlert([])).toBe(false);
    });
  });
});

