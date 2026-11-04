-- Messages (2026-11-04): one conversation per project between the client and Daniel. The client
-- writes on the portal's Messages tab, Daniel in /admin/inbox or on the project. A client's message
-- reaches Daniel on Signal from the box (notified_at, set by scripts/client-builds.mjs in
-- steadfast-ai); Daniel's reply emails the client a note with their link (emailed_at).
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects (id),
  at TEXT NOT NULL,
  sender TEXT NOT NULL,          -- client | daniel
  name TEXT,                     -- who on that side, as shown
  body TEXT NOT NULL,
  read_at TEXT,                  -- when the other side opened it
  notified_at TEXT,              -- client → Daniel: when Signal went out
  emailed_at TEXT                -- Daniel → client: when the email went out
);
CREATE INDEX messages_project ON messages (project_id, id);
CREATE INDEX messages_unread ON messages (sender, read_at);

-- A care plan set to end (2026-11-04): a cancel from Stripe's billing page waits for the end of the
-- paid or free period, so the plan stays active until then; this is that day, shown on both sides.
ALTER TABLE care_plans ADD COLUMN ends_at TEXT;   -- YYYY-MM-DD, or NULL when it isn't ending
