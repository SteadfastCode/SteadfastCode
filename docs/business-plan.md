# Steadfast Code — websites, local SEO/GEO and software: business and marketing plan

Written 2026-10-27 alongside the site rebuild. The evidence is in `docs/research/` (pricing benchmarks,
Search Atlas vs. a DIY stack, marketing channels, CMS options) and `docs/hosting.md`. Prices on the live
site come from one file, `src/data/site.ts`; change a number there and every page, the structured data
and `llms.txt` follow.

## 0. The short version

**What we're selling.** Very fast custom websites, built with AI coding tools and tested on real phones by Daniel, at fixed, posted prices, launched in
weeks; monthly care plans; honest local SEO with GEO (AI-answer visibility) bundled in; custom software
where it fits. Sold first to small businesses, churches and nonprofits in Lancaster County, remotely to
anyone.

**Why it works.** Nobody in the local market promises a custom site in under three weeks; the small
shops that post prices sit at $1,500–$3,800 for five pages and the agencies start at $8,000; most of
the sites around here are slow WordPress templates with a monthly fee attached to keep them. AI-assisted
development makes the fast, custom, fairly priced version possible for one person with a day job, and
the site itself demonstrates the product (every page is under 60 KB and loads in well under a second).

**Decisions made while building, all reversible in one file.** Prices (below). Astro static rebuild
keeping the original dark glow look (Vue + Vuetify was the old framework; the look was CSS, so it
carried over; the framework change is what makes the pages this small). GitHub Pages stays the host
until the Cloudflare cutover. No Search Atlas. GEO sold as a line inside local SEO, not a standalone.
`llms.txt` shipped because it's free, never sold as a lever.

**Decisions that are yours** (details in §9): the sales-tax question with a CPA; whether to offer a
pay-monthly option; the business email address and whether a phone number goes on the site; the
discount for churches and nonprofits; which hosting provider you liked at Burk; insurance; the entity
and fictitious name.

## 1. Positioning

- **One developer, in Lititz.** You talk to the person who builds it, and the same person afterward.
- **Custom code, built with AI in the open, and fast.** No templates, page builders or plugin sprawl. The
  site says plainly that AI tools write most of the code and Daniel directs the work and tests the result on real phones;
  "hand-coded" is off the table as disingenuous (Daniel, 2026-10-27). Built to score 100 on Google's
  checks; the home page measures itself live against the 2.3 MB median website.
- **Prices posted.** Same stance as Mr Dandyman: "I hate that it's hard to find rates online." Locally,
  only the small shops and the subscription sellers post prices, so precision matters: exact numbers,
  exact scopes, no "$125 in the text, $165 in the table."
- **Yours outright.** Domain in the client's name, code in a repo they can take, nothing that stops
  working if they leave. This is the direct counter to the all-inclusive-monthly model (Burk, Berks
  County, Noble) and the same ground WebTek is fighting on ("hold your website hostage").
- **Honest SEO.** No auto-generated posts, no link schemes, no ranking guarantees, a plain-English
  report every month. You've seen the shortcuts up close; say so (the SEO page does).
- **Faith, shown not shouted.** Burk already owns "Kingdom centric business owners" in Lititz; competing
  for that phrase invites a price comparison with a cheaper monthly number. Colossians 3:23 is in the
  footer, churches get a straight answer and a discount, and the values show in how the work is done.
- **Voice.** Your voice (see the memory note `daniel-voice`): full easy sentences, the reason given,
  "pretty" and "honestly" where true, American spelling, no hype. The tests fail on British spelling
  and on a short list of hype words.

**Who first.** Trades and home services (you are one, you know the room), restaurants and shops in the
Lititz/Ephrata/Manheim corridor, professional services (CPAs, attorneys, agents, who are also referral
partners), and churches and small nonprofits (long sales cycle, strong referrals, grant money exists
for "marketing plans" through the Community Foundation, though not for religious causes).

## 2. Offers and prices

### Websites (one-time, fixed price for a stated scope)

