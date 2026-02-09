# Mock Metrics Service Documentation

## Objective
This Node.js mock service is designed to simulate various system and application metrics and alerts, making them available for Prometheus to scrape. Its primary purpose is to facilitate testing and validation of Prometheus alert rules without requiring actual services to generate these conditions.

## Architecture
The service is a standalone Node.js application built with Express.js and `prom-client`. It runs locally on the host machine and is *not* integrated into the Docker Compose network. Prometheus accesses it via `host.docker.internal`.

## Exposed Endpoints

### `/health` (GET)
*   **Description:** A simple health check endpoint to confirm the service is running.
*   **Response:** `200 OK` with "Mock Metrics Service is UP!"

### `/metrics` (GET)
*   **Description:** Exposes all simulated metrics in the Prometheus exposition format. This is the endpoint Prometheus scrapes.
*   **Response:** `200 OK` with Prometheus formatted metrics.

### Control Endpoints (POST)
These endpoints allow for manual manipulation of metric values, enabling the simulation of specific alert conditions. All POST requests to these endpoints should include the necessary parameters in the URL path.

#### Memory and CPU
*   `/simulate/memory-usage/:value`
    *   **Description:** Sets the `mock_high_memory_usage_bytes` gauge.
    *   **Parameters:** `value` (float, e.g., `8000000000` for 8GB)
*   `/simulate/memory-leak/:status`
    *   **Description:** Sets `mock_memory_leak_detected` (1 for detected, 0 for not).
    *   **Parameters:** `status` (integer, 0 or 1)
*   `/simulate/cpu-usage/:value`
    *   **Description:** Sets `mock_high_cpu_usage_percent` gauge.
    *   **Parameters:** `value` (float, e.g., `95.5`)
*   `/simulate/cpu-spike/:status`
    *   **Description:** Sets `mock_cpu_spike_detected` (1 for detected, 0 for not).
    *   **Parameters:** `status` (integer, 0 or 1)
*   `/simulate/low-cpu-idle/:value`
    *   **Description:** Sets `mock_low_cpu_idle_percent` gauge.
    *   **Parameters:** `value` (float, e.g., `5.0`)

#### Storage / Disk
*   `/simulate/disk-usage/:device/:value`
    *   **Description:** Sets `mock_disk_usage_percent` gauge for a specific device.
    *   **Parameters:** `device` (string), `value` (float, e.g., `92.5`)
*   `/simulate/disk-read-error/:device`
    *   **Description:** Increments `mock_disk_read_errors_total` counter for a device.
    *   **Parameters:** `device` (string)
*   `/simulate/disk-write-error/:device`
    *   **Description:** Increments `mock_disk_write_errors_total` counter for a device.
    *   **Parameters:** `device` (string)

#### Network / Traffic
*   `/simulate/http-error-rate/:service/:value`
    *   **Description:** Sets `mock_http_error_rate_percent` gauge for a service/endpoint.
    *   **Parameters:** `service` (string), `value` (float, e.g., `10.0`)
*   `/simulate/http-latency/:service/:value`
    *   **Description:** Sets `mock_http_latency_seconds` gauge for a service/endpoint.
    *   **Parameters:** `service` (string), `value` (float, e.g., `2.5`)
*   `/simulate/service-up/:service/:status`
    *   **Description:** Sets `mock_service_up` gauge (1 for up, 0 for down) for a service.
    *   **Parameters:** `service` (string), `status` (integer, 0 or 1)
*   `/simulate/connection-drops/:service`
    *   **Description:** Increments `mock_connection_drops_total` counter for a service.
    *   **Parameters:** `service` (string)
*   `/simulate/packet-loss/:interface/:value`
    *   **Description:** Sets `mock_packet_loss_percent` gauge for an interface.
    *   **Parameters:** `interface` (string), `value` (float, e.g., `5.0`)

#### Database / Persistent Storage
*   `/simulate/db-connection-failed/:db/:status`
    *   **Description:** Sets `mock_db_connection_failed` gauge (1 for failed, 0 for success).
    *   **Parameters:** `db` (string), `status` (integer, 0 or 1)
