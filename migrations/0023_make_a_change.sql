-- "Make a change" (2026-11-20, steadfast-ai docs/client-portal-plan.md step 4): the client opens
-- change requests themselves, from the block above the message box.
--   lane   how a request travels: instant (a fact the box writes straight into the site's content
--          file), preview (made, then shown on the preview for the client to approve), daniel
--          (comes to Daniel first).
--   field  for an instant request, the fact that changed: phone | email | hours.
-- site_parts is the site's own named parts (its content file's labels), which the box publishes
-- after each deploy so the block's search can find "Darby rental" or "About us".
ALTER TABLE change_requests ADD COLUMN lane TEXT;
ALTER TABLE change_requests ADD COLUMN field TEXT;
ALTER TABLE projects ADD COLUMN site_parts TEXT;
