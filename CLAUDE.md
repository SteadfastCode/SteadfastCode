# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

The public website for **Steadfast Code** — `https://steadfastcode.tech` — Daniel Ecker's web design,
local SEO/GEO and software shop in Lititz, PA. Rebuilt 2026-10-27 from the Vue + Vuetify "coming soon"
page (LeoAI waitlist) into the shop's real site. Its job: sell a small-business owner on having Daniel
build their site, by being the demonstration (fast, honest, prices posted) and by making it easy to
start a project. The business and marketing plan behind it is `docs/business-plan.md`; the evidence is
under `docs/research/` and `docs/hosting.md`.

## Stack

- **Astro 7, static output**, `build.format: 'file'` (so `/websites` is `dist/websites.html` and the
  canonical matches the served URL on both GitHub Pages and Cloudflare Pages), one layout
  (`src/layouts/Base.astro`), pages under `src/pages/`, no client framework and no script bundle.
- **`src/data/site.ts` is the single source of the business facts and every price** — tiers, care
  plans, SEO plans, process, FAQ, work, products, benchmarks. Pages render from it; never write a dollar
  figure in a page. `money()` is the one way a price is formatted.
- **`src/lib/schema.ts` is the single source of the JSON-LD**, emitted as one `@graph` per page by the
  layout. Pages pass extra nodes (the `FAQPage`) and a breadcrumb label.
- **`src/pages/llms.txt.ts`** generates `/llms.txt` from the same data at build time.
- **One web font** (Roboto Slab variable, latin subset, self-hosted and preloaded from the layout);
  body text is the system font. The look — navy-to-black gradient, blue-glow cards, orange buttons,
  cyan accents — lives in `src/styles/global.css` and carries over from the original site.
- **`functions/api/contact.js`** is the only server code: a Cloudflare Pages Function that forwards the
  form to a lead intake if `CONTACT_FORWARD_URL` is set, else emails through Resend, else redirects
  with `?sent=0`. On GitHub Pages it does not run; the contact page's inline script sees the 404/405
  and opens the visitor's mail app with the message filled in. Bindings are listed in `.env.example`
  and set in the Pages project, never here.
- **Yarn 4 via Corepack** (`packageManager` in `package.json`, `nodeLinker: node-modules`). `yarn`
  only. `yarn gate` = build + `node --test test/`.

## Hosting and deploy

- **Today: GitHub Pages**, from the `gh-pages` branch, pushed by `.github/workflows/deploy.yml` on
  every push to `main`. **The committed workflow is still the old Yarn 1 one and will fail on this
  repo**; the replacement (Corepack, Yarn 4, `yarn gate` before publishing) is parked at
  `docs/deploy-workflow.yml` because the box's GitHub token lacks the `workflow` scope needed to push
  workflow-file changes. Copy it into place when merging `site-rebuild` into `main` (from a machine
  with full GitHub access, or after `gh auth refresh -h github.com -s workflow` on the box). `public/CNAME` carries the custom domain. DNS for
  `steadfastcode.tech` is at Porkbun (A records to GitHub, `www` CNAME to `steadfastcode.github.io`).
