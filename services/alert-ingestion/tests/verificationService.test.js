const { verifyAlert, normalizeSeverity, extractServiceName, VALID_SEVERITIES } = require('../src/services/verificationService');

describe('Verification Service', () => {
  describe('verifyAlert', () => {
    it('should pass verification for a valid alert', () => {
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

      const result = verifyAlert(validAlert);

      expect(result.valid).toBe(true);
      expect(result.reason).toBe('Alert verified successfully');
    });

    it('should fail verification when status is missing', () => {
      const alert = {
        labels: { alertname: 'Test', severity: 'high' },
        annotations: { summary: 'Test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Missing status field');
    });

    it('should fail verification when status is resolved', () => {
      const alert = {
        status: 'resolved',
        labels: { alertname: 'Test', severity: 'high' },
        annotations: { summary: 'Test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not \'firing\'');
    });

    it('should fail verification when labels are missing', () => {
      const alert = {
        status: 'firing',
        annotations: { summary: 'Test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Missing or invalid labels object');
    });

    it('should fail verification when alertname is missing', () => {
      const alert = {
        status: 'firing',
        labels: { severity: 'high' },
        annotations: { summary: 'Test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Missing alertname in labels');
    });

    it('should fail verification when severity is missing', () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'Test' },
        annotations: { summary: 'Test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Missing severity/priority in labels');
    });

    it('should fail verification when severity is invalid', () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'Test', severity: 'invalid-level' },
        annotations: { summary: 'Test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid severity');
    });

    it('should fail verification when timestamp is missing', () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'Test', severity: 'high' },
        annotations: { summary: 'Test' },
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing timestamp');
    });

    it('should fail verification when timestamp is invalid', () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'Test', severity: 'high' },
        annotations: { summary: 'Test' },
        startsAt: 'invalid-timestamp',
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid timestamp format');
    });

    it('should fail verification when annotations are missing', () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'Test', severity: 'high' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Missing annotations object');
    });

    it('should fail verification when message is missing from annotations', () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'Test', severity: 'high' },
        annotations: {},
        startsAt: '2026-02-09T14:30:00Z',
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Missing message in annotations');
    });

    it('should accept alert with message annotation', () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'Test', severity: 'high' },
        annotations: { message: 'Test message' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(true);
    });

    it('should accept alert with description annotation', () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'Test', severity: 'high' },
        annotations: { description: 'Test description' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(true);
    });

    it('should accept timestamp field instead of startsAt', () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'Test', severity: 'high' },
        annotations: { summary: 'Test' },
        timestamp: '2026-02-09T14:30:00Z',
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(true);
    });

    it('should accept priority instead of severity', () => {
      const alert = {
        status: 'firing',
        labels: { alertname: 'Test', priority: 'high' },
        annotations: { summary: 'Test' },
        startsAt: '2026-02-09T14:30:00Z',
      };

      const result = verifyAlert(alert);

      expect(result.valid).toBe(true);
    });
  });

  describe('normalizeSeverity', () => {
    it('should normalize standard severity levels', () => {
      expect(normalizeSeverity('critical')).toBe('critical');
      expect(normalizeSeverity('high')).toBe('high');
      expect(normalizeSeverity('warning')).toBe('warning');
      expect(normalizeSeverity('info')).toBe('info');
    });

    it('should normalize severity aliases', () => {
      expect(normalizeSeverity('page')).toBe('critical');
      expect(normalizeSeverity('urgent')).toBe('high');
      expect(normalizeSeverity('low')).toBe('info');
    });

    it('should handle case-insensitive input', () => {
      expect(normalizeSeverity('CRITICAL')).toBe('critical');
      expect(normalizeSeverity('High')).toBe('high');
      expect(normalizeSeverity('WARNING')).toBe('warning');
    });

    it('should return null for invalid severity', () => {
      expect(normalizeSeverity('invalid')).toBe(null);
      expect(normalizeSeverity('unknown')).toBe(null);
      expect(normalizeSeverity('')).toBe(null);
    });
  });

  describe('extractServiceName', () => {
    it('should extract service from instance label', () => {
      const labels = { instance: 'api-server-03' };
      expect(extractServiceName(labels)).toBe('api-server-03');
    });

    it('should extract service from service label when instance is missing', () => {
      const labels = { service: 'backend-service' };
      expect(extractServiceName(labels)).toBe('backend-service');
    });

    it('should extract service from job label when instance and service are missing', () => {
      const labels = { job: 'monitoring-job' };
      expect(extractServiceName(labels)).toBe('monitoring-job');
    });

    it('should extract service from alertname when other labels are missing', () => {
      const labels = { alertname: 'HighMemoryUsage' };
      expect(extractServiceName(labels)).toBe('HighMemoryUsage');
    });

    it('should return unknown-service when all labels are missing', () => {
      const labels = {};
      expect(extractServiceName(labels)).toBe('unknown-service');
    });

    it('should prioritize instance over other labels', () => {
      const labels = {
        instance: 'api-server-03',
        service: 'backend-service',
        job: 'monitoring-job',
        alertname: 'HighMemoryUsage',
      };
      expect(extractServiceName(labels)).toBe('api-server-03');
    });
  });

  describe('VALID_SEVERITIES', () => {
    it('should contain all standard severity levels', () => {
      expect(VALID_SEVERITIES).toContain('critical');
      expect(VALID_SEVERITIES).toContain('high');
      expect(VALID_SEVERITIES).toContain('warning');
      expect(VALID_SEVERITIES).toContain('info');
    });

    it('should have exactly 4 severity levels', () => {
      expect(VALID_SEVERITIES).toHaveLength(4);
    });
  });
});

