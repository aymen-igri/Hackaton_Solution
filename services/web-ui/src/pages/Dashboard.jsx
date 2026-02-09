import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const INCIDENT_API = process.env.REACT_APP_INCIDENT_API || 'http://localhost:8002';

function Dashboard() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${INCIDENT_API}/api/incidents?limit=20`)
      .then((res) => setIncidents(res.data))
      .catch((err) => console.error('Failed to fetch incidents:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading incidents…</p>;

  return (
    <div>
      <h2>📋 Active Incidents</h2>
      {incidents.length === 0 ? (
        <p>No incidents found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((inc) => (
              <tr key={inc.id}>
                <td>{inc.title}</td>
                <td className={`severity-${inc.severity}`}>{inc.severity}</td>
                <td>{inc.status}</td>
                <td>{new Date(inc.created_at).toLocaleString()}</td>
                <td><Link to={`/incidents/${inc.id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default Dashboard;
