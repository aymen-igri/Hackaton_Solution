# Alert Ingestion Service - Architecture Overview

## 🎯 Project Summary

This implementation adds a complete **Prometheus Alert Ingestion Pipeline** to the incident management platform. The service receives alerts from Prometheus via Alertmanager webhook, verifies them, normalizes them into a standard format, and queues them in Redis for processing.

## 🏗️ Architecture Diagram

```
┌─────────────┐
│ Prometheus  │ Scrapes metrics and evaluates alert rules
└──────┬──────┘
       │
       ▼
┌──────────────┐
│ Alertmanager │ Groups, routes, and deduplicates alerts
└──────┬───────┘
       │ Webhook POST
       ▼
┌────────────────────────────────────────────────┐
│         Alert Ingestion Service                │
│  ┌──────────────────────────────────────────┐  │
│  │  POST /api/prometheus/webhook            │  │
│  └───────────────┬──────────────────────────┘  │
│                  ▼                              │
│         ┌────────────────┐                      │
│         │  Verification  │ Check if valid alert│
│         │    Service     │ (8 criteria)        │
│         └────────┬───────┘                      │
│                  ▼                              │
│         ┌────────────────┐                      │
│         │ Enqueue to     │                      │
│         │ Raw Queue      │                      │
│         └────────┬───────┘                      │
│                  │                              │
└──────────────────┼──────────────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │  Redis Queues   │
         │  ┌───────────┐  │
         │  │Raw Queue  │  │
         │  └─────┬─────┘  │
         └────────┼─────────┘
                  │
                  ▼
         ┌────────────────┐
         │Queue Processor │
         └────────┬───────┘
                  │
          ┌───────┴────────┐
          ▼                ▼
    ┌──────────┐    ┌──────────┐
    │ Verify   │    │   Fail   │
    └────┬─────┘    └────┬─────┘
         │               │
         ▼               ▼
    ┌──────────┐    ┌──────────┐
    │Normalize │    │  Error   │
    └────┬─────┘    │  Queue   │
         │          └──────────┘
    ┌────┴─────┐
    ▼          ▼
┌─────────┐  ┌────────┐
│Success  │  │ Retry  │
│ Queue   │  │ Queue  │
└────┬────┘  └───┬────┘
     │           │
     │           │ Max retries exceeded
     │           └──────────┐
     │                      ▼
     │                 ┌──────────┐
     │                 │  Error   │
     │                 │  Queue   │
     │                 └──────────┘
     ▼
┌─────────────────┐
│  Correlation    │
│    Service      │
└─────────────────┘
```

## 📦 Components

### 1. **Verification Service** (`src/services/verificationService.js`)
Validates incoming alerts against 8 criteria:
- Status must be "firing"
- Required fields present (alertname, severity)
- Valid severity level
- Valid timestamp format
- Complete labels and annotations

### 2. **Normalization Service** (`src/services/normalizationService.js`)
Transforms raw Prometheus alerts to standardized format:

**Input (Prometheus format):**
```json
{
  "status": "firing",
  "labels": {
    "alertname": "HighMemoryUsage",
    "severity": "high",
    "instance": "api-server-03"
  },
  "annotations": {
    "summary": "Memory usage above 85%"
  },
  "startsAt": "2026-02-09T14:30:00Z"
}
```

**Output (Normalized format):**
```json
{
  "id": "uuid",
  "service": "api-server-03",
  "severity": "high",
  "message": "Memory usage above 85%",
  "timestamp": "2026-02-09T14:30:00Z",
  "labels": {...},
  "source": "prometheus"
}
```

### 3. **Queue Manager** (`src/queue/redisQueue.js`)
Manages 4 Redis queues using Bull:

| Queue | Purpose | Retry Logic |
|-------|---------|-------------|
| **raw-alerts** | Unverified alerts from Prometheus | No retry |
| **success-alerts** | Successfully normalized alerts | No retry |
| **retry-alerts** | Failed normalization (temporary) | 3 retries, 5s delay |
| **error-alerts** | Permanent failures | No retry |

### 4. **Alert Processor** (`src/services/alertProcessor.js`)
Orchestrates the entire pipeline:
1. Pull from raw queue
2. Verify alert
3. Normalize alert
4. Route to success/retry/error queue

Tracks statistics: processed, verified, normalized, retried, errors

### 5. **Prometheus Webhook Route** (`src/routes/prometheus.js`)
Exposes HTTP endpoints:
- `POST /api/prometheus/webhook` - Receives alerts
- `GET /api/prometheus/stats` - Processing statistics
- `GET /api/prometheus/test` - Health check

