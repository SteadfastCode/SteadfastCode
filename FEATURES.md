# FEATURES.md — SteadfastCode workqueue

This file is the ONLY source of automated work for this repo. The Steadfast routine (the
orchestrator in the steadfast-ai repo, `orchestrator/repos/SteadfastCode.json`) picks items from the
top of `## Workqueue Items`, does them in its own worktree, merges them, and moves them to
`## Completed Items` with the merge sha. Priority is file position: move a block to reprioritize.
Ids (`SCS-nnn`) are permanent identity and are never renumbered; the ledger joins on them.

Tags: `[needs-human]` marks an item only Daniel's own sessions may do (anything under `.github/**`
or `ops/routine/**`, anything that changes prices or the agreement's terms, anything needing the
Cloudflare dashboard). `[proposed]` is an item filed from chat or by an audit that waits for Daniel
to promote it. `[priority]` is claimed first; a cloud session files a merge item this way through
the bridge (steadfast-ai `CLAUDE.md`, "Cloud branches and go-live").

There is no backlog-audit item here on purpose (2026-11-03): the routine does only what is filed.

## Workqueue Items



- [x] **(SCS-003) Readable scripts: admin/inbox.astro, admin.astro, client.astro**
  Rewrite the dense inline scripts in src/pages/admin/inbox.astro (about 7.6 KB),
  src/pages/admin.astro (the inline one, about 4.7 KB) and src/pages/client.astro (about 3 KB) into
  readable, commented code. admin.astro and client.astro share the intake form; keep anything they
  share in one place.
  Rule (Daniel 2026-11-18, now in CLAUDE.md "Rules that override taste"): code is written to be
  read: plain names, one statement per line, comments that say why, never hand-minified; the build
  minifies. Prefer Astro processed <script> (bundled + minified; TypeScript is fine) over is:inline.
  Keep is:inline only where a script must run in place (before paint, html.js for the reveal rule)
  or uses define:vars, and write it just as readably. Behavior must not change: same IDs, same
  events, same text, same fetch calls. Watch test/perf.test.js: the 6 KB inline-script cap and the
  200 KB page budget (Astro may inline a small processed script; check the built page). Verify: yarn
  gate, then drive each rewritten page in Playwright (desktop and phone width, both themes) through
  every control the script touches, with no page errors. Prior art: the client template
  ContactForm.astro and Base.astro rewrites (steadfast-ai 791bd6d).

- [ ] **(SCS-004) Readable scripts: contact.astro, Base.astro, SpeedProof.astro**
  Rewrite the dense inline scripts in src/pages/contact.astro (the form ladder's client side; keep
  the mail-app fallback), src/layouts/Base.astro (the theme pin and the html.js line must stay
  is:inline in <head> but written readably; the 530- and 661-char one-liners) and check
  src/components/SpeedProof.astro, which is already mostly readable.
  Rule (Daniel 2026-11-18, now in CLAUDE.md "Rules that override taste"): code is written to be
  read: plain names, one statement per line, comments that say why, never hand-minified; the build
  minifies. Prefer Astro processed <script> (bundled + minified; TypeScript is fine) over is:inline.
  Keep is:inline only where a script must run in place (before paint, html.js for the reveal rule)
  or uses define:vars, and write it just as readably. Behavior must not change: same IDs, same
  events, same text, same fetch calls. Watch test/perf.test.js: the 6 KB inline-script cap and the
  200 KB page budget (Astro may inline a small processed script; check the built page). Verify: yarn
  gate, then drive each rewritten page in Playwright (desktop and phone width, both themes) through
  every control the script touches, with no page errors. Prior art: the client template
  ContactForm.astro and Base.astro rewrites (steadfast-ai 791bd6d).

## Proposed

## Blocked Items

## Completed Items

- [x] **(SCS-002) Readable scripts: admin/care.astro and admin/usage.astro** (routine 2026-11-19, daca659)
  Rewrite the dense inline scripts in src/pages/admin/care.astro (about 9.6 KB, 27 long lines) and
  src/pages/admin/usage.astro (about 8.9 KB, 19 long lines) into readable, commented code.
  Rule (Daniel 2026-11-18, now in CLAUDE.md "Rules that override taste"): code is written to be
  read: plain names, one statement per line, comments that say why, never hand-minified; the build
  minifies. Prefer Astro processed <script> (bundled + minified; TypeScript is fine) over is:inline.
  Keep is:inline only where a script must run in place (before paint, html.js for the reveal rule)
  or uses define:vars, and write it just as readably. Behavior must not change: same IDs, same
  events, same text, same fetch calls. Watch test/perf.test.js: the 6 KB inline-script cap and the
  200 KB page budget (Astro may inline a small processed script; check the built page). Verify: yarn
  gate, then drive each rewritten page in Playwright (desktop and phone width, both themes) through
  every control the script touches, with no page errors. Prior art: the client template
  ContactForm.astro and Base.astro rewrites (steadfast-ai 791bd6d).
- [x] **(SCS-001) Readable scripts: admin/leads.astro** (routine 2026-11-19, 7194eba)
  Rewrite the dense inline script in src/pages/admin/leads.astro (about 21 KB, 44 lines over 140
  chars) into readable, commented code. It's the biggest one, so it gets its own item; split it into
  named functions by job (loading, rendering rows, editing, filters).
  Rule (Daniel 2026-11-18, now in CLAUDE.md "Rules that override taste"): code is written to be
  read: plain names, one statement per line, comments that say why, never hand-minified; the build
  minifies. Prefer Astro processed <script> (bundled + minified; TypeScript is fine) over is:inline.
  Keep is:inline only where a script must run in place (before paint, html.js for the reveal rule)
  or uses define:vars, and write it just as readably. Behavior must not change: same IDs, same
  events, same text, same fetch calls. Watch test/perf.test.js: the 6 KB inline-script cap and the
  200 KB page budget (Astro may inline a small processed script; check the built page). Verify: yarn
  gate, then drive each rewritten page in Playwright (desktop and phone width, both themes) through
  every control the script touches, with no page errors. Prior art: the client template
  ContactForm.astro and Base.astro rewrites (steadfast-ai 791bd6d).