| Tier | Price | Scope | Usual time to launch | Where it sits locally |
|---|---|---|---|---|
| Starter | **$1,500** | one long-scroll page, form, GBP set up, search basics, 30 days of fixes | about a week | Burk one-pager $1,500 (+$55/mo); Webflow freelancers $800–$2,500 |
| Business | **$3,900** | up to 6 pages, copy and photo help, local SEO foundation, forms that never drop a lead, handoff call, two revision rounds | 2–3 weeks | Rachel Kline $3,800; RedX $4,000–$5,000; Seva $3,000; Burk $3,000 + $85/mo; WebTek $3,500+; WebFX $8,000 |
| Growth | **$6,900** | up to 15 pages, client-editable CMS, blog with a 3-month content plan, integrations, WCAG 2.1 AA pass, enforced performance budget | 3–5 weeks | WebTek "many projects" $3,500–$12,000; DesignRush 5–15 pages with CMS $10,000–$15,000 |
| Online store | **from $8,500** | Growth plus Shopify or a headless store, products, checkout, shipping and tax, training | 4–6 weeks | Burk $5,500 + $165/mo; RedX from $6,000 + $125/mo; national $6,000–$15,000 |

Why these numbers: the research puts the band a Lancaster County owner reads as "a real business, not
a side hustle, not a Harrisburg agency" at $3,500–$6,500 for a five-page site. Business at $3,900
lands in it, above the $1,500 Keystone lane and well under the agencies. Effective rates, assuming
AI-assisted builds: Starter ~6–8 hours of your time (≈ $190–$250/h), Business ~14–20 h (≈ $200–$280/h),
Growth ~25–35 h, Store ~35–45 h. That is a fair price for the outcome and a very good hourly rate for
you; it is not gouging because the client pays less than the next tier of competitor for a better
site, and it is not pennies because the speed advantage is priced as value, not discounted as hours.

Terms: 50% to start, 50% at launch; two revision rounds included; a project pauses after 14 days of
client silence; the site goes live and the code transfers on final payment; the domain is always in
the client's name. Anything past the tier's scope is quoted before it is built.

### Hosting and care (monthly, cancel any month)

| Plan | Price | What it is | Your time |
|---|---|---|---|
| Hosted | **$59** | Cloudflare edge hosting, SSL, backups, uptime monitoring, DNS and renewal reminders, form delivery, Steadfast Analytics dashboard, security updates, small fixes by email | ~15 min/mo |
| Cared for | **$149** | + up to 1 hour of changes, monthly report, GBP kept current with one post, two-business-day turnaround | ~1.25 h/mo |
| Growing | **$299** | + up to 3 hours including new pages, one content piece a month, quarterly review call, local SEO upkeep | ~3.5 h/mo |

Hosting cost is roughly zero (see `docs/hosting.md`), so these are priced on time and on the local
cluster: $50–$55 basic plans (Keystone, Seva) and $150–$260 with labor (WebTek, Seva, Rachel Kline).
Hosted at $59 is above the "free hosting with unlimited edits" floor on purpose: unlimited edits for
$55 is how a solo shop drowns. A client can decline all three and get free hosting set up at launch;
the FAQ says so, because it's true and it sells trust.

### SEO and GEO

| Offer | Price | Scope |
|---|---|---|
| Site & search audit | **$500 once** | technical crawl, local presence, content gaps, what the AI assistants say about them, a prioritized plan; credited back if they start a plan within 60 days |
| Local SEO | **$750/mo** | GBP managed, citations, review system, one real content piece a month, on-site fixes, monthly report |
| Local SEO + GEO | **$1,050/mo** | + monthly AI-visibility check across ChatGPT, Gemini, Perplexity and AI Overviews, entity consistency, two content pieces, earned mentions, quarterly call |

Local SEO at $750 sits between Keystone ($600) and Burk ($900), under the Ahrefs freelancer average
($1,150). GEO is a $300 line on top, which matches what the research found honest agencies doing
(bundling it; standalone GEO under $1,500/mo reads as fake). Budget ~6–8 hours a month per Local SEO
client and $15–$30/client in tools. Never promise a ranking; promise the work and the report.

