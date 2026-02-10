/**
 * Service-Metrics Endpoint & WebSocket Test Suite
 * Tests all REST endpoints and WebSocket functionality
 */

const http = require('http');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:8005';
const WS_URL = 'ws://localhost:8005';

const testResults = {
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    startTime: null,
    endTime: null
  },
  restEndpoints: [],
  websocket: []
};

// Helper function to make HTTP requests
function httpRequest(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = res.headers['content-type']?.includes('application/json') 
            ? JSON.parse(data) 
            : data;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed,
            raw: data
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data,
            raw: data
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    req.end();
  });
}

// Test 1: Health Check Endpoint
async function testHealthEndpoint() {
  const testName = 'GET /health';
  console.log(`\n🧪 Testing: ${testName}`);
  
  try {
    const response = await httpRequest('/health');
    const passed = response.statusCode === 200 && 
                   response.body.status === 'ok' && 
                   response.body.timestamp;

    const result = {
      endpoint: '/health',
      method: 'GET',
      status: passed ? 'PASSED' : 'FAILED',
      statusCode: response.statusCode,
      responseTime: null,
      response: response.body,
      expectedStatus: 200,
      expectedFields: ['status', 'timestamp'],
      validations: {
        statusCodeValid: response.statusCode === 200,
        hasStatusField: !!response.body.status,
        statusIsOk: response.body.status === 'ok',
        hasTimestamp: !!response.body.timestamp
      }
    };

    testResults.restEndpoints.push(result);
    testResults.summary.total++;
    if (passed) {
      testResults.summary.passed++;
      console.log(`   ✅ PASSED - Status: ${response.statusCode}`);
    } else {
      testResults.summary.failed++;
      console.log(`   ❌ FAILED - Status: ${response.statusCode}`);
    }

    return result;
  } catch (error) {
    const result = {
      endpoint: '/health',
      method: 'GET',
      status: 'ERROR',
      error: error.message
    };
    testResults.restEndpoints.push(result);
    testResults.summary.total++;
    testResults.summary.failed++;
    console.log(`   ❌ ERROR - ${error.message}`);
    return result;
  }
}

// Test 2: Prometheus Metrics Endpoint
async function testMetricsEndpoint() {
  const testName = 'GET /metrics';
  console.log(`\n🧪 Testing: ${testName}`);
  
  try {
    const response = await httpRequest('/metrics');
    const isPrometheusFormat = response.raw.includes('# HELP') || 
                               response.raw.includes('# TYPE') ||
                               response.raw.includes('service_metrics');
    
    const passed = response.statusCode === 200 && isPrometheusFormat;

    const result = {
      endpoint: '/metrics',
      method: 'GET',
      status: passed ? 'PASSED' : 'FAILED',
      statusCode: response.statusCode,
      contentType: response.headers['content-type'],
      isPrometheusFormat: isPrometheusFormat,
      metricsFound: extractMetricNames(response.raw),
      validations: {
        statusCodeValid: response.statusCode === 200,
        hasPrometheusFormat: isPrometheusFormat,
        hasContentType: !!response.headers['content-type']
      }
    };

    testResults.restEndpoints.push(result);
    testResults.summary.total++;
    if (passed) {
      testResults.summary.passed++;
      console.log(`   ✅ PASSED - Prometheus format detected`);
    } else {
      testResults.summary.failed++;
      console.log(`   ❌ FAILED - Invalid format`);
    }

    return result;
  } catch (error) {
    const result = {
      endpoint: '/metrics',
      method: 'GET',
      status: 'ERROR',
      error: error.message
    };
    testResults.restEndpoints.push(result);
    testResults.summary.total++;
    testResults.summary.failed++;
    console.log(`   ❌ ERROR - ${error.message}`);
    return result;
  }
}

// Test 3: Incidents by Service Endpoint
async function testIncidentsByServiceEndpoint() {
  const testName = 'GET /api/metrics/incidents/by-service';
  console.log(`\n🧪 Testing: ${testName}`);
  
  try {
    const response = await httpRequest('/api/metrics/incidents/by-service');
    const hasCorrectStructure = response.body.status === 'success' && 
                                 Array.isArray(response.body.data);
    
    const passed = response.statusCode === 200 && hasCorrectStructure;

    const result = {
      endpoint: '/api/metrics/incidents/by-service',
      method: 'GET',
      status: passed ? 'PASSED' : 'FAILED',
      statusCode: response.statusCode,
      response: response.body,
      dataCount: response.body.data?.length || 0,
      sampleData: response.body.data?.slice(0, 3),
      validations: {
        statusCodeValid: response.statusCode === 200,
        hasStatusField: response.body.status === 'success',
        hasDataArray: Array.isArray(response.body.data),
        dataStructureValid: validateIncidentsByServiceData(response.body.data)
      }
    };

    testResults.restEndpoints.push(result);
    testResults.summary.total++;
    if (passed) {
      testResults.summary.passed++;
      console.log(`   ✅ PASSED - Found ${result.dataCount} service(s)`);
    } else {
      testResults.summary.failed++;
      console.log(`   ❌ FAILED - Status: ${response.statusCode}`);
    }

    return result;
  } catch (error) {
    const result = {
      endpoint: '/api/metrics/incidents/by-service',
      method: 'GET',
      status: 'ERROR',
      error: error.message
    };
    testResults.restEndpoints.push(result);
    testResults.summary.total++;
    testResults.summary.failed++;
    console.log(`   ❌ ERROR - ${error.message}`);
    return result;
  }
}

