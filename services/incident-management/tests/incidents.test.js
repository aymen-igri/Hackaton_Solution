/**
 * Tests for the incidents REST API routes
 *
 * Mocks pg so no real database is needed.
 */

const mockQuery = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({ query: mockQuery })),
}));

// Mock incidentService (used by /metrics/sre)
jest.mock('../src/services/incidentService', () => ({
  computeSREMetrics: jest.fn().mockResolvedValue({
    mtta: { seconds: 120, human: '2m', sample_size: 5 },
    mttr: { seconds: 3600, human: '60m', sample_size: 3 },
    open_incidents: 2,
    computed_at: '2026-02-09T00:00:00.000Z',
  }),
}));

const express = require('express');
const request = require('supertest');
const incidentRoutes = require('../src/routes/incidents');

// Build a mini Express app for testing
const app = express();
app.use(express.json());
app.use('/api/incidents', incidentRoutes);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/incidents', () => {
  test('creates an incident and returns 201', async () => {
    const fakeIncident = {
      id: 'abc-123',
      title: 'Server down',
      severity: 'critical',
      source: 'prometheus',
      description: '',
      status: 'open',
      created_at: '2026-02-09T00:00:00.000Z',
      updated_at: '2026-02-09T00:00:00.000Z',
    };

    mockQuery.mockResolvedValueOnce({ rows: [fakeIncident] }); // INSERT

    const res = await request(app)
      .post('/api/incidents')
      .send({ title: 'Server down', severity: 'critical', source: 'prometheus' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Server down');
    expect(res.body.status).toBe('open');
  });
});

describe('GET /api/incidents', () => {
  test('returns list of incidents', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'inc-1', title: 'Alert 1', status: 'open', severity: 'high' },
        { id: 'inc-2', title: 'Alert 2', status: 'resolved', severity: 'low' },
      ],
    });

    const res = await request(app).get('/api/incidents');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe('inc-1');
  });

  test('filters by status query param', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'inc-1', status: 'open' }] });

    const res = await request(app).get('/api/incidents?status=open');

    expect(res.status).toBe(200);
    // Verify the query was called with status filter
    const call = mockQuery.mock.calls[0];
    expect(call[0]).toContain('WHERE status = $1');
    expect(call[1][0]).toBe('open');
  });
});

describe('GET /api/incidents/:id', () => {
  test('returns incident by id', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'inc-1', title: 'Test', status: 'open' }],
    });

    const res = await request(app).get('/api/incidents/inc-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('inc-1');
  });

  test('returns 404 if not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/incidents/doesnt-exist');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Incident not found');
  });
});

describe('PATCH /api/incidents/:id', () => {
  test('acknowledges an incident', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'inc-1', status: 'acknowledged', acknowledged_at: '2026-02-09T00:00:00Z' }],
    });

    const res = await request(app)
      .patch('/api/incidents/inc-1')
      .send({ status: 'acknowledged' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('acknowledged');
  });

  test('resolves an incident', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'inc-1', status: 'resolved', resolved_at: '2026-02-09T01:00:00Z' }],
    });

    const res = await request(app)
      .patch('/api/incidents/inc-1')
      .send({ status: 'resolved' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('resolved');
  });

  test('rejects invalid status', async () => {
    const res = await request(app)
      .patch('/api/incidents/inc-1')
      .send({ status: 'banana' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('status must be one of');
  });

  test('returns 404 if incident not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch('/api/incidents/nope')
      .send({ status: 'resolved' });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/incidents/metrics/sre', () => {
  test('returns MTTA and MTTR metrics', async () => {
    const res = await request(app).get('/api/incidents/metrics/sre');

    expect(res.status).toBe(200);
    expect(res.body.mtta.seconds).toBe(120);
    expect(res.body.mttr.seconds).toBe(3600);
    expect(res.body.open_incidents).toBe(2);
  });
});
