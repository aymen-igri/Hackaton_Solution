# Alert Ingestion Service - File Tree

## Complete Project Structure

```
Hackaton_Solution/
│
├── ALERT_INGESTION_SUMMARY.md          ← [NEW] Project summary (this location)
│
├── docker-compose.yml                  ← [MODIFIED] Added Redis + Alertmanager
│
├── monitoring/
│   ├── grafana/
│   │   ├── dashboards/
│   │   └── provisioning/
│   └── prometheus/
│       ├── prometheus.yml              ← [MODIFIED] Added alerting config
│       ├── alertmanager.yml            ← [NEW] Alertmanager configuration
│       └── alerts.yml                  ← [NEW] Sample alert rules
│
└── services/
    └── alert-ingestion/
        │
        ├── package.json                ← [MODIFIED] Added redis, bull
        │
        ├── Dockerfile                  ← [EXISTING]
        │
        ├── QUICKSTART.md               ← [NEW] 5-minute setup guide
        ├── IMPLEMENTATION.md           ← [NEW] Complete technical docs
        ├── MODIFICATIONS.md            ← [NEW] Detailed change log
        ├── ARCHITECTURE.md             ← [NEW] Architecture overview
        ├── README_CHANGES.md           ← [NEW] Summary & reference
        └── GUIDE_FR.md                 ← [NEW] French summary
        │
        └── src/
            │
            ├── server.js               ← [MODIFIED] Added prometheus routes
            ├── config.js               ← [MODIFIED] Added Redis config
            ├── metrics.js              ← [MODIFIED] Added new metrics
            │
            ├── db/
            │   └── queries.js          ← [EXISTING]
            │
            ├── queue/                  ← [NEW FOLDER]
            │   └── redisQueue.js       ← [NEW] Redis queue manager
            │
            ├── routes/
            │   ├── health.js           ← [EXISTING]
            │   ├── alerts.js           ← [EXISTING]
            │   └── prometheus.js       ← [NEW] Webhook endpoint
            │
            └── services/
                ├── correlationService.js       ← [EXISTING]
                ├── verificationService.js      ← [NEW] Alert verification
                ├── normalizationService.js     ← [NEW] Alert normalization
                └── alertProcessor.js           ← [NEW] Processing orchestrator

```

---

## File Count Summary

### Modified Files: **6**
1. `package.json`
2. `src/config.js`
3. `src/server.js`
4. `src/metrics.js`
5. `docker-compose.yml`
6. `monitoring/prometheus/prometheus.yml`

### New Files: **13**

#### Service Code (5)
1. `src/queue/redisQueue.js`
2. `src/services/verificationService.js`
3. `src/services/normalizationService.js`
4. `src/services/alertProcessor.js`
5. `src/routes/prometheus.js`

#### Configuration (2)
6. `monitoring/prometheus/alertmanager.yml`
7. `monitoring/prometheus/alerts.yml`

#### Documentation (6)
8. `services/alert-ingestion/QUICKSTART.md`
9. `services/alert-ingestion/IMPLEMENTATION.md`
10. `services/alert-ingestion/MODIFICATIONS.md`
11. `services/alert-ingestion/ARCHITECTURE.md`
12. `services/alert-ingestion/README_CHANGES.md`
13. `services/alert-ingestion/GUIDE_FR.md`

#### Project Summary (1)
14. `ALERT_INGESTION_SUMMARY.md` (at project root)

---

## Documentation Location Map

```
📁 Hackaton_Solution/
│
├── 📄 ALERT_INGESTION_SUMMARY.md    ← START HERE (Project overview)
│
└── 📁 services/alert-ingestion/
    │
    ├── 📘 QUICKSTART.md             ← Quick start (5 min)
    ├── 📗 ARCHITECTURE.md           ← Architecture overview
    ├── 📕 IMPLEMENTATION.md         ← Complete technical docs
    ├── 📙 MODIFICATIONS.md          ← Detailed change log
    ├── 📔 README_CHANGES.md         ← Summary & reference
    └── 📖 GUIDE_FR.md               ← French summary
```

---

## Service Integration Map

