/**
 * E2E Test Suite: Mock-Metrics -> Prometheus -> Service-Metrics Flow
 * 
 * This test validates the complete metrics pipeline:
 * 1. mock-metrics service generates/exposes metrics
 * 2. Prometheus scrapes metrics from mock-metrics
 * 3. service-metrics queries Prometheus and exposes data via REST/WebSocket
 */

const http = require('http');
const WebSocket = require('ws');

// Configuration
const CONFIG = {
  MOCK_METRICS_URL: 'http://localhost:8082',
  PROMETHEUS_URL: 'http://localhost:9090',
  SERVICE_METRICS_URL: 'http://localhost:8005',
  WS_URL: 'ws://localhost:8005',
  PROMETHEUS_SCRAPE_INTERVAL: 15000, // 15 seconds
  TEST_TIMEOUT: 60000
};

// Test results storage
const testResults = {
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    startTime: null,
    endTime: null
  },
  stages: {
    mockMetrics: [],
    prometheus: [],
    serviceMetrics: [],
    websocket: [],
    e2eFlow: []
  }
};

// ==================== HELPERS ====================

function httpRequest(baseUrl, path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      timeout: 15000,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = res.headers['content-type']?.includes('json') 
            ? JSON.parse(data) 
            : data;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed,
            raw: data
          });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function addResult(stage, testName, passed, details = {}) {
  const result = {
    test: testName,
    status: passed ? 'PASSED' : 'FAILED',
    timestamp: new Date().toISOString(),
    ...details
  };
  testResults.stages[stage].push(result);
  testResults.summary.total++;
  if (passed) {
    testResults.summary.passed++;
    console.log(`   ✅ ${testName}`);
  } else {
    testResults.summary.failed++;
    console.log(`   ❌ ${testName}${details.error ? ': ' + details.error : ''}`);
  }
  return result;
}

// ==================== STAGE 1: MOCK-METRICS ====================

async function testMockMetricsHealth() {
  console.log('\n📊 Stage 1: Testing Mock-Metrics Service');
  console.log('   URL:', CONFIG.MOCK_METRICS_URL);
  
  try {
    const response = await httpRequest(CONFIG.MOCK_METRICS_URL, '/health');
    const passed = response.statusCode === 200 && response.body.includes('UP');
    addResult('mockMetrics', 'Health Check', passed, {
      statusCode: response.statusCode,
      response: response.body
    });
    return passed;
  } catch (error) {
    addResult('mockMetrics', 'Health Check', false, { error: error.message });
    return false;
  }
}

async function testMockMetricsExposesMetrics() {
  try {
    const response = await httpRequest(CONFIG.MOCK_METRICS_URL, '/metrics');
    const hasMetrics = response.raw.includes('mock_') || response.raw.includes('process_');
    const metricsFound = extractMetricNames(response.raw);
    
    addResult('mockMetrics', 'Metrics Endpoint', hasMetrics, {
      statusCode: response.statusCode,
      metricsCount: metricsFound.length,
      sampleMetrics: metricsFound.slice(0, 10)
    });
    return { passed: hasMetrics, metrics: metricsFound };
  } catch (error) {
    addResult('mockMetrics', 'Metrics Endpoint', false, { error: error.message });
    return { passed: false, metrics: [] };
  }
}

async function simulateMetrics() {
  console.log('\n   📈 Simulating metrics via mock-metrics API...');
  const timestamp = Date.now();
  const testValue = Math.floor(Math.random() * 100);
  
  const simulations = [
    { path: `/simulate/memory-usage/${75 + testValue % 25}`, name: 'Memory Usage' },
    { path: `/simulate/cpu-usage/${50 + testValue % 50}`, name: 'CPU Usage' },
    { path: '/simulate/disk-usage/sda/85', name: 'Disk Usage' }
  ];

  const results = [];
  for (const sim of simulations) {
    try {
      const response = await httpRequest(CONFIG.MOCK_METRICS_URL, sim.path, 'POST');
      const passed = response.statusCode === 200;
      results.push({ name: sim.name, passed, response: response.body });
      addResult('mockMetrics', `Simulate ${sim.name}`, passed, {
        statusCode: response.statusCode,
        response: response.body
      });
    } catch (error) {
      results.push({ name: sim.name, passed: false, error: error.message });
      addResult('mockMetrics', `Simulate ${sim.name}`, false, { error: error.message });
    }
  }

  return { timestamp, testValue, results };
}

