module.exports = {
  port: process.env.PORT || 8002,
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/incident_platform',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  oncallServiceUrl: process.env.ONCALL_SERVICE_URL || 'http://localhost:8003',
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:8080',
  queues: {
    alerts: 'successQueue',                 // the queue where alert-ingestion pushes alerts
    incidents: 'incidents:queue',           // the queue where we push new incidents
    notifications: 'notifications:queue',   // the queue for sending notifications
    escalation: 'escalation:queue',         // the queue for escalation checks
    deadLetter: 'incidents:dead-letter',    // failed messages go here
  },
  worker: {
    brpopTimeoutSec: 5,   // BRPOP waits 5 seconds then loops
    retryDelayMs: 2000,   // wait 2s on error
    maxRetries: 3,        // max retry before dead-letter
  },
  incidentRules: {
    deduplicationWindowMin: 14,  // look for open incidents within last N minutes
    alertStormWindowMin: 10,     // count similar alerts within last N minutes
    alertStormThreshold: 3,      // N+ similar alerts = alert storm → create incident
    firingDurationMin: 5,        // alert firing longer than N min → create incident (for high sev)
  },
  escalation: {
    timeoutMinutes: 5,           // escalate if not acknowledged within N minutes
    checkIntervalMs: 30000,      // check for escalation every 30 seconds
  },
};