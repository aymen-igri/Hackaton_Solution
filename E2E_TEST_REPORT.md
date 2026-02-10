# End-to-End Test Report: Mock-Metrics to Alert-Ingestion

**Test Date:** February 10, 2026  
**Test Environment:** Docker Compose Stack  
**Tester:** Automated E2E Test Suite

---

## Executive Summary

All end-to-end tests passed successfully. The complete alert flow from mock-metrics service through Prometheus, Alertmanager, and into the alert-ingestion service is fully operational.

| Test Category         | Tests Run | Passed | Failed |
| --------------------- | --------- | ------ | ------ |
| Service Health        | 5         | 5      | 0      |
| Prometheus Scraping   | 1         | 1      | 0      |
| Direct Webhook        | 1         | 1      | 0      |
| Prometheus Alert Flow | 3         | 3      | 0      |
| **Total**             | **10**    | **10** | **0**  |

---

## Test 1: Service Health Checks

### 1.1 Docker Containers Status

| Container           | Status            | Port |
| ------------------- | ----------------- | ---- |
| alert-ingestion     | Running           | 8001 |
| prometheus          | Running           | 9090 |
| alertmanager        | Running           | 9093 |
| incident-management | Running           | 8002 |
| incident-redis      | Running (healthy) | 6379 |

**Result:** PASS

### 1.2 Mock-Metrics Service Health

```
Endpoint: http://localhost:8082/health
Response: Mock Metrics Service is UP!
```

**Result:** PASS

---

## Test 2: Prometheus Scraping Verification

### 2.1 Target Configuration

| Target          | Job Name     | Health | Scrape URL                               |
| --------------- | ------------ | ------ | ---------------------------------------- |
| mock-metrics    | mock-metrics | up     | http://host.docker.internal:8082/metrics |
| alert-ingestion | services     | up     | http://alert-ingestion:8001/metrics      |

**Result:** PASS - Prometheus successfully scrapes mock-metrics every 15 seconds

---

## Test 3: Direct Webhook POST Test

### 3.1 Test Payload

```json
{
  "version": "4",
  "status": "firing",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "E2E_Test_Alert",
        "severity": "high",
        "instance": "test-server",
        "service": "test-service"
      },
      "annotations": {
        "summary": "End-to-end test alert"
      },
      "startsAt": "2026-02-10T01:00:00Z"
    }
  ]
}
```

### 3.2 Response

```
message: Alerts received and queued for processing
summary: { total: 1, successful: 1, failed: 0 }
```

### 3.3 Stats Before/After

| Metric     | Before | After | Delta |
| ---------- | ------ | ----- | ----- |
| processed  | 19     | 21    | +2    |
| verified   | 19     | 21    | +2    |
| normalized | 19     | 21    | +2    |
| errors     | 0      | 0     | 0     |

**Result:** PASS

---

## Test 4: Full Prometheus Alert Flow

### 4.1 Alert Rules Loaded

```
Groups loaded: 5
- service-health
- alert-quality
- incident-lifecycle
- mock-alerts
- oncall-activity
```

### 4.2 Simulated Conditions

| Simulation           | Endpoint                                 | Value  |
| -------------------- | ---------------------------------------- | ------ |
| High Memory          | /simulate/memory-usage/95                | 95%    |
| Service Down         | /simulate/service-up/payment-svc/0       | DOWN   |
| DB Connection Failed | /simulate/db-connection-failed/main-db/1 | FAILED |

### 4.3 Alerts Fired in Prometheus

| Alert Name                   | State  | Severity |
| ---------------------------- | ------ | -------- |
| MockHighMemoryUsage          | firing | high     |
| MockServiceDown              | firing | critical |
| MockDatabaseConnectionFailed | firing | critical |

### 4.4 Alerts Received in Alert-Ingestion

Evidence from logs:

```
[Prometheus Webhook] Received 1 alerts
POST /api/prometheus/webhook HTTP/1.1" 200 189 "-" "Alertmanager/0.31.0"
[AlertProcessor] Processing raw alert: MockDatabaseConnectionFailed
[AlertProcessor] Alert normalized successfully: 47bea3ab-d7f0-42a9-b589-cf18722676da

[Prometheus Webhook] Received 1 alerts
POST /api/prometheus/webhook HTTP/1.1" 200 176 "-" "Alertmanager/0.31.0"
[AlertProcessor] Processing raw alert: MockServiceDown
[AlertProcessor] Alert normalized successfully: 0f2eea3c-bc32-444c-bfeb-e3af8f11edb3

[Prometheus Webhook] Received 1 alerts
POST /api/prometheus/webhook HTTP/1.1" 200 180 "-" "Alertmanager/0.31.0"
[AlertProcessor] Processing raw alert: MockHighMemoryUsage
[AlertProcessor] Alert normalized successfully: 6d0b35cd-89cb-4e49-934a-eda2692ee285
```

### 4.5 Final Processing Stats

| Metric     | Value |
| ---------- | ----- |
| processed  | 24    |
| verified   | 24    |
| normalized | 24    |
| retried    | 0     |
| errors     | 0     |

**Result:** PASS - All 3 mock alerts successfully flowed through the entire pipeline

---

## Data Flow Verification

```
mock-metrics (8082)
      |
      | GET /metrics (every 15s)
      v
Prometheus (9090)
      |
      | Evaluates alert.rules.yml
      | Fires when: mock_high_memory_usage_bytes > 80
      |            mock_service_up == 0
      |            mock_db_connection_failed == 1
      v
Alertmanager (9093)
      |
      | POST to webhook (group_wait: 10s)
      v
alert-ingestion (8001)
      |
      | /api/prometheus/webhook
      | -> verifyAlert()
      | -> normalizeAlert()
      | -> enqueue to Redis
      v
Redis Queues
      |
      | raw-alerts -> success-alerts
      v
Processed & Ready for Incident Correlation
```

---

## Timing Analysis

| Step                       | Expected Time | Observed |
| -------------------------- | ------------- | -------- |
| Prometheus scrape interval | 15s           | ~15s     |
| Alert rule evaluation      | 15s           | ~15s     |
| Alert pending (for clause) | 10-30s        | ~15s     |
| Alertmanager group_wait    | 10s           | ~10s     |
| Total time to webhook      | 40-70s        | ~55s     |

---

## Conclusion

The end-to-end test demonstrates that:

1. mock-metrics service correctly exposes Prometheus metrics
2. Prometheus successfully scrapes mock-metrics and evaluates alert rules
3. Alert rules for mock metrics fire correctly when thresholds are crossed
4. Alertmanager receives and routes alerts to the webhook
5. alert-ingestion service receives, verifies, and normalizes all alerts
6. No errors occurred during the entire flow

**Overall Result: ALL TESTS PASSED**
