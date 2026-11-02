-- Automatic preview updates from the client's own edits (2026-11-02, Daniel). A client edit marks
-- the project changed; the box waits for a quiet spell, then either updates the preview (small
-- changes) or flags the change for Daniel (pages, notes, sites they like, or a bigger ask the build
-- itself spots). No button, no visible limit: at most 5 automatic updates a day, then Daniel's told.
ALTER TABLE projects ADD COLUMN client_changed_at TEXT;   -- last client edit not yet handled
ALTER TABLE projects ADD COLUMN client_changes TEXT;      -- JSON list of what changed: field ids, 'uploads'
ALTER TABLE projects ADD COLUMN review_needed TEXT;       -- JSON list of { at, what } waiting on Daniel
