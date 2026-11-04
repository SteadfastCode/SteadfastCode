# Routine runbook — SteadfastCode (steadfastcode.tech)

- Setup: `yarn install --immutable`. Verify: `yarn gate` (build + every test, including axe on
  every public page). `CLAUDE.md` is the law here; read it first, and its "Rules that override
  taste" are not negotiable: every price comes from `src/data/site.ts`, nothing invented, no
  third-party request on any page, the voice rules, the verse quoted exactly.
- Pushing `main` deploys the site through Cloudflare Pages. There is no deploy step of your own
  and nothing to smoke beyond the gate; the merge is the release.
- A migration under `migrations/` goes into the `steadfast-intake` D1 database BEFORE the merge
  that ships the code reading it, with the token in `~/.config/steadfast-ai/cloudflare.env`:
  `set -a; . ~/.config/steadfast-ai/cloudflare.env; set +a` then
  `~/repos/steadfast-analytics/node_modules/.bin/wrangler d1 execute steadfast-intake --remote --file migrations/<file>.sql`.
  Only additive migrations (new columns with defaults, new tables, value renames) run unattended;
  anything that drops or rewrites a column is a needs-human item.
- A merge item (title "Merge cloud branch claude/…") is a merge, not an implementation:
  `git merge --no-ff origin/<branch>` into your worktree branch, run the branch's checklist under
  `docs/go-live/` step by step with its checks, then verify, PR and merge as usual. Delete the
  checklist file on `main` once its post-merge checks passed, in a follow-up commit.
- Never change a price, a care-plan term or the agreement text (`src/data/agreement.ts`) on your
  own; those items are Daniel's. Never touch `public/_headers`, `public/robots.txt` or the Access
  settings. `functions/api/contact.js` keeps its ladder: a form that silently drops a lead is the
  one failure this site must never have.
- The admin pages (`/admin`, `/admin/leads`, `/admin/usage`) and the client page are tools behind
  Cloudflare Access or a private link, excluded from the public-page tests; their own tests cover
  them. Anything that changes what the leads board or the intake stores needs a migration and a
  test against the in-memory D1 stand-in in `test/leads.test.js`.
