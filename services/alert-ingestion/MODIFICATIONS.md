# Alert Ingestion Service - Modifications and New Files

## Summary
Implementation of a complete Prometheus alert ingestion pipeline with verification, normalization, and Redis queue management.

## Modified Files

### 1. `package.json`
**Changes:**
- Added `redis` (^4.6.12) dependency for Redis connectivity
- Added `bull` (^4.12.0) dependency for queue management

**Purpose:** Enable Redis-based queue management for alert processing.

---

### 2. `src/config.js`
**Changes:**
- Added `redisUrl` configuration (default: redis://localhost:6379)
- Added `prometheusUrl` configuration (default: http://prometheus:9090)
- Added `normalization` configuration section:
  - `maxRetries: 3` - Maximum retry attempts
  - `retryDelayMs: 5000` - Delay between retries (5 seconds)

**Purpose:** Configure Redis connection and retry behavior for failed normalizations.

---

### 3. `src/server.js`
**Changes:**
- Added import for `prometheusRoutes` module
- Added import for `initializeProcessor` from alertProcessor service
- Added route: `app.use('/api/prometheus', prometheusRoutes)`
- Added `initializeProcessor()` call to start queue processing
- Added console log for Prometheus webhook endpoint URL

**Purpose:** Initialize alert processing pipeline and expose Prometheus webhook endpoint.

---

### 4. `src/metrics.js`
**Changes:**
- Added new metrics for alert processing pipeline:
  - `alerts_verified_total` (Counter with label: status)
  - `alerts_normalized_total` (Counter)
  - `alerts_queued_total` (Counter with label: queue)
  - `alerts_retried_total` (Counter)
  - `alerts_failed_total` (Counter with label: stage)

**Purpose:** Track metrics for verification, normalization, queueing, retries, and failures.

---

### 5. `docker-compose.yml`
**Changes:**
- Added Redis service:
  - Image: redis:7-alpine
  - Port: 6379
  - Volume: redis_data:/data
  - Health check with redis-cli ping
  - Persistent storage with appendonly mode

- Added Alertmanager service:
  - Image: prom/alertmanager:latest
  - Port: 9093
  - Volume: alertmanager.yml configuration
  - Volume: alertmanager_data:/alertmanager
  - Depends on alert-ingestion service

- Updated Prometheus service:
  - Added alerts.yml volume mount
  - Added command parameters for config file
  - Added dependency on alertmanager

- Updated alert-ingestion service:
  - Added dependency on Redis
  - Added environment variable: REDIS_URL
  - Added environment variable: PROMETHEUS_URL

- Added volumes:
  - redis_data
  - alertmanager_data

**Purpose:** Deploy Redis, Alertmanager, and configure service dependencies.

---

### 6. `monitoring/prometheus/prometheus.yml`
**Changes:**
- Added `alerting` section with alertmanager configuration
- Added `rule_files` section to load alerts.yml
- Configured alertmanagers target: alertmanager:9093

**Purpose:** Enable Prometheus alerting with Alertmanager integration.

---

## New Files Created

### 1. `src/queue/redisQueue.js`
**Purpose:** Redis queue manager using Bull library

**Features:**
- Creates and manages four queues:
  - `raw-alerts`: Unverified alerts from Prometheus
  - `success-alerts`: Successfully normalized alerts
  - `retry-alerts`: Failed alerts to retry
  - `error-alerts`: Alerts that exceeded max retries
- Event listeners for queue monitoring
- Configurable retry behavior
- Graceful shutdown handling
- Automatic job cleanup (removeOnComplete/removeOnFail)

**Key Functions:**
- Queue creation with Bull
- Event logging (completed, failed)
- Automatic retry-to-error migration
- SIGTERM handler for graceful shutdown

---

### 2. `src/services/verificationService.js`
**Purpose:** Alert verification service

**Features:**
- Validates incoming Prometheus alerts
- Implements 8 verification criteria:
  1. Status field presence
  2. Status must be "firing"
  3. Labels object validation
  4. Alertname presence in labels
  5. Severity/priority validation
  6. Severity value validation
  7. Timestamp validation
  8. Annotations validation

**Key Functions:**
- `verifyAlert(alert)` - Main verification function
- `normalizeSeverity(severity)` - Maps severity to standard values
- `isValidTimestamp(timestamp)` - Validates ISO timestamp
- `extractServiceName(labels)` - Extracts service identifier

**Severity Mapping:**
- critical, high, warning, info (standard)
- page → critical, urgent → high, low → info (aliases)

---

### 3. `src/services/normalizationService.js`
**Purpose:** Alert normalization service

**Features:**
- Transforms raw Prometheus alerts to standardized format
- Extracts service name with priority logic
- Normalizes severity values
- Generates unique alert IDs
- Preserves raw alert data for debugging

**Key Functions:**
- `normalizeAlert(rawAlert)` - Normalizes single alert
- `batchNormalizeAlerts(alerts)` - Batch normalization
- `isValidNormalizedAlert(alert)` - Validates normalized structure

**Output Format:**
```json
{
  "id": "uuid",
  "service": "extracted-service-name",
  "severity": "normalized-severity",
  "message": "alert-message",
  "timestamp": "ISO-8601",
  "labels": {...},
  "source": "prometheus",
  "_raw": {...}
}
```

---

### 4. `src/services/alertProcessor.js`
**Purpose:** Main alert processing orchestrator

**Features:**
- Processes alerts through complete pipeline
- Handles verification → normalization → routing
- Manages retry logic with configurable attempts
- Routes alerts to appropriate queues based on result
- Tracks processing statistics

**Key Functions:**
- `initializeProcessor()` - Sets up queue workers
- `enqueueAlert(alert)` - Adds alert to processing pipeline
- `getStats()` - Returns processing statistics
- `resetStats()` - Resets statistics counters

**Processing Flow:**
1. Pull from raw queue
2. Verify alert
3. Normalize alert
4. Validate normalized structure
5. Route to success/retry/error queue

**Statistics Tracked:**
- processed, verified, normalized, retried, errors

---

### 5. `src/routes/prometheus.js`
**Purpose:** Prometheus webhook API routes

**Endpoints:**

#### POST /api/prometheus/webhook
- Receives alerts from Prometheus Alertmanager
- Validates webhook payload
- Enqueues each alert for processing
- Returns summary of enqueued alerts

**Request:** Alertmanager webhook payload with alerts array

**Response:**
```json
{
  "message": "Alerts received and queued",
  "summary": {
    "total": 5,
    "successful": 5,
    "failed": 0
  },
  "results": [...]
}
```

#### GET /api/prometheus/stats
- Returns processing statistics
- Shows queue information

#### GET /api/prometheus/test
- Test endpoint for webhook verification
- Returns timestamp and confirmation message

---

### 6. `monitoring/prometheus/alertmanager.yml`
**Purpose:** Alertmanager configuration

**Features:**
- Routes all alerts to webhook receiver
- Groups alerts by alertname, cluster, service
- Configured delays: 10s wait, 10s interval, 12h repeat
- Webhook target: alert-ingestion:8001/api/prometheus/webhook
- send_resolved: false (only firing alerts)
- Inhibition rules: critical suppresses warning

---

### 7. `monitoring/prometheus/alerts.yml`
**Purpose:** Sample Prometheus alert rules

**Alert Rules Defined:**
1. **HighMemoryUsage** (severity: high)
   - Triggers when memory usage > 85% for 5 minutes
   
2. **HighCPUUsage** (severity: warning)
   - Triggers when CPU usage > 80% for 10 minutes
   
3. **ServiceDown** (severity: critical)
   - Triggers when service is down for 1 minute
   
4. **DiskSpaceLow** (severity: warning)
   - Triggers when disk space < 10% for 5 minutes
   
5. **HighErrorRate** (severity: high)
   - Triggers when HTTP 5xx rate > 0.05 for 5 minutes

Each alert includes:
- Labels: severity, environment, team
- Annotations: summary and description with template variables

---

### 8. `IMPLEMENTATION.md` (this file)
**Purpose:** Complete implementation documentation

**Sections:**
- Overview and architecture
- Component descriptions
- Configuration guide
- API endpoint documentation
- Error handling strategies
- Metrics and monitoring
- Testing procedures
- Deployment instructions
- Troubleshooting guide

---

## File Structure Summary

```
services/alert-ingestion/
├── package.json                           [MODIFIED]
├── src/
│   ├── server.js                         [MODIFIED]
│   ├── config.js                         [MODIFIED]
│   ├── metrics.js                        [MODIFIED]
│   ├── queue/
│   │   └── redisQueue.js                 [NEW]
│   ├── routes/
│   │   ├── alerts.js                     [EXISTING]
│   │   ├── health.js                     [EXISTING]
│   │   └── prometheus.js                 [NEW]
│   └── services/
│       ├── correlationService.js         [EXISTING]
│       ├── verificationService.js        [NEW]
│       ├── normalizationService.js       [NEW]
│       └── alertProcessor.js             [NEW]
├── IMPLEMENTATION.md                     [NEW]
└── MODIFICATIONS.md                      [NEW - this file]

monitoring/
└── prometheus/
    ├── prometheus.yml                    [MODIFIED]
    ├── alertmanager.yml                  [NEW]
    └── alerts.yml                        [NEW]

docker-compose.yml                        [MODIFIED]
```

---

## Dependencies Added

### package.json
```json
{
  "redis": "^4.6.12",    // Redis client for Node.js
  "bull": "^4.12.0"      // Redis-based queue for background jobs
}
```

---

## Environment Variables Added

```bash
REDIS_URL=redis://redis:6379
PROMETHEUS_URL=http://prometheus:9090
```

---

## Docker Services Added

1. **Redis**
   - Port: 6379
   - Purpose: Queue storage and management

2. **Alertmanager**
   - Port: 9093
   - Purpose: Alert routing and webhook delivery

---

## Installation & Deployment

### 1. Install Dependencies
```bash
cd services/alert-ingestion
npm install
```

### 2. Start All Services
```bash
# From project root
docker-compose up -d
```

### 3. Verify Services
```bash
# Check Redis
docker exec -it redis redis-cli ping

# Check Alertmanager
curl http://localhost:9093/-/healthy

# Check Alert Ingestion
curl http://localhost:8001/api/prometheus/test
```

### 4. View Logs
```bash
docker logs -f alert-ingestion
docker logs -f redis
docker logs -f alertmanager
```

---

## Testing the Implementation

### 1. Test Webhook Endpoint
```bash
curl -X POST http://localhost:8001/api/prometheus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "version": "4",
    "status": "firing",
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "TestAlert",
        "severity": "high",
        "instance": "test-server",
        "environment": "production"
      },
      "annotations": {
        "summary": "This is a test alert"
      },
      "startsAt": "2026-02-09T14:30:00Z"
    }]
  }'
```

### 2. Check Processing Statistics
```bash
curl http://localhost:8001/api/prometheus/stats
```

### 3. View Metrics
```bash
curl http://localhost:8001/metrics | grep alerts_
```

---

## Queue Monitoring

### Redis CLI Commands
```bash
# Enter Redis CLI
docker exec -it redis redis-cli

# List all keys
KEYS *

# Check queue lengths
LLEN bull:raw-alerts:wait
LLEN bull:success-alerts:wait
LLEN bull:retry-alerts:wait
LLEN bull:error-alerts:wait

# View queue jobs
LRANGE bull:raw-alerts:wait 0 -1
```

---

## Integration Points

### 1. Prometheus → Alertmanager
- Prometheus evaluates alert rules
- Sends firing alerts to Alertmanager
- Alertmanager groups and routes alerts

### 2. Alertmanager → Alert Ingestion
- Alertmanager sends webhook to `/api/prometheus/webhook`
- Alert Ingestion receives and enqueues alerts

### 3. Alert Ingestion → Redis
- Alerts stored in queues
- Processed asynchronously
- Automatic retry on failure

### 4. Success Queue → Correlation Service
- Successfully normalized alerts
- Ready for incident correlation
- Can be integrated with existing correlationService.js

---

## Key Design Decisions

1. **Separate Queues**: Raw, success, retry, error queues for clear separation of concerns

2. **Verification First**: Validate alerts before normalization to fail fast on invalid data

3. **Retry Logic**: Configurable retries (default: 3) with fixed delay (5s) for transient failures

4. **Normalized Format**: Standardized output format for consistent downstream processing

5. **Metrics Tracking**: Comprehensive metrics for monitoring pipeline health

6. **Error Preservation**: Failed alerts preserved in error queue for debugging

7. **Async Processing**: Non-blocking queue-based processing for scalability

---

## Next Steps

1. **Integration**: Connect success queue to existing correlation service
2. **Monitoring**: Add Grafana dashboard for queue metrics
3. **Alerting**: Set up alerts for error queue growth
4. **Security**: Add webhook authentication/authorization
5. **Testing**: Add unit and integration tests
6. **Documentation**: Add API documentation with examples

---

## Support & Troubleshooting

### Common Issues

**Issue:** Redis connection failed
- Check Redis is running: `docker ps | grep redis`
- Verify REDIS_URL environment variable

**Issue:** Alerts not being processed
- Check queue processor initialization in logs
- Verify Alertmanager webhook configuration
- Check processing statistics endpoint

**Issue:** High error rate
- Inspect error queue for common patterns
- Check alert verification criteria
- Review normalization logic

### Logging

All components log to console with prefixes:
- `[AlertProcessor]` - Processing pipeline
- `[Prometheus Webhook]` - Webhook endpoint
- `[rawAlertsQueue]` - Raw queue events
- `[retryQueue]` - Retry queue events
- `[errorQueue]` - Error queue events

---

## Version Information

- Node.js: 18+
- Redis: 7-alpine
- Prometheus: latest
- Alertmanager: latest
- Bull: 4.12.0
- redis client: 4.6.12

---

Last Updated: 2026-02-09

