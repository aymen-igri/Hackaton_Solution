// ─── Shared Design Tokens ─────────────────────────────────────────────────────
export const BG           = '#1c1c1c';
export const CARD_BG      = '#2a2a2a';
export const BORDER       = '#3a3a3a';
export const TEXT_PRIMARY = '#ffffff';
export const TEXT_MUTED   = '#888888';
export const FONT         = '"Wix Madefor Display", sans-serif';

// ─── Mock Data ────────────────────────────────────────────────────────────────
export const mockIncidents = [
  { id: 1, title: 'Database connection timeout',      severity: 'P1', assignedTo: 'Alice Chen',  status: 'Open'         },
  { id: 2, title: 'API latency spike on /checkout',   severity: 'P2', assignedTo: 'Bob Kim',     status: 'In Progress'  },
  { id: 3, title: 'Memory leak in worker service',    severity: 'P3', assignedTo: 'Carol Davis', status: 'Open'         },
  { id: 4, title: 'SSL certificate expiring soon',    severity: 'P2', assignedTo: 'Dan Lee',     status: 'Acknowledged' },
  { id: 5, title: 'Disk usage at 90% on prod-db-01',  severity: 'P1', assignedTo: 'Alice Chen',  status: 'Open'         },
];

export const mockSchedule = [
  { id: 1, name: 'Alice Chen',  role: 'Primary On-Call',   start: 'Mon 00:00', end: 'Wed 00:00' },
  { id: 2, name: 'Bob Kim',     role: 'Secondary On-Call', start: 'Mon 00:00', end: 'Wed 00:00' },
  { id: 3, name: 'Carol Davis', role: 'Primary On-Call',   start: 'Wed 00:00', end: 'Fri 00:00' },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────
export const StatCard = ({ label, value }) => (
  <div style={{
    backgroundColor: CARD_BG,
    border: `1px solid ${BORDER}`,
    borderRadius: '4px',
    padding: '1rem 1.25rem',
    flex: 1,
    minWidth: '130px',
  }}>
    <div style={{ fontSize: '0.72rem', color: TEXT_MUTED, marginBottom: '0.6rem', lineHeight: 1.4, fontFamily: FONT, letterSpacing: '0.04em', textAlign: 'center' }}>
      {label}
    </div>
    <div style={{ fontSize: '1.6rem', fontWeight: '700', color: TEXT_PRIMARY, fontFamily: FONT, textAlign: 'center' }}>
      {value}
    </div>
  </div>
);

// ─── Incidents Table ──────────────────────────────────────────────────────────
export const IncidentTable = ({ incidents, showSeeMore = true, onSeeMore }) => (
  <div>
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr', padding: '0.4rem 0.75rem', gap: '0.5rem' }}>
      {['TITLE', 'SEVERITY', 'ASSIGNED TO', 'STATUS'].map(h => (
        <span key={h} style={{ fontSize: '0.65rem', color: TEXT_MUTED, fontFamily: FONT, letterSpacing: '0.08em', fontWeight: '600' }}>
          {h}
        </span>
      ))}
    </div>
    {incidents.map(inc => (
      <div key={inc.id} style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1.5fr 1fr',
        backgroundColor: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: '3px',
        padding: '0.7rem 0.75rem',
        marginBottom: '0.35rem',
        gap: '0.5rem',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '0.78rem', color: TEXT_PRIMARY, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.title}</span>
        <span style={{ fontSize: '0.78rem', color: TEXT_PRIMARY, fontFamily: FONT }}>{inc.severity}</span>
        <span style={{ fontSize: '0.78rem', color: TEXT_PRIMARY, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.assignedTo}</span>
        <span style={{ fontSize: '0.78rem', color: TEXT_PRIMARY, fontFamily: FONT }}>{inc.status}</span>
      </div>
    ))}
    {showSeeMore && (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
        <button onClick={onSeeMore} style={{
          background: 'none', border: `1px solid ${TEXT_MUTED}`, color: TEXT_PRIMARY,
          fontSize: '0.72rem', fontFamily: FONT, padding: '0.4rem 0.9rem', cursor: 'pointer',
          borderRadius: '3px', display: 'flex', alignItems: 'center', gap: '0.4rem', letterSpacing: '0.06em',
        }}>
          See more <span style={{ fontSize: '1rem' }}>→</span>
        </button>
      </div>
    )}
  </div>
);

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────
export const MiniBarChart = ({ title, data }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '1.2rem 1rem 0.8rem' }}>
      {title && <div style={{ fontSize: '0.68rem', color: TEXT_MUTED, fontFamily: FONT, marginBottom: '1rem', letterSpacing: '0.06em' }}>{title}</div>}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ width: '100%', height: `${(d.value / max) * 100}%`, backgroundColor: '#ffffff', borderRadius: '2px 2px 0 0', minHeight: d.value > 0 ? '4px' : '0' }} />
            <span style={{ fontSize: '0.55rem', color: TEXT_MUTED, fontFamily: FONT, marginTop: '4px', whiteSpace: 'nowrap' }}>{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Mini Line Chart ──────────────────────────────────────────────────────────
export const MiniLineChart = ({ title, data }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const min = Math.min(...data.map(d => d.value));
  const range = max - min || 1;
  const W = 400, H = 140, PAD = 10;
  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.value - min) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });
  return (
    <div style={{ backgroundColor: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: '4px', padding: '1.2rem 1rem 0.8rem' }}>
      {title && <div style={{ fontSize: '0.68rem', color: TEXT_MUTED, fontFamily: FONT, marginBottom: '0.75rem', letterSpacing: '0.06em' }}>{title}</div>}
      <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', height: '160px' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((frac, i) => (
          <line key={i} x1={PAD} y1={PAD + frac * (H - PAD * 2)} x2={W - PAD} y2={PAD + frac * (H - PAD * 2)} stroke={BORDER} strokeWidth="0.5" />
        ))}
        <polyline points={points.join(' ')} fill="none" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((pt, i) => { const [x, y] = pt.split(','); return <circle key={i} cx={x} cy={y} r="2.5" fill="#ffffff" />; })}
        {data.map((d, i) => {
          const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
          return <text key={i} x={x} y={H + 16} textAnchor="middle" fill={TEXT_MUTED} fontSize="10" fontFamily={FONT}>{d.label}</text>;
        })}
      </svg>
    </div>
  );
};