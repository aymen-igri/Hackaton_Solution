// src/pages/Home.jsx
import { useState, useEffect } from 'react';
import { 
  FONT, 
  TEXT_PRIMARY, 
  TEXT_MUTED,
  CARD_BG,
  BORDER,
  StatCard, 
  IncidentTable, 
  MiniBarChart, 
  MiniLineChart 
} from '../components/shared';
import {
  getIncidentDetails,
  getIncidentsByService,
  createMetricsWebSocket,
  calculateAverageMTTA,
  calculateAverageMTTR,
  formatIncidentForUI
} from '../services/metricsApi';

export const HomePage = ({ onSeeMore }) => {
  const [incidents, setIncidents] = useState([]);
  const [incidentsByService, setIncidentsByService] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [detailsRes, byServiceRes] = await Promise.all([
          getIncidentDetails(),
          getIncidentsByService()
        ]);

        if (detailsRes.status === 'success') {
          setIncidents(detailsRes.data.map(formatIncidentForUI));
        }
        if (byServiceRes.status === 'success') {
          setIncidentsByService(byServiceRes.data);
        }
        setError(null);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = createMetricsWebSocket(
      (message) => {
        if (message.type === 'connection') {
          setWsConnected(true);
        }
        if (message.type === 'instant_metrics') {
          setLastUpdate(new Date(message.timestamp));
        }
      },
      () => setWsConnected(false)
    );

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Calculate stats
  const openIncidents = incidents.filter(i => i.status === 'Open').length;
  const avgMTTA = calculateAverageMTTA(incidents.map(i => ({ mtta_seconds: i.mttaSeconds })));
  const avgMTTR = calculateAverageMTTR(incidents.map(i => ({ mttr_seconds: i.mttrSeconds })));

  // Prepare chart data from incidents by service
  const serviceChartData = incidentsByService.slice(0, 7).map(s => ({
    label: s.service?.substring(0, 8) || 'Unknown',
    value: parseInt(s.total_incidents) || 0
  }));

  // Prepare MTTA trend
  const mttaChartData = incidents
    .filter(i => i.mttaSeconds != null)
    .slice(0, 6)
    .map((i, idx) => ({
      label: `Inc${idx + 1}`,
      value: Math.round(parseFloat(i.mttaSeconds) / 60)
    }));

  if (loading && incidents.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: TEXT_MUTED }}>
        Loading metrics from service-metrics...
      </div>
    );
  }

  return (
    <div style={{ padding: '1.75rem 1.5rem', maxWidth: '680px', margin: '0 auto' }}>
      {/* Connection Status */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.5rem', 
        marginBottom: '0.75rem',
        fontSize: '0.7rem',
        color: TEXT_MUTED
      }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: wsConnected ? '#22c55e' : '#ef4444'
        }} />
        {wsConnected ? 'Live' : 'Connecting...'}
        {lastUpdate && (
          <span style={{ marginLeft: 'auto' }}>
            Last update: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>

      <h1 style={{
        fontSize: 'clamp(2rem, 8vw, 3.2rem)',
        fontWeight: '800',
        color: TEXT_PRIMARY,
        fontFamily: FONT,
        lineHeight: 1.1,
        marginBottom: '1.75rem',
        letterSpacing: '-0.01em',
      }}>
        INCIDENT<br />DASHBOARD
      </h1>

      {error && (
        <div style={{
          backgroundColor: '#7f1d1d',
          border: '1px solid #991b1b',
          borderRadius: '4px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.8rem',
          color: '#fecaca'
        }}>
          ⚠️ {error} - Showing cached data
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <StatCard label="Open Incidents" value={openIncidents.toString()} />
        <StatCard label="Avg MTTA (min)" value={avgMTTA?.toString() || '—'} />
        <StatCard label="Avg MTTR (min)" value={avgMTTR?.toString() || '—'} />
      </div>

      {/* Recent Incidents Table */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ 
          fontSize: '0.7rem', 
          color: TEXT_MUTED, 
          marginBottom: '0.5rem',
          letterSpacing: '0.08em'
        }}>
          RECENT INCIDENTS ({incidents.length} total)
        </div>
        <IncidentTable 
          incidents={incidents.slice(0, 5)} 
          onSeeMore={onSeeMore} 
        />
      </div>

      {/* Charts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {serviceChartData.length > 0 && (
          <MiniBarChart 
            title="INCIDENTS BY SERVICE" 
            data={serviceChartData} 
          />
        )}
        
        {mttaChartData.length > 0 && (
          <MiniLineChart 
            title="MTTA PER INCIDENT (MIN)" 
            data={mttaChartData} 
          />
        )}
      </div>

      {/* Service Status Summary */}
      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ 
          fontSize: '0.7rem', 
          color: TEXT_MUTED, 
          marginBottom: '0.75rem',
          letterSpacing: '0.08em'
        }}>
          SERVICE STATUS
        </div>
        <div style={{ 
          backgroundColor: CARD_BG, 
          border: `1px solid ${BORDER}`,
          borderRadius: '4px',
          padding: '1rem'
        }}>
          {incidentsByService.length === 0 ? (
            <div style={{ color: TEXT_MUTED, fontSize: '0.8rem', textAlign: 'center' }}>
              No service data available
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {incidentsByService.map((service, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '0.5rem 0',
                  borderBottom: idx < incidentsByService.length - 1 ? `1px solid ${BORDER}` : 'none'
                }}>
                  <span style={{ fontSize: '0.8rem', color: TEXT_PRIMARY, fontFamily: FONT }}>
                    {service.service}
                  </span>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.7rem' }}>
                    <span style={{ color: '#ef4444' }}>
                      {service.open_count} open
                    </span>
                    <span style={{ color: '#f59e0b' }}>
                      {service.ack_count} ack
                    </span>
                    <span style={{ color: '#22c55e' }}>
                      {service.resolved_count} resolved
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};