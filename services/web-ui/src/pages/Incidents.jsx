// Incidents Page Component
import React, { useState } from 'react';


export const IncidentsPage = () => {
  const [incidents] = useState([
    { id: 1, title: 'Database Connection Timeout', severity: 'Critical', assignedTo: 'John Smith', status: 'In Progress', created: '2024-02-10 09:15' },
    { id: 2, title: 'API Response Slow', severity: 'High', assignedTo: 'Sarah Johnson', status: 'Open', created: '2024-02-10 08:30' },
    { id: 3, title: 'Login Page Error', severity: 'Medium', assignedTo: 'Mike Chen', status: 'In Progress', created: '2024-02-10 07:45' },
    { id: 4, title: 'Email Service Down', severity: 'Critical', assignedTo: 'Emma Wilson', status: 'Open', created: '2024-02-09 22:15' },
    { id: 5, title: 'Cache Not Clearing', severity: 'Low', assignedTo: 'Tom Anderson', status: 'Pending', created: '2024-02-09 20:30' },
    { id: 6, title: 'SSL Certificate Expiring', severity: 'High', assignedTo: 'Lisa Brown', status: 'Open', created: '2024-02-09 18:00' },
    { id: 7, title: 'Payment Gateway Issue', severity: 'Critical', assignedTo: 'David Lee', status: 'In Progress', created: '2024-02-09 15:45' },
    { id: 8, title: 'Mobile App Crash', severity: 'High', assignedTo: 'Amy Zhang', status: 'Open', created: '2024-02-09 14:20' },
    { id: 9, title: 'Report Generation Failure', severity: 'Medium', assignedTo: 'Chris Taylor', status: 'Pending', created: '2024-02-09 11:30' },
  ]);

  return (
    <main style={{ padding: '3rem 2rem' }}>
      <h1 style={{
        fontSize: '3rem',
        fontWeight: '300',
        marginBottom: '2rem',
        letterSpacing: '-0.02em'
      }}>
        ALL INCIDENTS
      </h1>

      <div style={{
        backgroundColor: '#000000',
        border: '1px solid #333',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1.5fr 1fr 1.5fr',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #333',
          fontSize: '0.875rem',
          fontWeight: '600',
          color: '#888888'
        }}>
          <div>TITLE</div>
          <div>SEVERITY</div>
          <div>ASSIGNED TO</div>
          <div>STATUS</div>
          <div>CREATED</div>
        </div>

        {/* Table Rows */}
        {incidents.map(incident => (
          <div
            key={incident.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1.5fr 1fr 1.5fr',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #222',
              transition: 'background-color 0.2s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#111'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{ fontSize: '0.9rem' }}>{incident.title}</div>
            <div style={{ fontSize: '0.9rem' }}>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                fontSize: '0.8rem',
                backgroundColor: incident.severity === 'Critical' ? '#ff4444' : 
                                incident.severity === 'High' ? '#ff8800' : 
                                incident.severity === 'Medium' ? '#ffbb00' : '#44aa44',
                color: '#ffffff'
              }}>
                {incident.severity}
              </span>
            </div>
            <div style={{ fontSize: '0.9rem', color: '#cccccc' }}>{incident.assignedTo}</div>
            <div style={{ fontSize: '0.9rem', color: '#cccccc' }}>{incident.status}</div>
            <div style={{ fontSize: '0.9rem', color: '#888888' }}>{incident.created}</div>
          </div>
        ))}
      </div>
    </main>
  );
};