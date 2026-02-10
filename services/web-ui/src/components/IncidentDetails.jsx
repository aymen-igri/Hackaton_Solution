import { useState, useEffect } from 'react';
import { HomePage } from '../pages/Home';
import { IncidentsPage } from '../pages/Incidents';
import { SchedulePage } from '../pages/Schedule';

// ─── Load Wix Madefor Display font ───────────────────────────────────────────
const loadFont = () => {
  if (document.getElementById('wix-font')) return;
  const link = document.createElement('link');
  link.id = 'wix-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Wix+Madefor+Display:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(link);
};

// ─── Header Component (Persistent across pages) ───────────────────────────────
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
      <span style={{ fontSize: '1rem', fontWeight: '700', color: '#ffffff', letterSpacing: '0.04em', fontFamily: '"Wix Madefor Display", sans-serif' }}>
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
            fontFamily: '"Wix Madefor Display", sans-serif',
            letterSpacing: '0.1em',
          }}
        >
          {tab}
        </button>
      ))}
    </nav>
  </header>
);

// ─── Main App Component ───────────────────────────────────────────────────────
export const IncidentDashboard = () => {
  const [activeTab, setActiveTab] = useState('HOME');

  useEffect(() => { loadFont(); }, []);

  const renderPage = () => {
    switch (activeTab) {
      case 'HOME':      return <HomePage onSeeMore={() => setActiveTab('INCIDENTS')} />;
      case 'INCIDENTS': return <IncidentsPage />;
      case 'SCHEDULE':  return <SchedulePage />;
      default:          return <HomePage onSeeMore={() => setActiveTab('INCIDENTS')} />;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#1c1c1c',
      color: '#ffffff',
      fontFamily: '"Wix Madefor Display", sans-serif',
    }}>
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      {renderPage()}
    </div>
  );
};

export default IncidentDashboard;