// ==================== STAGE 2: PROMETHEUS ====================

async function testPrometheusHealth() {
  console.log('\n🔥 Stage 2: Testing Prometheus');
  console.log('   URL:', CONFIG.PROMETHEUS_URL);
  
  try {
    const response = await httpRequest(CONFIG.PROMETHEUS_URL, '/-/healthy');
    const passed = response.statusCode === 200;
    addResult('prometheus', 'Health Check', passed, {
      statusCode: response.statusCode,
      response: response.body
    });
    return passed;
  } catch (error) {
    addResult('prometheus', 'Health Check', false, { error: error.message });
    return false;
  }
}

async function testPrometheusTargets() {
  try {
    const response = await httpRequest(CONFIG.PROMETHEUS_URL, '/api/v1/targets');
    const targets = response.body?.data?.activeTargets || [];
    const mockMetricsTarget = targets.find(t => 
      t.labels?.job === 'mock-metrics' || 
      t.scrapeUrl?.includes('8082')
    );
    
    const passed = mockMetricsTarget && mockMetricsTarget.health === 'up';
    
    addResult('prometheus', 'Mock-Metrics Target Status', passed, {
      targetFound: !!mockMetricsTarget,
      targetHealth: mockMetricsTarget?.health || 'not found',
      scrapeUrl: mockMetricsTarget?.scrapeUrl,
      lastScrape: mockMetricsTarget?.lastScrape
    });
    
    return { passed, target: mockMetricsTarget };
  } catch (error) {
    addResult('prometheus', 'Mock-Metrics Target Status', false, { error: error.message });
    return { passed: false, target: null };
  }
}

async function queryPrometheusForMockMetrics() {
  const queries = [
    { name: 'mock_high_memory_usage_bytes', query: 'mock_high_memory_usage_bytes' },
    { name: 'mock_high_cpu_usage_percent', query: 'mock_high_cpu_usage_percent' },
    { name: 'mock_disk_usage_percent', query: 'mock_disk_usage_percent' }
  ];

  const results = [];
  for (const q of queries) {
    try {
      const response = await httpRequest(
        CONFIG.PROMETHEUS_URL, 
        `/api/v1/query?query=${encodeURIComponent(q.query)}`
      );
      
      const hasData = response.body?.data?.result?.length > 0;
      const value = response.body?.data?.result?.[0]?.value?.[1];
      
      results.push({
        metric: q.name,
        hasData,
        value: value || null,
        raw: response.body?.data?.result
      });
      
      addResult('prometheus', `Query ${q.name}`, hasData, {
        hasData,
        value,
        resultCount: response.body?.data?.result?.length || 0
      });
    } catch (error) {
      results.push({ metric: q.name, hasData: false, error: error.message });
      addResult('prometheus', `Query ${q.name}`, false, { error: error.message });
    }
  }

  return results;
}

// ==================== STAGE 3: SERVICE-METRICS ====================

async function testServiceMetricsHealth() {
  console.log('\n📡 Stage 3: Testing Service-Metrics');
  console.log('   URL:', CONFIG.SERVICE_METRICS_URL);
  
  try {
    const response = await httpRequest(CONFIG.SERVICE_METRICS_URL, '/health');
    const passed = response.statusCode === 200 && response.body?.status === 'ok';
    addResult('serviceMetrics', 'Health Check', passed, {
      statusCode: response.statusCode,
      response: response.body
    });
    return passed;
  } catch (error) {
    addResult('serviceMetrics', 'Health Check', false, { error: error.message });
    return false;
  }
}

async function testServiceMetricsPrometheusEndpoint() {
  try {
    const response = await httpRequest(CONFIG.SERVICE_METRICS_URL, '/metrics');
    const isPrometheus = response.raw.includes('# HELP') || response.raw.includes('# TYPE');
    const metricsFound = extractMetricNames(response.raw);
    
    addResult('serviceMetrics', 'Prometheus Metrics Endpoint', isPrometheus, {
      statusCode: response.statusCode,
      metricsCount: metricsFound.length,
      metrics: metricsFound
    });
    return isPrometheus;
  } catch (error) {
    addResult('serviceMetrics', 'Prometheus Metrics Endpoint', false, { error: error.message });
    return false;
  }
}

