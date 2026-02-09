module.exports = {
  port: process.env.PORT || 8001,
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/incident_platform',
  incidentServiceUrl: process.env.INCIDENT_SERVICE_URL || 'http://localhost:8002',
  oncallServiceUrl: process.env.ONCALL_SERVICE_URL || 'http://localhost:8003',
  logLevel: process.env.LOG_LEVEL || 'info',
  correlation: {
    timeWindowMs: 5 * 60 * 1000,    // 5 minutes – alerts within this window may be correlated
    similarityThreshold: 0.7,         // 0-1 score for grouping alerts
  },
};