## 🔧 Configuration

### Environment Variables
```bash
PORT=8001
REDIS_URL=redis://redis:6379
PROMETHEUS_URL=http://prometheus:9090
DATABASE_URL=postgres://postgres:postgres@localhost:5432/incident_platform
```

### Alert Processing Config
```javascript
{
  normalization: {
    maxRetries: 3,        // Max retry attempts
    retryDelayMs: 5000    // 5 seconds between retries
  }
}
```

## 📊 Monitoring Metrics

New Prometheus metrics exposed at `/metrics`:

```prometheus
# Verification
alerts_verified_total{status="passed"}
alerts_verified_total{status="failed"}

# Normalization
alerts_normalized_total

# Queues
alerts_queued_total{queue="raw"}
alerts_queued_total{queue="success"}
alerts_queued_total{queue="retry"}
alerts_queued_total{queue="error"}

# Retries
alerts_retried_total

# Errors
alerts_failed_total{stage="verification"}
alerts_failed_total{stage="normalization"}
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd services/alert-ingestion
npm install
```

### 2. Start Services
```bash
# From project root
docker-compose up -d
```

### 3. Test the Webhook
```bash
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
```

### 4. Check Statistics
```bash
curl http://localhost:8001/api/prometheus/stats
```

## 📁 File Structure

```
services/alert-ingestion/
├── src/
│   ├── server.js                          # [MODIFIED] Added prometheus routes
│   ├── config.js                          # [MODIFIED] Added Redis config
│   ├── metrics.js                         # [MODIFIED] Added new metrics
│   ├── queue/
│   │   └── redisQueue.js                  # [NEW] Redis queue manager
│   ├── routes/
│   │   ├── alerts.js                      # [EXISTING]
│   │   ├── health.js                      # [EXISTING]
│   │   └── prometheus.js                  # [NEW] Webhook endpoint
│   ├── services/
│   │   ├── correlationService.js          # [EXISTING]
│   │   ├── verificationService.js         # [NEW] Alert verification
│   │   ├── normalizationService.js        # [NEW] Alert normalization
│   │   └── alertProcessor.js              # [NEW] Processing orchestrator
│   └── db/
│       └── queries.js                     # [EXISTING]
├── package.json                           # [MODIFIED] Added redis, bull
├── IMPLEMENTATION.md                      # [NEW] Technical docs
├── MODIFICATIONS.md                       # [NEW] Change list
└── QUICKSTART.md                          # [NEW] Quick start guide

monitoring/
└── prometheus/
    ├── prometheus.yml                     # [MODIFIED] Added alerting
    ├── alertmanager.yml                   # [NEW] Alertmanager config
    └── alerts.yml                         # [NEW] Sample alert rules

docker-compose.yml                         # [MODIFIED] Added Redis, Alertmanager
```

## 🔍 Service Dependencies

```
┌──────────────┐
│  PostgreSQL  │ ◄─── Alert storage
└──────────────┘

┌──────────────┐
│    Redis     │ ◄─── Queue storage
└──────────────┘

┌──────────────┐
│  Prometheus  │ ◄─── Metrics scraping
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Alertmanager │ ◄─── Alert routing
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Alert Ingestion  │ ◄─── Main service
└──────────────────┘
```

## 🎨 Data Flow Example

### Example: High Memory Alert

**1. Prometheus detects high memory**
```yaml
- alert: HighMemoryUsage
  expr: memory_usage > 85
  for: 5m
  labels:
    severity: high
    instance: api-server-03
```

**2. Alertmanager sends webhook**
```json
POST http://alert-ingestion:8001/api/prometheus/webhook
{
  "alerts": [{
    "status": "firing",
    "labels": {...},
    "annotations": {...},
    "startsAt": "2026-02-09T14:30:00Z"
  }]
}
```

**3. Verification (8 checks)**
- ✅ Status is "firing"
- ✅ Has alertname
- ✅ Has valid severity
- ✅ Has valid timestamp
- ✅ Has complete labels
- ✅ Has annotations
- Result: **PASSED**

