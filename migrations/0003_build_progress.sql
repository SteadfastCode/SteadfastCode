-- Live build progress on the admin page (2026-11-01): which step the box is on (1 picked up,
-- 2 setting up, 3 building, 4 checking, 5 publishing, 6 done), what the build session is doing
-- right now, and when the build started. Written by steadfast-ai's scripts/client-builds.mjs.
ALTER TABLE projects ADD COLUMN build_step INTEGER;
ALTER TABLE projects ADD COLUMN build_activity TEXT;
ALTER TABLE projects ADD COLUMN build_started_at TEXT;
