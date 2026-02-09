const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const healthRoutes = require('./routes/health');
const schedulesRoutes = require('./routes/schedules');
const oncallRoutes = require('./routes/oncall');

const app = express();
const PORT = process.env.PORT || 8003;

app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

app.use('/health', healthRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/oncall', oncallRoutes);

app.listen(PORT, () => {
  console.log(`[On-Call Service] Running on port ${PORT}`);
});

module.exports = app;
