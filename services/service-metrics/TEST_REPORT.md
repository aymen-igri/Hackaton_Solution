
╔═══════════════════════════════════════════════════════════════════════════════╗
║                     SERVICE-METRICS TEST REPORT                               ║
║                     Generated: 2026-02-10T06:40:27.170Z                ║
╚═══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SUMMARY                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Total Tests: 7     | Passed: 7     | Failed: 0                                   │
│  Success Rate: 100.0%                                                            │
│  Duration: 2066ms                                                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          REST API ENDPOINTS                                     │
└─────────────────────────────────────────────────────────────────────────────────┘


  1. GET /health
     ├── Status: ✅ PASSED
     ├── HTTP Status: 200
     ├── statusCodeValid: ✓
     ├── hasStatusField: ✓
     ├── statusIsOk: ✓
     ├── hasTimestamp: ✓
     
     

  2. GET /metrics
     ├── Status: ✅ PASSED
     ├── HTTP Status: 200
     ├── statusCodeValid: ✓
     ├── hasPrometheusFormat: ✓
     ├── hasContentType: ✓
     
     

  3. GET /api/metrics/incidents/by-service
     ├── Status: ✅ PASSED
     ├── HTTP Status: 200
     ├── statusCodeValid: ✓
     ├── hasStatusField: ✓
     ├── hasDataArray: ✓
     ├── dataStructureValid: ✓
     └── Data Count: 6
     

  4. GET /api/metrics/incidents/details
     ├── Status: ✅ PASSED
     ├── HTTP Status: 200
     ├── statusCodeValid: ✓
     ├── hasStatusField: ✓
     ├── hasDataArray: ✓
     ├── containsIncidentFields: ✓
     └── Data Count: 11
     


┌─────────────────────────────────────────────────────────────────────────────────┐
│                          WEBSOCKET TESTS                                        │
└─────────────────────────────────────────────────────────────────────────────────┘


  1. WebSocket Connection
     ├── Status: ✅ PASSED
     ├── hasType: ✓
     ├── hasMessage: ✓
     ├── hasTimestamp: ✓
     

  2. WebSocket Message Acknowledgment
     ├── Status: ✅ PASSED
     ├── hasType: ✓
     ├── hasRequestType: ✓
     ├── hasTimestamp: ✓
     

  3. WebSocket Instant Metrics Broadcast
     ├── Status: ✅ PASSED
     ├── hasType: ✓
     ├── hasTimestamp: ✓
     ├── hasData: ✓
     


┌─────────────────────────────────────────────────────────────────────────────────┐
│                          DETAILED RESULTS                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

