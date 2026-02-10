
╔═══════════════════════════════════════════════════════════════════════════════════════╗
║          E2E TEST REPORT: Mock-Metrics → Prometheus → Service-Metrics                 ║
║          Generated: 2026-02-10T07:06:27.394Z                                  ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                                    SUMMARY                                            │
├───────────────────────────────────────────────────────────────────────────────────────┤
│  Total Tests: 19     | Passed: 19     | Failed: 0                               │
│  Success Rate: 100.0%                                                                 │
│  Duration: 17372ms                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                           PIPELINE ARCHITECTURE                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
    │  MOCK-METRICS   │ ───▶  │   PROMETHEUS    │ ───▶  │ SERVICE-METRICS │
    │  :8082          │       │   :9090         │       │  :8005          │
    └─────────────────┘       └─────────────────┘       └─────────────────┘
           │                         │                         │
           │  /metrics               │  scrape every 15s       │  REST API
           │  Exposes mock_*         │  Stores time-series     │  WebSocket
           └─────────────────────────┴─────────────────────────┴──────────▶ UI

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                        STAGE 1: MOCK-METRICS SERVICE                                  │
└───────────────────────────────────────────────────────────────────────────────────────┘
  1. ✅ Health Check
     └── HTTP: 200
  2. ✅ Metrics Endpoint
     └── HTTP: 200 | Metrics: 53
  3. ✅ Simulate Memory Usage
     └── HTTP: 200
  4. ✅ Simulate CPU Usage
     └── HTTP: 200
  5. ✅ Simulate Disk Usage
     └── HTTP: 200

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                           STAGE 2: PROMETHEUS                                         │
└───────────────────────────────────────────────────────────────────────────────────────┘
  1. ✅ Health Check
     └── HTTP: 200
  2. ✅ Mock-Metrics Target Status
  3. ✅ Query mock_high_memory_usage_bytes
     └── Value: 77
  4. ✅ Query mock_high_cpu_usage_percent
     └── Value: 52
  5. ✅ Query mock_disk_usage_percent
     └── Value: 85

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                        STAGE 3: SERVICE-METRICS                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘
  1. ✅ Health Check
     └── HTTP: 200
  2. ✅ Prometheus Metrics Endpoint
     └── HTTP: 200 | Metrics: 3
  3. ✅ Incidents By Service API
     └── HTTP: 200 | Data: 7 items
  4. ✅ Incidents Details API
     └── HTTP: 200 | Data: 12 items

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                        STAGE 4: WEBSOCKET REAL-TIME                                   │
└───────────────────────────────────────────────────────────────────────────────────────┘
  1. ✅ Connection Established
  2. ✅ Receive Instant Metrics

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                        STAGE 5: E2E FLOW VALIDATION                                   │
└───────────────────────────────────────────────────────────────────────────────────────┘
  1. ✅ Metrics Reached Prometheus
  2. ✅ Service-Metrics Received Prometheus Data
  3. ✅ Complete Pipeline Flow

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                              DETAILED RESULTS (JSON)                                  │
└───────────────────────────────────────────────────────────────────────────────────────┘

{
  "summary": {
    "total": 19,
    "passed": 19,
    "failed": 0,
    "startTime": 1770707170022,
    "endTime": 1770707187394
  },
  "stages": {
    "mockMetrics": [
      {
        "test": "Health Check",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:10.052Z",
        "statusCode": 200,
        "response": "Mock Metrics Service is UP!"
      },
      {
        "test": "Metrics Endpoint",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:10.057Z",
        "statusCode": 200,
        "metricsCount": 53,
        "sampleMetrics": [
          "process_cpu_user_seconds_total",
          "process_cpu_system_seconds_total",
          "process_cpu_seconds_total",
          "process_start_time_seconds",
          "process_resident_memory_bytes",
          "nodejs_eventloop_lag_seconds",
          "nodejs_eventloop_lag_min_seconds",
          "nodejs_eventloop_lag_max_seconds",
          "nodejs_eventloop_lag_mean_seconds",
          "nodejs_eventloop_lag_stddev_seconds"
        ]
      },
      {
        "test": "Simulate Memory Usage",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:10.060Z",
        "statusCode": 200,
        "response": "High memory usage set to: 77"
      },
      {
        "test": "Simulate CPU Usage",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:10.061Z",
        "statusCode": 200,
        "response": "High CPU usage set to: 52"
      },
      {
        "test": "Simulate Disk Usage",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:10.063Z",
        "statusCode": 200,
        "response": "Disk usage for sda set to: 85%"
      }
    ],
    "prometheus": [
      {
        "test": "Health Check",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.089Z",
        "statusCode": 200,
        "response": "Prometheus Server is Healthy.\n"
      },
      {
        "test": "Mock-Metrics Target Status",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.095Z",
        "targetFound": true,
        "targetHealth": "up",
        "scrapeUrl": "http://host.docker.internal:8082/metrics",
        "lastScrape": "2026-02-10T07:06:22.064617866Z"
      },
      {
        "test": "Query mock_high_memory_usage_bytes",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.103Z",
        "hasData": true,
        "value": "77",
        "resultCount": 1
      },
      {
        "test": "Query mock_high_cpu_usage_percent",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.110Z",
        "hasData": true,
        "value": "52",
        "resultCount": 1
      },
      {
        "test": "Query mock_disk_usage_percent",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.112Z",
        "hasData": true,
        "value": "85",
        "resultCount": 1
      }
    ],
    "serviceMetrics": [
      {
        "test": "Health Check",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.121Z",
        "statusCode": 200,
        "response": {
          "status": "ok",
          "timestamp": "2026-02-10T07:06:27.120Z"
        }
      },
      {
        "test": "Prometheus Metrics Endpoint",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.124Z",
        "statusCode": 200,
        "metricsCount": 3,
        "metrics": [
          "service_metrics_collected_total",
          "service_metrics_errors_total",
          "service_metrics_poll_duration_seconds"
        ]
      },
      {
        "test": "Incidents By Service API",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.133Z",
        "statusCode": 200,
        "dataCount": 7
      },
      {
        "test": "Incidents Details API",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.133Z",
        "statusCode": 200,
        "dataCount": 12
      }
    ],
    "websocket": [
      {
        "test": "Connection Established",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.147Z",
        "message": "Connected to service-metrics"
      },
      {
        "test": "Receive Instant Metrics",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.376Z",
        "metricsKeys": [
          "prometheus_tsdb_head_series",
          "prometheus_engine_queries",
          "http_requests_total"
        ],
        "sampleData": {
          "prometheus_tsdb_head_series": {
            "resultType": "vector",
            "result": []
          },
          "prometheus_engine_queries": {
            "resultType": "vector",
            "result": []
          },
          "http_requests_total": {
            "resultType": "vector",
            "result": []
          }
        }
      }
    ],
    "e2eFlow": [
      {
        "test": "Metrics Reached Prometheus",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.391Z",
        "metricsWithData": [
          "mock_high_memory_usage_bytes",
          "mock_high_cpu_usage_percent",
          "mock_disk_usage_percent"
        ]
      },
      {
        "test": "Service-Metrics Received Prometheus Data",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.392Z",
        "dataKeys": [
          "prometheus_tsdb_head_series",
          "prometheus_engine_queries",
          "http_requests_total"
        ]
      },
      {
        "test": "Complete Pipeline Flow",
        "status": "PASSED",
        "timestamp": "2026-02-10T07:06:27.393Z",
        "mockMetricsToPrometheus": true,
        "prometheusToServiceMetrics": true
      }
    ]
  }
}
