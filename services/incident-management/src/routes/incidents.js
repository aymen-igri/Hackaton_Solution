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
 * Generate a secure random token for magic links
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Alias for backward compatibility
const generateAckToken = generateToken;

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
// TOKEN INFO ENDPOINTS (for frontend display)
// No authentication required - token acts as auth
// ============================================================

// GET /api/incidents/info/ack/:token – Get incident info for acknowledge page (PUBLIC)
router.get('/info/ack/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { rows } = await pool.query(
      `SELECT id, title, severity, source, description, status, assigned_to, 
              created_at, updated_at, acknowledged_at, resolved_at 
       FROM incidents WHERE ack_token = $1`,
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Invalid or expired token' });
    }

    const incident = rows[0];
    
    // Get linked alerts count
    const alertsResult = await pool.query(
      'SELECT COUNT(*) as alert_count FROM incident_alerts WHERE incident_id = $1',
      [incident.id]
    );
    incident.alert_count = parseInt(alertsResult.rows[0].alert_count);

    res.json({
      incident,
      action: incident.status === 'open' ? 'acknowledge' : null,
      message: incident.status === 'open' 
        ? 'Click the button below to acknowledge this incident'
        : `This incident is already ${incident.status}`
    });
  } catch (err) {
    console.error('[incidents] Error fetching incident info by ack token:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/incidents/info/resolve/:token – Get incident info for resolve page (PUBLIC)
router.get('/info/resolve/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { rows } = await pool.query(
      `SELECT id, title, severity, source, description, status, assigned_to, 
              created_at, updated_at, acknowledged_at, resolved_at 
       FROM incidents WHERE resolve_token = $1`,
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Invalid or expired token' });
    }

    const incident = rows[0];
    
    // Get linked alerts count
    const alertsResult = await pool.query(
      'SELECT COUNT(*) as alert_count FROM incident_alerts WHERE incident_id = $1',
      [incident.id]
    );
    incident.alert_count = parseInt(alertsResult.rows[0].alert_count);

    res.json({
      incident,
      action: incident.status === 'acknowledged' ? 'resolve' : null,
      message: incident.status === 'acknowledged' 
        ? 'Click the button below to mark this incident as resolved'
        : incident.status === 'open'
          ? 'This incident must be acknowledged first'
          : `This incident is already ${incident.status}`
    });
  } catch (err) {
    console.error('[incidents] Error fetching incident info by resolve token:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// MAGIC LINKS - Separate acknowledge and resolve flows
// No authentication required!
// ============================================================

// GET /api/incidents/ack/:token – Acknowledge incident via magic link (PUBLIC)
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

    // Only allow acknowledge if status is 'open'
    if (incident.status === 'open') {
      // Generate a new resolve token
      const resolve_token = generateToken();

      // Update incident: acknowledged + store resolve_token
      const { rows: updated } = await pool.query(
        `UPDATE incidents 
         SET status = 'acknowledged', acknowledged_at = $1, updated_at = $1, resolve_token = $2
         WHERE id = $3 
         RETURNING *`,
        [now, resolve_token, incident.id]
      );

      const updatedIncident = updated[0];
      console.log(`[incidents] Incident ${incident.id} ACKNOWLEDGED via magic link`);

      // Send confirmation email with resolve link (frontend URL)
      const resolveUrl = `${config.dashboardUrl}/resolve/${resolve_token}`;
      
      // Get engineer info for notification
      if (incident.assigned_to) {
        try {
          const notificationPayload = {
            type: 'acknowledgment_confirmation',
            incident: {
              id: updatedIncident.id,
              title: updatedIncident.title,
              severity: updatedIncident.severity,
              description: updatedIncident.description,
              source: updatedIncident.source,
              status: updatedIncident.status,
              resolve_token: resolve_token,
              acknowledged_at: updatedIncident.acknowledged_at,
              created_at: updatedIncident.created_at,
            },
            engineer: {
              email: incident.assigned_to,
              name: incident.assigned_to.split('@')[0],
            },
            resolveUrl: resolveUrl,
            channels: ['email'],
          };

          await redis.lpush(config.queues.notifications, JSON.stringify(notificationPayload));
          console.log(`[incidents] 📧 Acknowledgment confirmation queued with resolve link`);
        } catch (notifyErr) {
          console.error('[incidents] Failed to queue confirmation notification:', notifyErr.message);
        }
      }

      if (req.headers.accept?.includes('text/html')) {
        return res.send(buildHtmlPage(
          '✅ Incident Acknowledged',
          `<p>You have acknowledged incident <strong>${incident.title}</strong>.</p>
           <p>A confirmation email has been sent with a link to resolve this incident when fixed.</p>
           <p>Check your email for the <strong>RESOLVE</strong> link.</p>`,
          'success',
          updatedIncident
        ));
      }
      return res.json({ 
        message: 'Incident acknowledged. Check your email for the resolve link.', 
        status: 'acknowledged', 
        incident: updatedIncident 
      });

    } else if (incident.status === 'acknowledged') {
      // Already acknowledged - remind them to use resolve link
      if (req.headers.accept?.includes('text/html')) {
        return res.send(buildHtmlPage(
          '📋 Already Acknowledged',
          `<p>This incident was already acknowledged.</p>
           <p>To resolve it, please use the <strong>RESOLVE</strong> link sent to your email.</p>`,
          'info',
          incident
        ));
      }
      return res.json({
        message: 'Incident already acknowledged. Use the resolve link from your email to mark it resolved.',
        status: 'acknowledged',
        incident: { id: incident.id, title: incident.title, status: incident.status }
      });

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
    console.error('[incidents] Error with acknowledge link:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/incidents/resolve/:token – Resolve incident via magic link (PUBLIC)
router.get('/resolve/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const now = new Date().toISOString();

    // Find incident by resolve_token
    const { rows } = await pool.query(
      'SELECT * FROM incidents WHERE resolve_token = $1',
      [token]
    );

    if (!rows.length) {
      if (req.headers.accept?.includes('text/html')) {
        return res.status(404).send(buildHtmlPage('❌ Invalid Link', 'This resolve link is not valid or has expired.', 'error'));
      }
      return res.status(404).json({ 
        error: 'Invalid or expired link',
        message: 'This resolve link is not valid.'
      });
    }

    const incident = rows[0];

    // Only allow resolve if status is 'acknowledged'
    if (incident.status === 'acknowledged') {
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

    } else if (incident.status === 'open') {
      // Not yet acknowledged
      if (req.headers.accept?.includes('text/html')) {
        return res.send(buildHtmlPage(
          '⚠️ Not Yet Acknowledged',
          `<p>This incident must be acknowledged before it can be resolved.</p>
           <p>Please use the <strong>ACKNOWLEDGE</strong> link from the original notification first.</p>`,
          'error',
          incident
        ));
      }
      return res.json({
        message: 'Incident must be acknowledged before it can be resolved',
        status: 'open',
        incident: { id: incident.id, title: incident.title, status: incident.status }
      });

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
    console.error('[incidents] Error with resolve link:', err);
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
