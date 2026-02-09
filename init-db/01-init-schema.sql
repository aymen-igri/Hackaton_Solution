-- ============================================================
-- Incident Platform – Database Schema
-- ============================================================

-- ─── Alerts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id          UUID PRIMARY KEY,
    source      VARCHAR(255) NOT NULL,
    severity    VARCHAR(50)  NOT NULL,    -- critical, high, medium, low, info
    title       VARCHAR(512) NOT NULL,
    description TEXT         DEFAULT '',
    labels      JSONB        DEFAULT '{}',
    received_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_source      ON alerts (source);
CREATE INDEX idx_alerts_severity    ON alerts (severity);
CREATE INDEX idx_alerts_received_at ON alerts (received_at DESC);

-- ─── Incidents ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
    id              UUID PRIMARY KEY,
    title           VARCHAR(512) NOT NULL,
    severity        VARCHAR(50)  NOT NULL,
    source          VARCHAR(255),
    description     TEXT         DEFAULT '',
    status          VARCHAR(50)  NOT NULL DEFAULT 'open',   -- open, acknowledged, resolved, closed
    labels          JSONB        DEFAULT '{}',
    assigned_to     VARCHAR(255),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_incidents_status     ON incidents (status);
CREATE INDEX idx_incidents_severity   ON incidents (severity);
CREATE INDEX idx_incidents_created_at ON incidents (created_at DESC);

-- ─── Alert ↔ Incident mapping ──────────────────────────────
CREATE TABLE IF NOT EXISTS incident_alerts (
    alert_id    UUID REFERENCES alerts(id)    ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    linked_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (alert_id, incident_id)
);

-- ─── On-Call Schedules ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS oncall_schedules (
    id             UUID PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    team_id        VARCHAR(255),
    rotation_type  VARCHAR(50)  NOT NULL DEFAULT 'weekly',  -- daily, weekly
    start_date     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    end_date       TIMESTAMPTZ,
    members        JSONB        NOT NULL DEFAULT '[]',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Seed data (optional demo schedule) ─────────────────────
INSERT INTO oncall_schedules (id, name, team_id, rotation_type, start_date, members)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Platform Team – Primary',
    'platform',
    'weekly',
    NOW(),
    '["alice@example.com", "bob@example.com", "carol@example.com"]'
);
