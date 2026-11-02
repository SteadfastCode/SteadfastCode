-- The client side of a project (2026-11-01): a private link Daniel sends from /admin, where the
-- client uploads photos and a logo, fills in their own details, and watches the build.
-- Only the token's SHA-256 is stored; the link itself is shown once, when it's made.
CREATE TABLE client_links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_used_at TEXT
);
CREATE INDEX client_links_project ON client_links (project_id);

-- Files in the R2 bucket bound as UPLOADS, key projects/<project>/<id>.<ext>.
CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  kind TEXT NOT NULL,            -- logo | photo
  r2_key TEXT NOT NULL,
  filename TEXT,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  caption TEXT,
  source TEXT NOT NULL,          -- client | admin
  uploaded_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX uploads_project ON uploads (project_id, uploaded_at);

-- What happened on a project, in plain words, for Daniel: "Client uploaded 4 photos".
CREATE TABLE project_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects (id),
  at TEXT NOT NULL,
  who TEXT NOT NULL,             -- client | an admin email | box
  what TEXT NOT NULL
);
CREATE INDEX project_events_project ON project_events (project_id, at DESC);

-- Who is in which field right now, so each side sees "Daniel is editing this" instead of having a
-- field change under them. One row per side per project; stale after a few seconds.
CREATE TABLE presence (
  project_id TEXT NOT NULL REFERENCES projects (id),
  who TEXT NOT NULL,             -- daniel | client
  name TEXT,
  field TEXT,
  at TEXT NOT NULL,
  PRIMARY KEY (project_id, who)
);
