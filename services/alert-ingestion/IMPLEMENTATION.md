# Alert Ingestion Service - Implementation Documentation

## Overview
This document describes the implementation of the Prometheus Alert Ingestion Pipeline with verification, normalization, and Redis queue management.

## Architecture

### System Flow
```
Prometheus → Alertmanager → Webhook → Alert Ingestion Service
                                              ↓
                                      [Verification]
                                              ↓
                                      [Raw Queue (Redis)]
                                              ↓
                                      [Normalization]
                                              ↓
                            ┌─────────────────┴─────────────────┐
                            ↓                                   ↓
                    [Success Queue]                      [Retry Queue]
                            ↓                                   ↓
                    [Correlation Service]              [Retry Processor]
                                                               ↓
                                                       [Max Retries?]
                                                               ↓
                                                        [Error Queue]
```

## Components

### 1. Prometheus Webhook Endpoint
**File:** `src/routes/prometheus.js`

Receives alerts from Prometheus Alertmanager via webhook.

**Endpoint:** `POST /api/prometheus/webhook`

**Request Format:**
```json
{
  "version": "4",
  "status": "firing",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "HighMemoryUsage",
        "severity": "high",
        "instance": "api-server-03",
        "environment": "production",
        "team": "platform"
      },
      "annotations": {
        "summary": "Memory usage above 85% for 5 minutes"
      },
      "startsAt": "2026-02-09T14:30:00Z",
      "fingerprint": "abc123"
    }
  ]
}
```

**Response:**
```json
{
  "message": "Alerts received and queued for processing",
  "summary": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "results": [...]
}
```

### 2. Alert Verification Service
**File:** `src/services/verificationService.js`

Verifies that incoming data is a valid alert before processing.

#### Verification Criteria:
1. **Status Check**: Alert status must be "firing" (not "resolved")
2. **Required Fields**: Must have `alertname` in labels
3. **Severity Check**: Must have valid severity (critical, high, warning, info)
4. **Timestamp Validation**: Must have valid ISO timestamp
5. **Labels Validation**: Must have labels object with required fields
6. **Annotations Check**: Must have summary, message, or description

#### Severity Mapping:
```javascript
{
  'critical' → 'critical',
  'high' → 'high',
  'warning' → 'warning',
  'info' → 'info',
  'page' → 'critical',
  'urgent' → 'high',
  'low' → 'info'
}
```

**Example Usage:**
```javascript
const { verifyAlert } = require('./services/verificationService');

const verification = verifyAlert(alert);
if (verification.valid) {
  // Process alert
} else {
  console.log(`Verification failed: ${verification.reason}`);
}
```

### 3. Redis Queue Manager
**File:** `src/queue/redisQueue.js`

Manages four separate Redis queues using Bull library:

#### Queue Types:
- **rawAlertsQueue**: Stores unverified alerts from Prometheus
- **successQueue**: Stores successfully normalized alerts
- **retryQueue**: Stores alerts that failed normalization (to be retried)
- **errorQueue**: Stores alerts that exceeded max retries

**Configuration:**
```javascript
{
  maxRetries: 3,
  retryDelayMs: 5000 // 5 seconds between retries
}
```

### 4. Normalization Service
**File:** `src/services/normalizationService.js`

Transforms raw Prometheus alerts into standardized format.

#### Input (Raw Alert):
```json
{
  "status": "firing",
  "labels": {
    "alertname": "HighMemoryUsage",
    "severity": "high",
    "instance": "api-server-03",
    "environment": "production",
    "team": "platform"
  },
  "annotations": {
    "summary": "Memory usage above 85% for 5 minutes"
  },
  "startsAt": "2026-02-09T14:30:00Z",
  "fingerprint": "abc123"
}
```

#### Output (Normalized Alert):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "service": "api-server-03",
  "severity": "high",
  "message": "Memory usage above 85% for 5 minutes",
  "timestamp": "2026-02-09T14:30:00Z",
  "labels": {
    "alertname": "HighMemoryUsage",
    "environment": "production",
    "team": "platform",
    "instance": "api-server-03",
    "severity": "high"
  },
  "source": "prometheus",
  "_raw": {
    "fingerprint": "abc123",
    "generatorURL": "...",
    "annotations": {...}
  }
}
```

#### Service Name Extraction Priority:
1. `labels.instance`
2. `labels.service`
3. `labels.job`
4. `labels.alertname`
5. "unknown-service" (fallback)

### 5. Alert Processor
**File:** `src/services/alertProcessor.js`

Main processing engine that orchestrates the entire pipeline.

#### Processing Steps:
1. **Pull from Raw Queue**: Retrieve alert from rawAlertsQueue
2. **Verify**: Check if alert is valid using verificationService
3. **Normalize**: Transform to standard format using normalizationService
4. **Route**: Send to appropriate queue based on result
   - Success → successQueue
   - Failure (< max retries) → retryQueue
   - Failure (≥ max retries) → errorQueue

**Statistics Tracking:**
```javascript
{
  processed: 0,
  verified: 0,
  normalized: 0,
  retried: 0,
  errors: 0
}
```

## Configuration

### Environment Variables
```bash
PORT=8001
REDIS_URL=redis://localhost:6379
PROMETHEUS_URL=http://prometheus:9090
DATABASE_URL=postgres://postgres:postgres@localhost:5432/incident_platform
INCIDENT_SERVICE_URL=http://localhost:8002
ONCALL_SERVICE_URL=http://localhost:8003
```

### Config File
**File:** `src/config.js`
```javascript
{
  port: 8001,
  redisUrl: 'redis://localhost:6379',
  prometheusUrl: 'http://prometheus:9090',
  normalization: {
    maxRetries: 3,
    retryDelayMs: 5000
  }
}
```

## API Endpoints

### Prometheus Webhook
```
POST /api/prometheus/webhook
```
Receives alerts from Prometheus Alertmanager.

### Processing Statistics
```
GET /api/prometheus/stats
```
Returns processing statistics.

**Response:**
```json
{
  "processed": 150,
  "verified": 145,
  "normalized": 140,
  "retried": 5,
  "errors": 10,
  "queues": {
    "raw": "raw-alerts",
    "success": "success-alerts",
    "retry": "retry-alerts",
    "error": "error-alerts"
  }
}
```

### Health Check
```
GET /api/prometheus/test
```
Tests Prometheus webhook endpoint.

## Prometheus & Alertmanager Setup

### Alertmanager Configuration
**File:** `monitoring/prometheus/alertmanager.yml`

Configured to send all firing alerts to the webhook endpoint:
```yaml
receivers:
  - name: 'webhook'
    webhook_configs:
      - url: 'http://alert-ingestion:8001/api/prometheus/webhook'
        send_resolved: false
