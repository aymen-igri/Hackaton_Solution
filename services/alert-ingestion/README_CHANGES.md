# Alert Ingestion Service - Summary of Changes

## 🎯 Implementation Completed

A complete Prometheus alert ingestion pipeline has been implemented with:
- **Alert verification** (8 validation criteria)
- **Alert normalization** (standardized format)
- **Redis queue management** (4 separate queues)
- **Automatic retry logic** (configurable attempts)
- **Comprehensive monitoring** (Prometheus metrics)

---

## 📋 Quick Reference

### New Documentation Files Created

1. **QUICKSTART.md** - 5-minute setup guide with testing examples
2. **IMPLEMENTATION.md** - Complete technical documentation
3. **MODIFICATIONS.md** - Detailed list of all changes
4. **ARCHITECTURE.md** - System architecture overview
5. **README_CHANGES.md** - This summary file

### Modified Files (6 files)

| File | Changes |
|------|---------|
| `package.json` | Added redis, bull dependencies |
| `src/config.js` | Added Redis URL, retry configuration |
| `src/server.js` | Added prometheus routes, processor initialization |
| `src/metrics.js` | Added 5 new metrics for pipeline monitoring |
| `docker-compose.yml` | Added Redis, Alertmanager services |
| `monitoring/prometheus/prometheus.yml` | Added alerting configuration |

### New Files Created (11 files)

| File | Purpose |
|------|---------|
| `src/queue/redisQueue.js` | Redis queue manager (4 queues) |
| `src/services/verificationService.js` | Alert verification (8 criteria) |
| `src/services/normalizationService.js` | Alert normalization to standard format |
| `src/services/alertProcessor.js` | Processing orchestrator |
| `src/routes/prometheus.js` | Webhook endpoint for Prometheus |
| `monitoring/prometheus/alertmanager.yml` | Alertmanager configuration |
| `monitoring/prometheus/alerts.yml` | Sample alert rules |
| `QUICKSTART.md` | Quick start guide |
| `IMPLEMENTATION.md` | Technical documentation |
| `MODIFICATIONS.md` | Change log |
| `ARCHITECTURE.md` | Architecture overview |

---

## 🚀 How to Start

```bash
# 1. Install dependencies
cd services/alert-ingestion
npm install

# 2. Start all services
cd ../..
docker-compose up -d

# 3. Test the webhook
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
        "environment": "production",
        "team": "platform"
      },
      "annotations": {
        "summary": "This is a test alert"
      },
      "startsAt": "2026-02-09T14:30:00Z",
      "fingerprint": "test-123"
    }]
  }'

# 4. Check statistics
curl http://localhost:8001/api/prometheus/stats
```

---

## 🔍 System Flow

```
Prometheus → Alertmanager → Webhook → Verification → Raw Queue
                                                          ↓
                                                    Normalization
                                                          ↓
                                    ┌─────────────────────┴─────────────┐
                                    ↓                                   ↓
                             Success Queue                        Retry Queue
                                    ↓                                   ↓
                            Correlation                      (Max 3 retries)
                                                                        ↓
                                                                  Error Queue
```

---

## 📊 Key Features

### 1. Alert Verification
Validates alerts with **8 criteria**:
- ✅ Status must be "firing"
- ✅ Has alertname in labels
- ✅ Has valid severity (critical/high/warning/info)
- ✅ Has valid timestamp
- ✅ Has complete labels object
- ✅ Has annotations with message
- ✅ Severity mapping support
- ✅ Service name extraction

### 2. Alert Normalization
Transforms Prometheus alerts to standardized format:

**Output Format:**
```json
{
  "id": "uuid",
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

### 3. Redis Queue Management
**4 Separate Queues:**
- **raw-alerts** - Unverified alerts from Prometheus
- **success-alerts** - Successfully normalized alerts
- **retry-alerts** - Failed normalization (to retry)
- **error-alerts** - Permanent failures (after max retries)

### 4. Retry Logic
- **Max retries:** 3 attempts
- **Retry delay:** 5 seconds
- **Auto-migration:** retry → error queue after max attempts

---

## 🔧 Configuration

### Environment Variables
```bash
PORT=8001
REDIS_URL=redis://redis:6379
PROMETHEUS_URL=http://prometheus:9090
DATABASE_URL=postgres://postgres:postgres@localhost:5432/incident_platform
```

### Retry Configuration
```javascript
normalization: {
  maxRetries: 3,
  retryDelayMs: 5000
}
```

---

## 📈 Metrics

New metrics available at `http://localhost:8001/metrics`:

```
alerts_verified_total{status="passed"}
alerts_verified_total{status="failed"}
alerts_normalized_total
alerts_queued_total{queue="raw|success|retry|error"}
alerts_retried_total
alerts_failed_total{stage="verification|normalization"}
```

---

## 🐳 Docker Services

| Service | Port | Status |
|---------|------|--------|
| PostgreSQL | 5432 | ✅ Existing |
| **Redis** | 6379 | 🆕 New |
| Prometheus | 9090 | ✅ Modified |
| **Alertmanager** | 9093 | 🆕 New |
| Alert Ingestion | 8001 | ✅ Modified |
| Incident Mgmt | 8002 | ✅ Existing |
| OnCall Service | 8003 | ✅ Existing |
| Grafana | 3000 | ✅ Existing |
| Web UI | 8080 | ✅ Existing |

