# End-to-End Integration Test: Mock Service -> Prometheus -> Alertmanager -> Alert-Ingestion

## Objective
To verify the complete alert pipeline from a simulated metric in the local mock service to its ingestion by the `alert-ingestion` service running in Docker Compose.

## Services Involved
*   **Mock Metrics Service (Local):** Exposes `/metrics` for Prometheus and `/simulate` endpoints for triggering alerts. Runs on `http://localhost:8082`.
*   **Prometheus (Docker Compose):** Scrapes metrics from the mock service, evaluates alert rules, and forwards firing alerts to Alertmanager. Runs on `http://localhost:9090`.
*   **Alertmanager (Docker Compose):** Receives alerts from Prometheus and routes them to configured receivers (in this case, a webhook to `alert-ingestion`). Runs on `http://localhost:9093`.
*   **Alert-Ingestion Service (Docker Compose):** Receives webhooks from Alertmanager at `http://alert-ingestion:8001/api/prometheus/webhook`.

## Pre-requisites
1.  Docker and Docker Compose are installed and running.
2.  Node.js and npm are installed on the host machine.
3.  The `incident-platform` project is cloned and set up.

## Setup Instructions (To be performed by the user)
1.  **Start Docker Compose Services:**
    ```bash
    docker compose up -d
    ```
2.  **Start Mock Metrics Service:**
    Navigate to the `services/mock-metrics` directory and run:
    ```bash
    cd services/mock-metrics
    npm install
    node server.js
    ```
    Confirm the output: `Mock Metrics Service running on http://localhost:8082`

## Test Scenarios

### Scenario 1: Mock Service Health Check
*   **Description:** Verify that the mock metrics service is accessible on the host machine.
*   **Steps:**
    1.  Run `curl http://localhost:8082/health`
*   **Expected Result:** HTTP 200 OK with response "Mock Metrics Service is UP!"

### Scenario 2: Prometheus Scrape Verification
*   **Description:** Verify that Prometheus is successfully scraping metrics from the mock service.
*   **Steps:**
    1.  Access Prometheus UI in browser: `http://localhost:9090/targets`
    2.  Alternatively, use the Prometheus API:
        ```bash
        curl 'http://localhost:9090/api/v1/targets?state=active'
        ```
*   **Expected Result:**
    *   Prometheus UI should show a target named `mock-metrics` with state `UP`.
    *   API response should contain an entry for `mock-metrics` with `health: "up"`.

### Scenario 3: Triggering and Verifying a "MockHighMemoryUsage" Alert

*   **Description:** Simulate a high memory usage condition in the mock service, then verify that Prometheus fires the corresponding alert and Alertmanager forwards it to `alert-ingestion`.

*   **Steps:**
    1.  **Trigger High Memory Usage in Mock Service:**
        ```bash
        curl -X POST http://localhost:8082/simulate/memory-usage/90
        ```
        (This sets `mock_high_memory_usage_bytes` to 90, which is above the 85 threshold in `alert.rules.yml`)

    2.  **Verify Alert in Prometheus (after ~30-45 seconds for scrape + evaluation):**
        ```bash
        curl 'http://localhost:9090/api/v1/alerts'
        ```
        *Note: The alert has a `for: 30s` clause, so it will take at least 30 seconds after the metric is scraped to transition to `firing`.*

    3.  **Verify Alert in Alertmanager UI (optional, for visual confirmation):**
        Access Alertmanager UI: `http://localhost:9093/#/alerts`

    4.  **Verify Alert Ingestion (by checking `alert-ingestion` service logs):**
        ```bash
        docker compose logs alert-ingestion | grep "Received alert"
        ```
        *Note: The exact log message might vary depending on the implementation of `alert-ingestion` for webhook processing.*

*   **Expected Result:**
    *   **Step 1:** Response from mock service: `High memory usage set to: 90`
    *   **Step 2:** Prometheus API response should contain an alert with `alertname: "MockHighMemoryUsage"`, `state: "firing"`.
    *   **Step 3:** Alertmanager UI should show the `MockHighMemoryUsage` alert.
    *   **Step 4:** `alert-ingestion` logs should show a message indicating that it received the alert webhook.

### Scenario 4: Resolving a "MockHighMemoryUsage" Alert

*   **Description:** Reset the memory usage in the mock service to a normal level, then verify that Prometheus resolves the alert and Alertmanager removes it.

*   **Steps:**
    1.  **Reset Memory Usage in Mock Service:**
        ```bash
        curl -X POST http://localhost:8082/simulate/memory-usage/50
        ```
        (This sets `mock_high_memory_usage_bytes` to 50, below the 85 threshold)

    2.  **Verify Alert Resolution in Prometheus (after ~30-45 seconds for scrape + evaluation):**
        ```bash
        curl 'http://localhost:9090/api/v1/alerts'
        ```
        *Note: It takes time for Prometheus to re-evaluate and for the alert to clear.*

    3.  **Verify Alert Resolution in Alertmanager UI (optional):**
        Access Alertmanager UI: `http://localhost:9093/#/alerts`

    4.  **Verify Resolved Alert (by checking `alert-ingestion` service logs):**
        *Note: The `alertmanager.yml` has `send_resolved: false`, so Alertmanager will *not* send a resolved notification to `alert-ingestion`. This step primarily confirms the alert disappears from Alertmanager.*
        ```bash
        docker compose logs alert-ingestion
        ```

*   **Expected Result:**
    *   **Step 1:** Response from mock service: `High memory usage set to: 50`
    *   **Step 2:** Prometheus API response should *not* contain the `MockHighMemoryUsage` alert.
    *   **Step 3:** Alertmanager UI should *not* show the `MockHighMemoryUsage` alert.
    *   **Step 4:** No new log entries in `alert-ingestion` related to the resolution of `MockHighMemoryUsage` alert (due to `send_resolved: false`).

## Cleanup (To be performed by the user after tests)
1.  Stop Docker Compose services: `docker compose down`
2.  Stop the mock metrics service (Ctrl+C in the terminal where it's running).

# Service Metrics – Documentation Technique

## 🎯 Objectif

Service Node.js qui agrège des données depuis **Prometheus** (requêtes instant + range) et **PostgreSQL** (incidents), puis les expose via **API REST** et **WebSocket** vers le UI.

---

## 🏗️ Architecture
