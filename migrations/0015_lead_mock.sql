-- A mock-up for a lead (2026-11-09): a home page Daniel built on a private Pages preview before
-- the lead became a project, to show them. The board links to it; the real site starts from it.
ALTER TABLE leads ADD COLUMN mock_url TEXT;
