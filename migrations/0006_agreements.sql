-- Signed website agreements (2026-11-02). One row per signature: the exact text the client was
-- shown, its SHA-256, the typed name, time, IP, browser and link: the record Plumb keeps for Mr
-- Dandyman's signed estimates. `terms_key` is what makes it stale (package, add-on, price, wording);
-- a newer signature for the same project supersedes an older one.
CREATE TABLE agreements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  version TEXT NOT NULL,
  terms_key TEXT NOT NULL,
  text TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signed_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  link_id TEXT,
  portfolio_ok INTEGER,            -- 1 yes, 0 no, NULL not asked; never part of the signature
  emailed_to TEXT
);
CREATE INDEX agreements_project ON agreements (project_id, signed_at DESC);
