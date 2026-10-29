# Search Atlas vs. a DIY SEO/GEO stack for a one-person Lancaster County web shop (researched 2026-10-27)

Research subagent report, kept as the evidence behind the SEO/GEO section of `docs/business-plan.md`.
**[unverified]** = secondary source or search snippet. Access limits: Reddit blocked; G2/Capterra review
bodies 403 (ratings from snippets); Mangools and Moz Local pricing pages not fetchable.

## 1. Search Atlas as of late 2026

### 1.1 Pricing (https://searchatlas.com/pricing/, fetched 2026-10-27; monthly; "Universal Credits")

| | Starter | Growth | Pro | Agency |
|---|---|---|---|---|
| Price / mo | $99 | $199 | $399 | from $999 |
| Credits / mo | 50,000 | 120,000 | 400,000 | 1,000,000+ |
| Projects · seats | 1 · 1 | 2 · 3 | 4 · 5 | 10 · 10 |
| Sites powered by OTTO | 1 | 2 | 4 | 10 |
| LLM Visibility (projects / queries) | 0 / 0 | 2 / 100 (ChatGPT, Gemini, AI Mode) | 4 / 100 (+Copilot, Perplexity, Claude) | Unlimited / 250 |
| Tracked keywords | 2,000 | 3,500 | 6,000 | 50,000 |
| GBP profiles | 3 | 10 | 25 | 100 |
| White-label | — | — | dashboards and reporting | + client portals, 5 implementation hours (annual) |