async function testServiceMetricsIncidentsAPI() {
  try {
    const [byService, details] = await Promise.all([
      httpRequest(CONFIG.SERVICE_METRICS_URL, '/api/metrics/incidents/by-service'),
      httpRequest(CONFIG.SERVICE_METRICS_URL, '/api/metrics/incidents/details')
    ]);

    const byServicePassed = byService.statusCode === 200 && byService.body?.status === 'success';
    const detailsPassed = details.statusCode === 200 && details.body?.status === 'success';

    addResult('serviceMetrics', 'Incidents By Service API', byServicePassed, {
      statusCode: byService.statusCode,
      dataCount: byService.body?.data?.length || 0
    });

    addResult('serviceMetrics', 'Incidents Details API', detailsPassed, {
      statusCode: details.statusCode,
      dataCount: details.body?.data?.length || 0
    });

    return { byServicePassed, detailsPassed, byService: byService.body, details: details.body };
  } catch (error) {
    addResult('serviceMetrics', 'Incidents API', false, { error: error.message });
    return { byServicePassed: false, detailsPassed: false };
  }
}

// ==================== STAGE 4: WEBSOCKET E2E ====================

async function testWebSocketReceivesPrometheusMetrics() {
  console.log('\n🔌 Stage 4: Testing WebSocket Real-Time Metrics');
  console.log('   URL:', CONFIG.WS_URL);
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      addResult('websocket', 'Receive Instant Metrics', false, {
        error: 'Timeout waiting for instant_metrics (20s)'
      });
      resolve({ passed: false, data: null });
    }, 20000);

    try {
      const ws = new WebSocket(CONFIG.WS_URL);
      let connectionPassed = false;

      ws.on('open', () => {
        console.log('   📡 WebSocket connected');
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'connection' && !connectionPassed) {
            connectionPassed = true;
            addResult('websocket', 'Connection Established', true, {
              message: message.message
            });
          }

          if (message.type === 'instant_metrics') {
            clearTimeout(timeout);
            const hasPrometheusData = message.data && Object.keys(message.data).length > 0;
            
            addResult('websocket', 'Receive Instant Metrics', hasPrometheusData, {
              timestamp: message.timestamp,
              metricsKeys: Object.keys(message.data || {}),
              sampleData: message.data
            });

            ws.close();
            resolve({ passed: hasPrometheusData, data: message.data });
          }
        } catch (e) {
          // Continue waiting
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        addResult('websocket', 'Connection', false, { error: error.message });
        resolve({ passed: false, error: error.message });
      });
    } catch (error) {
      clearTimeout(timeout);
      addResult('websocket', 'Connection', false, { error: error.message });
      resolve({ passed: false, error: error.message });
    }
  });
}

// ==================== E2E FLOW VALIDATION ====================

async function validateE2EFlow(simulatedData, prometheusResults, wsData) {
  console.log('\n🔗 Stage 5: E2E Flow Validation');
  
  // Check if simulated metrics reached Prometheus
  const metricsReachedPrometheus = prometheusResults.some(r => r.hasData);
  addResult('e2eFlow', 'Metrics Reached Prometheus', metricsReachedPrometheus, {
    metricsWithData: prometheusResults.filter(r => r.hasData).map(r => r.metric)
  });

  // Check if service-metrics received data from Prometheus
  const serviceReceivedData = wsData && wsData.data && Object.keys(wsData.data).length > 0;
  addResult('e2eFlow', 'Service-Metrics Received Prometheus Data', serviceReceivedData, {
    dataKeys: wsData?.data ? Object.keys(wsData.data) : []
  });

  // Complete pipeline validation
  const pipelineComplete = metricsReachedPrometheus && serviceReceivedData;
  addResult('e2eFlow', 'Complete Pipeline Flow', pipelineComplete, {
    mockMetricsToPrometheus: metricsReachedPrometheus,
    prometheusToServiceMetrics: serviceReceivedData
  });

  return pipelineComplete;
}

// ==================== HELPERS ====================

