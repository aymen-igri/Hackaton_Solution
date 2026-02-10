const Queue = require('bull');
const config = require('../config');

/**
 * Redis Queue Manager
 *
 * Manages three separate queues for alert processing:
 * - rawAlertsQueue: Stores unverified alerts from Prometheus
 * - successQueue: Stores successfully normalized alerts
 * - retryQueue: Stores alerts that failed normalization (to be retried)
 * - errorQueue: Stores alerts that exceeded max retries
 */

// Create queue instances
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

// Queue event listeners for monitoring
rawAlertsQueue.on('completed', (job) => {
  console.log(`[rawAlertsQueue] Job ${job.id} completed`);
});

rawAlertsQueue.on('failed', (job, err) => {
  console.error(`[rawAlertsQueue] Job ${job.id} failed:`, err.message);
});

successQueue.on('completed', (job) => {
  console.log(`[successQueue] Job ${job.id} completed`);
});

retryQueue.on('failed', async (job, err) => {
  console.error(`[retryQueue] Job ${job.id} failed (attempt ${job.attemptsMade}):`, err.message);

  // If max retries exceeded, move to error queue
  if (job.attemptsMade >= config.normalization.maxRetries) {
    console.log(`[retryQueue] Moving job ${job.id} to error queue after ${job.attemptsMade} attempts`);
    await errorQueue.add(job.data, {
      jobId: `error-${job.id}`,
    });
  }
});

errorQueue.on('completed', (job) => {
  console.log(`[errorQueue] Job ${job.id} logged to error queue`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await rawAlertsQueue.close();
  await successQueue.close();
  await retryQueue.close();
  await errorQueue.close();
});

module.exports = {
  rawAlertsQueue,
  successQueue,
  retryQueue,
  errorQueue,
};

