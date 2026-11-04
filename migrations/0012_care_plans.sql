-- Care plans (2026-11-03): a client moving onto monthly hosting and care after launch. One row per
-- project. Daniel sets the plan and price in /admin/care and offers it; the client signs its terms
-- on their portal (stored like the website contract: the exact text, its SHA-256, name, time, IP,
-- browser) and adds a card through Stripe Checkout. Billing is on the 1st of the month, starting
-- the 1st on or after the 30-day change window ends (or launch, if that's later), nothing before.
-- Stripe's webhook keeps the status and paid-through date current; the checklist is the hosting
-- move (DNS to Cloudflare, the domain on Pages, email checked), ticked by Daniel.
CREATE TABLE care_plans (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  plan TEXT NOT NULL,                       -- hosted | hands-on | growth (src/data/site.ts carePlans)
  price INTEGER NOT NULL,                   -- dollars a month, as agreed
  status TEXT NOT NULL DEFAULT 'draft',     -- draft | offered | signed | active | past_due | canceled
  launched_at TEXT,                         -- YYYY-MM-DD
  first_bill_at TEXT,                       -- YYYY-MM-DD, the first charge (always a 1st)
  terms_version TEXT,
  terms_text TEXT,
  terms_sha256 TEXT,
  signer_name TEXT,
  signed_at TEXT,
  signer_ip TEXT,
  signer_agent TEXT,
  stripe_customer TEXT,
  stripe_subscription TEXT,
  stripe_status TEXT,                       -- Stripe's own: trialing | active | past_due | canceled | …
  paid_through TEXT,                        -- YYYY-MM-DD, the end of the last paid month
  checklist TEXT NOT NULL DEFAULT '{}',     -- { itemId: 'YYYY-MM-DD' } for each step done
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX care_plans_project ON care_plans (project_id);
CREATE INDEX care_plans_subscription ON care_plans (stripe_subscription);
