-- What a project still needs from the client (2026-11-19): a running list Daniel keeps on the
-- project and the client sees on their page (the Deliverance call: font, text box, filigree,
-- headers, footers, headings). Daniel adds an item; the client marks it sent and says where it is
-- (a link, "in Discord"), since most of these aren't photos they can upload; Daniel marks it received.
CREATE TABLE assets_needed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects (id),
  title TEXT NOT NULL,           -- what's needed, in a few words: "Display font"
  detail TEXT,                   -- Daniel's note: the format, what it's for
  status TEXT NOT NULL DEFAULT 'needed',   -- needed | sent | received
  client_note TEXT,              -- the client's words when they sent it: a link, or where to find it
  created_at TEXT NOT NULL,
  sent_at TEXT,
  received_at TEXT
);
CREATE INDEX assets_needed_project ON assets_needed (project_id, id);
