const axios = require('axios');
const config = require('../config');
const db = require('../db/queries');
const { correlatedAlerts } = require('../metrics');

/**
 * correlationService – THE KEY LOGIC
 *
 * When a new alert arrives we:
 *   1. Look for recent open incidents with similar labels / source within a time window.
 *   2. If a match is found → attach the alert to that incident (correlation).
 *   3. Otherwise → create a brand-new incident via the incident-management service.
 */

async function correlate(alert) {
  // 1. Find candidate incidents in the correlation window
  const candidates = await db.findOpenIncidentsBySourceAndWindow(
    alert.source,
    config.correlation.timeWindowMs,
  );

  // 2. Score each candidate
  for (const candidate of candidates) {
    const score = computeSimilarity(alert, candidate);
    if (score >= config.correlation.similarityThreshold) {
      // Attach alert to existing incident
      await db.linkAlertToIncident(alert.id, candidate.id);
      correlatedAlerts.inc();
      console.log(`[correlation] Alert ${alert.id} correlated to incident ${candidate.id} (score=${score.toFixed(2)})`);
      return candidate;
    }
  }

  // 3. No match – ask incident-management to open a new incident
  try {
    const { data: incident } = await axios.post(`${config.incidentServiceUrl}/api/incidents`, {
      title: alert.title,
      severity: alert.severity,
      source: alert.source,
      description: alert.description,
      alert_id: alert.id,
    });
    console.log(`[correlation] New incident ${incident.id} created for alert ${alert.id}`);
    return incident;
  } catch (err) {
    console.error('[correlation] Failed to create incident:', err.message);
    throw err;
  }
}

/**
 * Simple similarity heuristic.
 * Compare source, severity, and label overlap.
 */
function computeSimilarity(alert, incident) {
  let score = 0;
  const weights = { source: 0.3, severity: 0.2, labels: 0.5 };

  if (alert.source === incident.source) score += weights.source;
  if (alert.severity === incident.severity) score += weights.severity;

  // Label overlap (Jaccard index)
  const alertLabels = new Set(Object.keys(alert.labels || {}));
  const incidentLabels = new Set(Object.keys(incident.labels || {}));
  const intersection = [...alertLabels].filter((l) => incidentLabels.has(l));
  const union = new Set([...alertLabels, ...incidentLabels]);
  if (union.size > 0) {
    score += weights.labels * (intersection.length / union.size);
  }

  return score;
}

module.exports = { correlate, computeSimilarity };
