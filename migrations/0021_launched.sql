-- Launch (2026-11-20): the day Daniel pressed Launch on the project. It is what "launched" means
-- everywhere: the box takes the site out of preview mode (lets search engines in, marks
-- project.json launched) when it's set and puts it back when it's cleared, and the client's portal
-- switches to its after-launch view. A project's status goes to 'live' with it and comes back to
-- 'live', not 'preview', after a rebuild. NULL means not launched.
ALTER TABLE projects ADD COLUMN launched_at TEXT;
