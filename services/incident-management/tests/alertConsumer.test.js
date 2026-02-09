/**
 * Tests for alertConsumer – shouldCreateIncident decision logic
 *
 * We mock PostgreSQL (pg) and Redis (ioredis) so these tests run
 * without any external services.
 */

// ─── Mocks ─────────────────────────────────────────────────

const mockQuery = jest.fn();
const mockLpush = jest.fn();

// Mock pg
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({ query: mockQuery })),
}));

// Mock ioredis — both the shared client and BRPOP client
jest.mock('ioredis', () => {
  return jest.fn(() => ({
    brpop: jest.fn(),
    lpush: mockLpush,
  }));
});

// Mock ../redis (shared redis client)
jest.mock('../src/redis', () => ({
  lpush: mockLpush,
}));

// ─── Import AFTER mocks ───────────────────────────────────
const { shouldCreateIncident } = require('../src/workers/alertConsumer');

// ─── Helpers ───────────────────────────────────────────────

function makeAlert(overrides = {}) {
  return {
    alert_id: 'test-alert-001',
    source: 'prometheus',
    severity: 'warning',
    title: 'Test alert',
    description: 'Something happened',
    firing_duration: 0,
    ...overrides,
  };
}

// Helper to set what the DB returns
function mockFindOpenIncident(incident) {
  // findOpenIncidentForService query
  mockQuery.mockResolvedValueOnce({
    rows: incident ? [incident] : [],
  });
}

function mockCountSimilarAlerts(count) {
  // countSimilarAlerts query
  mockQuery.mockResolvedValueOnce({
    rows: [{ cnt: count }],
  });
}

// ─── Tests ─────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('shouldCreateIncident', () => {

  // ═══ RULE 1: Critical severity ═══
  describe('Rule 1 — Critical always creates', () => {
    test('severity=critical → action=create', async () => {
      const alert = makeAlert({ severity: 'critical' });
      const result = await shouldCreateIncident(alert);

      expect(result.action).toBe('create');
      expect(result.reason).toContain('critical');
    });

    test('critical does NOT query the DB (short-circuits)', async () => {
      const alert = makeAlert({ severity: 'critical' });
      await shouldCreateIncident(alert);

      // Should NOT call any DB queries — it returns immediately
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  // ═══ RULE 2: High severity + no existing incident ═══
  describe('Rule 2 — High severity, no open incident', () => {
    test('severity=high, no open incident → action=create', async () => {
      mockFindOpenIncident(null);     // no existing incident
      mockCountSimilarAlerts(0);      // no storm

      const alert = makeAlert({ severity: 'high' });
      const result = await shouldCreateIncident(alert);

      expect(result.action).toBe('create');
      expect(result.reason).toContain('severity is high');
    });

    test('severity=high, BUT open incident exists → action=attach (dedup)', async () => {
      mockFindOpenIncident({ id: 'existing-inc-001', source: 'prometheus' });
      mockCountSimilarAlerts(1);

      const alert = makeAlert({ severity: 'high' });
      const result = await shouldCreateIncident(alert);

      expect(result.action).toBe('attach');
      expect(result.existingIncident.id).toBe('existing-inc-001');
    });
  });

  // ═══ RULE 2b: Firing duration ═══
  describe('Rule 2 — Firing duration > 5 min', () => {
    test('medium severity but firing 10 min, no open incident → create', async () => {
      mockFindOpenIncident(null);
      mockCountSimilarAlerts(0);

      const alert = makeAlert({
        severity: 'medium',
        firing_duration: 600, // 10 minutes in seconds
      });
      const result = await shouldCreateIncident(alert);

      expect(result.action).toBe('create');
      expect(result.reason).toContain('firing');
    });
  });

  // ═══ RULE 3: Alert storm ═══
  describe('Rule 3 — Alert storm (3+ similar alerts)', () => {
    test('3 similar alerts in 10 min → action=create (storm)', async () => {
      mockFindOpenIncident(null);
      mockCountSimilarAlerts(3);

      const alert = makeAlert({ severity: 'medium' });
      const result = await shouldCreateIncident(alert);

      expect(result.action).toBe('create');
      expect(result.reason).toContain('alert storm');
      expect(result.reason).toContain('3');
    });

    test('5 similar alerts → still storm', async () => {
      mockFindOpenIncident(null);
      mockCountSimilarAlerts(5);

      const alert = makeAlert({ severity: 'low' });
      const result = await shouldCreateIncident(alert);

      expect(result.action).toBe('create');
      expect(result.reason).toContain('alert storm');
    });

    test('2 similar alerts → NOT a storm', async () => {
      mockFindOpenIncident(null);
      mockCountSimilarAlerts(2);

      const alert = makeAlert({ severity: 'low' });
      const result = await shouldCreateIncident(alert);

      expect(result.action).not.toBe('create');
    });
  });

  // ═══ DEDUP: Attach to existing ═══
  describe('Dedup — Attach to existing incident', () => {
    test('warning + open incident exists → attach', async () => {
      mockFindOpenIncident({ id: 'inc-abc', source: 'prometheus' });
      mockCountSimilarAlerts(1);

      const alert = makeAlert({ severity: 'warning' });
      const result = await shouldCreateIncident(alert);

      expect(result.action).toBe('attach');
      expect(result.existingIncident.id).toBe('inc-abc');
      expect(result.reason).toContain('attaching');
    });
  });

  // ═══ SKIP: No rules match ═══
  describe('Skip — No rules match', () => {
    test('low severity, no open incident, no storm → skip', async () => {
      mockFindOpenIncident(null);
      mockCountSimilarAlerts(0);

      const alert = makeAlert({ severity: 'low' });
      const result = await shouldCreateIncident(alert);

      expect(result.action).toBe('skip');
      expect(result.reason).toContain('No rules matched');
    });

    test('info severity → skip', async () => {
      mockFindOpenIncident(null);
      mockCountSimilarAlerts(0);

      const alert = makeAlert({ severity: 'info' });
      const result = await shouldCreateIncident(alert);

      expect(result.action).toBe('skip');
    });
  });
});
