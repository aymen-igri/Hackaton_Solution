// Schedule Page Component
import React, { useState } from 'react';
import { ScheduleDetails } from '../components/ScheduleDetails';

export const SchedulePage = () => {
  const [schedules, setSchedules] = useState([
    { id: 1, team: 'Team Alpha', member: 'John Smith', shift: 'Morning (6:00 AM - 2:00 PM)', date: '2024-02-10' },
    { id: 2, team: 'Team Alpha', member: 'Sarah Johnson', shift: 'Afternoon (2:00 PM - 10:00 PM)', date: '2024-02-10' },
    { id: 3, team: 'Team Beta', member: 'Mike Chen', shift: 'Night (10:00 PM - 6:00 AM)', date: '2024-02-10' },
    { id: 4, team: 'Team Beta', member: 'Emma Wilson', shift: 'Morning (6:00 AM - 2:00 PM)', date: '2024-02-11' },
    { id: 5, team: 'Team Gamma', member: 'Tom Anderson', shift: 'Afternoon (2:00 PM - 10:00 PM)', date: '2024-02-11' },
  ]);

  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const openScheduleDetails = (schedule) => {
    setSelectedSchedule(schedule);
    setIsAddingNew(false);
  };

  const openAddSchedule = () => {
    setSelectedSchedule({
      id: null,
      team: '',
      member: '',
      shift: '',
      date: new Date().toISOString().split('T')[0]
    });
    setIsAddingNew(true);
  };

  const closeScheduleDetails = () => {
    setSelectedSchedule(null);
    setIsAddingNew(false);
  };

  const updateSchedule = (updatedSchedule) => {
    if (isAddingNew) {
      // Adding new schedule
      const newId = Math.max(...schedules.map(s => s.id), 0) + 1;
      setSchedules(prev => [...prev, { ...updatedSchedule, id: newId }]);
    } else {
      // Updating existing schedule
      setSchedules(prev => 
        prev.map(schedule => 
          schedule.id === updatedSchedule.id ? updatedSchedule : schedule
        )
      );
    }
  };

  return (
    <main style={{ padding: '3rem 2rem' }}>
      <h1 style={{
        fontSize: '3rem',
        fontWeight: '300',
        marginBottom: '2rem',
        letterSpacing: '-0.02em'
      }}>
        ON-CALL SCHEDULE
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
          gridTemplateColumns: '1fr 1.5fr 2fr 1fr',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #333',
          fontSize: '0.875rem',
          fontWeight: '600',
          color: '#888888'
        }}>
          <div>TEAM</div>
          <div>MEMBER</div>
          <div>SHIFT</div>
          <div>DATE</div>
        </div>

        {/* Table Rows */}
        {schedules.map(schedule => (
          <div
            key={schedule.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.5fr 2fr 1fr',
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #222',
              transition: 'background-color 0.2s',
              cursor: 'pointer'
            }}
            onClick={() => openScheduleDetails(schedule)}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#111'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{ fontSize: '0.9rem' }}>{schedule.team}</div>
            <div style={{ fontSize: '0.9rem', color: '#cccccc' }}>{schedule.member}</div>
            <div style={{ fontSize: '0.9rem', color: '#cccccc' }}>{schedule.shift}</div>
            <div style={{ fontSize: '0.9rem', color: '#888888' }}>{schedule.date}</div>
          </div>
        ))}
      </div>

      {/* Add Schedule Button */}
      <div style={{ marginTop: '2rem' }}>
        <button 
          onClick={openAddSchedule}
          style={{
            backgroundColor: '#ffffff',
            border: 'none',
            color: '#000000',
            padding: '0.75rem 2rem',
            borderRadius: '6px',
            fontSize: '0.875rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#dddddd';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
          }}
        >
          + Add Schedule
        </button>
      </div>

      {/* Render the modal when a schedule is selected */}
      {selectedSchedule && (
        <ScheduleDetails
          schedule={selectedSchedule}
          onClose={closeScheduleDetails}
          onUpdate={updateSchedule}
          isAddingNew={isAddingNew}
        />
      )}
    </main>
  );
};