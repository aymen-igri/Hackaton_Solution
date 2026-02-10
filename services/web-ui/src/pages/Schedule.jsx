// src/pages/Schedule.jsx
import { FONT, TEXT_PRIMARY, TEXT_MUTED, CARD_BG, BORDER, mockSchedule } from '../components/shared';

export const SchedulePage = () => (
  <div style={{ padding: '1.75rem 1.5rem', maxWidth: '680px', margin: '0 auto' }}>

    <h1 style={{
      fontSize: '2rem',
      fontWeight: '800',
      color: TEXT_PRIMARY,
      fontFamily: FONT,
      marginBottom: '1.5rem',
      letterSpacing: '-0.01em',
    }}>
      SCHEDULE
    </h1>

    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr', padding: '0.4rem 0.75rem', gap: '0.5rem' }}>
      {['NAME', 'ROLE', 'START', 'END'].map(h => (
        <span key={h} style={{ fontSize: '0.65rem', color: TEXT_MUTED, fontFamily: FONT, letterSpacing: '0.08em', fontWeight: '600' }}>
          {h}
        </span>
      ))}
    </div>

    {mockSchedule.map(s => (
      <div key={s.id} style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr',
        backgroundColor: CARD_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: '3px',
        padding: '0.7rem 0.75rem',
        marginBottom: '0.35rem',
        gap: '0.5rem',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '0.78rem', color: TEXT_PRIMARY, fontFamily: FONT }}>{s.name}</span>
        <span style={{ fontSize: '0.78rem', color: TEXT_PRIMARY, fontFamily: FONT }}>{s.role}</span>
        <span style={{ fontSize: '0.78rem', color: TEXT_PRIMARY, fontFamily: FONT }}>{s.start}</span>
        <span style={{ fontSize: '0.78rem', color: TEXT_PRIMARY, fontFamily: FONT }}>{s.end}</span>
      </div>
    ))}

  </div>
);