// Test 4: Incidents Details Endpoint
async function testIncidentsDetailsEndpoint() {
  const testName = 'GET /api/metrics/incidents/details';
  console.log(`\n🧪 Testing: ${testName}`);
  
  try {
    const response = await httpRequest('/api/metrics/incidents/details');
    const hasCorrectStructure = response.body.status === 'success' && 
                                 Array.isArray(response.body.data);
    
    const passed = response.statusCode === 200 && hasCorrectStructure;

    const result = {
      endpoint: '/api/metrics/incidents/details',
      method: 'GET',
      status: passed ? 'PASSED' : 'FAILED',
      statusCode: response.statusCode,
      response: response.body,
      dataCount: response.body.data?.length || 0,
      sampleData: response.body.data?.slice(0, 3),
      validations: {
        statusCodeValid: response.statusCode === 200,
        hasStatusField: response.body.status === 'success',
        hasDataArray: Array.isArray(response.body.data),
        containsIncidentFields: validateIncidentDetailsData(response.body.data)
      }
    };

    testResults.restEndpoints.push(result);
    testResults.summary.total++;
    if (passed) {
      testResults.summary.passed++;
      console.log(`   ✅ PASSED - Found ${result.dataCount} incident(s)`);
    } else {
      testResults.summary.failed++;
      console.log(`   ❌ FAILED - Status: ${response.statusCode}`);
    }

    return result;
  } catch (error) {
    const result = {
      endpoint: '/api/metrics/incidents/details',
      method: 'GET',
      status: 'ERROR',
      error: error.message
    };
    testResults.restEndpoints.push(result);
    testResults.summary.total++;
    testResults.summary.failed++;
    console.log(`   ❌ ERROR - ${error.message}`);
    return result;
  }
}

// Test 5: WebSocket Connection
async function testWebSocketConnection() {
  const testName = 'WebSocket Connection';
  console.log(`\n🧪 Testing: ${testName}`);
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      const result = {
        test: 'WebSocket Connection',
        status: 'FAILED',
        error: 'Connection timeout (10s)'
      };
      testResults.websocket.push(result);
      testResults.summary.total++;
      testResults.summary.failed++;
      console.log(`   ❌ FAILED - Connection timeout`);
      resolve(result);
    }, 10000);

    try {
      const ws = new WebSocket(WS_URL);
      
      ws.on('open', () => {
        console.log(`   📡 WebSocket connected`);
      });

      ws.on('message', (data) => {
        clearTimeout(timeout);
        try {
          const message = JSON.parse(data.toString());
          const passed = message.type === 'connection' && 
                         message.message === 'Connected to service-metrics' &&
                         message.timestamp;

          const result = {
            test: 'WebSocket Connection',
            status: passed ? 'PASSED' : 'FAILED',
            welcomeMessage: message,
            validations: {
              hasType: message.type === 'connection',
              hasMessage: !!message.message,
              hasTimestamp: !!message.timestamp
            }
          };

          testResults.websocket.push(result);
          testResults.summary.total++;
          if (passed) {
            testResults.summary.passed++;
            console.log(`   ✅ PASSED - Welcome message received`);
          } else {
            testResults.summary.failed++;
            console.log(`   ❌ FAILED - Invalid welcome message`);
          }

          ws.close();
          resolve(result);
        } catch (e) {
          const result = {
            test: 'WebSocket Connection',
            status: 'FAILED',
            error: 'Failed to parse message: ' + e.message
          };
          testResults.websocket.push(result);
          testResults.summary.total++;
          testResults.summary.failed++;
          ws.close();
          resolve(result);
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        const result = {
          test: 'WebSocket Connection',
          status: 'ERROR',
          error: error.message
        };
        testResults.websocket.push(result);
        testResults.summary.total++;
        testResults.summary.failed++;
        console.log(`   ❌ ERROR - ${error.message}`);
        resolve(result);
      });
    } catch (error) {
      clearTimeout(timeout);
      const result = {
        test: 'WebSocket Connection',
        status: 'ERROR',
        error: error.message
      };
      testResults.websocket.push(result);
      testResults.summary.total++;
      testResults.summary.failed++;
      resolve(result);
    }
  });
}

