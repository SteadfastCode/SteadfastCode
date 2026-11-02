-- Every client-site build, timed (2026-11-01), so the admin page's "usually takes" line comes from
-- real builds instead of a guess. Written by steadfast-ai's scripts/client-builds.mjs.
CREATE TABLE builds (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  tier TEXT,
  kind TEXT NOT NULL,          -- first | rebuild
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  seconds INTEGER NOT NULL,
  ok INTEGER NOT NULL          -- 1 preview published, 0 failed
);
CREATE INDEX builds_kind ON builds (kind, tier, finished_at DESC);
-- The first two real builds (Daniel's test, Starter), timed from the service log.
INSERT INTO builds VALUES ('seed-1', '9c5dd4dd-ad65-4de2-9fcd-3518b4a3c741', 'starter', 'first', '2026-11-02T00:46:03Z', '2026-11-02T00:50:25Z', 262, 1);
INSERT INTO builds VALUES ('seed-2', '9c5dd4dd-ad65-4de2-9fcd-3518b4a3c741', 'starter', 'rebuild', '2026-11-02T00:52:51Z', '2026-11-02T00:54:15Z', 84, 1);
