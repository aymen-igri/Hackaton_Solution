# Redis Integration - Detailed Explanation

## 🎯 Overview

Redis is integrated into the Alert Ingestion Service using **Bull** (a Redis-based queue library for Node.js) to manage the alert processing workflow through 4 separate queues.

---

## 📦 Components of Redis Integration

### 1. Dependencies

**File:** `package.json`
```json
{
  "redis": "^4.6.12",    // Redis client for Node.js
  "bull": "^4.12.0"      // Redis-based queue system
}
```

### 2. Configuration

**File:** `src/config.js`
```javascript
module.exports = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  normalization: {
    maxRetries: 3,
    retryDelayMs: 5000
  }
};
```

### 3. Docker Service

**File:** `docker-compose.yml`
```yaml
redis:
  image: redis:7-alpine
  container_name: redis
  restart: unless-stopped
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

---

## 🔧 Queue Manager Implementation

**File:** `src/queue/redisQueue.js`

### Queue Creation with Bull

```javascript
const Queue = require('bull');
const config = require('../config');

// Create 4 separate queues
const rawAlertsQueue = new Queue('raw-alerts', config.redisUrl, {
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: false,
  },
});

const successQueue = new Queue('success-alerts', config.redisUrl, {
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 500,
    removeOnFail: false,
  },
});

const retryQueue = new Queue('retry-alerts', config.redisUrl, {
  defaultJobOptions: {
    attempts: config.normalization.maxRetries,
    backoff: {
      type: 'fixed',
      delay: config.normalization.retryDelayMs,
    },
    removeOnComplete: 100,
    removeOnFail: false,
  },
});

const errorQueue = new Queue('error-alerts', config.redisUrl, {
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: false,
    removeOnFail: false,
  },
});
```

---

## 📊 The 4 Redis Queues

### 1. Raw Alerts Queue
**Name:** `raw-alerts`  
**Purpose:** Store unverified alerts from Prometheus  
**Configuration:**
- Attempts: 1 (no retry at this level)
- Keep last 100 completed jobs
- Keep all failed jobs

**When used:**
- When webhook receives alerts from Prometheus
- Before verification

### 2. Success Queue
**Name:** `success-alerts`  
**Purpose:** Store successfully verified and normalized alerts  
**Configuration:**
- Attempts: 1
- Keep last 500 completed jobs
- Keep all failed jobs

**When used:**
- After successful verification
- After successful normalization
- Ready for correlation service

### 3. Retry Queue
**Name:** `retry-alerts`  
**Purpose:** Store alerts that failed normalization for retry  
**Configuration:**
- Attempts: 3 (configurable via `maxRetries`)
- Fixed delay: 5000ms (5 seconds) between retries
- Keep last 100 completed jobs
- Keep all failed jobs

**When used:**
- When normalization fails
- Up to 3 retry attempts
- After max retries → moved to error queue

### 4. Error Queue
**Name:** `error-alerts`  
**Purpose:** Store permanently failed alerts  
**Configuration:**
- Attempts: 1 (no retry)
- Keep ALL completed jobs (never remove)
- Keep ALL failed jobs

**When used:**
- Verification failures (immediate)
- Normalization failures after 3 retries
- For debugging and analysis

---

## 🔄 Queue Processing Flow

### Step-by-Step Integration

```
┌─────────────────────────────────────────────┐
│  1. Webhook Receives Alert                  │
│     (routes/prometheus.js)                  │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│  2. Enqueue to Raw Queue                    │
│     enqueueAlert(alert)                     │
│     → rawAlertsQueue.add({alert})           │
└───────────────┬─────────────────────────────┘
                │
                ▼
        ┌───────────────┐
        │ Redis Storage │
        │ raw-alerts    │
        └───────┬───────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│  3. Queue Worker Picks Up Job              │
│     rawAlertsQueue.process(async (job))    │
│     (services/alertProcessor.js)           │
└───────────────┬─────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────┐
│  4. Verify Alert                            │
│     verifyAlert(alert)                      │
└───────────────┬─────────────────────────────┘
                │
           ┌────┴────┐
           │         │
        VALID    INVALID
           │         │
           ▼         ▼
    ┌──────────┐  ┌──────────────┐
    │Normalize │  │ errorQueue   │
    │          │  │ .add(...)    │
    └────┬─────┘  └──────────────┘
         │
    ┌────┴────┐
    │         │
SUCCESS    FAIL
    │         │
    ▼         ▼
┌─────────┐ ┌─────────────┐
│success  │ │retryQueue   │
│Queue    │ │.add(...)    │
│.add(...) │ └──────┬──────┘
└─────────┘        │
                   ▼
            ┌──────────────┐
            │Retry 3 times │
            └──────┬───────┘
                   │
              ┌────┴────┐
              │         │
          SUCCESS    MAX RETRIES
              │         │
              ▼         ▼
        ┌─────────┐ ┌──────────┐
        │success  │ │errorQueue│
        │Queue    │ │.add(...) │
        └─────────┘ └──────────┘