{
  "summary": {
    "total": 7,
    "passed": 7,
    "failed": 0,
    "startTime": 1770705625104,
    "endTime": 1770705627170
  },
  "restEndpoints": [
    {
      "endpoint": "/health",
      "method": "GET",
      "status": "PASSED",
      "statusCode": 200,
      "responseTime": null,
      "response": {
        "status": "ok",
        "timestamp": "2026-02-10T06:40:25.129Z"
      },
      "expectedStatus": 200,
      "expectedFields": [
        "status",
        "timestamp"
      ],
      "validations": {
        "statusCodeValid": true,
        "hasStatusField": true,
        "statusIsOk": true,
        "hasTimestamp": true
      }
    },
    {
      "endpoint": "/metrics",
      "method": "GET",
      "status": "PASSED",
      "statusCode": 200,
      "contentType": "text/plain; version=0.0.4; charset=utf-8",
      "isPrometheusFormat": true,
      "metricsFound": [
        "service_metrics_collected_total",
        "service_metrics_errors_total",
        "service_metrics_poll_duration_seconds"
      ],
      "validations": {
        "statusCodeValid": true,
        "hasPrometheusFormat": true,
        "hasContentType": true
      }
    },
    {
      "endpoint": "/api/metrics/incidents/by-service",
      "method": "GET",
      "status": "PASSED",
      "statusCode": 200,
      "response": {
        "status": "success",
        "data": [
          {
            "service": "prometheus",
            "total_incidents": "5",
            "open_count": "4",
            "ack_count": "0",
            "resolved_count": "1"
          },
          {
            "service": "test-script",
            "total_incidents": "2",
            "open_count": "2",
            "ack_count": "0",
            "resolved_count": "0"
          },
          {
            "service": "multi-test-server",
            "total_incidents": "1",
            "open_count": "1",
            "ack_count": "0",
            "resolved_count": "0"
          },
          {
            "service": "db-monitor",
            "total_incidents": "1",
            "open_count": "0",
            "ack_count": "0",
            "resolved_count": "1"
          },
          {
            "service": "node-exporter",
            "total_incidents": "1",
            "open_count": "0",
            "ack_count": "1",
            "resolved_count": "0"
          },
          {
            "service": "rebuilt-test",
            "total_incidents": "1",
            "open_count": "0",
            "ack_count": "0",
            "resolved_count": "1"
          }
        ]
      },
      "dataCount": 6,
      "sampleData": [
        {
          "service": "prometheus",
          "total_incidents": "5",
          "open_count": "4",
          "ack_count": "0",
          "resolved_count": "1"
        },
        {
          "service": "test-script",
          "total_incidents": "2",
          "open_count": "2",
          "ack_count": "0",
          "resolved_count": "0"
        },
        {
          "service": "multi-test-server",
          "total_incidents": "1",
          "open_count": "1",
          "ack_count": "0",
          "resolved_count": "0"
        }
      ],
      "validations": {
        "statusCodeValid": true,
        "hasStatusField": true,
        "hasDataArray": true,
        "dataStructureValid": true
      }
    },
    {
      "endpoint": "/api/metrics/incidents/details",
      "method": "GET",
      "status": "PASSED",
      "statusCode": 200,
      "response": {
        "status": "success",
        "data": [
          {
            "id": "c97c99a1-efdc-4940-a0bd-25a1c4f57cd5",
            "title": "Test from Script",
            "severity": "critical",
            "source": "test-script",
            "status": "open",
            "created_at": "2026-02-10T06:39:31.220Z",
            "acknowledged_at": null,
            "resolved_at": null,
            "mtta_seconds": null,
            "mttr_seconds": null
          },
          {
            "id": "78e613ec-d1c8-4fa5-910b-424da30e7223",
            "title": "Test from Script",
            "severity": "critical",
            "source": "test-script",
            "status": "open",
            "created_at": "2026-02-10T06:39:26.522Z",
            "acknowledged_at": null,
            "resolved_at": null,
            "mtta_seconds": null,
            "mttr_seconds": null
          },
          {
            "id": "fb63b44c-aef8-4a03-b3ed-200bd78e82e1",
            "title": "Real Email Test",
            "severity": "critical",
            "source": "prometheus",
            "status": "open",
            "created_at": "2026-02-10T04:37:48.864Z",
            "acknowledged_at": null,
            "resolved_at": null,
            "mtta_seconds": null,
            "mttr_seconds": null
          },
          {
            "id": "9e374ffa-7136-4585-b05d-6e0cb648ac22",
            "title": "Test Email Flow",
            "severity": "critical",
            "source": "prometheus",
            "status": "open",
            "created_at": "2026-02-10T04:26:43.139Z",
            "acknowledged_at": null,
            "resolved_at": null,
            "mtta_seconds": null,
            "mttr_seconds": null
          },
          {
            "id": "c4fe9b4c-4977-4b86-a998-d685e951fd05",
            "title": "TestSeparateLinks",
            "severity": "critical",
            "source": "prometheus",
            "status": "resolved",
            "created_at": "2026-02-10T03:57:40.478Z",
            "acknowledged_at": "2026-02-10T03:59:15.308Z",
            "resolved_at": "2026-02-10T03:59:31.665Z",
            "mtta_seconds": "94.830000",
            "mttr_seconds": "111.187000"
          },
          {
            "id": "f80d7033-d37a-4e46-8bc0-126ae6e71554",
            "title": "MultiAlert_Test",
            "severity": "critical",
            "source": "multi-test-server",
            "status": "open",
            "created_at": "2026-02-10T03:40:11.516Z",
            "acknowledged_at": null,
            "resolved_at": null,
            "mtta_seconds": null,
            "mttr_seconds": null
          },
          {
            "id": "a8fe7b26-5572-4c98-82af-ca6ca8c8791a",
            "title": "E2E_After_Rebuild",
            "severity": "critical",
            "source": "rebuilt-test",
            "status": "resolved",
            "created_at": "2026-02-10T02:44:30.947Z",
            "acknowledged_at": "2026-02-10T02:45:03.942Z",
            "resolved_at": "2026-02-10T02:45:08.790Z",
            "mtta_seconds": "32.995000",
            "mttr_seconds": "37.843000"
          },
          {
            "id": "2ae43d4a-b137-44b2-b6cf-5e0cfb2313ea",
            "title": "Database Connection Pool Exhausted",
            "severity": "critical",
            "source": "db-monitor",
            "status": "resolved",
            "created_at": "2026-02-09T23:45:19.136Z",
            "acknowledged_at": "2026-02-09T23:45:27.730Z",
            "resolved_at": "2026-02-09T23:45:32.726Z",
            "mtta_seconds": "8.594000",
            "mttr_seconds": "13.590000"
          },
          {
            "id": "e775d42d-0adf-477d-baca-bc49ed74284a",
            "title": "Disk Space Critical",
            "severity": "critical",
            "source": "node-exporter",
            "status": "acknowledged",
            "created_at": "2026-02-09T23:02:22.703Z",
            "acknowledged_at": "2026-02-09T23:03:11.846Z",
            "resolved_at": null,
            "mtta_seconds": "49.143000",
            "mttr_seconds": null
          },
          {
            "id": "de2a2d35-92bb-4576-84e3-171b1adc2e3d",
            "title": "Server CPU Critical",
            "severity": "critical",
            "source": "prometheus",
            "status": "open",
            "created_at": "2026-02-09T22:59:01.467Z",
            "acknowledged_at": null,
            "resolved_at": null,
            "mtta_seconds": null,
            "mttr_seconds": null
          },
          {
            "id": "386e7a7f-9b79-40f5-989b-98edc81d8cd8",
            "title": "Server CPU High",
            "severity": "critical",
            "source": "prometheus",
            "status": "open",
            "created_at": "2026-02-09T22:56:38.416Z",
            "acknowledged_at": null,
            "resolved_at": null,
            "mtta_seconds": null,
            "mttr_seconds": null
          }
        ]
      },
      "dataCount": 11,
      "sampleData": [
        {
          "id": "c97c99a1-efdc-4940-a0bd-25a1c4f57cd5",
          "title": "Test from Script",
          "severity": "critical",
          "source": "test-script",
          "status": "open",
          "created_at": "2026-02-10T06:39:31.220Z",
          "acknowledged_at": null,
          "resolved_at": null,
          "mtta_seconds": null,
          "mttr_seconds": null
        },
        {
          "id": "78e613ec-d1c8-4fa5-910b-424da30e7223",
          "title": "Test from Script",
          "severity": "critical",
          "source": "test-script",
          "status": "open",
          "created_at": "2026-02-10T06:39:26.522Z",
          "acknowledged_at": null,
          "resolved_at": null,
          "mtta_seconds": null,
          "mttr_seconds": null
        },
        {
          "id": "fb63b44c-aef8-4a03-b3ed-200bd78e82e1",
          "title": "Real Email Test",
          "severity": "critical",
          "source": "prometheus",
          "status": "open",
          "created_at": "2026-02-10T04:37:48.864Z",
          "acknowledged_at": null,
          "resolved_at": null,
          "mtta_seconds": null,
          "mttr_seconds": null
        }
      ],
      "validations": {
        "statusCodeValid": true,
        "hasStatusField": true,
        "hasDataArray": true,
        "containsIncidentFields": true
      }
    }
  ],
  "websocket": [
    {
      "test": "WebSocket Connection",
      "status": "PASSED",
      "welcomeMessage": {
        "type": "connection",
        "message": "Connected to service-metrics",
        "timestamp": "2026-02-10T06:40:25.159Z"
      },
      "validations": {
        "hasType": true,
        "hasMessage": true,
        "hasTimestamp": true
      }
    },
    {
      "test": "WebSocket Message Acknowledgment",
      "status": "PASSED",
      "ackMessage": {
        "type": "ack",
        "requestType": "subscribe",
        "timestamp": "2026-02-10T06:40:25.177Z"
      },
      "validations": {
        "hasType": true,
        "hasRequestType": true,
        "hasTimestamp": true
      }
    },
    {
      "test": "WebSocket Instant Metrics Broadcast",
      "status": "PASSED",
      "metricsReceived": true,
      "timestamp": "2026-02-10T06:40:27.167Z",
      "dataKeys": [
        "prometheus_tsdb_head_series",
        "prometheus_engine_queries",
        "http_requests_total"
      ],
      "validations": {
        "hasType": true,
        "hasTimestamp": true,
        "hasData": true
      }
    }
  ]
}
