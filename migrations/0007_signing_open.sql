-- Review before signing (2026-11-02): Daniel can send the link early so a client reads the agreement
-- ahead of the meeting, with signing switched off until they sit down together. 1 = can sign.
ALTER TABLE projects ADD COLUMN signing_open INTEGER NOT NULL DEFAULT 1;