```

---

## 💻 Code Examples

### Example 1: Enqueuing an Alert

**File:** `src/routes/prometheus.js`

```javascript
const { enqueueAlert } = require('../services/alertProcessor');

router.post('/webhook', async (req, res) => {
  const { alerts } = req.body;
  
  for (const alert of alerts) {
    // Add to raw queue
    await enqueueAlert(alert);
  }
});
```

**Function:** `src/services/alertProcessor.js`
```javascript
async function enqueueAlert(alert) {
  const job = await rawAlertsQueue.add({
    alert,
    attemptCount: 0,
    enqueuedAt: new Date().toISOString(),
  });

  return {
    jobId: job.id,
    queueName: 'raw-alerts',
  };
}
```

### Example 2: Processing from Queue

**File:** `src/services/alertProcessor.js`

```javascript
function initializeProcessor() {
  // Set up worker to process raw alerts
  rawAlertsQueue.process(async (job) => {
    const { alert, attemptCount } = job.data;
    
    // Verify
    const verification = verifyAlert(alert);
    if (!verification.valid) {
      // Failed verification → error queue
      await errorQueue.add({
        alert,
        reason: verification.reason,
        stage: 'verification',
      });
      throw new Error(verification.reason);
    }
    
    // Normalize
    try {
      const normalizedAlert = normalizeAlert(alert);
      
      // Success → success queue
      await successQueue.add({
        alert: normalizedAlert,
        processedAt: new Date().toISOString(),
      });
      
      return { success: true };
    } catch (err) {
      // Failed normalization → retry queue
      if (attemptCount < maxRetries) {
        await retryQueue.add({
          alert,
          attemptCount: attemptCount + 1,
        });
      } else {
        // Max retries → error queue
        await errorQueue.add({
          alert,
          reason: err.message,
          stage: 'normalization',
        });
      }
      throw err;
    }
  });
}
```

### Example 3: Retry Queue Processing

**File:** `src/services/alertProcessor.js`

```javascript
// Process retry queue
retryQueue.process(async (job) => {
  const { alert, attemptCount } = job.data;
  
  console.log(`Retrying alert (attempt ${attemptCount}/${maxRetries})`);
  
  // Re-queue to raw alerts with updated attempt count
  await rawAlertsQueue.add({
    alert,
    attemptCount,
  });
  
  return { retried: true };
});
```

---

## 📡 Event Listeners for Monitoring

**File:** `src/queue/redisQueue.js`

```javascript
// Monitor raw queue
rawAlertsQueue.on('completed', (job) => {
  console.log(`[rawAlertsQueue] Job ${job.id} completed`);
});

rawAlertsQueue.on('failed', (job, err) => {
  console.error(`[rawAlertsQueue] Job ${job.id} failed:`, err.message);
});

// Monitor success queue
successQueue.on('completed', (job) => {
  console.log(`[successQueue] Job ${job.id} completed`);
});

// Monitor retry queue
retryQueue.on('failed', async (job, err) => {
  console.error(`[retryQueue] Job ${job.id} failed (attempt ${job.attemptsMade})`);
  
  // Auto-move to error queue after max retries
  if (job.attemptsMade >= maxRetries) {
    await errorQueue.add(job.data, {
      jobId: `error-${job.id}`,
    });
  }
});

// Monitor error queue
errorQueue.on('completed', (job) => {
  console.log(`[errorQueue] Job ${job.id} logged`);
});
```

---

## 🔍 Redis Data Structure

### How Bull Stores Data in Redis

Bull creates multiple Redis keys for each queue:

```
bull:raw-alerts:id               # Auto-incrementing ID counter
bull:raw-alerts:wait             # List of waiting jobs
bull:raw-alerts:active           # List of active jobs
bull:raw-alerts:completed        # Set of completed jobs
bull:raw-alerts:failed           # Set of failed jobs
bull:raw-alerts:delayed          # Set of delayed jobs
bull:raw-alerts:1                # Individual job data (hash)
bull:raw-alerts:2                # Individual job data (hash)
...
```

### Inspecting Redis Queues

```bash
# Connect to Redis
docker exec -it redis redis-cli

# List all Bull keys
KEYS bull:*

# Check queue lengths
LLEN bull:raw-alerts:wait
LLEN bull:success-alerts:wait
LLEN bull:retry-alerts:wait
LLEN bull:error-alerts:wait

# View a specific job
HGETALL bull:raw-alerts:1

# Count completed jobs
SCARD bull:success-alerts:completed

# View jobs in waiting list
LRANGE bull:raw-alerts:wait 0 -1
```

---

## 🔧 Configuration Options

### Queue Options

```javascript
new Queue('queue-name', redisUrl, {
  defaultJobOptions: {
    // Number of retry attempts
    attempts: 3,
    
    // Retry backoff strategy
    backoff: {
      type: 'fixed',      // or 'exponential'
      delay: 5000,        // ms
    },
    
    // Job expiration
    removeOnComplete: 100,  // Keep last N jobs
    removeOnFail: false,    // Keep all failed jobs
    
    // Job timeout
    timeout: 30000,         // 30 seconds
    
    // Priority
    priority: 1,            // Higher = more priority
  },
});
```

### Redis Connection Options

```javascript
const redisUrl = 'redis://username:password@host:port/db';

