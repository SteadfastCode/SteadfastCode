# Hosting for many client sites — options and the recommended stack (2026-10-27)

Prices are from the vendors' own pages fetched on 2026-10-27 unless marked **[unverified]**. The
sub-research on forms/transactional email, managed-WordPress agency programs and site-builder
platforms (Webflow, Framer, Duda, Squarespace Circle, Wix Studio) was cut short by a usage limit, so
those slices are thinner and flagged. `docs/research/cms-options.md` has the full client-editing CMS
comparison.

## What Burk Digital runs, and what "the one we liked" probably was

From their own web-design page: WordPress with **Elementor**, hosted on **Cloudways** (they carry the
Cloudways Agency Partner badge) on **Vultr** cloud servers, with a CDN, and they keep "2 domain name
leases" per client, meaning Burk holds the domains. That is a classic 2020s agency stack: one Cloudways
server per tier, many WordPress installs per server, Elementor templates on top.

**The one you liked was xCloud** (https://xcloud.host, fetched 2026-10-27). It is the same shape as
Cloudways, a control panel plus optional managed servers, with friendlier economics and a wider remit:

- **Bring your own server:** the first server with up to 10 sites is **free, "a free tier, not a
  trial"**; after that $5 per server for 2–5 servers, $4 for 6–10, $3 for 11+, unlimited sites per paid
  server. Connect DigitalOcean, Vultr, Hetzner, Linode, AWS, Google Cloud, Hostinger, Contabo.
- **Managed servers:** from $5/mo (1 GB, 25 GB SSD, 1 TB) through $12 (2 GB), $24 (4 GB), $45 (8 GB) to
  $399 (64 GB); unlimited sites on every plan; automated backups on every paid server.
- **Stack:** NGINX or OpenLiteSpeed, MySQL/MariaDB, ARM servers, staging, caching, team roles,
  white-labelling, bulk migration, multi-client management. **"WordPress-first, not WordPress-only":**
  Laravel, Node.js, Next.js, Docker and **static sites** are supported.
- **Add-ons:** Cloudflare Enterprise CDN $5/domain; mailboxes $1 per 8 GB (free on managed servers);
  transactional mail $3 per 3,000 (100/mo free); Patchstack security $2/site.
- **Reseller panel:** branded control panel from $25/mo (Startup, up to 25 servers) with a +25% or $3
  platform fee per sale on your own infrastructure; lifetime access by paying one or two years up front.
- What is still unverified: who makes it and since when (the site does not say), visit limits on
  managed plans, and what "white-labelling" covers in practice.

**Where it fits for you:** it is the best answer in this document for the *WordPress* clients, cheaper
than Rocket.net at ten sites ($12–24/mo for one managed 2–4 GB server running all of them, or a free
panel over a $12 Vultr box) and with a real panel, staging and backups. It does not change the
recommendation for the static Astro sites: Cloudflare Pages is still free, needs no server to patch,
and serves from the edge rather than from one VPS. If you want everything in one panel, xCloud can
host the static sites too, at the cost of running a server and giving up the edge; I would not.

## 1. Static / Jamstack hosting (what your Astro sites need)

| Host | Price | Limits that matter for an agency | Notes |
|---|---|---|---|
| **Cloudflare Pages** (Free) | $0 | 500 builds/mo, 1 concurrent build, **100 projects per account** (not routinely raised), 100 custom domains per project, 20,000 files per site, 25 MiB per file, no stated bandwidth cap. Functions count against the Workers Free plan (100k requests/day). | Pro $20/mo lifts to 5,000 builds, 5 concurrent, 250 domains. Docs now steer new projects to **Workers Static Assets** (same idea, 500 Workers per paid account); Pages keeps working. Source: https://developers.cloudflare.com/pages/platform/limits/ |
| **Netlify** | Free $0 (300 credits); Personal $9 (1,000); **Pro $20 with unlimited members** (3,000 credits) | Credit-metered since 2025: 15 credits per production deploy, 20 per GB of bandwidth, 2 per 10k requests. Pro top-ups 1,500 credits for $10 (≈ $0.10 per deploy, $0.13/GB). No stated site-count limit. | Fine, but every deploy and every GB is a line item now; 30 small sites × a few deploys a month fits in Pro. Source: https://www.netlify.com/pricing/ |
| **Vercel** | Hobby $0 (**non-commercial only**); Pro $20 per developer seat | Pro: 1 TB transfer, 10M requests, then $0.15/GB. | Great DX, but client sites are commercial, so Pro from day one, and the per-seat model doesn't buy anything a solo shop needs. Source: https://vercel.com/pricing |
| **GitHub Pages** | $0 | Soft 100 GB/mo bandwidth, 1 GB site, public repo on Free; GitHub's terms say Pages is not meant to be a free host for running an online business or e-commerce **[check the current terms before using it for a client]**. No server functions, so no form handler. | Where steadfastcode.tech lives today. Fine for this site; not the right home for client sites. |

**Call:** Cloudflare Pages (or a Worker with static assets, which is the same thing with a newer
name) for every static client site. One project per client, free tier, custom domain on the client's
own registrar, forms through a Pages Function. The 100-project ceiling is three years away at the
rates in the business plan, and Workers has its own, separate limit after that.

## 2. Managed WordPress, for clients who insist

| Host | Entry | 10 sites | 30 sites | Notes |
|---|---|---|---|---|
| **Rocket.net** | Starter $30/mo (1 site, 10 GB, 50 GB bandwidth); $25 annual | **Agency Tier 1 $100/mo** (10 installs, 50 GB, 200 GB) or Business $100 | **Agency Tier 3 $300/mo** (30 installs) | Every plan sits behind Cloudflare Enterprise (330 edge locations, enterprise WAF), unmetered visitors, 30-day money back. The cleanest per-site math here: $10/site. Source: https://rocket.net/pricing/ |
| **Kinsta** | Single site $35/mo ($30 annual) | WP 10 $225/mo ($188 annual) | WP 40 $450/mo ($375 annual); Agency "from $340" | Extra site $30/mo, extra 20 GB $20/mo. Premium support and tooling, priced like it. Source: https://kinsta.com/plans/ |
| **WP Engine** | Essential $28/mo annual (1 site, 25k visits) | "Up to 10 sites" tier (100k visits, 20 GB), price not shown on the page | "Up to 30 sites" tier (400k visits, 50 GB), price not shown | Transferable installs are free to build and hand off, "great for agencies and freelancers." Source: https://wpengine.com/plans/ |
| **Cloudways** (Burk's host) | DigitalOcean 2 GB from **$11/mo** as shown (promo pricing; list is higher) **[verify]** | unlimited apps per server; a 4 GB/8 GB server runs 10 brochure sites | add servers | Cloudflare Enterprise add-on $4.99/domain/mo, SafeUpdates $3/mo. Vultr prices weren't on the page fetched. You manage WordPress yourself. Source: https://www.cloudways.com/en/pricing.php |
| **GridPane** | **Core: free**, up to 25 sites on your own Vultr server | $0 + a Vultr server (~$12–24/mo for 2–4 GB **[unverified]**) | PeakFreq managed from $19/mo | Guidance: 15–20 cached brochure sites on 2 GB, 30–40 on 4 GB. You are the sysadmin. Source: https://gridpane.com/pricing/ |
| **xCloud** (the one you liked) | BYO server: **free** for 1 server / 10 sites; managed from $5/mo | one managed 2–4 GB server, $12–$24/mo, unlimited sites; or free panel + ~$12 Vultr box | one 8 GB server $45/mo, or two servers + $5 panel fee | Panel + managed hosting in one; NGINX/OLS, staging, backups, white-label, reseller panel from $25. Also runs static, Node, Laravel. Source: https://xcloud.host/pricing/ |
| Hostinger agency, Pressable, Flywheel, 20i, Nexcess | not fetched (Hostinger's agency page 404'd) | | | Fill in if a client's budget forces it. |

**Call:** if a client genuinely needs WordPress (an existing plugin ecosystem, a team used to it), put
them on **xCloud** (one managed 4 GB server for the first ten, $24/mo) and charge the Cared-for plan or
above, because WordPress is where the monthly support time actually goes. Rocket.net is the
alternative if a client wants a big-name host behind Cloudflare Enterprise and will pay for it. Don't run your own servers for client WordPress at this scale; the 3 a.m.
problems are yours and the margin isn't there.

## 3. VPS plus a control panel

GridPane Core (free) or RunCloud/Ploi/CloudPanel on a $12–24 Vultr or Hetzner box is the cheapest
way to host 20 WordPress sites, and the most expensive in your attention. For static Astro sites it
buys nothing over Cloudflare's free tier. Skip it unless you want a hobby.

## 4. Client-editable content (summary of `docs/research/cms-options.md`)

- **Default: Sveltia CMS.** Free, modern, mobile-friendly editor over the Markdown and images in each
  client's repo. One shared authenticator Worker on Cloudflare (free). Editors need a GitHub account
  with write access to their repo; for a client who refuses, **Decap + DecapBridge** ($9/mo flat for
  unlimited sites) gives email/Google login with the same config file. Still beta (1.0 "late 2026"),
  one maintainer.
- **When a client needs click-to-edit: TinaCMS.** Visual editing on Astro, email login, free for you
  plus one editor per site; a second editor is $29/mo for that site.
- **When content must publish without a rebuild (rare for these clients): Sanity** on its free tier.
- Everything else (Storyblok, Contentful, Payload, Directus) is either enterprise-priced per site or
  needs a server you'd have to run.

## 5. Forms, email and mailboxes

- **Forms:** a Cloudflare Pages Function per site (the pattern in `functions/api/contact.js` and in
  mrdandyman-site), forwarding to Front Desk when that is hosted, else emailing through Resend, else
  failing loudly. No third-party form widget, no JavaScript dependency.
- **Transactional email: Resend.** Free: 3,000 emails/mo, 100/day, **3 domains**, 30-day logs. Pro
  $20/mo: 50,000/mo, 10 domains, no daily cap. Source: https://resend.com/pricing . Sending from one
  Steadfast Code domain with the client's address as reply-to keeps every client on the free tier;
  sending from each client's own domain needs Pro at the fourth client.
- **Client mailboxes** (Google Workspace vs Proton vs Zoho) were not researched; recommend Google
  Workspace Starter for most businesses on cost-of-support grounds, and keep mail hosting out of the
  care plans entirely: the client pays the provider directly and you set up the DNS.

## 6. Why not the box in the basement

The steadfast-ai box is on a residential connection with no SLA, a single power supply, a history of
silent full-system deaths, and a Tailscale-only network by design. A client's site has to stay up
when the house loses power or the ISP hiccups, has to be served from near the visitor, and has to be
something you can hand off to another developer. Cloudflare's free tier does all of that for nothing.
The box stays what it is: your own AI gateway, build machine and routine runner.

## 7. The recommended stack and what it costs

| Layer | Choice | Cost at 10 sites | Cost at 30 sites |
|---|---|---|---|
| Code | one private repo per client in the SteadfastCode GitHub org, Astro 7, the same tests as this site | $0 | $0 |
| Hosting | Cloudflare Pages / Workers static assets, one project per client, client's domain | $0 | $0 (100-project ceiling is far off) |
| Forms | Pages Function + Resend, one sending domain | $0 | $0–$20/mo |
| Editing | Sveltia (shared auth Worker); Tina or DecapBridge where needed | $0–$30/mo | $0–$90/mo |
| Domains | registered in the client's name at Porkbun or wherever they already are | client pays (~$12/yr) | client pays |
| Monitoring | Cloudflare analytics + a free uptime checker | $0 | $0–$10/mo |
| WordPress exceptions | xCloud managed server (Rocket.net if a client insists on a big name) | $12–$24/mo if any | $24–$100/mo |
| **Total** | | **$0–$55/mo** | **$0–$220/mo** |

Against that, the care plans in `src/data/site.ts` are $59, $149 and $299 a month. Ten clients on the
cheapest plan is $590/mo against roughly nothing in hosting cost; the margin is entirely your time,
which is why Hosted includes only small fixes and the plans above it meter hours. Keep the hosting
line itemized on invoices (Pennsylvania treats hosting as nontaxable; see the business plan).

## 8. What is still unverified

Cloudways' Vultr prices and whether the $11 DigitalOcean figure is a promo; WP Engine's 10- and
30-site tier prices; Hostinger agency, Pressable, Flywheel, 20i; Webflow/Framer/Duda/Squarespace/Wix
client-billing programs; Google Workspace vs Proton vs Zoho; GitHub Pages' current commercial-use
wording; GitHub Free-for-orgs limits on outside collaborators in private repos (matters for Sveltia).