```
┌─────────────────────────────────────────────────────────────┐
│                     Docker Services                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  PostgreSQL  │    │    Redis     │    │  Prometheus  │  │
│  │  :5432       │    │    :6379     │    │    :9090     │  │
│  │  [EXISTING]  │    │    [NEW]     │    │  [MODIFIED]  │  │
│  └──────────────┘    └──────────────┘    └──────┬───────┘  │
│                             ▲                    │           │
│                             │                    ▼           │
│  ┌──────────────────────────┴───┐    ┌──────────────────┐  │
│  │   Alert Ingestion Service    │    │  Alertmanager    │  │
│  │         :8001                 │◄───│     :9093        │  │
│  │       [MODIFIED]              │    │     [NEW]        │  │
│  └──────────────┬────────────────┘    └──────────────────┘  │
│                 │                                            │
│                 ▼                                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Incident Management :8002     [EXISTING]            │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  OnCall Service :8003          [EXISTING]            │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Grafana :3000                 [EXISTING]            │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  Web UI :8080                  [EXISTING]            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│                    Alert Processing Pipeline                     │
└─────────────────────────────────────────────────────────────────┘

 [Prometheus]
      │
      │ Evaluates alert rules
      │
      ▼
 [Alertmanager]
      │
      │ POST webhook
      │
      ▼
 ┌─────────────────────────────────────────┐
 │  Alert Ingestion Service (:8001)        │
 │  ┌────────────────────────────────────┐ │
 │  │ POST /api/prometheus/webhook       │ │
 │  └────────────┬───────────────────────┘ │
 │               ▼                          │
 │  ┌────────────────────────────┐         │
 │  │  verificationService.js    │         │
 │  │  - 8 validation criteria   │         │
 │  └────────────┬───────────────┘         │
 │               │ Valid?                   │
 │               ▼                          │
 │  ┌────────────────────────────┐         │
 │  │  redisQueue.js             │         │
 │  │  - Enqueue to raw queue    │         │
 │  └────────────┬───────────────┘         │
 └───────────────┼──────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │  Redis (:6379) │
        │                │
        │ ┌────────────┐ │
        │ │ raw-alerts │ │
        │ └──────┬────���┘ │
        └────────┼────────┘
                 │
                 ▼
 ┌───────────────────────────────────────────┐
 │  alertProcessor.js                        │
 │  ┌──────────────────────────────────────┐ │
 │  │ Process Queue Worker                 │ │
 │  └──────────┬───────────────────────────┘ │
 │             ▼                              │
 │  ┌──────────────────┐                     │
 │  │ Verify Again     │                     │
 │  └──────┬───────────┘                     │
 │         │ Pass                             │
 │         ▼                                  │
 │  ┌──────────────────────────────┐         │
 │  │  normalizationService.js     │         │
 │  │  - Transform to std format   │         │
 │  └──────┬───────────────────────┘         │
 │         │ Success?                         │
 │         │                                  │
 │    ┌────┴────┐                            │
 │    │         │                            │
 │   YES        NO                           │
 │    │         │                            │
 └────┼─────────┼─────────────────────────────┘
      │         │
      ▼         ▼
┌──────────┐ ┌───────────┐
│ Success  │ │  Retry    │
│  Queue   │ │  Queue    │
└────┬─────┘ └─────┬─────┘
     │             │
     │             │ Attempt 1, 2, 3
     │             ▼
     │       ┌───────────┐
     │       │  Process  │
     │       │  Again    │
     │       └─────┬─────┘
     │             │
     │        ┌────┴────┐
     │       Fail   Success
     │        │         │
     │        ▼         │
     │   ┌─────────┐   │
     │   │  Error  │   │
     │   │  Queue  │   │
     │   └─────────┘   │
     │                 │
     └─────────────────┘
              │
              ▼
     ┌─────────────────┐
     │  Correlation    │
     │    Service      │
     └─────────────────┘
```

---

## Component Interaction Matrix

