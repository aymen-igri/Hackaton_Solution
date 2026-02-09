const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const healthRoutes = require('./routes/health');
const incidentRoutes = require('./routes/incidents');

const app = express();
const PORT = process.env.PORT || 8002;

app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

app.use('/health', healthRoutes);
app.use('/api/incidents', incidentRoutes);

app.listen(PORT, () => {
  console.log(`[Incident Management] Running on port ${PORT}`);
});

module.exports = app;
