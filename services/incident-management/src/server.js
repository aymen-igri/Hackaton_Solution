const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const healthRoutes = require('./routes/health');
const incidentRoutes = require('./routes/incidents');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

app.use('/health', healthRoutes);
app.use('/api/incidents', incidentRoutes);

app.listen(config.port, () => {
  console.log(`[Incident Management] Running on port ${config.port}`);

  // 🆕 Start Redis queue workers alongside the Express server
  const { startAlertConsumer } = require('./workers/alertConsumer');
  const { startIncidentWorker } = require('./workers/incidentWorker');

  startAlertConsumer();
  startIncidentWorker();
});

module.exports = app;