const axios = require('axios');

const PROMETHEUS_URL = process.env.PROMETHEUS_URL || 'http://prometheus:9090';

const client = axios.create({
  baseURL: PROMETHEUS_URL,
  timeout: 10000
});

// ─── Instant Queries ───────────────────────────────────
async function queryInstant() {
  const queries = [
    { name: 'prometheus_tsdb_head_series', query: 'prometheus_tsdb_head_series' },
    { name: 'prometheus_engine_queries', query: 'prometheus_engine_queries' },
    { name: 'http_requests_total', query: 'http_requests_total' }
  ];

  const results = {};

  for (const q of queries) {
    try {
      const response = await client.get('/api/v1/query', {
        params: { query: q.query }
      });
      results[q.name] = response.data.data;
    } catch (err) {
      console.error(`Error querying ${q.name}:`, err.message);
      results[q.name] = { error: err.message };
    }
  }

  return results;
}

// ─── Range Queries (1h, 24h) ──────────────────────────
async function queryRange() {
  const now = Math.floor(Date.now() / 1000);
  const oneHourAgo = now - 3600;
  const oneDayAgo = now - 86400;

  const queries = [
    {
      name: 'memory_usage_1h',
      query: 'memory_usage_bytes',
      start: oneHourAgo,
      end: now,
      step: '60s'
    },
    {
      name: 'cpu_usage_1h',
      query: 'cpu_usage_seconds_total',
      start: oneHourAgo,
      end: now,
      step: '60s'
    },
    {
      name: 'http_requests_24h',
      query: 'http_requests_total',
      start: oneDayAgo,
      end: now,
      step: '300s'
    }
  ];

  const results = {};

  for (const q of queries) {
    try {
      const response = await client.get('/api/v1/query_range', {
        params: {
          query: q.query,
          start: q.start,
          end: q.end,
          step: q.step
        }
      });
      results[q.name] = response.data.data;
    } catch (err) {
      console.error(`Error querying range ${q.name}:`, err.message);
      results[q.name] = { error: err.message };
    }
  }

  return results;
}

module.exports = {
  queryInstant,
  queryRange
};
