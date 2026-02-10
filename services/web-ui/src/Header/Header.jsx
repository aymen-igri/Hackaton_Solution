import React, { useState } from 'react';
import { HomePage } from '../pages/Home';
import { IncidentsPage } from '../pages/Incidents';
import { SchedulePage } from '../pages/Schedule';

// Header Component (Persistent across pages)
const Header = ({ activeTab, setActiveTab }) => {
  return (
    <header style={{
      backgroundColor: '#000000',
      padding: '1rem 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottom: '1px solid #333',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M16 4L8 12H14V20H18V12H24L16 4Z" fill="#ffffff"/>
          <path d="M8 24H24V28H8V24Z" fill="#ffffff"/>
        </svg>
        <span style={{ fontSize: '1.25rem', fontWeight: '600' }}>Acacia</span>
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
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              padding: '0.5rem 0',
              borderBottom: activeTab === tab ? '2px solid #ffffff' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          >
            {tab}
          </button>
        ))}
      </nav>
    </header>
  );
};

// Main App Component
export const IncidentDashboard = () => {
  const [activeTab, setActiveTab] = useState('HOME');

  // Render the appropriate page based on activeTab
  const renderPage = () => {
    switch(activeTab) {
      case 'HOME':
        return <HomePage />;
      case 'INCIDENTS':
        return <IncidentsPage />;
      case 'SCHEDULE':
        return <SchedulePage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Persistent Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />
      
      {/* Page Content */}
      {renderPage()}
    </div>
  );
};