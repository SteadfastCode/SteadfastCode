-- The intake retires after the first meeting (2026-11-19, steadfast-ai docs/client-portal-plan.md).
-- Once Daniel closes it, the client sees their details read-only and sends every change as a
-- message; the server refuses their edits to the answers. NULL means the intake is still open.
ALTER TABLE projects ADD COLUMN intake_closed_at TEXT;
