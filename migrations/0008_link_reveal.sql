-- Client links Daniel can copy again later (2026-11-02): the link, encrypted with AES-GCM under the
-- LINK_KEY secret on the Pages project. The database alone never holds a usable link; token_hash
-- stays the lookup. Links made before this have no copy and show "make a new one".
ALTER TABLE client_links ADD COLUMN token_enc TEXT;
