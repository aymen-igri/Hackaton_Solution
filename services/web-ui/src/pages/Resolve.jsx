// Resolve Page - Handles magic link for resolving incidents
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getIncidentInfoByResolveToken, resolveIncident } from '../services/incidentApi';

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#1c1c1c',
    color: '#ffffff',
    fontFamily: '"Wix Madefor Display", sans-serif',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  card: {
    backgroundColor: '#242424',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
    textAlign: 'center',
  },
  icon: {
    fontSize: '64px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '10px',
  },
  subtitle: {
    color: '#888',
    fontSize: '14px',
    marginBottom: '30px',
  },
  incidentCard: {
    backgroundColor: '#1c1c1c',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'left',
    marginBottom: '30px',
  },
  incidentTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '15px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #333',
    fontSize: '14px',
  },
  label: {
    color: '#888',
  },
  value: {
    fontWeight: '500',
  },
  severityBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  button: {
    width: '100%',
    padding: '16px 32px',
    fontSize: '16px',
    fontWeight: '600',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  primaryButton: {
    backgroundColor: '#22c55e',
    color: '#ffffff',
  },
  disabledButton: {
    backgroundColor: '#444',
    color: '#888',
    cursor: 'not-allowed',
  },
  successButton: {
    backgroundColor: '#22c55e',
    color: '#ffffff',
  },
  message: {
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
  },
  errorMessage: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
  },
  successMessage: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
  },
  infoMessage: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#3b82f6',
  },
  warningMessage: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    color: '#eab308',
  },
  loader: {
    width: '40px',
    height: '40px',
    border: '3px solid #333',
    borderTop: '3px solid #fff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  backLink: {
    marginTop: '20px',
    color: '#888',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontSize: '14px',
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'space-around',
    marginTop: '20px',
    padding: '15px 0',
    borderTop: '1px solid #333',
  },
  stat: {
    textAlign: 'center',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#22c55e',
  },
  statLabel: {
    fontSize: '12px',
    color: '#888',
    marginTop: '5px',
  },
};

