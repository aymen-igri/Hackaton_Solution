const { rawAlertsQueue, successQueue, retryQueue, errorQueue } = require('../queue/redisQueue');
const { verifyAlert } = require('./verificationService');
const { normalizeAlert, isValidNormalizedAlert } = require('./normalizationService');
const config = require('../config');

/**
 * Alert Processor Service
 *
 * Handles the complete alert processing pipeline:
 * 1. Pull alerts from raw queue
 * 2. Verify alerts
 * 3. Normalize verified alerts
 * 4. Route to success/retry/error queues based on result
 */

let processingStats = {
  processed: 0,
  verified: 0,
  normalized: 0,
  retried: 0,
  errors: 0,
};

/**
 * Initialize the alert processor
 * Sets up queue workers for processing alerts
 */
function initializeProcessor() {
  console.log('[AlertProcessor] Initializing alert processor...');

  // Process raw alerts
  rawAlertsQueue.process(async (job) => {
    const { alert, attemptCount = 0 } = job.data;
    processingStats.processed++;

    console.log(`[AlertProcessor] Processing raw alert: ${alert.labels?.alertname || 'unknown'}`);

    // Step 1: Verify the alert
    const verification = verifyAlert(alert);

    if (!verification.valid) {
      console.log(`[AlertProcessor] Alert verification failed: ${verification.reason}`);
      processingStats.errors++;

      // Move directly to error queue for invalid alerts
      await errorQueue.add({
        alert,
        reason: verification.reason,
        stage: 'verification',
        timestamp: new Date().toISOString(),
      });

      throw new Error(`Verification failed: ${verification.reason}`);
    }

    processingStats.verified++;
    console.log(`[AlertProcessor] Alert verified: ${verification.reason}`);

    // Step 2: Normalize the alert
    try {
      const normalizedAlert = normalizeAlert(alert);

      // Step 3: Validate normalized structure
      if (!isValidNormalizedAlert(normalizedAlert)) {
        throw new Error('Normalized alert structure is invalid');
      }

      processingStats.normalized++;
      console.log(`[AlertProcessor] Alert normalized successfully: ${normalizedAlert.id}`);

      // Step 4: Send to success queue
      await successQueue.add({
        alert: normalizedAlert,
        processedAt: new Date().toISOString(),
        attempts: attemptCount + 1,
      });

      return { success: true, alertId: normalizedAlert.id };
    } catch (normalizationError) {
      console.error(`[AlertProcessor] Normalization failed: ${normalizationError.message}`);

      // Step 5: Decide retry or error queue
      if (attemptCount < config.normalization.maxRetries) {
        console.log(`[AlertProcessor] Moving to retry queue (attempt ${attemptCount + 1}/${config.normalization.maxRetries})`);
        processingStats.retried++;

        await retryQueue.add({
          alert,
          attemptCount: attemptCount + 1,
          lastError: normalizationError.message,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log(`[AlertProcessor] Max retries exceeded, moving to error queue`);
        processingStats.errors++;

        await errorQueue.add({
          alert,
          reason: normalizationError.message,
          stage: 'normalization',
          attempts: attemptCount + 1,
          timestamp: new Date().toISOString(),
        });
      }

      throw normalizationError;
    }
  });

  // Process retry queue
  retryQueue.process(async (job) => {
    const { alert, attemptCount } = job.data;

    console.log(`[AlertProcessor] Retrying alert (attempt ${attemptCount}/${config.normalization.maxRetries})`);

    // Re-queue to raw alerts queue with updated attempt count
    await rawAlertsQueue.add({
      alert,
      attemptCount,
    });

    return { retried: true };
  });

  // Success queue processor (for forwarding to correlation service)
  successQueue.process(async (job) => {
    const { alert } = job.data;

    console.log(`[AlertProcessor] Successfully processed alert: ${alert.id} - ${alert.service}`);

    // Here you can forward to correlation service or database
    // This is a placeholder for future integration

    return { processed: true, alertId: alert.id };
  });

  console.log('[AlertProcessor] Alert processor initialized successfully');
}

/**
 * Add an alert to the processing pipeline
 * @param {Object} alert - Raw Prometheus alert
 * @returns {Promise<Object>} - Job info
 */
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

/**
 * Get processing statistics
 * @returns {Object} - Processing stats
 */
function getStats() {
  return {
    ...processingStats,
    queues: {
      raw: rawAlertsQueue.name,
      success: successQueue.name,
      retry: retryQueue.name,
      error: errorQueue.name,
    },
  };
}

/**
 * Reset statistics
 */
function resetStats() {
  processingStats = {
    processed: 0,
    verified: 0,
    normalized: 0,
    retried: 0,
    errors: 0,
  };
}

module.exports = {
  initializeProcessor,
  enqueueAlert,
  getStats,
  resetStats,
};

