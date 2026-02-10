const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { Pool } = require('pg');
const incidentService = require('../services/incidentService');
const redis = require('../redis');
const config = require('../config');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const router = Router();

/**
 * Generate a secure random token for magic link acknowledgment
 */
function generateAckToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/incidents – Create incident (public - called by alert-ingestion service)
router.post('/', async (req, res) => {
  try {
    const { title, severity, source, description, alert_id } = req.body;
    const id = uuidv4();
    const ack_token = generateAckToken();
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO incidents (id, title, severity, source, description, status, ack_token, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'open', $6, $7, $7)
      RETURNING *`;
    const { rows } = await pool.query(sql, [id, title, severity, source, description || '', ack_token, now]);
    const incident = rows[0];

    // Link the originating alert
    if (alert_id) {
      await pool.query(
        'INSERT INTO incident_alerts (alert_id, incident_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [alert_id, id],
      );
    }

    // Push to incidents:queue for assignment to on-call engineer
    await redis.lpush(
      config.queues.incidents,
      JSON.stringify({ incident_id: incident.id })
    );
    console.log(`[incidents] Created incident ${incident.id}, pushed to queue for assignment`);

    res.status(201).json(incident);
  } catch (err) {
    console.error('[incidents] Error creating incident:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// MAGIC LINK - Stateful: open → acknowledged → resolved
// No authentication required!
// ============================================================

// GET /api/incidents/ack/:token – Progress incident state via magic link (PUBLIC)
router.get('/ack/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const now = new Date().toISOString();

    // Find incident by ack_token
    const { rows } = await pool.query(
      'SELECT * FROM incidents WHERE ack_token = $1',
      [token]
    );

    if (!rows.length) {
      if (req.headers.accept?.includes('text/html')) {
        return res.status(404).send(buildHtmlPage('❌ Invalid Link', 'This link is not valid or has expired.', 'error'));
      }
      return res.status(404).json({ 
        error: 'Invalid or expired link',
        message: 'This acknowledgment link is not valid.'
      });
    }

    const incident = rows[0];
    const ackUrl = `${req.protocol}://${req.get('host')}/api/incidents/ack/${token}`;

    // STATE MACHINE: open → acknowledged → resolved
    if (incident.status === 'open') {
      // First click: ACKNOWLEDGE
      const { rows: updated } = await pool.query(
        `UPDATE incidents 
         SET status = 'acknowledged', acknowledged_at = $1, updated_at = $1
         WHERE id = $2 
         RETURNING *`,
        [now, incident.id]
      );

      console.log(`[incidents] Incident ${incident.id} ACKNOWLEDGED via magic link`);

      if (req.headers.accept?.includes('text/html')) {
        return res.send(buildHtmlPage(
          '✅ Incident Acknowledged',
          `<p>You have acknowledged incident <strong>${incident.title}</strong>.</p>
           <p>Once you've fixed the issue, click the button below to mark it as resolved.</p>`,
          'success',
          incident,
          ackUrl,
          'Mark as Resolved'
        ));
      }
      return res.json({ message: 'Incident acknowledged', status: 'acknowledged', incident: updated[0] });

    } else if (incident.status === 'acknowledged') {
      // Second click: RESOLVE
      const { rows: updated } = await pool.query(
        `UPDATE incidents 
         SET status = 'resolved', resolved_at = $1, updated_at = $1
         WHERE id = $2 
         RETURNING *`,
        [now, incident.id]
      );

      console.log(`[incidents] Incident ${incident.id} RESOLVED via magic link`);

      if (req.headers.accept?.includes('text/html')) {
        return res.send(buildHtmlPage(
          '🎉 Incident Resolved',
          `<p>Great work! Incident <strong>${incident.title}</strong> has been marked as resolved.</p>
           <p>Resolution time: ${getTimeDiff(incident.created_at, now)}</p>`,
          'resolved',
          incident
        ));
      }
      return res.json({ message: 'Incident resolved', status: 'resolved', incident: updated[0] });

    } else {
      // Already resolved or closed
      if (req.headers.accept?.includes('text/html')) {
        return res.send(buildHtmlPage(
          '📋 Incident Already ' + capitalize(incident.status),
          `<p>This incident was already ${incident.status}.</p>
           <p>Resolved at: ${incident.resolved_at ? new Date(incident.resolved_at).toLocaleString() : 'N/A'}</p>`,
          'info',
          incident
        ));
      }
      return res.json({
        message: `Incident already ${incident.status}`,
        incident: { id: incident.id, title: incident.title, status: incident.status }
      });
    }
  } catch (err) {
    console.error('[incidents] Error with magic link:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: Build HTML response page
function buildHtmlPage(title, message, type, incident = null, actionUrl = null, actionText = null) {
  const colors = {
    success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' },
    resolved: { bg: '#cce5ff', border: '#b8daff', text: '#004085' },
    error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' },
    info: { bg: '#e2e3e5', border: '#d6d8db', text: '#383d41' },
  };
  const c = colors[type] || colors.info;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
               max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .card { background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .header { background: ${c.bg}; border-bottom: 2px solid ${c.border}; padding: 20px; }
        .header h1 { color: ${c.text}; margin: 0; font-size: 24px; }
        .content { padding: 20px; }
        .details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 15px; }
        .details p { margin: 8px 0; }
        .label { font-weight: 600; color: #666; }
        .severity { display: inline-block; padding: 3px 10px; border-radius: 3px; font-weight: bold; text-transform: uppercase; font-size: 12px; }
        .severity.critical { background: #dc3545; color: white; }
        .severity.high { background: #fd7e14; color: white; }
        .severity.warning { background: #ffc107; color: black; }
        .severity.low { background: #28a745; color: white; }
        .btn { display: inline-block; padding: 12px 24px; background: #007bff; color: white; 
               text-decoration: none; border-radius: 5px; font-weight: 600; margin-top: 20px; }
        .btn:hover { background: #0056b3; }
        .footer { padding: 15px 20px; background: #f8f9fa; font-size: 12px; color: #666; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>${title}</h1>
        </div>
        <div class="content">
          ${message}
          ${incident ? `
          <div class="details">
            <p><span class="label">Incident:</span> #${incident.id.substring(0, 8)}</p>
            <p><span class="label">Title:</span> ${incident.title}</p>
            <p><span class="label">Severity:</span> <span class="severity ${incident.severity}">${incident.severity}</span></p>
            <p><span class="label">Source:</span> ${incident.source || 'N/A'}</p>
          </div>
          ` : ''}
          ${actionUrl ? `<a href="${actionUrl}" class="btn">${actionText}</a>` : ''}
        </div>
        <div class="footer">
          Incident Management Platform • ${new Date().toLocaleString()}
        </div>
      </div>
    </body>
    </html>
  `;
}

// Helper: Calculate time difference
function getTimeDiff(start, end) {
  const diffMs = new Date(end) - new Date(start);
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

// Helper: Capitalize first letter
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// GET /api/incidents – List incidents (public)
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status; // optional filter
    const assigned_to = req.query.assigned_to; // filter by assigned_to
    
    let sql = 'SELECT * FROM incidents';
    const params = [];
    const conditions = [];
    
    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }
    
    if (assigned_to) {
      conditions.push(`assigned_to = $${params.length + 1}`);
      params.push(assigned_to);
    }
    
    if (conditions.length) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/incidents/:id (public)
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM incidents WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Incident not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/incidents/:id – Update status (public)
router.patch('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const now = new Date().toISOString();
    const validStatuses = ['open', 'acknowledged', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const extra = {};
    if (status === 'acknowledged') extra.acknowledged_at = now;
    if (status === 'resolved') extra.resolved_at = now;

    let setClauses = ['status = $1', 'updated_at = $2'];
    let params = [status, now];
    let idx = 3;
    for (const [col, val] of Object.entries(extra)) {
      setClauses.push(`${col} = $${idx}`);
      params.push(val);
      idx++;
    }
    params.push(req.params.id);

    const sql = `UPDATE incidents SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
    const { rows } = await pool.query(sql, params);
    if (!rows.length) return res.status(404).json({ error: 'Incident not found' });
    
    console.log(`[incidents] Incident ${req.params.id} updated to ${status}`);
    res.json(rows[0]);
  } catch (err) {
    console.error('[incidents] Error updating incident:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/incidents/metrics/sre – MTTA / MTTR (public)
router.get('/metrics/sre', async (_req, res) => {
  try {
    const metrics = await incidentService.computeSREMetrics();
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
