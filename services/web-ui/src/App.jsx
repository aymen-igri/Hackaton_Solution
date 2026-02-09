import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import IncidentDetail from './pages/IncidentDetail';
import OnCallSchedule from './pages/OnCallSchedule';
import Metrics from './pages/Metrics';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <h1>🚨 Incident Platform</h1>
          <ul>
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/oncall">On-Call</Link></li>
            <li><Link to="/metrics">Metrics</Link></li>
          </ul>
        </nav>

        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/incidents/:id" element={<IncidentDetail />} />
            <Route path="/oncall" element={<OnCallSchedule />} />
            <Route path="/metrics" element={<Metrics />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
