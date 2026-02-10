// src/components/Header/Header.jsx
import { FONT } from '../../components/shared';

const Header = ({ activeTab, setActiveTab }) => (
  <header style={{
    backgroundColor: '#000000',
    padding: '0.85rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #3a3a3a',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="10" r="7" fill="#fff" />
        <rect x="14" y="17" width="4" height="10" fill="#fff" />
        <rect x="8" y="22" width="16" height="2" fill="#fff" />
      </svg>
      <span style={{ fontSize: '1rem', fontWeight: '700', color: '#ffffff', letterSpacing: '0.04em', fontFamily: FONT }}>
        Acacia
      </span>
    </div>

    <nav style={{ display: 'flex', gap: '2rem' }}>
      {['HOME', 'INCIDENTS', 'SCHEDULE'].map(tab => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === tab ? '#ffffff' : '#888888',
            fontSize: '0.78rem',
            fontWeight: '600',
            cursor: 'pointer',
            padding: '0.4rem 0',
            borderBottom: activeTab === tab ? '2px solid #ffffff' : '2px solid transparent',
            transition: 'all 0.15s',
            fontFamily: FONT,
            letterSpacing: '0.1em',
          }}
        >
          {tab}
        </button>
      ))}
    </nav>
  </header>
);

export default Header;