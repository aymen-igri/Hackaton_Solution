const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const { metricsMiddleware, metricsEndpoint } = require('./metrics');
const healthRoutes = require('./routes/health');
const alertRoutes = require('./routes/alerts');
const prometheusRoutes = require('./routes/prometheus');
const { initializeProcessor } = require('./services/alertProcessor');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));
app.use(metricsMiddleware);

// Routes
app.use('/health', healthRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/prometheus', prometheusRoutes);
app.get('/metrics', metricsEndpoint);

// Initialize alert processor
initializeProcessor();

// Start server
app.listen(config.port, () => {
  console.log(`[Alert Ingestion] Running on port ${config.port}`);
  console.log(`[Alert Ingestion] Prometheus webhook: http://localhost:${config.port}/api/prometheus/webhook`);
});

module.exports = app;
