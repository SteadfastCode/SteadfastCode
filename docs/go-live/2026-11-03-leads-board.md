# Go live: the leads board at /admin/leads

Branch `claude/amazing-cerf-iwy9bb`, built in a cloud session on 2026-11-03. One code commit on top
of `main` plus this checklist. Open the PR from
https://github.com/SteadfastCode/steadfastcode/pull/new/claude/amazing-cerf-iwy9bb if it is not
open yet. What it ships: the outreach board (`CLAUDE.md` → "The leads board"), a migration that
widens `leads`, a Leads tab in the admin header, Start a project from a lead marking it Won, and
`POST /api/leads/inbound` for Front Desk. Every step below is a box step unless it says otherwise.

## 1. Before the merge: the migration (box only, needs the Cloudflare token)

The merge deploys code that reads the new columns, so the migration goes first. It is additive
(columns with defaults, a new table, `started`→`won` and `closed`→`lost`), so the live site keeps
working between this step and the merge.

```bash
cd ~/repos/SteadfastCode && git fetch origin
git show origin/claude/amazing-cerf-iwy9bb:migrations/0011_outreach.sql > ~/.cache/0011_outreach.sql
set -a; . ~/.config/steadfast-ai/cloudflare.env; set +a
~/repos/steadfast-analytics/node_modules/.bin/wrangler d1 execute steadfast-intake --remote --file ~/.cache/0011_outreach.sql
```

If migrations 0001–0010 went in another way (the D1 console in the Cloudflare dashboard, or the
HTTP API the build service uses), use that; the SQL is the same file.

Check:

```bash
~/repos/steadfast-analytics/node_modules/.bin/wrangler d1 execute steadfast-intake --remote --command "SELECT kind, status, COUNT(*) AS n FROM leads GROUP BY kind, status; SELECT COUNT(*) AS touches FROM lead_touches;"
```

Every existing lead reads `inbound`; statuses are only `new`, `won` or `lost`; `lead_touches`
answers 0. A second run of the migration fails on `ALTER TABLE` (the columns exist), which is fine.

## 2. The merge

Merge the PR with a merge commit (`gh pr merge <n> --merge --delete-branch`), or from the box:

```bash
cd ~/repos/SteadfastCode && git checkout main && git pull --ff-only && git merge --no-ff origin/claude/amazing-cerf-iwy9bb && git push origin main
```

Pushing `main` deploys through Cloudflare Pages. Wait for the deployment to finish (the Pages
dashboard, or `wrangler pages deployment list --project-name steadfastcode`).

## 3. After the deploy: checks (from a browser, signed in through Access)

- https://steadfastcode.tech/admin/leads loads. The header reads Intake · Leads · Usage. The
  contact-form leads are on the board tagged "Came to us". No error line at the top.
- Open one lead, add a log entry ("Emailed", any text): the status moves to Contacted and the
  entry shows in the log. Change it back from the Details form if you like.
- Import → "Load the research list (24 new)" adds the organizations from the research; a second
  press says nothing new to add.
- https://steadfastcode.tech/admin still lists new contact-form leads under "Came to us" with
  Start from this; starting one opens the intake with its fields filled and marks it Won on the
  board.
- `curl -s -o /dev/null -w '%{http_code}\n' -X POST https://steadfastcode.tech/api/leads/inbound`
  answers 404 until `LEADS_INBOUND_SECRET` is set (step 5), never 500.

## 4. The lead research from the box

Import it on https://steadfastcode.tech/admin/leads#import: CSV with a header row (any of
`business, contact, role, email, phone, website, town, category, kind, fit, status, nextStep,
nextAt, source, why, notes`) or a JSON array. Do not commit it to this repo: it is public.

## 5. Optional, whenever Front Desk is ready to post

Set `LEADS_INBOUND_SECRET` on the Pages project (Settings → Variables and Secrets, production;
`openssl rand -base64 32` is a fine value) and give Front Desk the same value. Then:

```bash
curl -s -X POST https://steadfastcode.tech/api/leads/inbound -H "authorization: Bearer <secret>" -H "content-type: application/json" -d '{"name":"Test","email":"test@example.com","message":"Go-live test","sourceDetail":"front-desk: test"}'
```

answers `{"id":"…"}` with 201, the lead shows on the board as "Came to us", and Delete on its page
takes it off again.

## Rollback

Revert the merge commit on `main` (`git revert -m 1 <merge sha>` and push); Pages redeploys. The
migration can stay: the old code ignores the extra columns, and its "From a contact form" list
reads `status = 'new'`, which the migration leaves alone.

## Last

When every check above passed, remove this file on `main` so `docs/go-live/` only lists what is
still waiting:

```bash
cd ~/repos/SteadfastCode && git rm docs/go-live/2026-11-03-leads-board.md && git commit -m "Go-live done: the leads board" && git push origin main
```