- **Next: Cloudflare Pages** (Daniel's login): connect the repo, build `yarn build`, output `dist`,
  set the Resend binding, add the custom domain, delete the workflow. The apex domain needs the
  zone on Cloudflare: add steadfastcode.tech as a Cloudflare zone, check the imported records
  (MX and SPF/DKIM for support@ especially), then change the nameservers at Porkbun, which stays the
  registrar. Then the form posts for real, `/api/contact` and `/api/hit` exist, and the Steadfast
  Analytics binding (`ANALYTICS` service, `ANALYTICS_KEY`) can be added.

## Rules that override taste

- **Every price comes from `site.ts`.** `test/site.test.js` fails on any `$` figure in a page that is
  not one of its numbers, and checks `/websites`, `/seo` and `llms.txt` show every tier.
- **No third-party requests on any page.** No third-party analytics, no fonts from Google, no embeds, no
  script bundles. The one counter is Steadfast Analytics: an inline beacon posting to this site's own
  `/api/hit` (`functions/api/hit.js`), which hands it to the shared Worker over a service binding.
  Source of truth for the beacon and the function is `~/repos/steadfast-analytics/snippet/`; copy
  changes from there. If what it collects changes, `/privacy` changes in the same commit. `test/perf.test.js` enforces it, along with a **200 KB over-the-wire budget per page**
  (HTML + CSS + font + eager images, gzip-measured) and a 6 KB cap on inline script. The home page
  tells visitors this; keep it true. The LeoAI waitlist is a link to Tally, not an embed.
- **Nothing invented.** No made-up clients, reviews, logos, metrics or "founded in" dates. A case study
  is added to `work` when the site is live and the owner is happy to be shown; its `live` flag gates
  the link. Empty profile fields are not emitted into `sameAs`.
- **Voice.** First person, contractions, American spelling, full easy sentences with the reason given,
  "pretty"/"honestly"/"usually" where true, no hype. The tests fail on British spellings and on a short
  list of hype words. The show-off is in the performance and the motion, not the adjectives.
- **Say how the sites are built.** AI coding tools write most of the code; Daniel designs, directs the
  work and tests the result on real phones, and the test suite gates every build. Never say he reads,
  reviews or fixes the code line by line — he doesn't, and he caught that claim on 2026-10-28. Never "hand-coded", "hand-written", "handcrafted" or "artisan" — Daniel called
  that disingenuous (2026-10-27). "Custom code, not a template" is the honest contrast, and the voice
  test fails on the banned words.
- **The verse is quoted, not paraphrased.** Colossians 3:23 in the footer is the Legacy Standard
  Bible text word for word, from `site.ts`, with the "(LSB)" tag and the Lockman copyright line.
  Daniel's rule (2026-10-27); the test checks every page for the exact string.
- **Honest claims only.** "Built to score 100," not "scores 100," until a Lighthouse run is on record.
  No ranking guarantees anywhere. `llms.txt` is shipped, never sold.
- **Motion is optional.** Reveals, the hero stagger, the drifting glows and view transitions all stop
  under `prefers-reduced-motion`, and `[data-reveal]` only hides itself once the inline script has run
  (`html.js`), so a page with no JavaScript shows everything.
- **The form never silently drops a lead.** Keep the ladder in `functions/api/contact.js` and the
  mail-app fallback on the contact page.

## Verify

```
corepack enable
yarn install --immutable
yarn gate
```

Visual check: `yarn preview --port 4322` and Playwright from the box (`NODE_PATH=$(npm root -g)`), as in
the Mr Dandyman repo. Port 4321 is usually held by that site's preview.

## Decision Log

- **2026-10-27 — Astro static, not Vue + Vuetify.** Daniel asked to keep the look and feel and make it
  "super fast." The look was CSS (gradient, glow cards, orange/blue/cyan, Roboto Slab) and carried
  over; Vuetify was ~300 KB of JavaScript for a page with no interactivity. Pages now ship under 60 KB
  including the font, with zero script bundles.
- **2026-10-27 — Prices posted, from the pricing research.** Starter $1,500, Business $3,900, Growth
  $6,900, Store from $8,500; care $59/$149/$299; audit $500, Local SEO $750, +GEO $1,050. Rationale and
  the local competitor ladder in `docs/business-plan.md` §2 and `docs/research/pricing-benchmarks.md`.
- **2026-10-27 — GitHub Pages stays until the Cloudflare cutover.** Pushing to `main` keeps the site
  live without a credential only Daniel holds; the Function and the mail-app fallback mean the form
  works on either host.
- **2026-10-27 — `format: 'file'`.** GitHub Pages 301s `/websites` → `/websites/` for directory output,
  which would make every canonical point at a redirect. File output serves clean URLs on both hosts.
- **2026-10-27 — No "hand-coded".** The first draft said hand-coded in nine places while also saying AI
  tools make it fast. Daniel: "That is disingenuous." Every page now says AI tools write most of the
  code and he reviews it, and `test/site.test.js` bans the words.
- **2026-10-27 — Live speed proof on the home page.** The numbers are the visitor's own
  (Navigation/Resource Timing), the comparison is the HTTP Archive 2024 median mobile page (2,311 KB),
  and the no-JS fallback text is the figure the perf test enforces. A cached visit says "cached" rather
  than claiming a 2 KB website.
- **2026-10-28 — Steadfast Analytics, our own cookieless counter, not GA4 or a hosted tool.** Daniel
  wanted traffic numbers without Google and asked whether a custom, trustworthy counter was worth
  building as a selling point. It is a Cloudflare Worker + D1 in its own repo
  (`~/repos/steadfast-analytics`): page, linking site's hostname, UTM tags, device size, country,
  and three events (form sent, phone tapped, email tapped). One visitor per day via a hash of a daily
  salt + site + IP + browser; the salt is deleted after the day, IPs and browser strings are never
  stored, 13-month retention. Dashboard at analytics.steadfastcode.tech behind Cloudflare Access.
  Do Not Track / GPC not honored on purpose: they ask not to be tracked across sites or have data
  sold, and this does neither; honoring them would only undercount. Only counts once the site is on
  Cloudflare Pages with the `ANALYTICS` service binding and `ANALYTICS_KEY` set; until then
  `/api/hit` doesn't exist and the beacon's posts go nowhere.