*   `/simulate/db-slow-queries/:db/:count`
    *   **Description:** Sets `mock_db_slow_queries_total` gauge for a database.
    *   **Parameters:** `db` (string), `count` (integer, e.g., `50`)
*   `/simulate/db-high-lock-time/:db/:value`
    *   **Description:** Sets `mock_db_high_lock_time_seconds` gauge for a database.
    *   **Parameters:** `db` (string), `value` (float, e.g., `30.0`)
*   `/simulate/db-disk-full/:db/:value`
    *   **Description:** Sets `mock_db_disk_full_percent` gauge for a database.
    *   **Parameters:** `db` (string), `value` (float, e.g., `90.0`)

#### Microservices / Application
*   `/simulate/pod-crash-loop/:pod/:status`
    *   **Description:** Sets `mock_pod_crash_loop` gauge (1 for active, 0 for inactive).
    *   **Parameters:** `pod` (string), `status` (integer, 0 or 1)
*   `/simulate/service-unavailable/:service/:status`
    *   **Description:** Sets `mock_service_unavailable` gauge (1 for unavailable, 0 for available).
    *   **Parameters:** `service` (string), `status` (integer, 0 or 1)
*   `/simulate/queue-backlog-high/:queue/:count`
    *   **Description:** Sets `mock_queue_backlog_high_count` gauge for a queue.
    *   **Parameters:** `queue` (string), `count` (integer, e.g., `1000`)
*   `/simulate/cache-miss-rate/:cache/:value`
    *   **Description:** Sets `mock_cache_miss_rate_percent` gauge for a cache.
    *   **Parameters:** `cache` (string), `value` (float, e.g., `15.0`)

#### Prometheus Self-Monitoring
*   `/simulate/prometheus-scrape-failed/:job/:instance/:status`
    *   **Description:** Sets `mock_prometheus_scrape_failed` gauge (1 for failed, 0 for success).
    *   **Parameters:** `job` (string), `instance` (string), `status` (integer, 0 or 1)
*   `/simulate/prometheus-target-down/:job/:instance/:status`
    *   **Description:** Sets `mock_prometheus_target_down` gauge (1 for down, 0 for up).
    *   **Parameters:** `job` (string), `instance` (string), `status` (integer, 0 or 1)
*   `/simulate/prometheus-tsdb-high-series/:instance/:value`
    *   **Description:** Sets `mock_prometheus_tsdb_high_series` gauge for a Prometheus instance.
    *   **Parameters:** `instance` (string), `value` (integer, e.g., `200000`)
*   `/simulate/prometheus-high-memory/:instance/:value`
    *   **Description:** Sets `mock_prometheus_high_memory_bytes` gauge for a Prometheus instance.
    *   **Parameters:** `instance` (string), `value` (float, e.g., `1000000000`)
*   `/simulate/prometheus-high-cpu/:instance/:value`
    *   **Description:** Sets `mock_prometheus_high_cpu_percent` gauge for a Prometheus instance.
    *   **Parameters:** `instance` (string), `value` (float, e.g., `85.0`)

## Simulation Logic
The service initializes all metrics to default values. Developers can then use the `/simulate/...` POST endpoints to dynamically change metric values, triggering specific alert conditions that Prometheus will detect based on its configured alert rules.

## Usage
1.  **Start the mock service:** Navigate to `services/mock-metrics` and run `npm install && node server.js`.
2.  **Start Docker Compose:** In the project root, run `docker compose up -d`.
3.  **Trigger alerts:** Use `curl` or a similar tool to hit the `/simulate/...` endpoints.
    *   Example: `curl -X POST http://localhost:8081/simulate/cpu-usage/90`
4.  **Verify in Prometheus:** Access Prometheus UI at `http://localhost:9090/targets` to ensure the `mock-metrics` job is up and scraping. Check the graph for the simulated metrics.
