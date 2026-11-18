-- The contract library (2026-11-17): the sections a website contract can have and the lines Daniel
-- has written for them, so a line added to one project's contract from the Contract pane on /admin
-- is a one-tap add on every later contract. The ten built-in sections are seeded here so every line
-- has a section to belong to; their headings and standard lines stay in src/data/agreement.ts, and a
-- project's contract (answers.contract) refers to sections and lines by these ids.
CREATE TABLE contract_sections (
  id TEXT PRIMARY KEY,                 -- 'build', 'price', … for the built-in ones; random for Daniel's
  heading TEXT NOT NULL,
  builtin INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL,           -- order in the contract; Daniel's come after the built-in ones
  created_at TEXT NOT NULL
);
CREATE TABLE contract_lines (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES contract_sections (id),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (section_id, text)
);
CREATE INDEX contract_lines_section ON contract_lines (section_id, created_at);

INSERT INTO contract_sections (id, heading, builtin, position, created_at) VALUES
  ('who', 'Who this is between', 1, 0, '2026-11-17T00:00:00Z'),
  ('build', 'What I’ll build', 1, 1, '2026-11-17T00:00:00Z'),
  ('price', 'Price and payment', 1, 2, '2026-11-17T00:00:00Z'),
  ('deposit', 'The deposit', 1, 3, '2026-11-17T00:00:00Z'),
  ('timing', 'Timing', 1, 4, '2026-11-17T00:00:00Z'),
  ('changes', 'Changes', 1, 5, '2026-11-17T00:00:00Z'),
  ('your-part', 'Your part', 1, 6, '2026-11-17T00:00:00Z'),
  ('ownership', 'Who owns what', 1, 7, '2026-11-17T00:00:00Z'),
  ('no-promise', 'What I don’t promise', 1, 8, '2026-11-17T00:00:00Z'),
  ('fine-print', 'The fine print', 1, 9, '2026-11-17T00:00:00Z');
