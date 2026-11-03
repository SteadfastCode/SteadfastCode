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

## Proposed

## Blocked Items

## Completed Items
