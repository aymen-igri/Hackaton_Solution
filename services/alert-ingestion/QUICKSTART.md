# Quick Start Guide - Alert Ingestion Service

## Overview
This guide helps you quickly set up and test the Prometheus Alert Ingestion Service.

## Prerequisites
- Docker and Docker Compose installed
- Node.js 18+ (for local development)
- curl or Postman for testing

## Quick Setup (5 minutes)

### Step 1: Install Dependencies
```bash
cd services/alert-ingestion
npm install
```

### Step 2: Start All Services
```bash
# Return to project root
cd ../..

# Start all services with Docker Compose
docker-compose up -d
```

### Step 3: Verify Services Are Running
```bash
# Check all containers
docker ps

# Should see:
# - postgres
# - redis
# - prometheus
# - alertmanager
# - alert-ingestion
# - incident-management
# - oncall-service
# - grafana
# - web-ui
```

### Step 4: Wait for Services to Be Healthy
```bash
# Check Redis
docker exec -it redis redis-cli ping
# Expected: PONG

# Check Alert Ingestion
curl http://localhost:8001/health
# Expected: {"status":"ok"}

# Check Prometheus
curl http://localhost:9090/-/healthy
# Expected: Prometheus is Healthy.

# Check Alertmanager
curl http://localhost:9093/-/healthy
# Expected: OK
```

## Testing the Implementation

### Test 1: Verify Webhook Endpoint
```bash
curl http://localhost:8001/api/prometheus/test
```

**Expected Response:**
```json
{
  "message": "Prometheus webhook endpoint is active",
  "timestamp": "2026-02-09T14:30:00Z"
}
```

### Test 2: Send a Test Alert
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
      "fingerprint": "test-123"
    }]
  }'
```

**Expected Response:**
```json
{
  "message": "Alerts received and queued for processing",
  "summary": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "results": [
    {
      "success": true,
      "jobId": "1",
      "alertname": "HighMemoryUsage"
    }
  ]
}
```

### Test 3: Check Processing Statistics
```bash
curl http://localhost:8001/api/prometheus/stats
```

**Expected Response:**
```json
{
  "processed": 1,
  "verified": 1,
  "normalized": 1,
  "retried": 0,
  "errors": 0,
  "queues": {
    "raw": "raw-alerts",
    "success": "success-alerts",
    "retry": "retry-alerts",
    "error": "error-alerts"
  }
}
```

### Test 4: View Metrics
```bash
curl http://localhost:8001/metrics
```

Look for these metrics:
```
alerts_verified_total{status="passed"} 1
alerts_normalized_total 1
alerts_queued_total{queue="raw"} 1
alerts_queued_total{queue="success"} 1
```

### Test 5: Test Invalid Alert (Verification Failure)
```bash
curl -X POST http://localhost:8001/api/prometheus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "version": "4",
    "status": "firing",
    "alerts": [{
      "status": "resolved",
      "labels": {
        "alertname": "TestAlert"
      },
      "annotations": {
        "summary": "This should fail verification"
      },
      "startsAt": "2026-02-09T14:30:00Z"
    }]
  }'
```

**Expected:** Alert will be rejected and sent to error queue (status is "resolved", not "firing")

### Test 6: Inspect Redis Queues
```bash
# Enter Redis CLI
docker exec -it redis redis-cli

# List all queue keys
KEYS *

# Check raw queue length
LLEN bull:raw-alerts:wait

# Check success queue length
LLEN bull:success-alerts:wait

# Check error queue length
LLEN bull:error-alerts:wait

# View a job from success queue
LRANGE bull:success-alerts:completed 0 0
```

## Access Service UIs

### Prometheus
- URL: http://localhost:9090
- Navigate to Status → Targets to see monitored services
- Navigate to Alerts to see configured alert rules
- Navigate to Graph to query metrics

### Alertmanager
- URL: http://localhost:9093
- View active alerts
- Check webhook receiver configuration
- Monitor alert grouping

### Grafana
- URL: http://localhost:3000
- Default credentials: admin/admin
- Import dashboards from monitoring/grafana/dashboards/

### Alert Ingestion API
- Health: http://localhost:8001/health
- Metrics: http://localhost:8001/metrics
- Stats: http://localhost:8001/api/prometheus/stats

## View Logs

### Alert Ingestion Service Logs
```bash
docker logs -f alert-ingestion
```

Look for:
```
[Alert Ingestion] Running on port 8001
[Alert Ingestion] Prometheus webhook: http://localhost:8001/api/prometheus/webhook
[AlertProcessor] Initializing alert processor...
[AlertProcessor] Alert processor initialized successfully
```

When alerts are processed:
```
[Prometheus Webhook] Received 1 alerts
[AlertProcessor] Processing raw alert: HighMemoryUsage
[AlertProcessor] Alert verified: Alert verified successfully
[AlertProcessor] Alert normalized successfully: <uuid>
[successQueue] Job <id> completed
```

### Redis Logs
```bash
docker logs -f redis
```

### Alertmanager Logs
```bash
docker logs -f alertmanager
```

## Common Test Scenarios

### Scenario 1: Valid Alert (Success Path)
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
**Expected:** Alert → verified → normalized → success queue

### Scenario 2: Missing Severity (Verification Failure)
```bash
curl -X POST http://localhost:8001/api/prometheus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "TestMissingSeverity",
        "instance": "server-01"
      },
      "annotations": {
        "summary": "Missing severity field"
      },
      "startsAt": "2026-02-09T14:30:00Z"
    }]
  }'
