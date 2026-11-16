-- ─────────────────────────────────────────────────────────────────
-- SiteWatch – Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL editor)
-- ─────────────────────────────────────────────────────────────────

-- 1. SITES — the list of websites to monitor
-- Add rows here manually or via the Supabase dashboard.
CREATE TABLE IF NOT EXISTS sites (
  id               BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL,              -- Human label, e.g. "Cyble Main"
  url              TEXT NOT NULL UNIQUE,       -- Full URL with https://
  emoji            TEXT DEFAULT '🌐',          -- Icon shown in dashboard
  active           BOOLEAN DEFAULT TRUE,       -- Set false to pause monitoring
  last_status      TEXT,                       -- 'up' | 'down' — last known state
  last_checked_at  TIMESTAMPTZ,               -- When the last check ran
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CHECKS — raw result of every 5-minute check
CREATE TABLE IF NOT EXISTS checks (
  id                BIGSERIAL PRIMARY KEY,
  site_id           BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  status            TEXT NOT NULL,             -- 'up' | 'down'
  http_code         INTEGER,                   -- e.g. 200, 503, NULL on timeout
  response_time_ms  INTEGER,                   -- Milliseconds
  error             TEXT,                      -- Error message if down
  checked_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast dashboard queries (site history, last N checks)
CREATE INDEX IF NOT EXISTS checks_site_time
  ON checks(site_id, checked_at DESC);

-- 3. INCIDENTS — one row per downtime event
CREATE TABLE IF NOT EXISTS incidents (
  id           BIGSERIAL PRIMARY KEY,
  site_id      BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  started_at   TIMESTAMPTZ NOT NULL,
  resolved_at  TIMESTAMPTZ,
  resolved     BOOLEAN DEFAULT FALSE,
  reason       TEXT                           -- Error detail from first failed check
);

CREATE INDEX IF NOT EXISTS incidents_site
  ON incidents(site_id, started_at DESC);

-- ─────────────────────────────────────────────────────────────────
-- ROW-LEVEL SECURITY (RLS)
-- The Python monitor uses the service key (bypasses RLS).
-- The frontend uses the anon key — read-only access only.
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE sites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE checks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Allow anon (frontend) to read everything — no writes
CREATE POLICY "public read sites"
  ON sites FOR SELECT USING (TRUE);

CREATE POLICY "public read checks"
  ON checks FOR SELECT USING (TRUE);

CREATE POLICY "public read incidents"
  ON incidents FOR SELECT USING (TRUE);

-- ─────────────────────────────────────────────────────────────────
-- SEED DATA — replace with your real sites
-- ─────────────────────────────────────────────────────────────────

INSERT INTO sites (name, url, emoji) VALUES
  ('Cyble Main',              'https://cyble.com',          '🌐'),
  ('Cyble Intelligence Portal','https://portal.cyble.com',  '🔒'),
  ('API Gateway',             'https://api.cyble.com',      '⚡'),
  ('Docs',                    'https://docs.cyble.com',     '📄'),
  ('Threat Feed CDN',         'https://cdn.cyble.com',      '📡'),
  ('Customer Login',          'https://login.cyble.com',    '🛡'),
  ('Blog',                    'https://blog.cyble.com',     '✍️'),
  ('Status Page',             'https://status.cyble.com',   '📊')
ON CONFLICT (url) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- HELPER VIEW — uptime % per site over last 30 days
-- (used by the frontend dashboard)
-- ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW site_uptime_30d AS
SELECT
  site_id,
  ROUND(
    100.0 * SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0),
    2
  ) AS uptime_pct
FROM checks
WHERE checked_at >= NOW() - INTERVAL '30 days'
GROUP BY site_id;
