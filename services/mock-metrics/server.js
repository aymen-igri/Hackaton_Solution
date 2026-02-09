const express = require('express');
const {
  getMetrics,
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
} = require('./metrics');

const app = express();
const PORT = 8082; // Using port 8082 for the mock service

app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.status(200).send('Mock Metrics Service is UP!');
});

// Metrics endpoint for Prometheus to scrape
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', 'text/plain');
    res.end(await getMetrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// --- Control Endpoints for Metric Simulation ---

// 1. Memory and CPU
app.post('/simulate/memory-usage/:value', (req, res) => {
  const value = parseFloat(req.params.value);
  highMemoryUsage.set({ instance: 'mock-app-1', service: 'mock-service' }, value);
  res.status(200).send(`High memory usage set to: ${value}`);
});

app.post('/simulate/memory-leak/:status', (req, res) => {
  const status = parseInt(req.params.status); // 0 or 1
  memoryLeakDetected.set({ instance: 'mock-app-1', service: 'mock-service' }, status);
  res.status(200).send(`Memory leak detected status set to: ${status}`);
});

app.post('/simulate/cpu-usage/:value', (req, res) => {
  const value = parseFloat(req.params.value);
  highCpuUsage.set({ instance: 'mock-app-1', service: 'mock-service' }, value);
  res.status(200).send(`High CPU usage set to: ${value}`);
});

app.post('/simulate/cpu-spike/:status', (req, res) => {
  const status = parseInt(req.params.status); // 0 or 1
  cpuSpikeDetected.set({ instance: 'mock-app-1', service: 'mock-service' }, status);
  res.status(200).send(`CPU spike detected status set to: ${status}`);
});

app.post('/simulate/low-cpu-idle/:value', (req, res) => {
  const value = parseFloat(req.params.value);
  lowCpuIdle.set({ instance: 'mock-app-1', service: 'mock-service' }, value);
  res.status(200).send(`Low CPU idle set to: ${value}`);
});


// 2. Storage / Disk
app.post('/simulate/disk-usage/:device/:value', (req, res) => {
  const { device, value } = req.params;
  diskUsage.set({ device: device, mountpoint: '/data' }, parseFloat(value));
  res.status(200).send(`Disk usage for ${device} set to: ${value}%`);
});

app.post('/simulate/disk-read-error/:device', (req, res) => {
  const { device } = req.params;
  diskReadErrors.inc({ device: device });
  res.status(200).send(`Disk read error incremented for ${device}`);
});

app.post('/simulate/disk-write-error/:device', (req, res) => {
  const { device } = req.params;
  diskWriteErrors.inc({ device: device });
  res.status(200).send(`Disk write error incremented for ${device}`);
});

// 3. Network / Traffic
app.post('/simulate/http-error-rate/:service/:value', (req, res) => {
  const { service, value } = req.params;
  httpErrorRate.set({ service: service, endpoint: '/api/v1/data' }, parseFloat(value));
  res.status(200).send(`HTTP error rate for ${service} set to: ${value}%`);
});

app.post('/simulate/http-latency/:service/:value', (req, res) => {
  const { service, value } = req.params;
  httpLatency.set({ service: service, endpoint: '/api/v1/data' }, parseFloat(value));
  res.status(200).send(`HTTP latency for ${service} set to: ${value}s`);
});

app.post('/simulate/service-up/:service/:status', (req, res) => {
  const { service, status } = req.params;
  serviceUp.set({ service: service }, parseInt(status)); // 0 for down, 1 for up
  res.status(200).send(`Service ${service} status set to: ${status}`);
});

app.post('/simulate/connection-drops/:service', (req, res) => {
  const { service } = req.params;
  connectionDrops.inc({ service: service });
  res.status(200).send(`Connection drops for ${service} incremented`);
});

app.post('/simulate/packet-loss/:interface/:value', (req, res) => {
  const { interface, value } = req.params;
  packetLoss.set({ interface: interface }, parseFloat(value));
  res.status(200).send(`Packet loss for ${interface} set to: ${value}%`);
});


// 4. Database / Persistent Storage
app.post('/simulate/db-connection-failed/:db/:status', (req, res) => {
  const { db, status } = req.params;
  dbConnectionFailed.set({ db_name: db }, parseInt(status));
  res.status(200).send(`DB connection failed status for ${db} set to: ${status}`);
});

app.post('/simulate/db-slow-queries/:db/:count', (req, res) => {
  const { db, count } = req.params;
  dbSlowQueries.set({ db_name: db }, parseInt(count));
  res.status(200).send(`DB slow queries count for ${db} set to: ${count}`);
});

app.post('/simulate/db-high-lock-time/:db/:value', (req, res) => {
  const { db, value } = req.params;
  dbHighLockTime.set({ db_name: db }, parseFloat(value));
  res.status(200).send(`DB high lock time for ${db} set to: ${value}s`);
});

app.post('/simulate/db-disk-full/:db/:value', (req, res) => {
  const { db, value } = req.params;
  dbDiskFull.set({ db_name: db }, parseFloat(value));
  res.status(200).send(`DB disk full for ${db} set to: ${value}%`);
});


// 5. Microservices / Application
app.post('/simulate/pod-crash-loop/:pod/:status', (req, res) => {
  const { pod, status } = req.params;
  podCrashLoop.set({ pod_name: pod, namespace: 'default' }, parseInt(status));
  res.status(200).send(`Pod crash loop status for ${pod} set to: ${status}`);
});

app.post('/simulate/service-unavailable/:service/:status', (req, res) => {
  const { service, status } = req.params;
  serviceUnavailable.set({ service_name: service }, parseInt(status));
  res.status(200).send(`Service ${service} unavailable status set to: ${status}`);
});

app.post('/simulate/queue-backlog-high/:queue/:count', (req, res) => {
  const { queue, count } = req.params;
  queueBacklogHigh.set({ queue_name: queue }, parseInt(count));
  res.status(200).send(`Queue backlog for ${queue} set to: ${count}`);
});

app.post('/simulate/cache-miss-rate/:cache/:value', (req, res) => {
  const { cache, value } = req.params;
  cacheMissRateHigh.set({ cache_name: cache }, parseFloat(value));
  res.status(200).send(`Cache miss rate for ${cache} set to: ${value}%`);
});


// 6. Prometheus Self-Monitoring
app.post('/simulate/prometheus-scrape-failed/:job/:instance/:status', (req, res) => {
  const { job, instance, status } = req.params;
  prometheusScrapeFailed.set({ job_name: job, instance: instance }, parseInt(status));
  res.status(200).send(`Prometheus scrape failed for ${job}/${instance} set to: ${status}`);
});

app.post('/simulate/prometheus-target-down/:job/:instance/:status', (req, res) => {
  const { job, instance, status } = req.params;
  prometheusTargetDown.set({ job_name: job, instance: instance }, parseInt(status));
  res.status(200).send(`Prometheus target down for ${job}/${instance} set to: ${status}`);
});

app.post('/simulate/prometheus-tsdb-high-series/:instance/:value', (req, res) => {
  const { instance, value } = req.params;
  prometheusTsdbHighSeries.set({ instance: instance }, parseInt(value));
  res.status(200).send(`Prometheus TSDB high series for ${instance} set to: ${value}`);
});

app.post('/simulate/prometheus-high-memory/:instance/:value', (req, res) => {
  const { instance, value } = req.params;
  prometheusHighMemory.set({ instance: instance }, parseFloat(value));
  res.status(200).send(`Prometheus high memory for ${instance} set to: ${value}`);
});

app.post('/simulate/prometheus-high-cpu/:instance/:value', (req, res) => {
  const { instance, value } = req.params;
  prometheusHighCpu.set({ instance: instance }, parseFloat(value));
  res.status(200).send(`Prometheus high CPU for ${instance} set to: ${value}`);
});


// Start the server
app.listen(PORT, () => {
  console.log(`Mock Metrics Service running on http://localhost:${PORT}`);
});
