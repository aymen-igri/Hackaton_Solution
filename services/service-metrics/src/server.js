require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const prometheus = require('./prometheus-client');
const postgres = require('./postgres-client');
const { setupWebSocketServer } = require('./websocket-handler');
const { register, Counter, Histogram } = require('prom-client');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8005;
const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/incident_platform';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '10000'); // 10 seconds

// ─── Metrics ───────────────────────────────────────────
const metricsCollected = new Counter({
  name: 'service_metrics_collected_total',
  help: 'Total metrics collected from sources',
  labelNames: ['source']
});

const metricsErrors = new Counter({
  name: 'service_metrics_errors_total',
  help: 'Total errors during metric collection',
  labelNames: ['source']
});

const pollDuration = new Histogram({
  name: 'service_metrics_poll_duration_seconds',
  help: 'Duration of metric polling',
  labelNames: ['source']
});

// ─── Middleware ────────────────────────────────────────
app.use(express.json());

// ─── CORS Middleware (allow web-ui access) ─────────────
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ─── Health Check ──────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Prometheus Metrics ────────────────────────────────
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    console.error('Error generating metrics:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── REST API: Incidents by Service ────────────────────
app.get('/api/metrics/incidents/by-service', async (req, res) => {
  try {
    const incidents = await postgres.getIncidentsByService();
    res.json(incidents);
  } catch (err) {
    console.error('Error fetching incidents by service:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── REST API: Incidents with Details ──────────────────
app.get('/api/metrics/incidents/details', async (req, res) => {
  try {
    const incidents = await postgres.getIncidentsWithDetails();
    res.json(incidents);
  } catch (err) {
    console.error('Error fetching incident details:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── WebSocket Setup ───────────────────────────────────
setupWebSocketServer(wss);

// ─── Polling Logic ────────────────────────────────────
let pollTimer;

async function pollMetrics() {
  try {
    // Poll Prometheus instant queries
    const startInstant = Date.now();
    const instantData = await prometheus.queryInstant();
    pollDuration.labels('prometheus_instant').observe((Date.now() - startInstant) / 1000);
    metricsCollected.labels('prometheus_instant').inc();

    // Broadcast to WebSocket clients
    const instantMessage = {
      type: 'instant_metrics',
      timestamp: new Date().toISOString(),
      data: instantData
    };
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(instantMessage));
      }
    });

    // Poll Prometheus range queries (1h, 24h)
    const startRange = Date.now();
    const rangeData = await prometheus.queryRange();
    pollDuration.labels('prometheus_range').observe((Date.now() - startRange) / 1000);
    metricsCollected.labels('prometheus_range').inc();

    const rangeMessage = {
      type: 'range_metrics',
      timestamp: new Date().toISOString(),
      data: rangeData
    };
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(rangeMessage));
      }
    });

  } catch (err) {
    console.error('Polling error:', err);
    metricsErrors.labels('prometheus').inc();
  }
}

// ─── Startup ───────────────────────────────────────────
server.listen(PORT, async () => {
  console.log(`[service-metrics] running on port ${PORT}`);
  
  try {
    await postgres.init();
    console.log('[service-metrics] database connection established');
  } catch (err) {
    console.error('[service-metrics] database connection failed:', err);
    process.exit(1);
  }

  // Start polling
  pollMetrics();
  pollTimer = setInterval(pollMetrics, POLL_INTERVAL);
});

// ─── Graceful Shutdown ────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[service-metrics] SIGTERM received, shutting down gracefully');
  clearInterval(pollTimer);
  wss.close(() => {
    postgres.close();
    server.close(() => process.exit(0));
  });
});