// Test 6: WebSocket Message Acknowledgment
async function testWebSocketAcknowledgment() {
  const testName = 'WebSocket Message Acknowledgment';
  console.log(`\n🧪 Testing: ${testName}`);
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      const result = {
        test: 'WebSocket Message Acknowledgment',
        status: 'FAILED',
        error: 'Acknowledgment timeout (10s)'
      };
      testResults.websocket.push(result);
      testResults.summary.total++;
      testResults.summary.failed++;
      console.log(`   ❌ FAILED - Acknowledgment timeout`);
      resolve(result);
    }, 10000);

    try {
      const ws = new WebSocket(WS_URL);
      let welcomeReceived = false;
      
      ws.on('open', () => {
        console.log(`   📡 WebSocket connected`);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Skip welcome message
          if (message.type === 'connection' && !welcomeReceived) {
            welcomeReceived = true;
            // Send test message
            ws.send(JSON.stringify({ type: 'subscribe', channel: 'metrics' }));
            console.log(`   📤 Sent subscribe message`);
            return;
          }

          // Check acknowledgment
          if (message.type === 'ack') {
            clearTimeout(timeout);
            const passed = message.type === 'ack' && 
                           message.requestType === 'subscribe' &&
                           message.timestamp;

            const result = {
              test: 'WebSocket Message Acknowledgment',
              status: passed ? 'PASSED' : 'FAILED',
              ackMessage: message,
              validations: {
                hasType: message.type === 'ack',
                hasRequestType: message.requestType === 'subscribe',
                hasTimestamp: !!message.timestamp
              }
            };

            testResults.websocket.push(result);
            testResults.summary.total++;
            if (passed) {
              testResults.summary.passed++;
              console.log(`   ✅ PASSED - Acknowledgment received`);
            } else {
              testResults.summary.failed++;
              console.log(`   ❌ FAILED - Invalid acknowledgment`);
            }

            ws.close();
            resolve(result);
          }
        } catch (e) {
          // Continue waiting for ack
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        const result = {
          test: 'WebSocket Message Acknowledgment',
          status: 'ERROR',
          error: error.message
        };
        testResults.websocket.push(result);
        testResults.summary.total++;
        testResults.summary.failed++;
        console.log(`   ❌ ERROR - ${error.message}`);
        resolve(result);
      });
    } catch (error) {
      clearTimeout(timeout);
      const result = {
        test: 'WebSocket Message Acknowledgment',
        status: 'ERROR',
        error: error.message
      };
      testResults.websocket.push(result);
      testResults.summary.total++;
      testResults.summary.failed++;
      resolve(result);
    }
  });
}

// Test 7: WebSocket Instant Metrics Broadcast
async function testWebSocketInstantMetrics() {
  const testName = 'WebSocket Instant Metrics Broadcast';
  console.log(`\n🧪 Testing: ${testName} (waiting up to 15s for metrics...)`);
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      const result = {
        test: 'WebSocket Instant Metrics Broadcast',
        status: 'FAILED',
        error: 'No instant_metrics received within 15s'
      };
      testResults.websocket.push(result);
      testResults.summary.total++;
      testResults.summary.failed++;
      console.log(`   ❌ FAILED - No metrics received`);
      resolve(result);
    }, 15000);

    try {
      const ws = new WebSocket(WS_URL);
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'instant_metrics') {
            clearTimeout(timeout);
            const passed = message.type === 'instant_metrics' && 
                           message.timestamp &&
                           message.data;

            const result = {
              test: 'WebSocket Instant Metrics Broadcast',
              status: passed ? 'PASSED' : 'FAILED',
              metricsReceived: true,
              timestamp: message.timestamp,
              dataKeys: message.data ? Object.keys(message.data) : [],
              validations: {
                hasType: message.type === 'instant_metrics',
                hasTimestamp: !!message.timestamp,
                hasData: !!message.data
              }
            };

            testResults.websocket.push(result);
            testResults.summary.total++;
            if (passed) {
              testResults.summary.passed++;
              console.log(`   ✅ PASSED - Instant metrics received`);
            } else {
              testResults.summary.failed++;
              console.log(`   ❌ FAILED - Invalid metrics format`);
            }

            ws.close();
            resolve(result);
          }
        } catch (e) {
          // Continue waiting
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        const result = {
          test: 'WebSocket Instant Metrics Broadcast',
          status: 'ERROR',
          error: error.message
        };
        testResults.websocket.push(result);
        testResults.summary.total++;
        testResults.summary.failed++;
        console.log(`   ❌ ERROR - ${error.message}`);
        resolve(result);
      });
    } catch (error) {
      clearTimeout(timeout);
      const result = {
        test: 'WebSocket Instant Metrics Broadcast',
        status: 'ERROR',
        error: error.message
      };
      testResults.websocket.push(result);
      testResults.summary.total++;
      testResults.summary.failed++;
      resolve(result);
    }
  });
}

