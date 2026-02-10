// Acknowledge Page - Handles magic link for acknowledging incidents
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getIncidentInfoByAckToken, acknowledgeIncident } from '../services/incidentApi';

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
    backgroundColor: '#ffffff',
    color: '#000000',
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

export const AcknowledgePage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [incident, setIncident] = useState(null);
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchIncident = async () => {
      try {
        const data = await getIncidentInfoByAckToken(token);
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

  const handleAcknowledge = async () => {
    setProcessing(true);
    try {
      const result = await acknowledgeIncident(token);
      setSuccess(true);
      setIncident(prev => ({ ...prev, status: 'acknowledged' }));
      setMessage(result.message || 'Incident acknowledged successfully! Check your email for the resolve link.');
      setAction(null);
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

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>
          {success ? '✅' : incident?.status === 'acknowledged' ? '📋' : '🔔'}
        </div>
        <h1 style={styles.title}>
          {success ? 'Acknowledged!' : incident?.status === 'open' ? 'Acknowledge Incident' : `Incident ${incident?.status}`}
        </h1>
        <p style={styles.subtitle}>{message}</p>

        {error && (
          <div style={{ ...styles.message, ...styles.errorMessage }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ ...styles.message, ...styles.successMessage }}>
            ✓ Check your email for the RESOLVE link
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
            <span style={styles.value}>{incident?.status}</span>
          </div>

          <div style={styles.infoRow}>
            <span style={styles.label}>Created</span>
            <span style={styles.value}>{formatDate(incident?.created_at)}</span>
          </div>

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
        </div>

        {action === 'acknowledge' && !success && (
          <button
            style={{
              ...styles.button,
              ...(processing ? styles.disabledButton : styles.primaryButton),
            }}
            onClick={handleAcknowledge}
            disabled={processing}
          >
            {processing ? 'Processing...' : '✓ ACKNOWLEDGE INCIDENT'}
          </button>
        )}

        {success && (
          <button
            style={{ ...styles.button, ...styles.successButton }}
            disabled
          >
            ✓ ACKNOWLEDGED
          </button>
        )}

        {!action && !success && incident?.status !== 'open' && (
          <div style={{ ...styles.message, ...styles.infoMessage }}>
            {incident?.status === 'acknowledged' 
              ? 'Use the resolve link from your email to mark this resolved'
              : `This incident is already ${incident?.status}`}
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

export default AcknowledgePage;