```

### Alert Rules
**File:** `monitoring/prometheus/alerts.yml`

Includes sample alert rules:
- HighMemoryUsage (severity: high)
- HighCPUUsage (severity: warning)
- ServiceDown (severity: critical)
- DiskSpaceLow (severity: warning)
- HighErrorRate (severity: high)

## Error Handling

### Verification Failures
Alerts that fail verification are immediately sent to errorQueue with reason:
```json
{
  "alert": {...},
  "reason": "Missing severity/priority in labels",
  "stage": "verification",
  "timestamp": "2026-02-09T14:30:00Z"
}
```

### Normalization Failures
Alerts that fail normalization are sent to retryQueue up to maxRetries times:
```json
{
  "alert": {...},
  "attemptCount": 2,
  "lastError": "Cannot normalize severity: unknown",
  "timestamp": "2026-02-09T14:30:00Z"
}
```

After max retries, moved to errorQueue:
```json
{
  "alert": {...},
  "reason": "Cannot normalize severity: unknown",
  "stage": "normalization",
  "attempts": 3,
  "timestamp": "2026-02-09T14:30:00Z"
}
```

## Metrics

New Prometheus metrics exposed at `/metrics`:

```
# Verification metrics
alerts_verified_total{status="passed"} 145
alerts_verified_total{status="failed"} 5

# Normalization metrics
alerts_normalized_total 140

# Queue metrics
alerts_queued_total{queue="raw"} 150
alerts_queued_total{queue="success"} 140
alerts_queued_total{queue="retry"} 5
alerts_queued_total{queue="error"} 10

# Retry metrics
alerts_retried_total 5

# Error metrics
alerts_failed_total{stage="verification"} 5
alerts_failed_total{stage="normalization"} 5
```

## Testing

### Manual Testing with curl
```bash
# Test webhook endpoint
curl -X POST http://localhost:8001/api/prometheus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "version": "4",
    "status": "firing",
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "HighMemoryUsage",
        "severity": "high",
        "instance": "api-server-03",
        "environment": "production",
        "team": "platform"
      },
      "annotations": {
        "summary": "Memory usage above 85% for 5 minutes"
      },
      "startsAt": "2026-02-09T14:30:00Z",
      "fingerprint": "abc123"
    }]
  }'

# Check statistics
curl http://localhost:8001/api/prometheus/stats
```

## Dependencies

### New Dependencies Added:
```json
{
  "redis": "^4.6.12",
  "bull": "^4.12.0"
}
```

## Docker Services

### Redis
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
```

### Alertmanager
```yaml
alertmanager:
  image: prom/alertmanager:latest
  ports:
    - "9093:9093"
  volumes:
    - ./monitoring/prometheus/alertmanager.yml:/etc/alertmanager/alertmanager.yml
```

## Deployment

### Start Services
```bash
docker-compose up -d
```

### Check Logs
```bash
# Alert Ingestion Service
docker logs -f alert-ingestion

# Redis
docker logs -f redis

# Alertmanager
docker logs -f alertmanager
```

### Access UIs
- Prometheus: http://localhost:9090
- Alertmanager: http://localhost:9093
- Alert Ingestion API: http://localhost:8001
- Grafana: http://localhost:3000

## Troubleshooting

### Redis Connection Issues
```bash
# Check Redis connectivity
docker exec -it redis redis-cli ping
```

### Queue Inspection
```bash
# Connect to Redis and inspect queues
docker exec -it redis redis-cli
> KEYS *
> LLEN bull:raw-alerts:*
```

### Alert Processing Stuck
Check processing statistics:
```bash
curl http://localhost:8001/api/prometheus/stats
```

## Future Enhancements
1. Add queue monitoring dashboard in Grafana
2. Implement dead letter queue with manual review
3. Add alert enrichment from external sources
4. Implement priority-based queue processing
5. Add webhook authentication/security

