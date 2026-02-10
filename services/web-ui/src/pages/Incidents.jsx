// src/pages/Incidents.jsx
import { useState, useEffect } from 'react';
import { FONT, TEXT_PRIMARY, TEXT_MUTED, IncidentTable } from '../components/shared';
import { getIncidentDetails, formatIncidentForUI } from '../services/metricsApi';

export const IncidentsPage = () => {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function fetchIncidents() {
      try {
        const res = await getIncidentDetails();
        if (res.status === 'success') {
          setIncidents(res.data.map(formatIncidentForUI));
        }
      } catch (err) {
        console.error('Failed to fetch incidents:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchIncidents();
  }, []);

  const filteredIncidents = filter === 'all' 
    ? incidents 
    : incidents.filter(i => i.status.toLowerCase() === filter);

  const filterButtons = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'acknowledged', label: 'Acknowledged' },
    { key: 'resolved', label: 'Resolved' }
  ];

  return (
    <div style={{ padding: '1.75rem 1.5rem', maxWidth: '680px', margin: '0 auto' }}>
      <h1 style={{
        fontSize: '2rem',
        fontWeight: '800',
        color: TEXT_PRIMARY,
        fontFamily: FONT,
        marginBottom: '1rem',
        letterSpacing: '-0.01em',
      }}>
        INCIDENTS
      </h1>

      {/* Filter Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {filterButtons.map(btn => (
          <button
            key={btn.key}
            onClick={() => setFilter(btn.key)}
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.72rem',
              fontFamily: FONT,
              backgroundColor: filter === btn.key ? '#ffffff' : 'transparent',
              color: filter === btn.key ? '#1c1c1c' : TEXT_MUTED,
              border: `1px solid ${filter === btn.key ? '#ffffff' : '#3a3a3a'}`,
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: TEXT_MUTED, textAlign: 'center', padding: '2rem' }}>
          Loading incidents...
        </div>
      ) : (
        <>
          <div style={{ 
            fontSize: '0.7rem', 
            color: TEXT_MUTED, 
            marginBottom: '0.5rem',
            letterSpacing: '0.08em'
          }}>
            {filteredIncidents.length} INCIDENT{filteredIncidents.length !== 1 ? 'S' : ''}
          </div>
          <IncidentTable incidents={filteredIncidents} showSeeMore={false} />
        </>
      )}
    </div>
  );
};