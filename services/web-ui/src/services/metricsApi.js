// Service-Metrics API Client
// Connects to service-metrics on port 8005

const SERVICE_METRICS_URL = process.env.REACT_APP_METRICS_URL || 'http://localhost:8005';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8005';

/**
 * Fetch incidents grouped by service
 */
export async function getIncidentsByService() {
  const response = await fetch(`${SERVICE_METRICS_URL}/api/metrics/incidents/by-service`);
  if (!response.ok) throw new Error('Failed to fetch incidents by service');
  return response.json();
}

/**
 * Fetch incident details with MTTA/MTTR
 */
export async function getIncidentDetails() {
  const response = await fetch(`${SERVICE_METRICS_URL}/api/metrics/incidents/details`);
  if (!response.ok) throw new Error('Failed to fetch incident details');
  return response.json();
}

/**
 * Check service health
 */
export async function getHealth() {
  const response = await fetch(`${SERVICE_METRICS_URL}/health`);
  if (!response.ok) throw new Error('Service unhealthy');
  return response.json();
}

/**
 * Create WebSocket connection for real-time metrics
 * @param {Function} onMessage - Callback for incoming messages
 * @param {Function} onError - Callback for errors
 * @returns {WebSocket} - WebSocket instance
 */
export function createMetricsWebSocket(onMessage, onError) {
  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('[WebSocket] Connected to service-metrics');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (err) {
      console.error('[WebSocket] Parse error:', err);
    }
  };

  ws.onerror = (error) => {
    console.error('[WebSocket] Error:', error);
    if (onError) onError(error);
  };

  ws.onclose = () => {
    console.log('[WebSocket] Disconnected');
  };

  return ws;
}

/**
 * Calculate average MTTA from incidents
 */
export function calculateAverageMTTA(incidents) {
  const withMTTA = incidents.filter(i => i.mtta_seconds != null);
  if (withMTTA.length === 0) return null;
  const avg = withMTTA.reduce((sum, i) => sum + parseFloat(i.mtta_seconds), 0) / withMTTA.length;
  return Math.round(avg / 60); // Return in minutes
}

/**
 * Calculate average MTTR from incidents
 */
export function calculateAverageMTTR(incidents) {
  const withMTTR = incidents.filter(i => i.mttr_seconds != null);
  if (withMTTR.length === 0) return null;
  const avg = withMTTR.reduce((sum, i) => sum + parseFloat(i.mttr_seconds), 0) / withMTTR.length;
  return Math.round(avg / 60); // Return in minutes
}

/**
 * Map severity to display format
 */
export function mapSeverity(severity) {
  const map = {
    critical: 'P1',
    high: 'P2',
    medium: 'P3',
    low: 'P4',
    warning: 'P3'
  };
  return map[severity?.toLowerCase()] || severity?.toUpperCase() || 'P3';
}

/**
 * Format incident for UI display
 */
export function formatIncidentForUI(incident) {
  return {
    id: incident.id,
    title: incident.title,
    severity: mapSeverity(incident.severity),
    assignedTo: incident.assigned_to || 'Unassigned',
    status: formatStatus(incident.status),
    source: incident.source,
    createdAt: incident.created_at,
    mttaSeconds: incident.mtta_seconds,
    mttrSeconds: incident.mttr_seconds
  };
}

/**
 * Format status for display
 */
function formatStatus(status) {
  const map = {
    open: 'Open',
    acknowledged: 'Acknowledged',
    resolved: 'Resolved',
    closed: 'Closed'
  };
  return map[status?.toLowerCase()] || status || 'Unknown';
}