// Helper functions
function extractMetricNames(prometheusText) {
  const lines = prometheusText.split('\n');
  const metrics = [];
  lines.forEach(line => {
    if (line.startsWith('# HELP ')) {
      const match = line.match(/^# HELP (\S+)/);
      if (match) metrics.push(match[1]);
    }
  });
  return metrics;
}

function validateIncidentsByServiceData(data) {
  if (!Array.isArray(data) || data.length === 0) return true; // Empty is valid
  const requiredFields = ['service', 'total_incidents', 'open_count', 'ack_count', 'resolved_count'];
  return data.every(item => requiredFields.some(field => item.hasOwnProperty(field)));
}

function validateIncidentDetailsData(data) {
  if (!Array.isArray(data) || data.length === 0) return true; // Empty is valid
  const expectedFields = ['id', 'title', 'severity', 'status', 'created_at'];
  return data.every(item => expectedFields.some(field => item.hasOwnProperty(field)));
}

// Generate report
function generateReport() {
  const report = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                     SERVICE-METRICS TEST REPORT                               ║
║                     Generated: ${new Date().toISOString()}                ║
╚═══════════════════════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SUMMARY                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Total Tests: ${testResults.summary.total.toString().padEnd(5)} | Passed: ${testResults.summary.passed.toString().padEnd(5)} | Failed: ${testResults.summary.failed.toString().padEnd(5)}                               │
│  Success Rate: ${((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1)}%                                                            │
│  Duration: ${testResults.summary.endTime - testResults.summary.startTime}ms                                                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          REST API ENDPOINTS                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

${testResults.restEndpoints.map((test, i) => `
  ${i + 1}. ${test.method} ${test.endpoint}
     ├── Status: ${test.status === 'PASSED' ? '✅ PASSED' : '❌ ' + test.status}
     ├── HTTP Status: ${test.statusCode || 'N/A'}
     ${test.validations ? Object.entries(test.validations).map(([k, v]) => `├── ${k}: ${v ? '✓' : '✗'}`).join('\n     ') : ''}
     ${test.dataCount !== undefined ? `└── Data Count: ${test.dataCount}` : ''}
     ${test.error ? `└── Error: ${test.error}` : ''}
`).join('')}

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          WEBSOCKET TESTS                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

${testResults.websocket.map((test, i) => `
  ${i + 1}. ${test.test}
     ├── Status: ${test.status === 'PASSED' ? '✅ PASSED' : '❌ ' + test.status}
     ${test.validations ? Object.entries(test.validations).map(([k, v]) => `├── ${k}: ${v ? '✓' : '✗'}`).join('\n     ') : ''}
     ${test.error ? `└── Error: ${test.error}` : ''}
`).join('')}

┌─────────────────────────────────────────────────────────────────────────────────┐
│                          DETAILED RESULTS                                       │
└─────────────────────────────────────────────────────────────────────────────────┘

${JSON.stringify(testResults, null, 2)}
`;
  return report;
}

// Main test runner
async function runTests() {
  console.log('\n' + '='.repeat(80));
  console.log('  SERVICE-METRICS TEST SUITE');
  console.log('  Target: ' + BASE_URL);
  console.log('  WebSocket: ' + WS_URL);
  console.log('='.repeat(80));

  testResults.summary.startTime = Date.now();

  // REST API Tests
  console.log('\n📋 Running REST API Tests...');
  await testHealthEndpoint();
  await testMetricsEndpoint();
  await testIncidentsByServiceEndpoint();
  await testIncidentsDetailsEndpoint();

  // WebSocket Tests
  console.log('\n📋 Running WebSocket Tests...');
  await testWebSocketConnection();
  await testWebSocketAcknowledgment();
  await testWebSocketInstantMetrics();

  testResults.summary.endTime = Date.now();

  // Generate and output report
  const report = generateReport();
  console.log(report);

  // Write report to file
  const fs = require('fs');
  const reportPath = __dirname + '/../TEST_REPORT.md';
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);

  // Exit with appropriate code
  process.exit(testResults.summary.failed > 0 ? 1 : 0);
}

// Run tests
runTests();