---

## 🎯 API Endpoints

### New Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/prometheus/webhook` | Receive alerts from Alertmanager |
| GET | `/api/prometheus/stats` | Get processing statistics |
| GET | `/api/prometheus/test` | Test webhook endpoint |

### Existing Endpoints
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics
- `POST /api/alerts` - Create alert
- `GET /api/alerts` - List alerts

---

## 🧪 Testing Examples

### Valid Alert (Success)
```bash
curl -X POST http://localhost:8001/api/prometheus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "TestSuccess",
        "severity": "critical",
        "instance": "server-01"
      },
      "annotations": {
        "summary": "Test successful processing"
      },
      "startsAt": "2026-02-09T14:30:00Z"
    }]
  }'
```
**Result:** verified → normalized → success queue ✅

### Invalid Alert (Verification Failure)
```bash
curl -X POST http://localhost:8001/api/prometheus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [{
      "status": "resolved",
      "labels": {"alertname": "Test"},
      "annotations": {"summary": "Test"},
      "startsAt": "2026-02-09T14:30:00Z"
    }]
  }'
```
**Result:** verification failed → error queue ❌

---

## 📚 Documentation Guide

| File | Read for... |
|------|-------------|
| **QUICKSTART.md** | Quick setup and testing (5 min) |
| **ARCHITECTURE.md** | System overview and data flow |
| **IMPLEMENTATION.md** | Detailed technical documentation |
| **MODIFICATIONS.md** | Complete list of changes |

---

## 🔍 Monitoring & Debugging

### Check Processing Stats
```bash
curl http://localhost:8001/api/prometheus/stats
```

### View Logs
```bash
docker logs -f alert-ingestion
```

### Inspect Redis Queues
```bash
docker exec -it redis redis-cli
KEYS *
LLEN bull:success-alerts:wait
```

### View Metrics
```bash
curl http://localhost:8001/metrics | grep alerts_
```

---

## ✅ Verification Checklist

- [x] Redis service added to docker-compose
- [x] Alertmanager service added to docker-compose
- [x] Prometheus configured with alerting
- [x] Alert verification service implemented
- [x] Alert normalization service implemented
- [x] Queue management with Bull/Redis
- [x] Retry logic with configurable attempts
- [x] Webhook endpoint for Prometheus
- [x] Processing statistics endpoint
- [x] Comprehensive metrics
- [x] Sample alert rules
- [x] Documentation files created
- [x] No compilation errors

---

## 🎉 What You Get

✅ **Complete Pipeline:** From Prometheus alert to normalized data  
✅ **Reliable Processing:** Automatic retries with error handling  
✅ **Full Visibility:** Metrics, logs, and statistics  
✅ **Production Ready:** Docker deployment with health checks  
✅ **Well Documented:** 4 comprehensive documentation files  
✅ **Easy Testing:** curl examples and test scenarios  
✅ **Scalable Design:** Queue-based async processing  

---

## 🚦 Next Steps

1. **Start Services:** `docker-compose up -d`
2. **Run Tests:** Use curl examples from QUICKSTART.md
3. **Monitor Metrics:** Check `http://localhost:8001/metrics`
4. **View Logs:** `docker logs -f alert-ingestion`
5. **Configure Alerts:** Edit `monitoring/prometheus/alerts.yml`
6. **Integrate Correlation:** Connect success queue to correlation service

---

## 📞 Troubleshooting

**Problem:** Services not starting  
**Solution:** Check `docker-compose up -d` and `docker ps`

**Problem:** Webhook returns errors  
**Solution:** Check logs with `docker logs alert-ingestion`

**Problem:** Alerts not processing  
**Solution:** Check stats at `http://localhost:8001/api/prometheus/stats`

**Problem:** High error rate  
**Solution:** Inspect error queue in Redis

---

## 📦 Dependencies Added

```json
{
  "redis": "^4.6.12",
  "bull": "^4.12.0"
}
```

---

## 🏗️ Project Structure

```
services/alert-ingestion/
├── src/
│   ├── queue/           [NEW] Redis queue management
│   ├── routes/
│   │   └── prometheus.js    [NEW] Webhook endpoint
│   └── services/
│       ├── verificationService.js     [NEW]
│       ├── normalizationService.js    [NEW]
│       └── alertProcessor.js          [NEW]
├── QUICKSTART.md        [NEW]
├── IMPLEMENTATION.md    [NEW]
├── MODIFICATIONS.md     [NEW]
├── ARCHITECTURE.md      [NEW]
└── README_CHANGES.md    [NEW] This file
```

---

**Implementation Status:** ✅ **COMPLETE**  
**Version:** 1.0.0  
**Date:** 2026-02-09  
**Ready for:** Production Testing

---

For detailed information, see:
- **Quick Start:** QUICKSTART.md
- **Architecture:** ARCHITECTURE.md  
- **Full Documentation:** IMPLEMENTATION.md
- **Change Log:** MODIFICATIONS.md

