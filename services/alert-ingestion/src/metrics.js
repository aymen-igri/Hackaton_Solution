const client = require('prom-client');

// Create a Registry
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metrics
const alertsReceived = new client.Counter({
  name: 'alerts_received_total',
  help: 'Total number of alerts received',
  labelNames: ['source', 'severity'],
  registers: [register],
});

const alertProcessingDuration = new client.Histogram({
  name: 'alert_processing_duration_seconds',
  help: 'Time spent processing an alert',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const correlatedAlerts = new client.Counter({
  name: 'correlated_alerts_total',
  help: 'Total number of alerts that were correlated to an existing incident',
  registers: [register],
});

// New metrics for alert processing pipeline
const alertsVerified = new client.Counter({
  name: 'alerts_verified_total',
  help: 'Total number of alerts that passed verification',
  labelNames: ['status'],
  registers: [register],
});

const alertsNormalized = new client.Counter({
  name: 'alerts_normalized_total',
  help: 'Total number of alerts successfully normalized',
  registers: [register],
});

const alertsQueued = new client.Counter({
  name: 'alerts_queued_total',
  help: 'Total number of alerts queued',
  labelNames: ['queue'],
  registers: [register],
});

const alertsRetried = new client.Counter({
  name: 'alerts_retried_total',
  help: 'Total number of alerts that were retried',
  registers: [register],
});

const alertsFailed = new client.Counter({
  name: 'alerts_failed_total',
  help: 'Total number of alerts that failed processing',
  labelNames: ['stage'],
  registers: [register],
});

// Middleware to track request duration
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
  registers: [register],
});

function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path || req.path, status_code: res.statusCode });
  });
  next();
}

async function metricsEndpoint(_req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = {
  alertsReceived,
  alertProcessingDuration,
  correlatedAlerts,
  alertsVerified,
  alertsNormalized,
  alertsQueued,
  alertsRetried,
  alertsFailed,
  metricsMiddleware,
  metricsEndpoint,
};
