# Documentation: End-to-End Integration Testing with Mock Metrics Service

## Overview
This document outlines the end-to-end integration testing methodology for the DevOps Incident & On-Call Platform, specifically focusing on the alert pipeline: Mock Metrics Service -> Prometheus -> Alertmanager -> Alert-Ingestion Service. The goal is to ensure that simulated operational issues (metrics) are correctly identified by Prometheus, routed by Alertmanager, and ingested by the `alert-ingestion` microservice for further processing.

## Architecture & Communication Flow

1.  **Mock Metrics Service:** A Node.js application running directly on the host machine (not containerized). It provides a `/metrics` endpoint for Prometheus to scrape and a set of `/simulate/...` POST endpoints to dynamically adjust metric values, thereby simulating various system conditions (e.g., high memory usage, service downtime).
    *   **Running on:** `http://localhost:8082`

2.  **Prometheus:** A Docker container responsible for monitoring. It is configured to scrape the `/metrics` endpoint of the `mock-metrics` service via `host.docker.internal:8082`. Prometheus evaluates pre-defined alert rules based on these metrics. When an alert condition is met, Prometheus generates an alert.
    *   **Running on:** `http://localhost:9090` (within Docker Compose)
    *   **Configuration:** `monitoring/prometheus/prometheus.yml`, `monitoring/prometheus/alert.rules.yml`

3.  **Alertmanager:** A Docker container that receives alerts from Prometheus. It is responsible for deduplicating, grouping, and routing these alerts to the correct receivers. In this setup, Alertmanager is configured to forward all alerts to the `alert-ingestion` service via a webhook.
    *   **Running on:** `http://localhost:9093` (within Docker Compose)
    *   **Configuration:** `monitoring/prometheus/alertmanager.yml`

4.  **Alert-Ingestion Service:** A Docker container that acts as the entry point for alerts into the incident management platform. It exposes a webhook endpoint (`/api/prometheus/webhook`) that Alertmanager posts alerts to. This service is then responsible for validating, normalizing, correlating, and creating/updating incidents based on the incoming alerts.
    *   **Running on:** `http://localhost:8001` (within Docker Compose)

**Simplified Flow Diagram:**

```
[Mock Metrics Service (Host:8082)] --(Scrapes)--> [Prometheus (Docker:9090)]
                                                         |
                                                        (Alerts)
                                                         |
                                                         v
                                              [Alertmanager (Docker:9093)]
                                                         |
                                                        (Webhook)
                                                         |
                                                         v
                                            [Alert-Ingestion Service (Docker:8001)]
```

## How to Interpret Test Results

### 1. Mock Service Accessibility (`http://localhost:8082/health`)
*   **Success:** A `200 OK` response with "Mock Metrics Service is UP!" indicates the local service is running and reachable.
*   **Failure:** Connection refused or timeout indicates the service is not running or is blocked by a firewall.

### 2. Prometheus Scrape Status (`http://localhost:9090/targets` or `/api/v1/targets`)
*   **Success:** The `mock-metrics` job/target showing `UP` status confirms Prometheus can successfully reach and scrape metrics from the `mock-metrics` service.
*   **Failure:** `DOWN` status suggests network connectivity issues between the Prometheus container and the host machine, or the `mock-metrics` service is not accessible at `host.docker.internal:8082`.

### 3. Prometheus Alerting (`http://localhost:9090/api/v1/alerts`)
*   **Success:** An alert appearing in the Prometheus UI or API with `state: "firing"` (after the configured `for:` duration) signifies that Prometheus has correctly evaluated the alert rule based on the simulated metric.
*   **Failure:** No alert or `state: "pending"` for an extended period could mean:
    *   The metric value wasn't set correctly in the mock service.
    *   Prometheus hasn't scraped the new metric value yet.
    *   The alert rule expression is incorrect or the `for:` duration hasn't passed.

### 4. Alertmanager UI (`http://localhost:9093/#/alerts`)
*   **Success:** The alert appearing in the Alertmanager UI confirms that Prometheus successfully forwarded the alert to Alertmanager.
*   **Failure:** If an alert is firing in Prometheus but not visible in Alertmanager, there might be a misconfiguration in Prometheus's `alerting` section or Alertmanager itself.

### 5. Alert-Ingestion Service Logs (`docker compose logs alert-ingestion`)
*   **Success:** Log entries like "Received alert webhook from Alertmanager" (or similar, depending on implementation) confirm that Alertmanager successfully sent the webhook, and the `alert-ingestion` service received it.
*   **Failure:** Absence of such logs suggests:
    *   The webhook URL in `alertmanager.yml` is incorrect.
    *   Network issues preventing Alertmanager from reaching `alert-ingestion`.
    *   The `alert-ingestion` service is not correctly configured to listen for webhooks on `/api/prometheus/webhook`.

## Key Configuration Points for Troubleshooting

*   **Mock Service Port:** Ensure the mock service is indeed running on `8082`.
*   **Prometheus Scrape Config:** Verify `host.docker.internal:8082` is correctly specified in `prometheus.yml` under the `mock-metrics` job.
*   **Alert Rule Expressions:** Double-check the `expr` and `for` clauses in `alert.rules.yml` to match the expected metric values and timings.
*   **Alertmanager Webhook URL:** Confirm `http://alert-ingestion:8001/api/prometheus/webhook` is precise in `alertmanager.yml`.
*   **`alert-ingestion` Webhook Endpoint:** Ensure the `alert-ingestion` service actually implements an endpoint at `/api/prometheus/webhook` that can process POST requests.

By following the provided test scenarios and understanding these interpretation guidelines, the full lifecycle of an alert, from simulation to ingestion, can be thoroughly validated.
