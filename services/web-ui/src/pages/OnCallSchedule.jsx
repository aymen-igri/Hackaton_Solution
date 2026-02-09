import React, { useEffect, useState } from 'react';
import axios from 'axios';

const ONCALL_API = process.env.REACT_APP_ONCALL_API || 'http://localhost:8003';

function OnCallSchedule() {
  const [schedules, setSchedules] = useState([]);
  const [currentOnCall, setCurrentOnCall] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${ONCALL_API}/api/schedules`),
      axios.get(`${ONCALL_API}/api/oncall/current`),
    ])
      .then(([schedRes, oncallRes]) => {
        setSchedules(schedRes.data);
        setCurrentOnCall(oncallRes.data);
      })
      .catch((err) => console.error('Failed to fetch on-call data:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading on-call data…</p>;

  return (
    <div>
      <h2>📞 On-Call Schedule</h2>

      {currentOnCall && currentOnCall.on_call && (
        <div className="current-oncall">
          <h3>Currently On Call</h3>
          <p><strong>{currentOnCall.on_call}</strong> ({currentOnCall.schedule_name} – {currentOnCall.rotation_type})</p>
        </div>
      )}

      <h3>All Schedules</h3>
      {schedules.length === 0 ? (
        <p>No schedules configured.</p>
      ) : (
        <ul>
          {schedules.map((s) => (
            <li key={s.id}>
              <strong>{s.name}</strong> – {s.rotation_type} rotation
              ({(typeof s.members === 'string' ? JSON.parse(s.members) : s.members).length} members)
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default OnCallSchedule;