const getSeverityColor = (severity) => {
  switch (severity?.toLowerCase()) {
    case 'critical': return { bg: '#dc2626', color: '#fff' };
    case 'high': return { bg: '#f97316', color: '#fff' };
    case 'warning': return { bg: '#eab308', color: '#000' };
    case 'low': return { bg: '#22c55e', color: '#fff' };
    default: return { bg: '#6b7280', color: '#fff' };
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString();
};

const calculateDuration = (start, end) => {
  if (!start || !end) return null;
  const ms = new Date(end) - new Date(start);
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

export const ResolvePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [incident, setIncident] = useState(null);
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [resolutionTime, setResolutionTime] = useState(null);

  useEffect(() => {
    const fetchIncident = async () => {
      try {
        const data = await getIncidentInfoByResolveToken(token);
        setIncident(data.incident);
        setAction(data.action);
        setMessage(data.message);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchIncident();
    }
  }, [token]);

  const handleResolve = async () => {
    setProcessing(true);
    try {
      const result = await resolveIncident(token);
      setSuccess(true);
      const updatedIncident = result.incident || { ...incident, status: 'resolved', resolved_at: new Date().toISOString() };
      setIncident(updatedIncident);
      setMessage(result.message || 'Incident resolved successfully!');
      setAction(null);
      
      // Calculate resolution time
      if (incident?.created_at) {
        setResolutionTime(calculateDuration(incident.created_at, updatedIncident.resolved_at || new Date()));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{
            ...styles.loader,
            margin: '0 auto',
          }} />
          <p style={{ marginTop: '20px', color: '#888' }}>Loading incident...</p>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error && !incident) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.icon}>❌</div>
          <h1 style={styles.title}>Invalid Link</h1>
          <p style={{ ...styles.message, ...styles.errorMessage }}>
            {error}
          </p>
          <p style={{ color: '#888', fontSize: '14px' }}>
            This link may have expired or been replaced by a newer one.
          </p>
          <div 
            style={styles.backLink}
            onClick={() => navigate('/')}
          >
            ← Go to Dashboard
          </div>
        </div>
      </div>
    );
  }

  const severityStyle = getSeverityColor(incident?.severity);
  const mtta = incident?.acknowledged_at && incident?.created_at 
    ? calculateDuration(incident.created_at, incident.acknowledged_at)
    : null;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>
          {success ? '🎉' : incident?.status === 'resolved' ? '✅' : '🔧'}
        </div>
        <h1 style={styles.title}>
          {success ? 'Resolved!' : incident?.status === 'acknowledged' ? 'Resolve Incident' : `Incident ${incident?.status}`}
        </h1>
        <p style={styles.subtitle}>{message}</p>

        {error && (
          <div style={{ ...styles.message, ...styles.errorMessage }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ ...styles.message, ...styles.successMessage }}>
            🎉 Great work! The incident has been resolved.
          </div>
        )}

        <div style={styles.incidentCard}>
          <div style={styles.incidentTitle}>
            <span style={{
              ...styles.severityBadge,
              backgroundColor: severityStyle.bg,
              color: severityStyle.color,
            }}>
              {incident?.severity}
            </span>
            {incident?.title}
          </div>

          <div style={styles.infoRow}>
            <span style={styles.label}>Source</span>
            <span style={styles.value}>{incident?.source}</span>
          </div>

          <div style={styles.infoRow}>
            <span style={styles.label}>Status</span>
            <span style={{
              ...styles.value,
              color: success || incident?.status === 'resolved' ? '#22c55e' : '#fff'
            }}>
              {success ? 'resolved' : incident?.status}
            </span>
          </div>

          <div style={styles.infoRow}>
            <span style={styles.label}>Created</span>
            <span style={styles.value}>{formatDate(incident?.created_at)}</span>
          </div>

          {incident?.acknowledged_at && (
            <div style={styles.infoRow}>
              <span style={styles.label}>Acknowledged</span>
              <span style={styles.value}>{formatDate(incident.acknowledged_at)}</span>
            </div>
          )}

          {(success || incident?.status === 'resolved') && incident?.resolved_at && (
            <div style={styles.infoRow}>
              <span style={styles.label}>Resolved</span>
              <span style={styles.value}>{formatDate(incident.resolved_at)}</span>
            </div>
          )}

          {incident?.assigned_to && (
            <div style={styles.infoRow}>
              <span style={styles.label}>Assigned To</span>
              <span style={styles.value}>{incident.assigned_to}</span>
            </div>
          )}

          {incident?.description && (
            <div style={{ ...styles.infoRow, flexDirection: 'column', gap: '5px', borderBottom: 'none' }}>
              <span style={styles.label}>Description</span>
              <span style={styles.value}>{incident.description}</span>
            </div>
          )}

          {/* Show metrics after resolution */}
          {(success || incident?.status === 'resolved') && (mtta || resolutionTime) && (
            <div style={styles.statsRow}>
              {mtta && (
                <div style={styles.stat}>
                  <div style={styles.statValue}>{mtta}</div>
                  <div style={styles.statLabel}>Time to Acknowledge</div>
                </div>
              )}
              {(resolutionTime || incident?.resolved_at) && (
                <div style={styles.stat}>
                  <div style={styles.statValue}>
                    {resolutionTime || calculateDuration(incident.created_at, incident.resolved_at)}
                  </div>
                  <div style={styles.statLabel}>Time to Resolve</div>
                </div>
              )}
            </div>
          )}
        </div>

        {action === 'resolve' && !success && (
          <button
            style={{
              ...styles.button,
              ...(processing ? styles.disabledButton : styles.primaryButton),
            }}
            onClick={handleResolve}
            disabled={processing}
          >
            {processing ? 'Processing...' : '✓ MARK AS RESOLVED'}
          </button>
        )}

        {success && (
          <button
            style={{ ...styles.button, ...styles.successButton }}
            disabled
          >
            ✓ RESOLVED
          </button>
        )}

        {!action && !success && incident?.status === 'open' && (
          <div style={{ ...styles.message, ...styles.warningMessage }}>
            ⚠️ This incident must be acknowledged first before it can be resolved.
          </div>
        )}

        {!action && !success && incident?.status === 'resolved' && (
          <div style={{ ...styles.message, ...styles.infoMessage }}>
            This incident was already resolved on {formatDate(incident.resolved_at)}
          </div>
        )}

        <div 
          style={styles.backLink}
          onClick={() => navigate('/')}
        >
          ← Go to Dashboard
        </div>
      </div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ResolvePage;
