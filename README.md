# 🚨 Incident Platform

A microservices-based SRE incident management platform built with **Express.js**, **React**, **PostgreSQL**, **Prometheus**, and **Grafana**.

## Architecture

| Service | Port | Description |
|---------|------|-------------|
| **alert-ingestion** | 8001 | Receives alerts, persists them, and correlates to incidents |
| **incident-management** | 8002 | Incident lifecycle (create/ack/resolve) + MTTA/MTTR metrics |
| **oncall-service** | 8003 | On-call schedule & rotation management |
| **web-ui** | 8080 | React dashboard for incidents, on-call, and SRE metrics |
| **PostgreSQL** | 5432 | Primary data store |
| **Prometheus** | 9090 | Metrics collection |
| **Grafana** | 3000 | Dashboards & visualization |

## Quick Start

```bash
# 1. Clone and enter the project
cd incident-platform

# 2. Copy environment file
cp .env.example .env

# 3. Start everything
docker-compose up -d --build

# 4. Open the UI
open http://localhost:8080
```

## API Endpoints

### Alert Ingestion (`:8001`)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/alerts` | Ingest new alert |
| `GET`  | `/api/alerts` | List recent alerts |
| `GET`  | `/api/alerts/:id` | Get alert by ID |
| `GET`  | `/health` | Health check |
| `GET`  | `/metrics` | Prometheus metrics |

### Incident Management (`:8002`)
| Method  | Path | Description |
|---------|------|-------------|
| `POST`  | `/api/incidents` | Create incident |
| `GET`   | `/api/incidents` | List incidents |
| `GET`   | `/api/incidents/:id` | Get incident by ID |
| `PATCH` | `/api/incidents/:id` | Update status (acknowledge/resolve) |
| `GET`   | `/api/incidents/metrics/sre` | MTTA & MTTR metrics |
| `GET`   | `/health` | Health check |

### On-Call Service (`:8003`)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/schedules` | Create rotation schedule |
| `GET`  | `/api/schedules` | List schedules |
| `GET`  | `/api/oncall/current` | Who is on call now? |
| `GET`  | `/api/oncall/next` | Who is next? |
| `GET`  | `/health` | Health check |

## Monitoring

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin / admin)
  - Pre-provisioned dashboards: *Incident Overview* and *SRE Metrics*

## CI/CD

```bash
./pipeline.sh
```

Runs lint → tests → Docker build → compose up → health checks.

## Project Structure

```
incident-platform/
├── docker-compose.yml
├── .env / .env.example
├── services/
│   ├── alert-ingestion/        # Port 8001
│   ├── incident-management/    # Port 8002
│   ├── oncall-service/         # Port 8003
│   └── web-ui/                 # Port 8080
├── monitoring/
│   ├── prometheus/
│   └── grafana/
├── init-db/
│   └── 01-init-schema.sql
├── pipeline.sh
└── README.md
```
