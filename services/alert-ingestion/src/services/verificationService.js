/**
 * Alert Verification Service
 *
 * Verifies incoming alerts from Prometheus to ensure they are valid alerts
 * and not just metric updates or resolved notifications.
 *
 * Verification Criteria:
 * 1. Must have 'status' field set to 'firing' (not 'resolved')
 * 2. Must have required fields: alertname, severity (or priority)
 * 3. Must have valid timestamp
 * 4. Must have labels object
 * 5. Severity must be one of: critical, high, warning, info
 * 6. Alert must have annotations with summary or message
 */

const VALID_SEVERITIES = ['critical', 'high', 'warning', 'info'];
const SEVERITY_MAPPING = {
  'critical': 'critical',
  'high': 'high',
  'warning': 'warning',
  'info': 'info',
  'page': 'critical',
  'urgent': 'high',
  'low': 'info',
};

/**
 * Verify if the incoming data is a valid Prometheus alert
 * @param {Object} alert - The alert object from Prometheus webhook
 * @returns {Object} - { valid: boolean, reason: string }
 */
function verifyAlert(alert) {
  // Check 1: Must have status field
  if (!alert.status) {
    return { valid: false, reason: 'Missing status field' };
  }

  // Check 2: Status must be 'firing' (we ignore resolved alerts)
  if (alert.status !== 'firing') {
    return { valid: false, reason: `Alert status is '${alert.status}', not 'firing'` };
  }

  // Check 3: Must have labels
  if (!alert.labels || typeof alert.labels !== 'object') {
    return { valid: false, reason: 'Missing or invalid labels object' };
  }

  // Check 4: Must have alertname in labels
  if (!alert.labels.alertname) {
    return { valid: false, reason: 'Missing alertname in labels' };
  }

  // Check 5: Must have severity or priority
  const severity = alert.labels.severity || alert.labels.priority;
  if (!severity) {
    return { valid: false, reason: 'Missing severity/priority in labels' };
  }

  // Check 6: Severity must be valid
  const normalizedSeverity = normalizeSeverity(severity);
  if (!normalizedSeverity) {
    return { valid: false, reason: `Invalid severity '${severity}'` };
  }

  // Check 7: Must have valid timestamp
  if (!alert.startsAt && !alert.timestamp) {
    return { valid: false, reason: 'Missing timestamp (startsAt or timestamp)' };
  }

  const timestamp = alert.startsAt || alert.timestamp;
  if (!isValidTimestamp(timestamp)) {
    return { valid: false, reason: `Invalid timestamp format: ${timestamp}` };
  }

  // Check 8: Must have annotations with message or summary
  if (!alert.annotations || typeof alert.annotations !== 'object') {
    return { valid: false, reason: 'Missing annotations object' };
  }

  if (!alert.annotations.summary && !alert.annotations.message && !alert.annotations.description) {
    return { valid: false, reason: 'Missing message in annotations (summary/message/description)' };
  }

  // All checks passed
  return { valid: true, reason: 'Alert verified successfully' };
}

/**
 * Normalize severity to standard values
 * @param {string} severity - Raw severity value
 * @returns {string|null} - Normalized severity or null if invalid
 */
function normalizeSeverity(severity) {
  const lower = severity.toLowerCase();
  return SEVERITY_MAPPING[lower] || (VALID_SEVERITIES.includes(lower) ? lower : null);
}

/**
 * Validate timestamp format
 * @param {string} timestamp - ISO timestamp string
 * @returns {boolean} - True if valid
 */
function isValidTimestamp(timestamp) {
  try {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  } catch (err) {
    return false;
  }
}

/**
 * Extract service name from labels
 * Priority: instance > service > job > alertname
 * @param {Object} labels - Alert labels
 * @returns {string} - Service name
 */
function extractServiceName(labels) {
  return labels.instance ||
         labels.service ||
         labels.job ||
         labels.alertname ||
         'unknown-service';
}

module.exports = {
  verifyAlert,
  normalizeSeverity,
  extractServiceName,
  VALID_SEVERITIES,
};

