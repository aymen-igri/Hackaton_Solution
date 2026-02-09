# Incident Management Service

> Microservice responsible for the full incident lifecycle — from alert consumption to engineer assignment and SRE metrics.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [How It Works (End-to-End Flow)](#how-it-works-end-to-end-flow)
- [Decision Logic — `shouldCreateIncident`](#decision-logic--shouldcreateincident)
- [Redis Queues](#redis-queues)
- [Workers](#workers)
  - [Alert Consumer](#1-alert-consumer)
  - [Incident Worker](#2-incident-worker)
- [REST API Endpoints](#rest-api-endpoints)
- [Database Schema](#database-schema)
- [SRE Metrics (MTTA / MTTR)](#sre-metrics-mtta--mttr)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Running Locally](#running-locally)
- [Testing](#testing)

---

## Overview

The **incident-management** service sits at the heart of the incident platform. It:

1. **Consumes alerts** from a Redis queue (`successQueue`) pushed by the `alert-ingestion` service.
2. **Decides** whether to create a new incident, attach to an existing one, or skip — using a rules-based engine.
3. **Creates incidents** in PostgreSQL and pushes them to a second Redis queue (`incidents:queue`).
4. **Assigns on-call engineers** by calling the `oncall-service` API.
5. **Exposes a REST API** for CRUD operations on incidents and SRE metrics (MTTA / MTTR).

---

## Architecture

```
┌─────────────────┐       ┌──────────────────────────────────────────────────┐       ┌──────────────────┐
│  alert-ingestion│       │           incident-management                   │       │  oncall-service  │
│    service      │       │                                                  │       │                  │
│                 │ LPUSH │  ┌──────────────┐     ┌───────────────────┐      │  HTTP │                  │
│  Receives       │──────►│  │alertConsumer │────►│  PostgreSQL       │      │──────►│  GET /api/oncall │
│  webhooks,      │       │  │ (BRPOP)      │     │  (alerts +        │      │       │  /current        │
│  validates,     │       │  │              │     │   incidents)      │      │       │                  │
│  correlates     │       │  └──────┬───────┘     └───────────────────┘      │       └──────────────────┘
│                 │       │         │ LPUSH                                  │
│                 │       │         ▼                                        │
│                 │       │  ┌──────────────┐                               │
│                 │       │  │incidentWorker│  Assigns on-call engineer      │
│                 │       │  │ (BRPOP)      │  to the incident in PG        │
│                 │       │  └──────────────┘                               │
│                 │       │                                                  │
│                 │       │  ┌──────────────┐                               │
│                 │       │  │  REST API    │  /api/incidents (CRUD)         │
│                 │       │  │  (Express)   │  /api/incidents/metrics/sre    │
│                 │       │  └──────────────┘                               │
└─────────────────┘       └──────────────────────────────────────────────────┘
```

---

## How It Works (End-to-End Flow)

```
1.  alert-ingestion  ── LPUSH ──►  Redis "successQueue"

2.  alertConsumer (BRPOP on "successQueue")
    │
    ├── Persists the raw alert into the `alerts` table
    │
    ├── Runs  shouldCreateIncident(alert)
    │   │
    │   ├── action: "create"   → INSERT into `incidents` table
    │   │                        → Link alert in `incident_alerts`
    │   │                        → LPUSH to "incidents:queue"
    │   │
    │   ├── action: "attach"   → Link alert to existing incident
    │   │                        → UPDATE incident's updated_at
    │   │
    │   └── action: "skip"     → Log and do nothing
    │
3.  incidentWorker (BRPOP on "incidents:queue")
    │
    ├── GET  oncall-service /api/oncall/current
    │
    ├── UPDATE incidents SET assigned_to = <engineer>
    │
    └── On failure: retry up to 3 times, then → dead-letter queue
```

---

## Decision Logic — `shouldCreateIncident`

Located in `src/workers/alertConsumer.js`. This is the brain that decides what happens when an alert arrives.

### Rules (evaluated in order)

| #  | Rule            | Condition                                                                 | Action     |
|----|-----------------|---------------------------------------------------------------------------|------------|
| 1  | **Critical**    | `severity === 'critical'`                                                 | **create** |
| 2  | **High / Long** | No open incident for this source in last 14 min **AND** (`severity === 'high'` **OR** firing > 5 min) | **create** |
| 3  | **Alert Storm** | 3+ similar alerts (same source + title) in last 10 min                    | **create** |
| —  | **Dedup**       | An open incident already exists for this source                           | **attach** |
| —  | **Fallback**    | None of the above matched                                                 | **skip**   |

### Evaluation order detail

1. **Rule 1** fires first — critical alerts **always** create an incident, no DB lookup needed.
2. A DB query checks if an **open incident** already exists for this `source` within the dedup window (14 min).
3. A DB query counts **similar alerts** (same `source` + `title`) in the storm window (10 min).
4. **Rule 3** fires if count ≥ 3 (alert storm).
5. **Rule 2** fires if there's no open incident AND severity is high or the alert has been firing > 5 min.
6. If an open incident exists → **attach** (deduplication).
7. Otherwise → **skip** (low/info severity with no other trigger).

### Configurable thresholds

All thresholds live in `src/config.js` under `incidentRules`:

```js
incidentRules: {
  deduplicationWindowMin: 14,   // look for open incidents within last N minutes
  alertStormWindowMin: 10,      // count similar alerts within last N minutes
  alertStormThreshold: 3,       // N+ similar alerts = storm
  firingDurationMin: 5,         // firing longer than N min triggers Rule 2
}
```

---

## Redis Queues

| Queue Name              | Producer           | Consumer          | Purpose                                 |
|-------------------------|--------------------|--------------------|----------------------------------------|
| `successQueue`          | alert-ingestion    | alertConsumer      | Validated alerts ready for processing  |
| `incidents:queue`       | alertConsumer      | incidentWorker     | New incidents needing engineer assignment |
| `incidents:dead-letter` | incidentWorker     | (manual review)    | Failed messages after 3 retries        |

All queues use Redis lists with `LPUSH` (producer) and `BRPOP` (consumer) for blocking message delivery.

**Important:** Each worker uses a **dedicated** Redis connection for `BRPOP` (it blocks), separate from the shared connection used for `LPUSH`.

---

## Workers

Both workers start automatically when the Express server boots (inside `app.listen` callback in `server.js`).

### 1. Alert Consumer

**File:** `src/workers/alertConsumer.js`

- Blocks on `BRPOP successQueue` waiting for alerts.
- On receiving an alert:
  1. **Persists** the alert into the `alerts` table (needed so storm detection can count it).
  2. Runs `shouldCreateIncident(alertData)` to get a decision.
  3. Executes the decision: `create`, `attach`, or `skip`.
- If `create`:
  - INSERTs into `incidents` table.
  - Links alert → incident in `incident_alerts`.
  - LPUSHes the incident to `incidents:queue` for the next worker.

### 2. Incident Worker

**File:** `src/workers/incidentWorker.js`

- Blocks on `BRPOP incidents:queue` waiting for incidents.
- On receiving an incident:
  1. Calls `GET oncall-service/api/oncall/current` to get the on-call engineer.
  2. Updates the incident's `assigned_to` field in PostgreSQL.
- **Retry logic:** On failure, re-queues the message up to `maxRetries` (3). After that, sends it to `incidents:dead-letter`.

---

## REST API Endpoints

Base URL: `http://localhost:8002`

### Health Check

| Method | Endpoint   | Description                    |
|--------|------------|--------------------------------|
| GET    | `/health`  | Returns `{ status: "ok" }` if PG is reachable |

### Incidents CRUD

| Method | Endpoint                      | Description                          |
|--------|-------------------------------|--------------------------------------|
| POST   | `/api/incidents`              | Create a new incident                |
| GET    | `/api/incidents`              | List incidents (optional `?status=open&limit=50`) |
| GET    | `/api/incidents/:id`          | Get a single incident by ID          |
| PATCH  | `/api/incidents/:id`          | Update status (`open`, `acknowledged`, `resolved`, `closed`) |
| GET    | `/api/incidents/metrics/sre`  | Get MTTA / MTTR metrics              |

### Request/Response Examples

**Create an incident:**
```bash
curl -X POST http://localhost:8002/api/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "High CPU on api-server",
    "severity": "high",
    "source": "prometheus",
    "description": "CPU > 90% for 10 minutes",
    "alert_id": "some-uuid"
  }'
```

**Acknowledge an incident:**
```bash
curl -X PATCH http://localhost:8002/api/incidents/<id> \
  -H "Content-Type: application/json" \
  -d '{ "status": "acknowledged" }'
```

**Get SRE metrics:**
```bash
curl http://localhost:8002/api/incidents/metrics/sre
```

Response:
```json
{
  "mtta": { "seconds": 120, "human": "2m 0s", "sample_size": 5 },
  "mttr": { "seconds": 3600, "human": "1h 0m", "sample_size": 3 },
  "open_incidents": 2
}
```

---

## Database Schema

### `alerts`
| Column       | Type          | Description                      |
|-------------|---------------|----------------------------------|
| id          | UUID (PK)     | Alert unique ID                  |
| source      | VARCHAR(255)  | Where the alert came from        |
| severity    | VARCHAR(50)   | critical, high, medium, low, info|
| title       | VARCHAR(512)  | Alert title                      |
| description | TEXT          | Details                          |
| labels      | JSONB         | Extra metadata                   |
| received_at | TIMESTAMPTZ   | When the alert was received      |

### `incidents`
| Column          | Type          | Description                       |
|----------------|---------------|-----------------------------------|
| id             | UUID (PK)     | Incident unique ID                |
| title          | VARCHAR(512)  | Incident title                    |
| severity       | VARCHAR(50)   | Inherited from alert              |
| source         | VARCHAR(255)  | Source system                     |
| description    | TEXT          | Details                           |
| status         | VARCHAR(50)   | open → acknowledged → resolved → closed |
| labels         | JSONB         | Extra metadata                    |
| assigned_to    | VARCHAR(255)  | On-call engineer email            |
| created_at     | TIMESTAMPTZ   | Creation time                     |
| updated_at     | TIMESTAMPTZ   | Last update time                  |
| acknowledged_at| TIMESTAMPTZ   | When first acknowledged           |
| resolved_at    | TIMESTAMPTZ   | When resolved                     |

### `incident_alerts` (many-to-many link)
| Column      | Type  | Description                   |
|-------------|-------|-------------------------------|
| alert_id    | UUID  | FK → alerts.id                |
| incident_id | UUID  | FK → incidents.id             |
| linked_at   | TIMESTAMPTZ | When the link was created |

---

## SRE Metrics (MTTA / MTTR)

Computed by `src/services/incidentService.js` and exposed at `GET /api/incidents/metrics/sre`.

| Metric | Formula | Meaning |
|--------|---------|---------|
| **MTTA** (Mean Time To Acknowledge) | `AVG(acknowledged_at - created_at)` | How fast engineers respond |
| **MTTR** (Mean Time To Resolve) | `AVG(resolved_at - created_at)` | How fast incidents are fully resolved |
| **Open Incidents** | `COUNT(*) WHERE status = 'open'` | Current unresolved count |

---

## Configuration

All config is centralized in `src/config.js` and driven by environment variables:

| Env Variable       | Default                                              | Description                |
|--------------------|------------------------------------------------------|----------------------------|
| `PORT`             | `8002`                                               | Express server port        |
| `DATABASE_URL`     | `postgres://postgres:postgres@localhost:5432/incident_platform` | PostgreSQL connection string |
| `REDIS_URL`        | `redis://localhost:6379`                              | Redis connection string    |
| `ONCALL_SERVICE_URL` | `http://localhost:8003`                            | On-call service base URL   |

---

## Project Structure

```
incident-management/
├── Dockerfile
├── package.json
├── README.md                     ← you are here
├── src/
│   ├── server.js                 ← Express app + starts both workers
│   ├── config.js                 ← Centralized config (env vars, rules, queue names)
│   ├── redis.js                  ← Shared Redis client (for LPUSH)
│   ├── routes/
│   │   ├── health.js             ← GET /health
│   │   └── incidents.js          ← CRUD + metrics endpoints
│   ├── services/
│   │   └── incidentService.js    ← MTTA/MTTR computation
│   └── workers/
│       ├── alertConsumer.js      ← BRPOP successQueue → decision logic → create/attach/skip
│       └── incidentWorker.js     ← BRPOP incidents:queue → assign on-call engineer
└── tests/
    ├── alertConsumer.test.js     ← 12 tests for shouldCreateIncident decision logic
    ├── incidents.test.js         ← 10 tests for REST API routes
    └── incidentWorker.test.js    ← 3 tests for worker structure
```

---

## Running Locally

### With Docker Compose (from project root)

```bash
docker compose up --build
```

This starts PostgreSQL, Redis, and all microservices. The incident-management service is available at `http://localhost:8002`.

### Standalone (for development)

Make sure PostgreSQL and Redis are running, then:

```bash
cd services/incident-management
npm install
npm run dev    # uses nodemon for hot-reload
```

---

## Testing

```bash
cd services/incident-management
npm test
```

Runs **25 tests** using Jest with mocked DB and Redis:

- **alertConsumer.test.js** — Tests the `shouldCreateIncident` decision logic across all rules (critical, high, storm, dedup, skip, firing duration).
- **incidents.test.js** — Tests all REST API endpoints (create, list, filter, get by id, acknowledge, resolve, invalid status, SRE metrics).
- **incidentWorker.test.js** — Tests worker module exports and config structure.