**4. Normalization**
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
    "team": "platform"
  },
  "source": "prometheus"
}
```

**5. Queue Routing**
- Verification: PASSED ✅
- Normalization: SUCCESS ✅
- Queue: **success-alerts** ✅

**6. Ready for Correlation**
Alert is now in success queue, ready to be picked up by correlation service

## 📚 Documentation Files

| File | Description |
|------|-------------|
| **QUICKSTART.md** | Quick setup and testing guide (5 minutes) |
| **IMPLEMENTATION.md** | Complete technical documentation |
| **MODIFICATIONS.md** | Detailed list of all changes and new files |
| **ARCHITECTURE.md** | This file - architecture overview |

## 🐳 Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| **PostgreSQL** | 5432 | Database |
| **Redis** | 6379 | Queue storage |
| **Prometheus** | 9090 | Metrics & alerting |
| **Alertmanager** | 9093 | Alert routing |
| **Alert Ingestion** | 8001 | Main service |
| **Incident Mgmt** | 8002 | Incident management |
| **OnCall Service** | 8003 | On-call scheduling |
| **Grafana** | 3000 | Dashboards |
| **Web UI** | 8080 | Frontend |

## 🔗 API Endpoints

### Prometheus Integration
- `POST /api/prometheus/webhook` - Receive alerts from Alertmanager
- `GET /api/prometheus/stats` - Get processing statistics
- `GET /api/prometheus/test` - Test webhook endpoint

### Existing Endpoints
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics
- `POST /api/alerts` - Create alert manually
- `GET /api/alerts` - List alerts

## ⚠️ Error Handling

### Verification Failures
**Reason:** Alert doesn't meet criteria
**Action:** Immediately → Error Queue
**Example:** Status is "resolved" instead of "firing"

### Normalization Failures
**Reason:** Cannot transform to standard format
**Action:** Retry Queue (up to 3 times) → Error Queue
**Example:** Invalid severity value

### Max Retries Exceeded
**Reason:** Failed after 3 retry attempts
**Action:** Error Queue
**Monitoring:** Check error queue metrics

## 📈 Success Metrics

After implementation, you can track:
- **Alert ingestion rate**: alerts_received_total
- **Verification success rate**: alerts_verified_total{status="passed"} / total
- **Normalization success rate**: alerts_normalized_total / alerts_verified_total
- **Error rate**: alerts_failed_total by stage
- **Queue depths**: alerts_queued_total by queue
- **Retry rate**: alerts_retried_total

## 🎯 Testing Scenarios

### ✅ Valid Alert (Success Path)
Alert with all required fields → Verified → Normalized → Success Queue

### ❌ Missing Severity (Verification Failure)
Alert without severity → Verification Failed → Error Queue

### ⚠️ Invalid Severity (Normalization Failure)
Alert with invalid severity → Verified → Normalization Failed → Retry Queue → Error Queue

### 📦 Batch Processing
Multiple alerts in one webhook → Each processed independently

## 🛠️ Troubleshooting

### Check Service Health
```bash
docker ps
curl http://localhost:8001/health
curl http://localhost:8001/api/prometheus/test
```

### View Logs
```bash
docker logs -f alert-ingestion
```

### Inspect Queues
```bash
docker exec -it redis redis-cli
KEYS *
LLEN bull:success-alerts:wait
```

### View Statistics
```bash
curl http://localhost:8001/api/prometheus/stats
```

## 🔮 Future Enhancements

1. **Queue Monitoring Dashboard** - Grafana dashboard for queue metrics
2. **Alert Enrichment** - Add context from external sources
3. **Priority Processing** - Process critical alerts first
4. **Webhook Security** - Add authentication/authorization
5. **Dead Letter Queue Review** - Manual review interface for errors
6. **Performance Optimization** - Batch processing for high volume

## 📞 Support

For issues or questions:
1. Check logs: `docker logs alert-ingestion`
2. Review statistics: `curl http://localhost:8001/api/prometheus/stats`
3. Inspect error queue: `docker exec -it redis redis-cli`
4. Check metrics: `curl http://localhost:8001/metrics`

## 📝 Summary

This implementation provides:
- ✅ Prometheus alert ingestion via webhook
- ✅ Comprehensive alert verification (8 criteria)
- ✅ Standardized alert normalization
- ✅ Redis-based queue management (4 queues)
- ✅ Automatic retry logic with configurable attempts
- ✅ Complete metrics and monitoring
- ✅ Error tracking and debugging
- ✅ Docker-based deployment
- ✅ Comprehensive documentation

**Result:** A production-ready alert ingestion pipeline that reliably processes Prometheus alerts with verification, normalization, and intelligent retry logic.

---

**Version:** 1.0.0  
**Last Updated:** 2026-02-09  
**Status:** ✅ Production Ready

