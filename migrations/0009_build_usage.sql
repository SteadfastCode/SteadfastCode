-- What each client build costs (2026-11-02, Daniel: "how much usage, and what it roughly costs me
-- per rebuild, categorized and based on how much changed"). Written by steadfast-ai's
-- scripts/client-builds.mjs; read by /admin/usage.
ALTER TABLE builds ADD COLUMN mode TEXT;               -- first | targeted | full
ALTER TABLE builds ADD COLUMN requested_by TEXT;       -- daniel | client
ALTER TABLE builds ADD COLUMN model TEXT;
ALTER TABLE builds ADD COLUMN effort TEXT;
ALTER TABLE builds ADD COLUMN input_tokens INTEGER;
ALTER TABLE builds ADD COLUMN output_tokens INTEGER;
ALTER TABLE builds ADD COLUMN cache_read_tokens INTEGER;
ALTER TABLE builds ADD COLUMN cache_write_tokens INTEGER;
ALTER TABLE builds ADD COLUMN cost_usd REAL;           -- what the same work costs on the API
ALTER TABLE builds ADD COLUMN turns INTEGER;
ALTER TABLE builds ADD COLUMN session_seconds INTEGER;
ALTER TABLE builds ADD COLUMN weekly_before INTEGER;   -- plan's weekly usage %, before and after
ALTER TABLE builds ADD COLUMN weekly_after INTEGER;
ALTER TABLE builds ADD COLUMN change_count INTEGER;
ALTER TABLE builds ADD COLUMN changes TEXT;
ALTER TABLE builds ADD COLUMN rules_refreshed INTEGER;
-- Which kind of build was asked for, and by whom; the box clears them when it picks the build up.
ALTER TABLE projects ADD COLUMN build_mode TEXT;
ALTER TABLE projects ADD COLUMN build_requested_by TEXT;
-- Small settings for the admin pages (the plan price that turns usage into dollars).
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
