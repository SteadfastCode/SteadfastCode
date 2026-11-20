-- Needed-assets items take their answer on the card (2026-11-20). Daniel says which inputs an item
-- allows: photos and files are uploaded on the card (uploads.asset_id ties each one to its item;
-- photos also show in the regular Photos section), a link, and a typed answer. A file (a font, a
-- vector, a PSD) is kept for Daniel to download and is never shown as an image or put on the site.
ALTER TABLE assets_needed ADD COLUMN inputs TEXT;    -- JSON list of: photos | files | link | text
ALTER TABLE assets_needed ADD COLUMN link TEXT;      -- the client's link, when the item takes one
ALTER TABLE assets_needed ADD COLUMN answer TEXT;    -- the client's typed answer, when the item takes one
ALTER TABLE uploads ADD COLUMN asset_id INTEGER;     -- the needed item this was uploaded for, or NULL