### Software

Quoted per project after a scoping call, as a fixed price for a stated scope. Small tools start in the
low thousands. The products (LeoAI, Front Desk, Plumb) are on the site as proof, with honest status
labels.

### Discounts and options for you to decide

- **Churches and nonprofits:** 40% off builds (Daniel's decision, 2026-10-28), no discount on care or
  SEO plans because those are priced on hours. Two guardrails: cap it (say, two discounted builds a
  quarter) so ministry work doesn't crowd out the full-price work that funds it, and quote the
  discounted figure as the price, not as a negotiation that can go lower.
- **Pay-monthly option (not on the site yet).** Three local competitors sell websites as
  subscriptions, and cash flow is the most common reason a small business doesn't start this quarter.
  If you want it: Business as **$329/mo for 12 months** with the Hosted plan included, ownership
  transfers at month 12, then $59/mo. Total $3,948, so the client pays about the same as the one-time
  price and you carry the financing. Risks: you front ~$3,900 of work per client; needs a signed
  12-month agreement, card on file, and an early-exit clause (remaining months due). Keep the one-time
  price as the default so WebTek's "hostage" attack never lands on you.
- **Referral fee:** 10% of the first invoice, paid within 7 days of client payment, to any partner who
  sends a client.

## 3. Delivery stack

Full detail in `docs/hosting.md`. Cloudflare Pages confirmed as the host (Daniel, 2026-10-28). In one paragraph: one private repo per client in the SteadfastCode
GitHub org; Astro 7 static; the same test gate as this site (prices from one data file, no third-party
requests, a page-weight budget, JSON-LD checked at the source); Cloudflare Pages (or a Worker with
static assets) per client on the client's own domain; a Pages Function for forms that forwards to
Front Desk when hosted, else emails through Resend, else fails loudly; Sveltia CMS for clients who edit
their own copy, TinaCMS when they need click-to-edit; xCloud (the host you liked at Burk: a control
panel plus managed servers, free for one server and ten sites, $12–$24/mo for a managed server running
unlimited sites) for the rare client who truly needs WordPress; never the basement box. Hosting cost
at 30 sites is between $0 and about $220 a month, nearly all of it optional.

## 4. SEO and GEO: the decision

**Search Atlas: no.** The shortcuts weren't bugs; they're the product. The 5–100-article bulk content
queue, the automated 2:1 link exchange, the "13 cloud stacks a month" SOP and automated press releases
map almost word for word onto Google's scaled-content and link-spam policy examples. The 2026 one-star
reviews ("AI-generated nonsense," "injects spam onto your site," "completely broke multiple client
sites") show the pattern survived the October 2025 overhaul. The marketing page says autopilot is the
default; the help center says approval is. The pixel injects client-side JavaScript that ChatGPT and
Perplexity crawlers never execute, which is pointless on a static site that ships correct HTML, and it
all vanishes when the subscription stops. Refunds only within 48 hours and under 10% usage. The one
argument for it is that you know the interface.

**When it could be worth a look:** four or more WordPress clients who are already on the plugin and
want bulk meta/alt-text cleanup, on Pro ($399) with approval mode verified on, never the content
queue, never Cloud Stacks or WILDFIRE, never the pixel on an Astro site, virtual card, everything
exported. Below six clients the DIY stack is cheaper and cleaner.

**DIY stack.** Lean (5–8 clients) ≈ **$130–175/mo**: Search Console, GA4, Bing Webmaster Tools, GBP and
Looker Studio (free); SE Ranking Core on annual ($103, includes 100 GEO prompts a day); Local Falcon
Starter ($25) for geo-grid rank reports; Ahrefs Free/Starter ($0–29); Screaming Frog free tier (our
sites are under 500 URLs); JSON-LD written into the templates. Comfortable (10–20 clients) ≈ $600–900/mo adds
BrightLocal Track, Ahrefs Lite, an AI-visibility tool (Otterly or Peec) and AgencyAnalytics or DashThis
for client dashboards.

**What GEO honestly is for a local business** (the evidence is in `docs/research/seo-geo-tooling.md`):
the business website and the Google Business Profile account for ~70% of local AI citations, Yelp
~10%; mentions on third-party sites matter more than links; ChatGPT recommends about 1% of local
locations; results swing run to run. So the work is: the same facts everywhere assistants read,
structured data in the HTML, pages that open with the answer, specific content about real jobs, earned
local mentions, and measuring by asking the assistants every month. `llms.txt` has no demonstrated
effect (Google calls it speculative; a 300k-domain study found no correlation); we ship it because it
costs nothing and never claim it does anything.

**The monthly report** (one Looker Studio template, built once): calls, direction requests, website
clicks and form fills from GBP; impressions, clicks and top queries from Search Console; a 5×5
geo-grid for the three money keywords; what three AI assistants answered to five customer-style
prompts, with last month alongside; what was done; what's next. In English.

## 5. Marketing and ad plan

The evidence and the full channel table are in `docs/research/marketing-channels.md`. The constraints:
a full-time job, a few evening and weekend hours, $300–$1,000 a month, and a market where paid search
for "web design" runs $6–$20 a click. The conclusion: the first ten clients come from relationships and
outreach, and paid media sets the pace for clients ten to twenty.

### Channels, in priority order

1. **The site itself** (done): proof on the home page, prices posted, a form that never drops a lead,
   case studies as they come. Next: a "60-second site check" page (enter a URL, get a PageSpeed and
   mobile report plus three plain-English fixes) as the ad landing page and the outreach hook.
2. **Google Business Profile** as a service-area business (hide the address; "Website designer"
   primary, "Internet marketing service" and "Marketing agency" secondary; service areas Lititz,
   Lancaster, Ephrata, Manheim, Lebanon, York, Harrisburg, Hershey, Reading). Ask every client for a
   review at launch and at 60 days. Post weekly: before/after, speed scores, a finished site.
3. **Referral partners** at 10%: two photographers, two printers or sign shops, two bookkeepers or
   CPAs, an insurance agent, a business attorney, an IT shop, a marketing freelancer who doesn't build.
   Ten coffees in the first six weeks, a one-page written offer.
4. **Lancaster Chamber** ($550/yr): Monthly Mixers and Get Connected are evening-friendly; roughly 80%
   of members are small businesses. Northern Lancaster County Chamber (Ephrata, covers Lititz) for the
   Business Expo; SCORE for a free mentor and a workshop slot ("what a small-business website should
   cost in 2027"); ASSETS for new-business cohorts; Venture Lititz by volunteering, not membership.
   BNI and Rotary wait for year two unless a chapter meets at 7 a.m. near Lititz.
5. **Personal video audits by email**, ten a week: a 90-second screen recording of their site on a
   phone, the PageSpeed score, two concrete fixes, an offer to show a sketch. 10–16% reply rates
   against 4% for plain cold email. CAN-SPAM rules: real headers, your postal address, opt-out honored
   within ten business days. **No cold texting** (TCPA, and Pennsylvania SB 992 since October 18, 2026
   counts texts as telephone solicitation, requires written consent, bans Sundays and 7 p.m.–9 a.m.).
6. **Google Search ads**, after there are three case studies: exact and phrase match on local terms
   ("web design lancaster pa", "website designer lititz", "small business website lancaster"), geo
   to Lititz/Lancaster/Ephrata/Manheim, negatives for jobs/course/free/template, landing on the site
   check page. Expect $75–$300 per raw lead; $300/mo is a learning budget, $800–$1,500/mo buys 3–6
   qualified leads. Local Services Ads has no category for this work.
7. **Meta** at $5–$10/day for retargeting site visitors with a before/after video, plus one lead-form
   campaign a month. Cheaper leads, lower intent.
8. **Content** for the long tail: "what a Lancaster County small-business website costs in 2027,"
   "church website checklist," per-industry pages (a plumber's site, a restaurant's site), each
   written from a real build. Local SEO for the shop's own site takes 3–9 months; start now.
9. **Churches and nonprofits**: the county directory, two early sites done at a discount as case
   studies, the Community Foundation's capacity-building grants for nonprofits.
10. Skip or minimal: Thumbtack/Bark (leads go to five pros and want same-hour replies), LinkedIn ads
    (~$200 per lead), paid Clutch/DesignRush tiers (built for ten-person agencies). Claim the free
    profiles for the citations.

### 90 days

- **Days 1–14:** entity and fictitious-name filing, CPA call on sales tax, insurance bound, contract
  template adopted, GBP created, free profiles claimed, email tool with the postal address, the site
  check page built, the first two case studies lined up (Mr Dandyman once MDS-001 cuts over, plus one
  church or nonprofit at a discount).
- **Days 15–45:** Chamber joined and two events attended, SCORE mentor requested, ten referral
  coffees, video audits started at ten a week, first client reviews asked for.
- **Days 46–90:** Google Search test at $300–$500/mo for 45 days, Meta retargeting at $5/day, two
  articles published, weekly GBP and LinkedIn posts, first speaking slot. Target by day 90: 4–6
  signed clients, two partners who have each sent a lead, five GBP reviews.

### Budget

| Line | $300/mo track | $1,000/mo track |
|---|---|---|
| Google Search ads | $2,400 (8 months after a 4-month organic start) | $8,400 |
| Meta | $600 | $3,600 |
| Lancaster Chamber (+ Northern Lancaster County, estimate) | $900 | $900 |
| Insurance (GL + tech E&O) | $1,450 | $1,450 |
| Fictitious name, tools, workshops, co-working passes | $820 | $2,170 |
| Referral fees (10% of first invoices) | $1,200 | $1,800 |
| BNI | $0 | $1,800 (only if a morning chapter fits) |
| **Year one** | **~$7,400** | **~$20,100** |
| Expected signed clients in 12 months | 10–14 | 16–24 |

### Creative that fits the positioning

The pitch is a demonstration, not an adjective. Side-by-side phone recordings of their site and a
rebuilt page loading. The live stats block from the home page as a 15-second clip. A before/after
with the numbers under it (KB, seconds, Lighthouse). "Prices posted" as a headline, because nobody
else's are. Case studies with measurements and the owner's own words.

## 6. Compliance and admin

- **Sales tax.** Pennsylvania's treatment conflicts across sources: CPA summaries of the Department of
  Revenue's late-2024 guidance say website development is taxable "if the site is transferred to the
  customer," while a PA web firm cites DOR answers calling it non-taxable; hosting is non-taxable in
  every source. Transferring the site to the client is exactly our model and the most exposed one.
  **Get a written CPA opinion and, if advised, a sales tax license before the first invoice.** The FAQ
  on the site already says tax is added on top where it applies and will be on the quote. Itemize
  hosting separately on every invoice.
- **Outreach law.** CAN-SPAM for email (opt-out regime, no B2B exception, postal address required,
  up to $53,088 per email). No marketing texts without written consent (TCPA, and PA SB 992 from
  2026-10-18: texts covered, 9 a.m.–7 p.m., never Sunday, $1,000 per violation). Phone follow-ups in
  business hours only.
- **Insurance.** General liability about $38/mo and tech E&O about $94/mo at the medians for web
  designers; budget $1,300–$1,600 a year once both are on. Timing (2026-10-28, money tight): nothing
  until the first paying client signs; then E&O, because it covers the work itself. General liability
  waits for a client who requires it or for regular on-site work. Insurers quote in a day, so there is
  no need to carry it while there is nothing to insure.
- **Entity.** Decide whether Steadfast Code operates under an existing LLC (fictitious name filing,
  $70, no newspaper ad when the registrant is an LLC) or its own. Check the operating agreement's
  purpose clause.
- **Contract essentials.** Fixed price and scope; 50/50; two revision rounds; pause after 14 days of
  silence; IP assigns to the client on final payment with your pre-existing tools licensed back;
  third-party licenses stay third-party; domain in the client's name; hosting handoff obligation
  spelled out; care plans month to month; a 1.5%/mo late fee.

## 7. Capacity and money

Your time is the constraint, not demand. At 8–10 hours a week, about 400–500 hours a year.

| Scenario | Mix | Builds | Care (avg 6 months live) | SEO | Gross | Hours |
|---|---|---|---|---|---|---|
| A: 10 clients, $300 ad track | 3 Starter, 5 Business, 1 Growth, 1 Store | $39,400 | 7 plans × ~$110 × 6 = ~$4,600 | 2 × $750 × 6 = $9,000 | **~$53,000** | ~330 |
| B: 18 clients, $1,000 ad track | 5 Starter, 9 Business, 3 Growth, 1 Store | $71,600 | 12 plans × ~$120 × 6 = ~$8,600 | 4 × $750 × 6 = $18,000 | **~$98,000** | ~560 |

Costs against that: marketing ($7,400 or $20,100), tools ($2,000–$6,000), insurance (in the marketing
line), your income tax. Scenario B needs more hours than the day job leaves; it's the shape of year two,
or of the first year you take a contractor for design or content. Recurring revenue is the thing to
watch: at 20 care plans averaging $120 that's $2,400 a month before any new build, which is the
"profitable services first" base the goals memo describes.

## 8. Operations

- **Intake:** form or email → reply the same day with two or three questions → 30-minute call → fixed
  price and date in writing the same day → 50% invoice → kickoff checklist (logo, photos, words,
  access to domain and GBP).
- **Build:** repo from the client starter template (to be built: Astro 7, the test gate, the contact
  Function, Sveltia config, the schema module), first real version within days on a preview URL,
  revisions on the live preview, launch on the client's domain, GBP and Search Console verified,
  forms tested end to end, handoff call recorded.
- **Care:** a shared inbox or Front Desk source for requests; a monthly 30-minute block per Cared-for
  client; the Looker Studio report sent on the first business day; renewals and DNS in a calendar.
- **SEO:** the four-week rhythm on the SEO page (profile, content, citations, technical + report).
- **Offboarding:** a written checklist that transfers the repo, the Pages project (or a static export),
  the domain and the GBP within five business days of a request, at no charge. Promise it in the
  contract; it's the ownership pitch made real.
- **What the routine can build unattended:** the client starter template, the site-check page (a
  Pages Function calling the PageSpeed Insights API), a proposal generator from `site.ts` tiers, the
  Looker Studio report template, a monthly-report script, the Cloudflare deploy for this site.

## 9. Open questions for you

1. **Sales tax**: CPA opinion first. It changes whether quotes say "+6% PA sales tax."
2. **Pay-monthly option**: offer it or not (§2). My recommendation: offer it quietly on Business only,
   after the first five one-time clients, if cash-flow objections actually come up.
3. **Email and phone**: support@steadfastcode.tech is live (confirmed 2026-10-28). Phone on the site:
   still open (the Mr Dandyman line, a Twilio number via Front Desk, or none).
4. **xCloud** is now in `docs/hosting.md` as the WordPress-client host; static sites stay on Cloudflare.
5. **Church/nonprofit discount**: 40% on builds, decided 2026-10-28.
6. **Cloudflare cutover for this site** (your login): create a Pages project from the repo, set the
   Resend binding, add the custom domain, delete the GitHub Pages workflow. The apex domain needs
   Cloudflare DNS: add steadfastcode.tech as a zone, check the imported records (keep the email ones),
   then switch the nameservers at Porkbun, which stays the registrar. Then add the Steadfast
   Analytics binding (see `~/repos/steadfast-analytics/README.md`).
   The form falls back to opening the visitor's mail app until then.
7. **Insurance and entity**: bind tech E&O the week the first paying client signs, not before; add
   general liability only if a client's contract requires it or on-site visits become routine. Decide
   which LLC this runs under before the first invoice.
8. **Case studies**: which church or nonprofit gets the first discounted build.