Third-party (4 Sep 2026): ~20% off annual; extra OTTO sites $99 for one, $85 each for 2–3, $69 for
4–9, $59 for 10–24 — https://diyai.io/ai-tools/seo/search-atlas-pricing/ **[unverified]**.
**Refund policy** (https://searchatlas.com/search-atlas-refund-policy): refund only "within 48 hours of
their initial subscription purchase" and only if "less than 10% of quota usage"; "Search Atlas has a
no-refund policy"; requests only via live chat.

### 1.2 What OTTO does (https://searchatlas.com/otto-seo/)

- Technical/on-page (autopilot or review): titles, headings, meta, schema, canonicals, links, OG, alt text, internal links "across every page."
- Content: topic maps → "publish-ready content"; help center describes a "bulk queue of 5–100 articles" with "push content to WordPress or Webflow" (https://help.searchatlas.com/en/articles/11880471-seo-ai-content-and-metrics). **This is the pipeline that produced the six near-duplicate posts on mrdandyman.biz.**
- Off-page: WILDFIRE "automated backlink exchange network," "2:1 exchange ratio" (LinkGraph, 2 Sep 2026: https://www.linkgraph.com/blog/search-atlas-review/); press releases via Signal Genesys; **Cloud Stacks** "designed primarily as tools for generating backlinks," the 30-day SOP "recommends building 13 high-DA interconnected properties each month" (https://help.searchatlas.com/en/articles/10732338-cloud-stacks ; https://help.searchatlas.com/en/articles/10131697-otto-30-day-sop) **[snippets]**. FAQ: "if the subscription is cancelled, all Cloud Stacks and Press Releases published will be removed."
- Deployment: OTTO Pixel (JS in the header) or a Cloudflare Worker; "OTTO uses dynamic client side rendering which means that you need to have OTTO activated for the rendering to continue"; "AI crawlers and non-JS bots only see edge-rendered content, not JS-injected fixes" (https://altheo.ai/reviews/searchatlas).
- WordPress plugin `metasync` v2.7.3: 7,000+ installs, **3.3/5 from 24 reviews (13 five-star, 10 one-star)**, updated 21 Oct 2026 — https://wordpress.org/plugins/metasync/ .

### 1.3 Approval gates

Partially fixed, and the vendor contradicts itself. Marketing page: OTTO "runs on autopilot and deploys
optimizations on its own … Turn on approval mode to review each change." Help center (26 Oct 2026): "By
default, OTTO does not deploy changes without your approval," plus an "I'm feeling lucky" button that
approves everything and "cannot be undone in bulk"
(https://help.searchatlas.com/hc/searchatlas-help/articles/1786754740-otto-deployment-lucky-button-and-dynamic-indexing-explained).
No published quality gate on content (no duplicate check, no local-mention requirement); the 5–100
article bulk queue is still a headline feature.

### 1.4 GEO features

No "OTTO GEO" product; the module is **LLM Visibility** (mentions, citations, sentiment, share of voice
across ChatGPT, Gemini, Perplexity, Claude) — https://searchatlas.com/llm-visibility/ . Starter has zero
LLM-visibility credits.

### 1.5 Reviews

| Platform | Score |
|---|---|
| Trustpilot | 3.9/5, 352 reviews; 64% five-star, **27% one-star** — https://www.trustpilot.com/review/searchatlas.com |
| G2 | 4.5/5, 111 [unverified snippet] |
| Capterra | 4.8/5, 82 [unverified snippet] |
| WordPress.org plugin | 3.3/5, 24 |
| Shopify app | 2.5/5, 13 (9 one-star) — https://apps.shopify.com/search-atlas/reviews |

2026 one-star Trustpilot quotes: "The articles are all AI-generated nonsense and riddled with egregious
factual errors" (16 Jul); "The tool injects spam onto your site. Run it through a crawler and see"
(2 Jul); "Following their explicit recommendations completely broke multiple client sites" (30 Sep);
"unwanted live-site changes … recurring charges continued" (14 Sep); "I was unable to cancel at all
during the trial" (1 Sep). Praise: "do the work of multiple experienced SEOs" (26 Sep 2026); CrawlRaven
(competitor, Aug 2026, 3.4/5) credits the local SEO module and bulk mechanical fixes, calls generated
articles "a competent first draft, not a publishable one," and notes "The credit meters are where a $99
plan quietly becomes a $150 plan" (https://crawlraven.com/blog/otto-seo-review). No documented manual
action attributed to OTTO was found — absence of evidence, not evidence of safety.

## 2. Google policy risk

Primary: https://developers.google.com/search/docs/essentials/spam-policies (updated 2026-08-28).
- **Scaled content abuse:** "many pages … generated for the primary purpose of manipulating search rankings," "no matter how it's created," example "Using generative AI tools … to generate many pages without adding value."
- **Site reputation abuse:** clarified 19 Nov 2024 ("no amount of first-party involvement alters the fundamental third-party nature"), enforced by manual actions; EEA-only adjustment Aug 2026.
- **Link spam:** "links with optimized anchor text in articles, guest posts, or press releases distributed on other sites"; "Excessive link exchanges"; "Using automated programs or services to create links." WILDFIRE and automated PR match almost word for word.
- **AI content guidance** (2026-10-01): "critical to manually factcheck and review all AI-generated content … before publishing" — https://developers.google.com/search/docs/fundamentals/using-gen-ai-content . Google's GEO guide (2026-07-10) says mass-producing pages to manipulate AI responses violates the scaled-content policy — https://developers.google.com/search/docs/fundamentals/ai-optimization-guide .
- **Spam updates:** Aug 2025, Mar 2026, Jun 2026, Aug 2026, Sep 2026 (five in 14 months) — https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history .
- **Rendering risk:** "none of the major AI crawlers currently render JavaScript" (Vercel, Dec 2024: https://vercel.com/blog/the-rise-of-the-ai-crawler); pixel-injected schema is invisible to ChatGPT/Perplexity and pointless on a static Astro site that ships correct HTML.

## 3. DIY stack (2026 prices)

| Tool | Price | Notes | Source |
|---|---|---|---|
| GSC, GA4, Bing WMT, GBP, Looker Studio | $0 | core of every engagement | |
| Semrush | SEO $139/mo ($117 annual); Starter $199 incl. 50 AI prompts/day; Local Base $30/location, Local Pro $60; AI Visibility Toolkit $99 add-on | | https://www.semrush.com/pricing/ ; https://www.semrush.com/kb/1611-local-toolkit-pricing-and-plans |
| Ahrefs | Starter $29; Lite $129 (Brand Radar 150 prompt checks); Standard $249; **Ahrefs Free** for verified sites | | https://ahrefs.com/pricing |
| SE Ranking | Core $129 ($103 annual): 10 projects, 2k keywords, **100 GEO prompts/day**; Growth $279 ($223): 30 projects | | https://seranking.com/subscription.html |
| Screaming Frog | free to 500 URLs; £199/yr | most Astro local sites fit in 500 | https://www.screamingfrog.co.uk/seo-spider/pricing/ |
| BrightLocal | 1 location Track $41 ($31 annual); 11–20 locations Track $104 ($78) incl. Local AI Visibility Tracker, geo-grid, citations monitoring | | https://www.brightlocal.com/pricing/ |
| Local Falcon | Starter $24.99 (7,500 credits), Basic $49.99, Pro $99.99; white-label reports | | https://www.localfalcon.com/pricing |
| Whitespark | Local Rank Tracker $14–$200; GBP Local Platform $1/location; citation building $20+ | | https://whitespark.ca/pricing/ |
| Localo | Single $49; Pro $169 up to 60 profiles | | https://localo.com/pricing |
| Schema | hand-written JSON-LD in Astro layouts; free generator | | https://technicalseo.com/tools/schema-markup-generator/ |
| AgencyAnalytics | $20/client/mo annual | | https://agencyanalytics.com/pricing |
| DashThis | Individual $44 (3 dashboards); Professional $139 | | https://dashthis.com/pricing/ |
| Mangools ~$29–$129; Moz Local ~$16–$33/location | [unverified] | | |

**Lean (5–8 clients) ≈ $130–175/mo:** free Google/Bing tools + SE Ranking Core annual ($103) + Local
Falcon Starter ($25) + Ahrefs Free/Starter ($0–29) + Screaming Frog free + hand-written schema + Looker
Studio reports. **Comfortable (10–20 clients) ≈ $600–900/mo:** SE Ranking Growth ($223) or Semrush
Starter + Local; BrightLocal Track 11–20 ($78); Local Falcon Basic ($50); Ahrefs Lite ($129); Otterly
Standard ($189) or Peec Starter (~$95) when a client pays for GEO reporting; AgencyAnalytics or
DashThis; Screaming Frog licence. Comparison: 10 OTTO sites on Search Atlas = Agency ($999) or Pro +
6 activations (~$813) before credit top-ups.

## 4. GEO in 2026: evidence vs. hype

**Google itself:** "There are no additional requirements to appear in AI Overviews or AI Mode"; "You
don't need to create new machine readable files, AI text files, or markup"; keep Business Profile
up to date — https://developers.google.com/search/docs/appearance/ai-features . GEO guide: "Structured
data isn't required for generative AI search"; llms.txt-style files are ignored by Google Search.

**Evidence-based for local businesses:**
- BrightLocal (16 Sep 2026; ~200k searches, 1.97M citations): GBP = 28.5% of all local AI citations; business websites = 42%; Yelp 9.5% (present for 84.65% of businesses); repeat-run overlap only 20–33% — https://www.brightlocal.com/research/local-ai-visibility-study/
- SOCi 2026 Local Visibility Index (~350k locations): 3-Pack 35.9%, Gemini 11.0%, Perplexity 7.4%, **ChatGPT 1.2%** — https://golocal.soci.ai/rs/355-TUF-572/images/The_2026_Local_Visibility_Index_SOCi100.pdf
- Whitespark Local Search Ranking Factors 2026: "In AI SEO, mentions (citations) are the new link"; 3 of the top 5 AI visibility factors are citation factors — https://whitespark.ca/local-search-ranking-factors/
- Ahrefs (May 2025; 75k brands): unlinked brand mentions correlate 0.664 with AI Overview presence vs 0.218 for backlinks — https://ahrefs.com/blog/ai-overview-brand-correlation/
- Peec (Sep 2026): ChatGPT local data comes from Yelp/TripAdvisor licensing plus scraped Google Maps; Bing secondary — https://docs.peec.ai/research/chatgpt-search-result-providers
- Princeton GEO paper (KDD 2024): "up to 40%" visibility gains from statistics, quotes and citations — https://arxiv.org/abs/2311.09735

**Hype:** **llms.txt** — Mueller: "purely speculative for now" (SEJ, 2 Jun 2026); SE Ranking 300k-domain
study: no correlation with citations (SEJ, 20 Nov 2025). Harmless to ship, dishonest to sell. Same for
"AI-specific schema" and pixel-injected anything.

**AI-visibility tools:** Otterly Lite $29 / Standard $189 / Premium $489 (https://otterly.ai/pricing);
Rankscale $20–$385 (https://rankscale.ai/pricing); Peec Starter $95 [unverified]; Profound trial only,
enterprise custom; Scrunch ~$250–300; Semrush AI Visibility $99 add-on; Ahrefs Brand Radar in Lite; SE
Ranking 100 prompts/day in Core; BrightLocal Local AI Visibility Tracker in Track ($41). **Agency GEO
pricing:** WebFX small-business $1,500–$5,000/mo; productized $500–$2,500/mo; "no established rate
card" (Tenpoint Labs).

## 5. Bottom line

**Search Atlas: no as a resale platform.** The things Daniel objected to are not bugs that got patched
— they are the product: the 5–100 article bulk queue, 2:1 automated link exchanges, 13-cloud-stacks-a-
month SOP, automated press releases, all mapping onto Google's scaled-content and link-spam examples;
2026 one-star reviews show the pattern persisted after the Oct 2025 overhaul; the default-deploy story
is contradicted; the pixel is wrong for Astro (client-side JS that ChatGPT/Perplexity never see, gone
when the subscription ends); 48-hour refund window and trial-billing complaints; 3.3-star plugin.

**When it could make sense:** Growth ($199) as a consolidated audit + rank tracker + GBP console, or Pro
($399) at 4+ WordPress clients already on the plugin wanting bulk alt-text/meta cleanup. Below ~6
clients the DIY stack is cheaper and cleaner. **Guardrails if ever used:** approval mode on from minute
one; never "I'm feeling lucky"; never the bulk content queue, WordPress auto-publish, Cloud Stacks,
WILDFIRE or press releases; no pixel on Astro; cap credits; virtual card; export everything so nothing
depends on the subscription.

**Local SEO (service definition):** a monthly, hands-on program for one location: a fully built and
maintained GBP (categories, services, real photos, posts, Q&A, review replies) and matching Bing
Places; a fast site with a dedicated page per service and service area, accurate LocalBusiness/
Service/FAQ structured data in the HTML, a handful of genuinely local pages per quarter from the
owner's own jobs and photos; clean citations (Yelp, Facebook, BBB, trade and chamber directories); a
review-request routine the owner actually runs; a geo-grid rank report plus GSC/GBP metrics in Looker
Studio. No bulk AI articles, no link schemes, nothing published without the owner seeing it.

**GEO (service definition):** an add-on, not a separate discipline: quarterly (or monthly) tracking of
20–50 real customer-style prompts across AI Mode/Overviews, ChatGPT and Perplexity; correct and
reviewed presence on the sources those engines cite (GBP, Yelp, TripAdvisor where relevant, trade
associations, local news, "best of" lists); clear, factual, dated service pages with prices, process
and credentials an LLM can quote; unlinked mentions through honest local PR. Honest limits in writing:
results are volatile, ChatGPT recommends ~1% of local locations, no file or markup buys inclusion.
Price as a $150–400/mo line on top of Local SEO.
