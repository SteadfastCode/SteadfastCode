-- Daniel's signature on the contract (2026-11-23), after the client's, as Plumb's contractor
-- countersigns a signed quote: his typed name, the signature he drew (a PNG data URL, kept as
-- received because the record is the evidence), when, and from which address and browser. On the
-- client's signature row, so it signs exactly the text and fingerprint they signed.
ALTER TABLE agreements ADD COLUMN countersigner_name TEXT;
ALTER TABLE agreements ADD COLUMN countersigned_at TEXT;
ALTER TABLE agreements ADD COLUMN countersign_drawing TEXT;
ALTER TABLE agreements ADD COLUMN countersign_ip TEXT;
ALTER TABLE agreements ADD COLUMN countersign_ua TEXT;
