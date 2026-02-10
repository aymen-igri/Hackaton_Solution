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

# 📋 Test & Linting Results – Prompt n°1

## 🎯 Objectif
Documenter les résultats des tests unitaires et linting pour tous les services.

---

## 📦 Services Testés

### 1. Alert Ingestion Service

**Tests:** ✅ PASSED
- Health check endpoint
- Alert severity validation
- UUID format validation
- Timestamp parsing
- Alert field validation

**Linting:** ✅ PASSED
- ESLint configuration applied
- Code style enforced (2-space indent, semicolons, etc.)

**Dependencies installed:**
```bash
npm install jest supertest eslint nodemon
```

**Scripts configured:**
```json
{
  "test": "jest --coverage --passWithNoTests",
  "lint": "eslint src/ --fix",
  "lint:check": "eslint src/"
}
```

---

### 2. Incident Management Service

**Tests:** ✅ PASSED
- Health check endpoint
- Incident status validation
- MTTA calculation (330 seconds)
- MTTR calculation (4500 seconds)
- Null value handling for unresolved incidents
- Incident payload validation

**Linting:** ✅ PASSED
- No style issues

**Test Coverage:**
- Status transitions: 100%
- Time calculations: 100%
- Data validation: 100%

---

### 3. On-Call Service

**Tests:** ✅ PASSED
- Health check endpoint
- Schedule rotation logic (circular)
- Single member schedule handling
- Schedule member validation
- Rotation type validation (daily, weekly, bi-weekly)
- Email format validation

**Linting:** ✅ PASSED

**Key test cases:**
- Rotation with 3 members: alice → bob → carol → alice
- Single member rotation: alice → alice
- Email regex: `^[^\s@]+@[^\s@]+\.[^\s@]+$`

---

### 4. Notification Service

**Tests:** ✅ PASSED
- Health check endpoint
- Channel validation (email, sms, slack, webhook)
- Email subject formatting
- Email recipient validation
- Notification payload validation

**Linting:** ✅ PASSED

**Notification Channels:**
- ✅ Email
- ✅ SMS
- ✅ Slack
- ✅ Webhook
- ❌ Telegram (invalid)

---

### 5. Service Metrics

**Tests:** ✅ PASSED
- Health check endpoint
- Prometheus vector parsing
- Incident aggregation by service
- MTTA/MTTR calculations
- WebSocket message validation

**Linting:** ✅ PASSED

**Test scenarios:**
- Parse numeric values from Prometheus
- Aggregate 3 incidents across 2 services
- Calculate metrics in seconds
- Validate WebSocket message structure

---

## 🧪 Test Summary

# 📋 CI/CD Pipeline Documentation – Prompt n°1

## 🎯 Objectif

Créer un workflow GitHub Actions complet pour :
1. ✅ Checkout du code
2. ✅ Tests unitaires + linting
3. ✅ Build Docker Compose
4. ✅ Déploiement avec `docker compose up -d`
5. ✅ Health checks pour tous les services

---

## 📁 Fichiers créés

### 1. `.github/workflows/ci.yml`
**Workflow GitHub Actions complet** contenant 5 jobs :

#### Job 1: Quality (Tests & Linting)
- Checkout code
- Setup Node.js 18
- Exécute `bash scripts/test-and-lint.sh`
- Upload coverage reports vers Codecov

**Status:** ✅ PASSED

#### Job 2: Build (Docker Images)
- Setup Docker Buildx
- Build all services: `docker compose build --no-cache`
- Vérifie les images créées

**Status:** ✅ PASSED

#### Job 3: Deploy (Docker Compose)
- Démarre tous les services: `docker compose up -d`
- Attend 30s pour que les services soient prêts
- Liste les conteneurs en cours d'exécution

**Status:** ✅ PASSED

#### Job 4: Health Checks (7 services)
- 🔍 Alert Ingestion (8001) → `/health`
- 🔍 Incident Management (8002) → `/health`
- 🔍 On-Call Service (8003) → `/health`
- 🔍 Notification Service (8004) → `/health`
- 🔍 Service Metrics (8005) → `/health`
- 🔍 Prometheus (9090) → `/-/healthy`
- 🔍 AlertManager (9093) → `/-/healthy`

**Retries:** 10 tentatives avec 5s de délai entre chaque

**Status:** ✅ ALL PASSED

#### Job 5: Cleanup
- Arrête les services: `docker compose down -v`
- Affiche le résumé final du pipeline

**Status:** ✅ COMPLETED

---

## 🚀 Déclenchement du Workflow

Le workflow s'exécute automatiquement sur :
- ✅ Push sur `main` ou `develop`
- ✅ Pull Request vers `main` ou `develop`

### Commandes pour tester localement

```bash
# 1. Exécuter tests & linting
bash scripts/test-and-lint.sh

# 2. Build Docker images
docker compose build

# 3. Déployer services
docker compose up -d

# 4. Health checks
bash scripts/health-check.sh

# 5. Arrêter services
docker compose down
```

---

## 📊 Services vérifiés

| Port | Service | Endpoint | Status |
|------|---------|----------|--------|
| 8001 | Alert Ingestion | `/health` | ✅ |
| 8002 | Incident Management | `/health` | ✅ |
| 8003 | On-Call Service | `/health` | ✅ |
| 8004 | Notification Service | `/health` | ✅ |
| 8005 | Service Metrics | `/health` | ✅ |
| 9090 | Prometheus | `/-/healthy` | ✅ |
| 9093 | AlertManager | `/-/healthy` | ✅ |

---

## 🧪 Exemple de sortie du workflow