```
┌─────────────────────┬──────┬──────┬──────┬──────┬──────┬──────┐
│ Component           │Redis │Prom. │Alert │Corr. │DB    │Metr. │
│                     │      │      │Mgr   │Svc   │      │      │
├─────────────────────┼──────┼──────┼──────┼──────┼──────┼──────┤
│ prometheus.js       │  ✓   │      │  ✓   │      │      │  ✓   │
│ verificationSvc.js  │      │      │      │      │      │  ✓   │
│ normalizationSvc.js │      │      │      │      │      │  ✓   │
│ redisQueue.js       │  ✓   │      │      │      │      │      │
│ alertProcessor.js   │  ✓   │      │      │  ✓   │      │  ✓   │
│ correlationSvc.js   │      │      │      │      │  ✓   │  ✓   │
└─────────────────────┴──────┴──────┴──────┴──────┴──────┴──────┘

Legend:
✓ = Direct interaction
Redis = Redis Queues
Prom. = Prometheus
Alert Mgr = Alertmanager
Corr. Svc = Correlation Service
DB = PostgreSQL Database
Metr. = Metrics/Monitoring
```

---

## Queue State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                    Alert Queue States                        │
└─────────────────────────────────────────────────────────────┘

    [Alert Received]
          │
          ▼
    ┌──────────┐
    │   RAW    │ ← Unverified alerts
    │  QUEUE   │
    └────┬─────┘
         │
    [Processing]
         │
    ┌────┴─────┐
    │          │
  VALID    INVALID
    │          │
    ▼          ▼
┌──────┐   ┌───────┐
│Norm. │   │ERROR  │ ← Verification failed
└──┬───┘   │QUEUE  │
   │       └───────┘
┌──┴───┐
│      │
OK    FAIL
│      │
▼      ▼
┌──────────┐  ┌──────────┐
│ SUCCESS  │  │  RETRY   │
│  QUEUE   │  │  QUEUE   │
└────┬─────┘  └────┬─────┘
     │             │
     │        [Attempt 1]
     │             │
     │        [Attempt 2]
     │             │
     │        [Attempt 3]
     │             │
     │        ┌────┴────┐
     │       Fail   Success
     │        │         │
     │        ▼         │
     │   ┌─────────┐   │
     │   │  ERROR  │   │
     │   │  QUEUE  │   │
     │   └─────────┘   │
     │                 │
     └─────────────────┘
              │
              ▼
      [Ready for Use]
```

---

## File Sizes & Lines of Code

```
Modified Files:
  package.json                   ~30 lines
  src/config.js                  ~20 lines
  src/server.js                  ~35 lines
  src/metrics.js                 ~90 lines
  docker-compose.yml             ~140 lines
  prometheus.yml                 ~30 lines

New Service Files:
  src/queue/redisQueue.js        ~95 lines
  src/services/verificationService.js    ~130 lines
  src/services/normalizationService.js   ~125 lines
  src/services/alertProcessor.js         ~195 lines
  src/routes/prometheus.js       ~125 lines

New Config Files:
  monitoring/prometheus/alertmanager.yml ~20 lines
  monitoring/prometheus/alerts.yml       ~50 lines

New Documentation Files:
  QUICKSTART.md                  ~550 lines
  IMPLEMENTATION.md              ~650 lines
  MODIFICATIONS.md               ~700 lines
  ARCHITECTURE.md                ~580 lines
  README_CHANGES.md              ~450 lines
  GUIDE_FR.md                    ~450 lines

Total New Code:     ~670 lines
Total Documentation: ~3,380 lines
Total Changes:      ~345 lines in existing files
──────────────────────────────────
Grand Total:        ~4,395 lines
```

---

## Technology Stack

```
Backend Services:
├── Node.js (18+)
├── Express.js
├── Redis (7-alpine)
└── Bull (Queue Management)

Monitoring:
├── Prometheus (latest)
├── Alertmanager (latest)
└── Grafana (latest)

Database:
└── PostgreSQL (15-alpine)

DevOps:
├── Docker
└── Docker Compose

Languages:
├── JavaScript (ES6+)
├── YAML
└── Markdown
```

---

## Status: ✅ IMPLEMENTATION COMPLETE

**Created:** February 9, 2026  
**Total Files Modified:** 6  
**Total Files Created:** 14  
**Total Lines Added:** ~4,395  
**Documentation Language:** English  
**Ready for:** Production Testing

---

*For detailed implementation information, start with ALERT_INGESTION_SUMMARY.md*

