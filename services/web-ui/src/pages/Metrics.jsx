import React, { useEffect, useState } from 'react';
import axios from 'axios';

const INCIDENT_API = process.env.REACT_APP_INCIDENT_API || 'http://localhost:8002';

function Metrics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${INCIDENT_API}/api/incidents/metrics/sre`)
      .then((res) => setMetrics(res.data))
      .catch((err) => console.error('Failed to fetch SRE metrics:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading metrics…</p>;
  if (!metrics) return <p>Unable to load metrics.</p>;

  return (
    <div>
      <h2>📊 SRE Metrics</h2>

      <div className="metrics-grid">
        <div className="metric-card">
          <h3>MTTA</h3>
          <p className="metric-value">{metrics.mtta.human}</p>
          <p className="metric-label">Mean Time To Acknowledge</p>
          <p className="metric-sample">Sample size: {metrics.mtta.sample_size}</p>
        </div>

        <div className="metric-card">
          <h3>MTTR</h3>
          <p className="metric-value">{metrics.mttr.human}</p>
          <p className="metric-label">Mean Time To Resolve</p>
          <p className="metric-sample">Sample size: {metrics.mttr.sample_size}</p>
        </div>

        <div className="metric-card">
          <h3>Open Incidents</h3>
          <p className="metric-value">{metrics.open_incidents}</p>
          <p className="metric-label">Currently active</p>
        </div>
      </div>

      <p className="computed-at">Computed at: {new Date(metrics.computed_at).toLocaleString()}</p>
    </div>
  );
}

export default Metrics;