```
**Expected:** Alert → verification failure → error queue

### Scenario 3: Invalid Severity (Normalization Failure)
```bash
curl -X POST http://localhost:8001/api/prometheus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "TestInvalidSeverity",
        "severity": "invalid-level",
        "instance": "server-01"
      },
      "annotations": {
        "summary": "Invalid severity value"
      },
      "startsAt": "2026-02-09T14:30:00Z"
    }]
  }'
```
**Expected:** Alert → verified → normalization failure → retry queue → (after 3 retries) → error queue

### Scenario 4: Batch Alerts
```bash
curl -X POST http://localhost:8001/api/prometheus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "Alert1",
          "severity": "high",
          "instance": "server-01"
        },
        "annotations": {"summary": "First alert"},
        "startsAt": "2026-02-09T14:30:00Z"
      },
      {
        "status": "firing",
        "labels": {
          "alertname": "Alert2",
          "severity": "warning",
          "instance": "server-02"
        },
        "annotations": {"summary": "Second alert"},
        "startsAt": "2026-02-09T14:31:00Z"
      },
      {
        "status": "firing",
        "labels": {
          "alertname": "Alert3",
          "severity": "critical",
          "instance": "server-03"
        },
        "annotations": {"summary": "Third alert"},
        "startsAt": "2026-02-09T14:32:00Z"
      }
    ]
  }'
```
**Expected:** All 3 alerts processed independently

## Monitoring & Debugging

### Check Queue Status
```bash
# Get processing stats
curl http://localhost:8001/api/prometheus/stats | jq

# Expected output:
{
  "processed": 10,
  "verified": 9,
  "normalized": 8,
  "retried": 1,
  "errors": 2,
  "queues": {...}
}
```

### Inspect Error Queue
```bash
docker exec -it redis redis-cli

# Count errors
LLEN bull:error-alerts:completed

# View first error
LRANGE bull:error-alerts:completed 0 0
```

### View Prometheus Metrics
```bash
# All alert metrics
curl http://localhost:8001/metrics | grep -E "alerts_"

# Verification metrics
curl http://localhost:8001/metrics | grep "alerts_verified"

# Queue metrics
curl http://localhost:8001/metrics | grep "alerts_queued"
```

## Troubleshooting

### Issue: Webhook returns 500 error
**Solution:** Check alert-ingestion logs
```bash
docker logs alert-ingestion
```

### Issue: Alerts not being processed
**Solution:** Check processor initialization
```bash
docker logs alert-ingestion | grep "AlertProcessor"
```

### Issue: Redis connection error
**Solution:** Verify Redis is running
```bash
docker ps | grep redis
docker exec -it redis redis-cli ping
```

### Issue: High error rate
**Solution:** Inspect error queue
```bash
curl http://localhost:8001/api/prometheus/stats
# Check "errors" count

# Then inspect error queue in Redis
docker exec -it redis redis-cli
LRANGE bull:error-alerts:completed 0 -1
```

## Clean Up

### Stop All Services
```bash
docker-compose down
```

### Stop and Remove Volumes (Complete Reset)
```bash
docker-compose down -v
```

### Remove Only Alert Processing Data
```bash
docker exec -it redis redis-cli FLUSHALL
```

## Next Steps

1. **Configure Real Alerts**: Edit `monitoring/prometheus/alerts.yml`
2. **Set Up Grafana**: Import dashboards from `monitoring/grafana/dashboards/`
3. **Integrate Correlation**: Connect success queue to correlation service
4. **Add Authentication**: Secure webhook endpoint
5. **Monitor Production**: Set up alerting on error queue growth

## Quick Reference

### Service Ports
- Alert Ingestion: 8001
- Incident Management: 8002
- OnCall Service: 8003
- Grafana: 3000
- PostgreSQL: 5432
- Redis: 6379
- Prometheus: 9090
- Alertmanager: 9093
- Web UI: 8080

### Important Endpoints
- Webhook: POST http://localhost:8001/api/prometheus/webhook
- Stats: GET http://localhost:8001/api/prometheus/stats
- Health: GET http://localhost:8001/health
- Metrics: GET http://localhost:8001/metrics

### Useful Commands
```bash
# View all containers
docker ps

# View logs
docker logs -f alert-ingestion

# Restart service
docker-compose restart alert-ingestion

# Enter Redis CLI
docker exec -it redis redis-cli

# Check queue length
docker exec -it redis redis-cli LLEN bull:success-alerts:wait

# View metrics
curl http://localhost:8001/metrics | grep alerts_

# Test webhook
curl http://localhost:8001/api/prometheus/test
```

---

For detailed documentation, see:
- `IMPLEMENTATION.md` - Complete technical documentation
- `MODIFICATIONS.md` - List of all changes and new files
- `README.md` - Project overview

---

Last Updated: 2026-02-09

