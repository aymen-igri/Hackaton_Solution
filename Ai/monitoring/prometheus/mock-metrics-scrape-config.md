# Prometheus Scrape Configuration for Mock Metrics Service

## Objective
This document explains how Prometheus is configured to scrape metrics from the standalone Node.js Mock Metrics Service.

## Configuration in `prometheus.yml`
To allow Prometheus (running inside Docker) to access the locally running Mock Metrics Service (on the host machine), a specific `scrape_config` entry has been added to the `monitoring/prometheus/prometheus.yml` file.

```yaml
  - job_name: 'mock-metrics'
    metrics_path: /metrics 
    static_configs:
      - targets: ['host.docker.internal:8081']
```

### Explanation:
*   **`job_name: 'mock-metrics'`**: This identifies the scraping job within Prometheus.
*   **`metrics_path: /metrics`**: Specifies the endpoint on the target service from which Prometheus will fetch metrics. The Mock Metrics Service exposes its metrics at this path.
*   **`static_configs`**: Defines a static list of targets for this job.
*   **`targets: ['host.docker.internal:8081']`**:
    *   **`host.docker.internal`**: This is a special DNS name that resolves to the internal IP address of the host machine from *within* a Docker container. This is crucial for allowing services running inside Docker (like Prometheus) to communicate with services running directly on the host machine (like our Mock Metrics Service) without complex network configurations.
    *   **`8081`**: This is the port on which the Mock Metrics Service is configured to listen.

## How it Works
When Prometheus starts, it reads this configuration and periodically (every `scrape_interval`, typically 15 seconds as defined globally) attempts to connect to `http://host.docker.internal:8081/metrics` to pull the latest metric data from the Mock Metrics Service. This allows Prometheus to collect the simulated metrics and evaluate them against defined alert rules.

## Usage
After ensuring the Mock Metrics Service is running locally on port 8081, start your Docker Compose setup. Prometheus will automatically discover and start scraping the mock service. You can verify this in the Prometheus UI under "Targets" (usually accessible at `http://localhost:9090/targets`).