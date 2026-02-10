// src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Header from './components/Header/Header';
import { HomePage } from './pages/Home';
import { IncidentsPage } from './pages/Incidents';
import { SchedulePage } from './pages/Schedule';
import { AcknowledgePage } from './pages/Acknowledge';
import { ResolvePage } from './pages/Resolve';

const loadFont = () => {
  if (document.getElementById('wix-font')) return;
  const link = document.createElement('link');
  link.id = 'wix-font';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Wix+Madefor+Display:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(link);
};

// Main dashboard with tab navigation
const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('HOME');
  const navigate = useNavigate();

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

// App with routing
export const IncidentDashboard = () => {
  useEffect(() => { loadFont(); }, []);

  return (
    <Router>
      <Routes>
        {/* Magic link routes */}
        <Route path="/acknowledge/:token" element={<AcknowledgePage />} />
        <Route path="/resolve/:token" element={<ResolvePage />} />
        
        {/* Main dashboard */}
        <Route path="/*" element={<Dashboard />} />
      </Routes>
    </Router>
  );
};

export default IncidentDashboard;