// Or with options object
new Queue('queue-name', {
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-password',
    db: 0,
  }
});
```

---

## 🚦 Queue States & Lifecycle

### Job States

```
┌──────────┐
│  Added   │  → Job created and added to queue
└────┬─────┘
     │
     ▼
┌──────────┐
│ Waiting  │  → In queue, waiting for worker
└────┬─────┘
     │
     ▼
┌──────────┐
│  Active  │  → Being processed by worker
└────┬─────┘
     │
  ┌──┴──┐
  │     │
  ▼     ▼
┌────┐ ┌────┐
│Done│ │Fail│
└────┘ └──┬─┘
          │
     ┌────┴────┐
     │         │
     ▼         ▼
  ┌─────┐  ┌──────┐
  │Retry│  │Failed│
  └─────┘  └──────┘
```

### Checking Job State

```javascript
const job = await rawAlertsQueue.add(data);

// Get job state
const state = await job.getState();
// Returns: 'waiting', 'active', 'completed', 'failed', 'delayed'

// Get job progress
const progress = await job.progress();

// Check if completed
const isCompleted = await job.isCompleted();

// Check if failed
const isFailed = await job.isFailed();
```

---

## 📊 Monitoring & Metrics

### Queue Metrics

```javascript
// Get queue counts
const waiting = await rawAlertsQueue.getWaitingCount();
const active = await rawAlertsQueue.getActiveCount();
const completed = await rawAlertsQueue.getCompletedCount();
const failed = await rawAlertsQueue.getFailedCount();

console.log({
  waiting,
  active,
  completed,
  failed,
});
```

### Get Jobs

```javascript
// Get waiting jobs
const waitingJobs = await rawAlertsQueue.getWaiting();

// Get active jobs
const activeJobs = await rawAlertsQueue.getActive();

// Get completed jobs
const completedJobs = await rawAlertsQueue.getCompleted();

// Get failed jobs
const failedJobs = await rawAlertsQueue.getFailed();
```

---

## 🔒 Graceful Shutdown

**File:** `src/queue/redisQueue.js`

```javascript
process.on('SIGTERM', async () => {
  console.log('Gracefully shutting down queues...');
  
  await rawAlertsQueue.close();
  await successQueue.close();
  await retryQueue.close();
  await errorQueue.close();
  
  console.log('All queues closed');
});
```

This ensures:
- Workers finish current jobs
- No new jobs are accepted
- Redis connections are closed properly
- No data loss

---

## 🐛 Debugging Redis Issues

### Common Commands

```bash
# Check Redis is running
docker exec -it redis redis-cli ping

# Monitor Redis commands in real-time
docker exec -it redis redis-cli MONITOR

# Check memory usage
docker exec -it redis redis-cli INFO memory

# Check queue lengths
docker exec -it redis redis-cli LLEN bull:raw-alerts:wait

# Clear a specific queue (CAREFUL!)
docker exec -it redis redis-cli DEL bull:error-alerts:wait
```

### Logs to Check

```bash
# Alert Ingestion Service logs
docker logs -f alert-ingestion

# Redis logs
docker logs -f redis

# Look for these patterns:
# [rawAlertsQueue] Job X completed
# [AlertProcessor] Processing raw alert
# [AlertProcessor] Alert verified
# [successQueue] Job X completed
```

---

## 🎯 Summary

### Redis Integration Points

1. **Docker Service** - Redis container running on port 6379
2. **Bull Library** - Manages queues and jobs
3. **Queue Manager** - Creates and configures 4 queues
4. **Alert Processor** - Processes jobs from queues
5. **Event Listeners** - Monitors queue events
6. **Graceful Shutdown** - Handles termination properly

### Data Flow Through Redis

```
Webhook → rawAlertsQueue (Redis)
          ↓
    Queue Worker pulls job
          ↓
    Verify & Normalize
          ↓
    ┌─────┴─────┐
    ↓           ↓
successQueue  retryQueue (Redis)
(Redis)         ↓
              errorQueue (Redis)
```

### Benefits of Redis Integration

✅ **Asynchronous Processing** - Non-blocking alert handling  
✅ **Reliability** - Jobs persisted to disk  
✅ **Retry Logic** - Automatic retries with backoff  
✅ **Scalability** - Multiple workers can process queues  
✅ **Monitoring** - Queue metrics and job states  
✅ **Error Handling** - Failed jobs tracked in error queue  
✅ **Persistence** - Data survives service restarts  

---

**For more information:**
- Bull Documentation: https://github.com/OptimalBits/bull
- Redis Documentation: https://redis.io/documentation
- See `IMPLEMENTATION.md` for complete technical details

