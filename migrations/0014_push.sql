-- Push to Daniel's phone (2026-11-04). `devices` is every phone running the Steadfast Code admin app
-- (its FCM token, registered from the app); `notifications` is the queue of what should reach him:
-- the site writes a row (a new lead, a signed contract, a card added, a failed payment) and the
-- build service on the box sends it, by push when a device is registered, by Signal when not.
CREATE TABLE devices (
  token TEXT PRIMARY KEY,
  who TEXT NOT NULL DEFAULT 'daniel',
  label TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  kind TEXT NOT NULL,          -- lead | contract | care | message | test | …
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,                    -- where a tap opens, on steadfastcode.tech
  sent_at TEXT,
  sent_by TEXT,                -- push | signal
  error TEXT
);
CREATE INDEX notifications_pending ON notifications (sent_at, id);
