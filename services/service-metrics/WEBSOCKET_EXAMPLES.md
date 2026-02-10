# 📡 API & WebSocket Formats – Service Metrics

**Base URL:** `http://localhost:8005`
**WebSocket URL:** `ws://localhost:8005`

---

## 🔌 REST API Endpoints

### 1. Health Check
```http
GET /health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-02-09T10:30:00.000Z"
}
```

---

### 2. Incidents by Service
```http
GET /api/metrics/incidents/by-service
```

**Response (200):**
```json
{
  "status": "success",
  "data": [
    {
      "service": "platform",
      "total_incidents": 15,
      "open_count": 3,
      "ack_count": 2,
      "resolved_count": 10
    }
  ]
}
```

---

### 3. Incidents Details (MTTA/MTTR)
```http
GET /api/metrics/incidents/details
```

**Response (200):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "High Memory Usage",
      "severity": "high",
      "source": "prometheus",
      "status": "resolved",
      "created_at": "2026-02-09T08:00:00Z",
      "acknowledged_at": "2026-02-09T08:05:30Z",
      "resolved_at": "2026-02-09T09:15:00Z",
      "mtta_seconds": 330,
      "mttr_seconds": 4500
    }
  ]
}
```

---

### 4. Prometheus Metrics
```http
GET /metrics
```

**Response (200):** Text format (Prometheus)

````

{
  "type": "connection",
  "message": "Connected to service-metrics",
  "timestamp": "2026-02-09T10:30:00.000Z"
}

Instant Metrics (Every 10 seconds)
Sent automatically by server



{
  "type": "instant_metrics",
  "timestamp": "2026-02-09T10:30:05.000Z",
  "data": {
    "prometheus_tsdb_head_series": {
      "resultType": "vector",
      "result": [
        {
          "metric": {},
          "value": [1707472205, "15234"]
        }
      ]
    },
    "prometheus_engine_queries": {
      "resultType": "vector",
      "result": [
        {
          "metric": {},
          "value": [1707472205, "3"]
        }
      ]
    },
    "http_requests_total": {
      "resultType": "vector",
      "result": [
        {
          "metric": {
            "__name__": "http_requests_total",
            "instance": "localhost:8081",
            "job": "mock-metrics",
            "method": "GET",
            "status": "200"
          },
          "value": [1707472205, "1234"]
        },
        {
          "metric": {
            "__name__": "http_requests_total",
            "instance": "localhost:8081",
            "job": "mock-metrics",
            "method": "POST",
            "status": "201"
          },
          "value": [1707472205, "567"]
        }
      ]
    }
  }
}






{
  "type": "range_metrics",
  "timestamp": "2026-02-09T10:30:05.000Z",
  "data": {
    "memory_usage_1h": {
      "resultType": "matrix",
      "result": [
        {
          "metric": {
            "__name__": "memory_usage_bytes",
            "instance": "localhost:8081",
            "job": "mock-metrics"
          },
          "values": [
            [1707468600, "1073741824"],
            [1707468660, "1107296256"],
            [1707468720, "1140850688"],
            [1707469140, "1208666112"],
            [1707472200, "1291845632"]
          ]
        }
      ]
    },
    "cpu_usage_1h": {
      "resultType": "matrix",
      "result": [
        {
          "metric": {
            "__name__": "cpu_usage_seconds_total",
            "instance": "localhost:8081",
            "job": "mock-metrics"
          },
          "values": [
            [1707468600, "45.23"],
            [1707468660, "46.12"],
            [1707468720, "47.05"],
            [1707472200, "62.34"]
          ]
        }
      ]
    },
    "http_requests_24h": {
      "resultType": "matrix",
      "result": [
        {
          "metric": {
            "__name__": "http_requests_total",
            "instance": "localhost:8081",
            "job": "mock-metrics",
            "method": "GET"
          },
          "values": [
            [1707386400, "2340"],
            [1707390000, "2567"],
            [1707393600, "2891"],
            [1707472200, "3567"]
          ]
        }
      ]
    }
  }
}


Acknowledgment Message
Sent in response to client message


{
  "type": "ack",
  "requestType": "subscribe",
  "timestamp": "2026-02-09T10:30:05.000Z"
}