function extractMetricNames(prometheusText) {
  const lines = prometheusText.split('\n');
  const metrics = new Set();
  lines.forEach(line => {
    if (line.startsWith('# HELP ')) {
      const match = line.match(/^# HELP (\S+)/);
      if (match) metrics.add(match[1]);
    }
  });
  return Array.from(metrics);
}

// ==================== REPORT GENERATION ====================

function generateReport() {
  const duration = testResults.summary.endTime - testResults.summary.startTime;
  const successRate = ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1);

  const report = `
╔═══════════════════════════════════════════════════════════════════════════════════════╗
║          E2E TEST REPORT: Mock-Metrics → Prometheus → Service-Metrics                 ║
║          Generated: ${new Date().toISOString()}                                  ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                                    SUMMARY                                            │
├───────────────────────────────────────────────────────────────────────────────────────┤
│  Total Tests: ${testResults.summary.total.toString().padEnd(6)} | Passed: ${testResults.summary.passed.toString().padEnd(6)} | Failed: ${testResults.summary.failed.toString().padEnd(6)}                          │
│  Success Rate: ${successRate}%                                                                 │
│  Duration: ${duration}ms                                                                       │
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
${formatStageResults(testResults.stages.mockMetrics)}

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                           STAGE 2: PROMETHEUS                                         │
└───────────────────────────────────────────────────────────────────────────────────────┘
${formatStageResults(testResults.stages.prometheus)}

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                        STAGE 3: SERVICE-METRICS                                       │
└───────────────────────────────────────────────────────────────────────────────────────┘
${formatStageResults(testResults.stages.serviceMetrics)}

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                        STAGE 4: WEBSOCKET REAL-TIME                                   │
└───────────────────────────────────────────────────────────────────────────────────────┘
${formatStageResults(testResults.stages.websocket)}

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                        STAGE 5: E2E FLOW VALIDATION                                   │
└───────────────────────────────────────────────────────────────────────────────────────┘
${formatStageResults(testResults.stages.e2eFlow)}

┌───────────────────────────────────────────────────────────────────────────────────────┐
│                              DETAILED RESULTS (JSON)                                  │
└───────────────────────────────────────────────────────────────────────────────────────┘

${JSON.stringify(testResults, null, 2)}
`;

  return report;
}

function formatStageResults(results) {
  if (!results || results.length === 0) {
    return '  No tests executed for this stage.\n';
  }
  
  return results.map((r, i) => {
    const icon = r.status === 'PASSED' ? '✅' : '❌';
    let details = '';
    
    if (r.statusCode) details += `HTTP: ${r.statusCode} | `;
    if (r.dataCount !== undefined) details += `Data: ${r.dataCount} items | `;
    if (r.metricsCount !== undefined) details += `Metrics: ${r.metricsCount} | `;
    if (r.value !== undefined) details += `Value: ${r.value} | `;
    if (r.error) details += `Error: ${r.error} | `;
    
    details = details.slice(0, -3); // Remove trailing " | "
    
    return `  ${i + 1}. ${icon} ${r.test}${details ? '\n     └── ' + details : ''}`;
  }).join('\n');
}

// ==================== MAIN TEST RUNNER ====================

async function runE2ETests() {
  console.log('\n' + '═'.repeat(80));
  console.log('  E2E TEST SUITE: Mock-Metrics → Prometheus → Service-Metrics');
  console.log('═'.repeat(80));

  testResults.summary.startTime = Date.now();

  // Stage 1: Mock-Metrics
  const mockHealthy = await testMockMetricsHealth();
  if (!mockHealthy) {
    console.log('\n⚠️  Mock-Metrics is not running. Please start it first.');
    console.log('   Run: cd services/mock-metrics && node server.js');
  }

  const mockMetrics = await testMockMetricsExposesMetrics();
  const simulated = await simulateMetrics();

  // Wait for Prometheus to scrape
  console.log('\n⏳ Waiting for Prometheus to scrape mock-metrics (17 seconds)...');
  await sleep(17000);

  // Stage 2: Prometheus
  const prometheusHealthy = await testPrometheusHealth();
  const targetStatus = await testPrometheusTargets();
  const prometheusResults = await queryPrometheusForMockMetrics();

  // Stage 3: Service-Metrics
  const serviceHealthy = await testServiceMetricsHealth();
  await testServiceMetricsPrometheusEndpoint();
  await testServiceMetricsIncidentsAPI();

  // Stage 4: WebSocket
  const wsResult = await testWebSocketReceivesPrometheusMetrics();

  // Stage 5: E2E Flow Validation
  await validateE2EFlow(simulated, prometheusResults, wsResult);

  testResults.summary.endTime = Date.now();

  // Generate report
  const report = generateReport();
  console.log(report);

  // Save report
  const fs = require('fs');
  const reportPath = __dirname + '/../E2E_TEST_REPORT.md';
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);

  // Exit code
  const exitCode = testResults.summary.failed > 0 ? 1 : 0;
  console.log(`\nTest suite ${exitCode === 0 ? 'PASSED ✅' : 'FAILED ❌'}`);
  process.exit(exitCode);
}

// Run
runE2ETests();
