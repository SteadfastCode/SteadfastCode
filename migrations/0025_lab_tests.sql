-- The lab card (2026-11-24): Daniel's say over a client's lab page from /admin. The tests themselves
-- are described in the client repo (lab/build.mjs, published as tests.json beside the landing page);
-- a row here overrides one test's place on the landing page, which asks /api/lab on load.
--   shown    1 listed, 0 held back; NULL leaves it to the build
--   status   'ready' or 'rough'; NULL leaves it to the build
--   updated  YYYY-MM-DD, set when the status changes here
CREATE TABLE lab_tests (
  project_id TEXT NOT NULL REFERENCES projects (id),
  folder TEXT NOT NULL,
  shown INTEGER,
  status TEXT,
  updated TEXT,
  set_at TEXT NOT NULL,
  PRIMARY KEY (project_id, folder)
);
