-- Change requests (2026-11-20, steadfast-ai docs/client-portal-plan.md step 3): one record per
-- thing a client asks to change, linked to the message it came from. The same record is a card in
-- the conversation (with its status) and a row in the project's request queue on /admin.
CREATE TABLE change_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id TEXT NOT NULL REFERENCES projects (id),
  message_id INTEGER REFERENCES messages (id),   -- the message its card sits under
  kind TEXT NOT NULL DEFAULT 'other',            -- details | photos | reword | section | page | broken | other
  title TEXT NOT NULL,                           -- the ask in a few words
  status TEXT NOT NULL DEFAULT 'received',       -- received | working | preview | approved | live | closed
  note TEXT,                                     -- Daniel's note to the client: a quote, or why it's closed
  created_by TEXT NOT NULL,                      -- client | daniel
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX change_requests_project ON change_requests (project_id, id);
CREATE UNIQUE INDEX change_requests_message ON change_requests (message_id) WHERE message_id IS NOT NULL;
