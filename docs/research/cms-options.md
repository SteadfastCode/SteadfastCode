# CMS options for Astro + GitHub + Cloudflare Pages, solo dev, 10–30 client sites (researched 2026-10-27)

Research subagent report, kept as the evidence behind the "client-editable content" recommendation in
`docs/hosting.md`. Assumptions: one repo/project per client site; 1 dev admin plus 1–2 client editors
per site; low content volume. Official list prices as fetched 2026-10-27 unless marked.

| CMS | Type | Price @1 site | @10 sites | @30 sites | Client editing UX (1–5) | Live vs rebuild | Media | Auth for a client | Lock-in | Sources |
|---|---|---|---|---|---|---|---|---|---|---|
| **Decap CMS** 3.17.3 (26 Oct 2026, MIT) | Git | $0; auth via a Cloudflare Worker OAuth proxy = $0, or DecapBridge Free (3 sites) | $0, or **$9/mo flat** with DecapBridge Pro | $0 / $9 | **3** — proven, dated UI, no mobile layout | Rebuild (commit → Pages build; Free = 500 deploys/mo) | repo folder; Cloudinary/Uploadcare | GitHub account + repo write, or DecapBridge email/Google login | None (Markdown/YAML in repo) | https://decapcms.org/docs/backends-overview/ · https://decapbridge.com/ · https://decapcms.org/turbo/ |
| **Sveltia CMS** v0.253.1 (27 Oct 2026, beta; 1.0 "late 2026") | Git | $0 (self-deployed Authenticator on Workers Free) | $0 (one shared Worker, `ALLOWED_DOMAINS`) | $0 | **4** — modern, fast, mobile, dark mode, i18n, built-in image optimizer (WebP) | Rebuild | repo with optimizer; or R2/S3/Cloudinary | Each editor needs a GitHub account with write access; will **not** support Netlify Identity | None; Decap `config.yml` compatible | https://sveltiacms.app/en/docs · https://github.com/sveltia/sveltia-cms-auth · https://sveltiacms.app/en/docs/media/cloudflare-r2 |
| **Keystatic** (Thinkmill, MIT, "experimental") | Git | $0 GitHub mode; Keystatic Cloud Free up to 3 users/team | $0 with one free team per client (ToS unverified) or ≈$50–$100/mo one team | ≈$150–$300 or $0 | **4** — clean editor, Astro-native | Rebuild | repo; Cloud Images (Pro $10+) | GitHub mode: GitHub account; Cloud: email login | None | https://keystatic.com/docs/cloud · https://docs.astro.build/en/guides/cms/keystatic/ |
| **TinaCMS** (Tina Cloud) | Git + GraphQL | Free: 2 users, 1 project. Team $29/mo (3 users), Team Plus $49, Business $299 — **per project** | $0 if dev + 1 editor/site; $0–$290 if a 2nd editor forces Team | $0–$870 | **4.5** — real click-to-edit on Astro (`@tinacms/astro`), no React needed | Rebuild; visual editing prefers `output:'server'` | Tina Cloud repo media + CDN; 100 MB cap | Easy: Tina Cloud invite, no GitHub account | Low; self-hosted backend exists | https://tina.io/pricing · https://tina.io/docs/frameworks/astro |
| **Sanity** | API | Free: 20 seats, 10k docs, 100 GB assets; Growth $15/seat | $0 if each site is its own Free project (per-org cap unpublished) | $0 or $900 | **4** — polished Studio; Presentation needs SSR | Live (API) | hosted CDN | email/Google login | Medium; JSON export | https://www.sanity.io/pricing |
| **Storyblok** | API | Starter free (1 seat, +$15 2nd); Growth $99 | $0–$150 Starter per site; Growth $990 | $0–$450 / $2,970 | **5** — best visual editor | Live; true preview needs SSR | hosted, 500 MB on Starter | email invite | Medium | https://www.storyblok.com/pricing |
| **Contentful** | API | Free: 1 space, 10 users; Lite ~$300/mo (1 space) | not viable self-serve (Lite caps at 2 spaces) | enterprise only | **3.5** | Live | hosted | email | Medium-high | third-party trackers; official page 429'd |
| **Payload** 3.x (MIT; Figma since Jun 2025; Cloud paused) | API self-hosted | $0 software; one instance serves all clients on a $5–$20 VPS or Workers + D1 + R2 | flat | flat | **4** — data admin, not in-page | Live (REST) or rebuild hook | local/S3/R2 | Payload's own users | None | https://payloadcms.com/get-started · https://docs.astro.build/en/guides/cms/payload/ |
| **Directus** v12 (MSCL; free under $5M revenue) | API | self-host $0; Cloud Core $89/mo (3 seats) | self-host flat; Cloud $990 | Cloud $2,970 | **3.5** — spreadsheet-like | Live | local/S3/R2 | own users | None | https://directus.com/pricing |

**Cloudflare notes:** no first-party CMS. Pages docs now say "Start new projects with Workers" (Pages
still works; Free = 500 deploys/mo). Relevant pieces: a Workers OAuth proxy for Sveltia/Decap (free
tier), R2 as media backend, Payload's official Workers + D1 + R2 template. **Astro Studio** is gone
(sunset 1 Mar 2025); Astro DB continues on libSQL and is not a CMS.

**2025–2026 status changes:** Netlify Identity deprecation reversed 19 Feb 2026, but Git Gateway stays
deprecated (and only works on Netlify-hosted sites anyway). Decap launched paid "Decap Turbo" (Free 1
site; Pro €19/mo). Sveltia 1.0 slipped to "late 2026", single maintainer. Keystatic Cloud priced (Free
3 users/team, Pro $10 + $5/user). Tina Business $599 → $299. Storyblok price change 7 Apr 2026.
Contentful Lite ~$300 cliff. Payload Cloud closed to new projects. Directus BSL → MSCL with v12.

**Recommendation:** **Sveltia CMS** as the zero-cost default (one shared Authenticator Worker,
content stays Markdown/YAML/images in each client repo, modern mobile editor, WebP on upload; fall back
to Decap + DecapBridge at $9/mo flat for a client who refuses a GitHub account). **TinaCMS** when a
client needs click-to-edit visual editing and a plain email login (Free covers dev + 1 editor per
project; a second editor is $29/mo for that site). Keystatic + Cloud is the honorable mention; Sanity
the best API option if live publishing without rebuilds matters.

**Could not verify:** Contentful official pricing (429); Sanity projects-per-org cap; Tina free-project
count and exact monthly prices; Storyblok Starter ToS for paying clients; Keystatic API routes on
Cloudflare's runtime; GitHub Free-for-orgs outside-collaborator limits on private repos; Directus page
inconsistencies.
