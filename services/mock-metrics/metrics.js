const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

// --- 1. Memory and CPU Metrics ---
const highMemoryUsage = new client.Gauge({
  name: 'mock_high_memory_usage_bytes',
  help: 'Simulated high memory usage in bytes',
  labelNames: ['instance', 'service'],
  registers: [register],
});

const memoryLeakDetected = new client.Gauge({
  name: 'mock_memory_leak_detected',
  help: 'Simulated memory leak detection (1 for detected, 0 for not)',
  labelNames: ['instance', 'service'],
  registers: [register],
});

const highCpuUsage = new client.Gauge({
  name: 'mock_high_cpu_usage_percent',
  help: 'Simulated high CPU usage in percent',
  labelNames: ['instance', 'service'],
  registers: [register],
});

const cpuSpikeDetected = new client.Gauge({
  name: 'mock_cpu_spike_detected',
  help: 'Simulated CPU spike detection (1 for detected, 0 for not)',
  labelNames: ['instance', 'service'],
  registers: [register],
});

const lowCpuIdle = new client.Gauge({
  name: 'mock_low_cpu_idle_percent',
  help: 'Simulated low CPU idle in percent',
  labelNames: ['instance', 'service'],
  registers: [register],
});

// --- 2. Storage / Disk Metrics ---
const diskUsage = new client.Gauge({
  name: 'mock_disk_usage_percent',
  help: 'Simulated disk usage in percent',
  labelNames: ['device', 'mountpoint'],
  registers: [register],
});

const diskReadErrors = new client.Counter({
  name: 'mock_disk_read_errors_total',
  help: 'Simulated total disk read errors',
  labelNames: ['device'],
  registers: [register],
});

const diskWriteErrors = new client.Counter({
  name: 'mock_disk_write_errors_total',
  help: 'Simulated total disk write errors',
  labelNames: ['device'],
  registers: [register],
});

// --- 3. Network / Traffic Metrics ---
const httpErrorRate = new client.Gauge({
  name: 'mock_http_error_rate_percent',
  help: 'Simulated HTTP error rate in percent',
  labelNames: ['service', 'endpoint'],
  registers: [register],
});

const httpLatency = new client.Gauge({
  name: 'mock_http_latency_seconds',
  help: 'Simulated HTTP request latency in seconds',
  labelNames: ['service', 'endpoint'],
  registers: [register],
});

const serviceUp = new client.Gauge({
  name: 'mock_service_up',
  help: 'Simulated service availability (1 for up, 0 for down)',
  labelNames: ['service'],
  registers: [register],
});

const connectionDrops = new client.Counter({
  name: 'mock_connection_drops_total',
  help: 'Simulated total connection drops',
  labelNames: ['service'],
  registers: [register],
});

const packetLoss = new client.Gauge({
  name: 'mock_packet_loss_percent',
  help: 'Simulated packet loss in percent',
  labelNames: ['interface'],
  registers: [register],
});

// --- 4. Database / Persistent Storage Metrics ---
const dbConnectionFailed = new client.Gauge({
  name: 'mock_db_connection_failed',
  help: 'Simulated DB connection failure (1 for failed, 0 for success)',
  labelNames: ['db_name'],
  registers: [register],
});

const dbSlowQueries = new client.Gauge({
  name: 'mock_db_slow_queries_total',
  help: 'Simulated total number of slow database queries',
  labelNames: ['db_name'],
  registers: [register],
});

const dbHighLockTime = new client.Gauge({
  name: 'mock_db_high_lock_time_seconds',
  help: 'Simulated high database lock time in seconds',
  labelNames: ['db_name'],
  registers: [register],
});

const dbDiskFull = new client.Gauge({
  name: 'mock_db_disk_full_percent',
  help: 'Simulated database disk usage in percent',
  labelNames: ['db_name'],
  registers: [register],
});

// --- 5. Microservices / Application Metrics ---
const podCrashLoop = new client.Gauge({
  name: 'mock_pod_crash_loop',
  help: 'Simulated pod crash loop (1 for active, 0 for inactive)',
  labelNames: ['pod_name', 'namespace'],
  registers: [register],
});

const serviceUnavailable = new client.Gauge({
  name: 'mock_service_unavailable',
  help: 'Simulated service unavailability (1 for unavailable, 0 for available)',
  labelNames: ['service_name'],
  registers: [register],
});

const queueBacklogHigh = new client.Gauge({
  name: 'mock_queue_backlog_high_count',
  help: 'Simulated high message queue backlog count',
  labelNames: ['queue_name'],
  registers: [register],
});

const cacheMissRateHigh = new client.Gauge({
  name: 'mock_cache_miss_rate_percent',
  help: 'Simulated high cache miss rate in percent',
  labelNames: ['cache_name'],
  registers: [register],
});

// --- 6. Prometheus Self-Monitoring Metrics ---
const prometheusScrapeFailed = new client.Gauge({
  name: 'mock_prometheus_scrape_failed',
  help: 'Simulated Prometheus scrape failure (1 for failed, 0 for success)',
  labelNames: ['job_name', 'instance'],
  registers: [register],
});

const prometheusTargetDown = new client.Gauge({
  name: 'mock_prometheus_target_down',
  help: 'Simulated Prometheus target down (1 for down, 0 for up)',
  labelNames: ['job_name', 'instance'],
  registers: [register],
});

const prometheusTsdbHighSeries = new client.Gauge({
  name: 'mock_prometheus_tsdb_high_series',
  help: 'Simulated high Prometheus TSDB series count',
  labelNames: ['instance'],
  registers: [register],
});

const prometheusHighMemory = new client.Gauge({
  name: 'mock_prometheus_high_memory_bytes',
  help: 'Simulated high Prometheus memory usage in bytes',
  labelNames: ['instance'],
  registers: [register],
});

const prometheusHighCpu = new client.Gauge({
  name: 'mock_prometheus_high_cpu_percent',
  help: 'Simulated high Prometheus CPU usage in percent',
  labelNames: ['instance'],
  registers: [register],
});

// Function to get metrics in Prometheus format
async function getMetrics() {
  return register.metrics();
}

module.exports = {
  // Expose metrics for direct manipulation in the server.js if needed for specific scenarios
  highMemoryUsage,
  memoryLeakDetected,
  highCpuUsage,
  cpuSpikeDetected,
  lowCpuIdle,
  diskUsage,
  diskReadErrors,
  diskWriteErrors,
  httpErrorRate,
  httpLatency,
  serviceUp,
  connectionDrops,
  packetLoss,
  dbConnectionFailed,
  dbSlowQueries,
  dbHighLockTime,
  dbDiskFull,
  podCrashLoop,
  serviceUnavailable,
  queueBacklogHigh,
  cacheMissRateHigh,
  prometheusScrapeFailed,
  prometheusTargetDown,
  prometheusTsdbHighSeries,
  prometheusHighMemory,
  prometheusHighCpu,
  getMetrics,
  register // Expose register for custom metrics if needed
};
