-- The outreach board (2026-11-03). Leads are no longer only contact-form submissions: Daniel's
-- prospects (businesses, churches and nonprofits he goes to) and partners (chambers, networks,
-- referral sources) sit in the same table, with a pipeline status, what their site is like today,
-- the next step and its date, and a log of every touch in lead_touches. Moved here from the
-- steadfast-ai gateway dashboard, which kept the board in a JSON file on the box; /admin already
-- had the other half (a project starts from a lead), and this database is durable and off the box.
-- For a contact-form lead, received_at is when the form came in; for one Daniel adds, when he did.
ALTER TABLE leads ADD COLUMN kind TEXT NOT NULL DEFAULT 'inbound';        -- inbound | prospect | partner
ALTER TABLE leads ADD COLUMN role TEXT;                                   -- the contact's role
ALTER TABLE leads ADD COLUMN category TEXT;                               -- plumber, church, chamber…
ALTER TABLE leads ADD COLUMN town TEXT;
ALTER TABLE leads ADD COLUMN site_state TEXT NOT NULL DEFAULT 'unknown';  -- unknown | none | facebook | outdated | slow | fine
ALTER TABLE leads ADD COLUMN why TEXT;                                    -- why reach out
ALTER TABLE leads ADD COLUMN next_step TEXT;
ALTER TABLE leads ADD COLUMN next_at TEXT;                                -- YYYY-MM-DD
ALTER TABLE leads ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
UPDATE leads SET updated_at = received_at WHERE updated_at = '';
-- status was new | started | closed; now the pipeline:
-- new | contacted | replied | meeting | proposal | won | lost | hold
UPDATE leads SET status = 'won' WHERE status = 'started';
UPDATE leads SET status = 'lost' WHERE status = 'closed';
CREATE TABLE lead_touches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL REFERENCES leads (id),
  at TEXT NOT NULL,
  kind TEXT NOT NULL,     -- note | email | call | text | visit | video | reply | meeting | status | project
  text TEXT NOT NULL,
  status TEXT,            -- the status this touch moved the lead to, when it moved it
  who TEXT NOT NULL       -- daniel | box | front-desk
);
CREATE INDEX lead_touches_lead ON lead_touches (lead_id, id DESC);
CREATE INDEX leads_status ON leads (status);
CREATE INDEX leads_next ON leads (next_at);
