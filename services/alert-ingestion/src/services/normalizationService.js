const { v4: uuidv4 } = require('uuid');
const { normalizeSeverity, extractServiceName } = require('./verificationService');

/**
 * Normalization Service
 *
 * Normalizes raw Prometheus alerts into a standardized format:
 * {
 *   "service": "api-server-03",
 *   "severity": "high",
 *   "message": "Memory usage above 85% for 5 minutes",
 *   "timestamp": "2026-02-09T14:30:00Z",
 *   "labels": {
 *     "alertname": "HighMemoryUsage",
 *     "environment": "production",
 *     "team": "platform"
 *   },
 *   "source": "prometheus"
 * }
 */

/**
 * Normalize a verified Prometheus alert to standard format
 * @param {Object} rawAlert - Raw alert from Prometheus
 * @returns {Object} - Normalized alert
 * @throws {Error} - If normalization fails
 */
function normalizeAlert(rawAlert) {
  try {
    // Extract service name from labels
    const service = extractServiceName(rawAlert.labels);

    // Normalize severity
    const severity = normalizeSeverity(rawAlert.labels.severity || rawAlert.labels.priority);
    if (!severity) {
      throw new Error(`Cannot normalize severity: ${rawAlert.labels.severity || rawAlert.labels.priority}`);
    }

    // Extract message from annotations
    const message = rawAlert.annotations.summary ||
                   rawAlert.annotations.message ||
                   rawAlert.annotations.description ||
                   `Alert: ${rawAlert.labels.alertname}`;

    // Get timestamp
    const timestamp = rawAlert.startsAt || rawAlert.timestamp || new Date().toISOString();

    // Build normalized alert
    const normalizedAlert = {
      id: uuidv4(), // Add unique ID
      service,
      severity,
      message,
      timestamp,
      labels: {
        alertname: rawAlert.labels.alertname,
        ...rawAlert.labels,
      },
      source: 'prometheus',
      // Preserve original data for debugging
      _raw: {
        fingerprint: rawAlert.fingerprint,
        generatorURL: rawAlert.generatorURL,
        annotations: rawAlert.annotations,
      },
    };

    return normalizedAlert;
  } catch (err) {
    throw new Error(`Normalization failed: ${err.message}`);
  }
}

/**
 * Batch normalize multiple alerts
 * @param {Array} alerts - Array of raw alerts
 * @returns {Object} - { successful: Array, failed: Array }
 */
function batchNormalizeAlerts(alerts) {
  const successful = [];
  const failed = [];

  for (const alert of alerts) {
    try {
      const normalized = normalizeAlert(alert);
      successful.push(normalized);
    } catch (err) {
      failed.push({
        alert,
        error: err.message,
      });
    }
  }

  return { successful, failed };
}

/**
 * Validate normalized alert structure
 * @param {Object} alert - Normalized alert
 * @returns {boolean} - True if valid
 */
function isValidNormalizedAlert(alert) {
  return (
    alert &&
    typeof alert === 'object' &&
    alert.service &&
    alert.severity &&
    alert.message &&
    alert.timestamp &&
    alert.labels &&
    typeof alert.labels === 'object' &&
    alert.labels.alertname &&
    alert.source === 'prometheus'
  );
}

module.exports = {
  normalizeAlert,
  batchNormalizeAlerts,
  isValidNormalizedAlert,
};

