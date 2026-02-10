# Service Integration Guide

This guide explains how to connect your services to the Incident Management Platform for monitoring and alerting.

## Overview

There are two ways to send alerts to the platform:

1. Via Prometheus and Alertmanager (recommended for metrics-based monitoring)
2. Direct webhook calls (for custom integrations)

---

## Option 1: Prometheus Integration

This method is ideal if your service exposes metrics that Prometheus can scrape.

### Step 1: Expose a Metrics Endpoint

Your service must expose metrics in Prometheus format at a `/metrics` endpoint. Example using Node.js with prom-client:

```javascript
const client = require("prom-client");
const express = require("express");

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom metric example
const requestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "status"],
  registers: [register],
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
```

### Step 2: Register Your Service in Prometheus

Add your service to `monitoring/prometheus/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: "your-service"
    metrics_path: /metrics
    static_configs:
      - targets: ["your-service-host:port"]
```

### Step 3: Define Alert Rules

Add alerting rules in `monitoring/prometheus/alert.rules.yml`:

```yaml
groups:
  - name: your-service-alerts
    rules:
      - alert: YourServiceDown
        expr: up{job="your-service"} == 0
        for: 1m
        labels:
          severity: "critical"
        annotations:
          summary: "Your service is down"
          description: "Service {{ $labels.instance }} is not responding"
```

### Step 4: Restart Prometheus

```bash
docker-compose restart prometheus
```

Alerts will automatically flow through Alertmanager to the alert-ingestion service.

---

## Option 2: Direct Webhook Integration

Use this method to send alerts directly without Prometheus.

### Endpoint

```
POST http://localhost:8001/api/prometheus/webhook
Content-Type: application/json
```

### Payload Format

```json
{
  "version": "4",
  "status": "firing",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "YourAlertName",
        "severity": "critical",
        "instance": "your-server-01",
        "service": "your-service"
      },
      "annotations": {
        "summary": "Brief description of the issue",
        "description": "Detailed description"
      },
      "startsAt": "2026-02-10T10:00:00Z"
    }
  ]
}
```

### Required Fields

- `alerts[].status`: Must be "firing"
- `alerts[].labels.alertname`: Name of the alert
- `alerts[].labels.severity`: One of "critical", "high", "warning", "info"
- `alerts[].annotations.summary`: Brief message describing the alert
- `alerts[].startsAt`: ISO 8601 timestamp

### Example Request

Using curl:

```bash
curl -X POST http://localhost:8001/api/prometheus/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "version": "4",
    "status": "firing",
    "alerts": [{
      "status": "firing",
      "labels": {
        "alertname": "HighLatency",
        "severity": "warning",
        "instance": "api-gateway",
        "service": "payment-service"
      },
      "annotations": {
        "summary": "API latency exceeds threshold"
      },
      "startsAt": "2026-02-10T10:00:00Z"
    }]
  }'
```

---

## Verifying Integration

### Check if alerts are received

```bash
curl http://localhost:8001/api/prometheus/stats
```

### Test the webhook endpoint

```bash
curl http://localhost:8001/api/prometheus/test
```

---

## Service Ports Reference

| Service             | Port | Purpose                         |
| ------------------- | ---- | ------------------------------- |
| alert-ingestion     | 8001 | Receives alerts via webhook     |
| incident-management | 8002 | Manages incidents               |
| Prometheus          | 9090 | Metrics collection and alerting |
| Alertmanager        | 9093 | Alert routing and grouping      |

---

## Troubleshooting

If alerts are not being received:

1. Verify Prometheus can reach your service: Check Prometheus targets at http://localhost:9090/targets
2. Check alert rules are loaded: Visit http://localhost:9090/alerts
3. Verify Alertmanager is running: Check http://localhost:9093
4. Check alert-ingestion logs: `docker logs alert-ingestion`

For webhook issues, ensure your payload includes all required fields and the severity value is valid.
