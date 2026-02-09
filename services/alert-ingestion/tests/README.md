# Test Quick Reference

## Quick Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests (requires Redis)
npm run test:integration

# Run E2E tests
npm run test:e2e

# Watch mode for development
npm run test:watch

# Run tests with script (Linux/Mac)
chmod +x run-tests.sh
./run-tests.sh

# Run tests with script (Windows)
.\run-tests.ps1
```

## Test Files

| File | Tests | Type |
|------|-------|------|
| `verificationService.test.js` | 19 | Unit |
| `normalizationService.test.js` | 20 | Unit |
| `prometheus.routes.test.js` | 9 | Unit |
| `integration.test.js` | 3 | Integration |
| `e2e.test.js` | 21 | E2E |

**Total: 72 tests**

## Coverage

Expected coverage: ~95%

View coverage report:
```bash
npm test
open coverage/lcov-report/index.html  # Mac/Linux
start coverage\lcov-report\index.html # Windows
```

## Prerequisites

### For Unit Tests
- Node.js 18+
- Dependencies installed (`npm install`)

### For Integration Tests
- Redis running (`docker-compose up -d redis`)
- REDIS_URL configured

### For E2E Tests
- All services running (`docker-compose up -d`)

## Test Examples

### Valid Alert
```javascript
{
  "status": "firing",
  "labels": {
    "alertname": "HighMemoryUsage",
    "severity": "high",
    "instance": "api-server-03"
  },
  "annotations": {
    "summary": "Memory usage above 85%"
  },
  "startsAt": "2026-02-09T14:30:00Z"
}
```

### Run Single Test File
```bash
npm test -- verificationService.test.js
```

### Debug Tests
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Troubleshooting

**Redis connection error:**
```bash
docker-compose up -d redis
export REDIS_URL=redis://localhost:6379
```

**Tests timeout:**
Increase timeout in `jest.config.js`:
```javascript
{ testTimeout: 30000 }
```

**Coverage below threshold:**
Add more tests or adjust in `jest.config.js`

## CI/CD

Tests can be integrated into GitHub Actions, GitLab CI, or Jenkins.

See `TESTING.md` for complete CI/CD examples.

---

**For detailed documentation, see TESTING.md**

