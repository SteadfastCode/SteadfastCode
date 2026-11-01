-- Client site projects from the admin intake (2026-11-01). `answers` is the intake as JSON, keyed
-- by the field ids in src/data/intake.ts. The box reads build-requested rows and writes back
-- status and preview_url as the build goes.
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,                       -- set when a build is requested; the repo is client-<slug>
  lead_id TEXT REFERENCES leads (id),
  tier TEXT,
  answers TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'intake',  -- intake | build-requested | building | preview | live | closed
  preview_url TEXT,
  build_note TEXT,                        -- the box's last word on the build, shown on the page
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  build_requested_at TEXT
);
CREATE INDEX projects_updated ON projects (updated_at DESC);
CREATE INDEX projects_status ON projects (status);
