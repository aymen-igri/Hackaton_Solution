const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * rotationService – Who's on call now?
 *
 * Supports rotation types: daily, weekly
 * Uses modulo arithmetic on members array to determine the current responder.
 */

async function getCurrentOnCall(scheduleId) {
  const schedule = await getSchedule(scheduleId);
  if (!schedule) return { on_call: null, message: 'No active schedule found' };

  const members = typeof schedule.members === 'string' ? JSON.parse(schedule.members) : schedule.members;
  if (!members.length) return { on_call: null, message: 'Schedule has no members' };

  const index = computeRotationIndex(schedule.rotation_type, schedule.start_date, members.length);

  return {
    schedule_id: schedule.id,
    schedule_name: schedule.name,
    rotation_type: schedule.rotation_type,
    on_call: members[index],
    index,
    total_members: members.length,
    since: schedule.start_date,
  };
}

async function getNextOnCall(scheduleId) {
  const schedule = await getSchedule(scheduleId);
  if (!schedule) return { on_call: null, message: 'No active schedule found' };

  const members = typeof schedule.members === 'string' ? JSON.parse(schedule.members) : schedule.members;
  if (!members.length) return { on_call: null, message: 'Schedule has no members' };

  const currentIndex = computeRotationIndex(schedule.rotation_type, schedule.start_date, members.length);
  const nextIndex = (currentIndex + 1) % members.length;

  return {
    schedule_id: schedule.id,
    next_on_call: members[nextIndex],
    index: nextIndex,
  };
}

// ─── Helpers ───────────────────────────────────────────────

async function getSchedule(scheduleId) {
  let sql, params;
  if (scheduleId) {
    sql = 'SELECT * FROM oncall_schedules WHERE id = $1';
    params = [scheduleId];
  } else {
    // Get the first active schedule
    sql = `SELECT * FROM oncall_schedules
           WHERE (end_date IS NULL OR end_date > NOW())
           ORDER BY created_at ASC LIMIT 1`;
    params = [];
  }
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

function computeRotationIndex(rotationType, startDate, memberCount) {
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now - start;

  let periods;
  switch (rotationType) {
    case 'daily':
      periods = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      break;
    case 'weekly':
    default:
      periods = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      break;
  }

  return periods % memberCount;
}

module.exports = { getCurrentOnCall, getNextOnCall };
