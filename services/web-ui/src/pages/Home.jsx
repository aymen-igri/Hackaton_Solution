import React, { useState } from 'react';


export const HomePage = () => {
  const [incidents] = useState([
    { id: 1, title: 'Database Connection Timeout', severity: 'Critical', assignedTo: 'John Smith', status: 'In Progress' },
    { id: 2, title: 'API Response Slow', severity: 'High', assignedTo: 'Sarah Johnson', status: 'Open' },
    { id: 3, title: 'Login Page Error', severity: 'Medium', assignedTo: 'Mike Chen', status: 'In Progress' },
    { id: 4, title: 'Email Service Down', severity: 'Critical', assignedTo: 'Emma Wilson', status: 'Open' },
    { id: 5, title: 'Cache Not Clearing', severity: 'Low', assignedTo: 'Tom Anderson', status: 'Pending' },
    { id: 6, title: 'SSL Certificate Expiring', severity: 'High', assignedTo: 'Lisa Brown', status: 'Open' },
    { id: 7, title: 'Payment Gateway Issue', severity: 'Critical', assignedTo: 'David Lee', status: 'In Progress' },
    { id: 8, title: 'Mobile App Crash', severity: 'High', assignedTo: 'Amy Zhang', status: 'Open' },
    { id: 9, title: 'Report Generation Failure', severity: 'Medium', assignedTo: 'Chris Taylor', status: 'Pending' },
  ]);

  return (
    <main style={{ padding: '3rem 2rem' }}>
      {/* Welcome Message */}
      <h1 style={{
        fontSize: '3rem',
        fontWeight: '300',
        marginBottom: '2rem',
        letterSpacing: '-0.02em'
      }}>
        WELCOME BACK<br />MANAGER
      </h1>

      {/* Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '3rem',
        maxWidth: '800px'
      }}>
        <div style={{
          backgroundColor: '#000000',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#888888', marginBottom: '0.5rem' }}>
            Total Open<br />Incidents
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '600' }}>9</div>
        </div>

        <div style={{
          backgroundColor: '#000000',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#888888', marginBottom: '0.5rem' }}>
            Current Average<br />MTTA
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '600' }}>9</div>
        </div>

        <div style={{
          backgroundColor: '#000000',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#888888', marginBottom: '0.5rem' }}>
            Current Average<br />MTTR
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '600' }}>9</div>
        </div>
      </div>

      {/* Incidents Table */}
      <div style={{
        backgroundColor: '#000000',
        border: '1px solid #333',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1.5fr 1fr',
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
        </div>

        {/* Table Rows */}
        {incidents.slice(0, 3).map(incident => (
          <div
            key={incident.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1.5fr 1fr',
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
          </div>
        ))}

        {/* See More Button */}
        <div style={{ padding: '1.5rem', textAlign: 'right' }}>
          <button style={{
            backgroundColor: 'transparent',
            border: '1px solid #ffffff',
            color: '#ffffff',
            padding: '0.75rem 1.5rem',
            borderRadius: '6px',
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.color = '#000000';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#ffffff';
          }}
          >
            See more
            <span style={{ fontSize: '1rem' }}>→</span>
          </button>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div style={{
        marginTop: '2rem',
        backgroundColor: '#000000',
        border: '1px solid #333',
        borderRadius: '8px',
        height: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#444444',
        fontSize: '0.875rem'
      }}>
        Chart Area
      </div>
    </main>
  );
};
