module.exports = {
  port: process.env.PORT || 8002,
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/incident_platform',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  oncallServiceUrl: process.env.ONCALL_SERVICE_URL || 'http://localhost:8003',
  queues: {
    alerts: 'alerts:queue',             // the queue where alert-ingestion pushes alerts
    incidents: 'incidents:queue',       // the queue where we push new incidents
    deadLetter: 'incidents:dead-letter', // failed messages go here
  },
  worker: {
    brpopTimeoutSec: 5,   // BRPOP waits 5 seconds then loops
    retryDelayMs: 2000,   // wait 2s on error
    maxRetries: 3,         // max retry before dead-letter
  },
};