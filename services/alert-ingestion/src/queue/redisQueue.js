const Redis = require('ioredis');
const config = require('../config');

/**
 * Redis Queue Manager (Simple Lists)
 *
 * Uses simple Redis lists with LPUSH/BRPOP for queue operations.
 * This is compatible with incident-management service which uses BRPOP.
 *
 * Queue names:
 * - rawAlertsQueue: Stores unverified alerts from Prometheus
 * - successQueue: Stores successfully normalized alerts (consumed by incident-management)
 * - retryQueue: Stores alerts that failed normalization (to be retried)
 * - errorQueue: Stores alerts that exceeded max retries
 */

// Create Redis client
const redis = new Redis(config.redisUrl);

// Queue names as simple strings
const QUEUE_NAMES = {
  raw: 'rawAlertsQueue',
  success: 'successQueue',      // Must match incident-management config
  retry: 'retryQueue',
  error: 'errorQueue',
};

// Stats tracking
let stats = {
  raw: { added: 0, processed: 0 },
  success: { added: 0 },
  retry: { added: 0 },
  error: { added: 0 },
};

/**
 * Simple queue wrapper that mimics Bull-like interface
 */
class SimpleQueue {
  constructor(name, redisClient) {
    this.name = name;
    this.redis = redisClient;
    this.processor = null;
    this.isProcessing = false;
  }

  async add(data) {
    const job = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      data,
      timestamp: new Date().toISOString(),
    };
    await this.redis.lpush(this.name, JSON.stringify(job));
    console.log(`[${this.name}] Job ${job.id} added`);
    return job;
  }

  process(handler) {
    this.processor = handler;
    this._startProcessing();
  }

  async _startProcessing() {
    if (this.isProcessing || !this.processor) return;
    this.isProcessing = true;

    console.log(`[${this.name}] Started processing...`);

    while (this.isProcessing) {
      try {
        const result = await this.redis.brpop(this.name, 5);
        if (result) {
          const [, message] = result;
          const job = JSON.parse(message);
          try {
            await this.processor(job);
            console.log(`[${this.name}] Job ${job.id} completed`);
          } catch (err) {
            console.error(`[${this.name}] Job ${job.id} failed:`, err.message);
          }
        }
      } catch (err) {
        console.error(`[${this.name}] Processing error:`, err.message);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  async close() {
    this.isProcessing = false;
  }
}

// Create queue instances
const rawAlertsQueue = new SimpleQueue(QUEUE_NAMES.raw, redis);
const successQueue = new SimpleQueue(QUEUE_NAMES.success, redis);
const retryQueue = new SimpleQueue(QUEUE_NAMES.retry, redis);
const errorQueue = new SimpleQueue(QUEUE_NAMES.error, redis);

// Graceful shutdown
process.on('SIGTERM', async () => {
  await rawAlertsQueue.close();
  await successQueue.close();
  await retryQueue.close();
  await errorQueue.close();
  await redis.quit();
});

module.exports = {
  redis,
  rawAlertsQueue,
  successQueue,
  retryQueue,
  errorQueue,
  QUEUE_NAMES,
};

