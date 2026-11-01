-- Contact-form submissions, kept so the admin intake can start a project from one (2026-11-01).
-- The email still goes out; this is the copy that doesn't live only in an inbox.
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  business TEXT,
  plan TEXT,
  site TEXT,
  message TEXT NOT NULL,
  source_detail TEXT,
  status TEXT NOT NULL DEFAULT 'new'  -- new | started (a project was made from it) | closed
);
CREATE INDEX leads_received ON leads (received_at DESC);
