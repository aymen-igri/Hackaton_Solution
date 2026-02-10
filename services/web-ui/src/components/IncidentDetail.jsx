import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const INCIDENT_API = process.env.REACT_APP_INCIDENT_API || 'http://localhost:8002';

function IncidentDetail() {
  const { id } = useParams();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${INCIDENT_API}/api/incidents/${id}`)
      .then((res) => setIncident(res.data))
      .catch((err) => console.error('Failed to fetch incident:', err))
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (newStatus) => {
    try {
      const { data } = await axios.patch(`${INCIDENT_API}/api/incidents/${id}`, { status: newStatus });
      setIncident(data);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  if (loading) return <p>Loading…</p>;
  if (!incident) return <p>Incident not found.</p>;

  return (
    <div>
      <h2>🔍 Incident: {incident.title}</h2>
      <dl>
        <dt>ID</dt><dd>{incident.id}</dd>
        <dt>Severity</dt><dd>{incident.severity}</dd>
        <dt>Status</dt><dd>{incident.status}</dd>
        <dt>Source</dt><dd>{incident.source}</dd>
        <dt>Created</dt><dd>{new Date(incident.created_at).toLocaleString()}</dd>
        {incident.acknowledged_at && <><dt>Acknowledged</dt><dd>{new Date(incident.acknowledged_at).toLocaleString()}</dd></>}
        {incident.resolved_at && <><dt>Resolved</dt><dd>{new Date(incident.resolved_at).toLocaleString()}</dd></>}
        <dt>Description</dt><dd>{incident.description || '—'}</dd>
      </dl>

      <div className="actions">
        {incident.status === 'open' && (
          <button onClick={() => updateStatus('acknowledged')}>✅ Acknowledge</button>
        )}
        {['open', 'acknowledged'].includes(incident.status) && (
          <button onClick={() => updateStatus('resolved')}>🔧 Resolve</button>
        )}
      </div>
    </div>
  );
}

export default IncidentDetail;
