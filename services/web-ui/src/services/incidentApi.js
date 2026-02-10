// Incident Management API Client
// Connects to incident-management service on port 8002

const INCIDENT_API_URL = process.env.REACT_APP_INCIDENT_URL || 'http://localhost:8002';

/**
 * Get incident info for acknowledge page (using ack_token)
 * @param {string} token - The ack_token from the magic link
 */
export async function getIncidentInfoByAckToken(token) {
  const response = await fetch(`${INCIDENT_API_URL}/api/incidents/info/ack/${token}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Invalid or expired token');
    }
    throw new Error('Failed to fetch incident info');
  }
  return response.json();
}

/**
 * Get incident info for resolve page (using resolve_token)
 * @param {string} token - The resolve_token from the magic link
 */
export async function getIncidentInfoByResolveToken(token) {
  const response = await fetch(`${INCIDENT_API_URL}/api/incidents/info/resolve/${token}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Invalid or expired token');
    }
    throw new Error('Failed to fetch incident info');
  }
  return response.json();
}

/**
 * Acknowledge an incident via magic link token
 * @param {string} token - The ack_token
 */
export async function acknowledgeIncident(token) {
  const response = await fetch(`${INCIDENT_API_URL}/api/incidents/ack/${token}`, {
    headers: {
      'Accept': 'application/json'
    }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || data.message || 'Failed to acknowledge incident');
  }
  return response.json();
}

/**
 * Resolve an incident via magic link token
 * @param {string} token - The resolve_token
 */
export async function resolveIncident(token) {
  const response = await fetch(`${INCIDENT_API_URL}/api/incidents/resolve/${token}`, {
    headers: {
      'Accept': 'application/json'
    }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || data.message || 'Failed to resolve incident');
  }
  return response.json();
}
