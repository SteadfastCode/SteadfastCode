---
  # CLAUDE.md — steadfastcode.tech (LeoAI Marketing Site)

  > Update this file when decisions are made about copy, design direction, hosting, or campaign strategy. Standard: would a future Claude session make a worse decision without this? If yes, log it.

  ---

  ## What Is This Repo?

  Marketing site for LeoAI — an AI-powered chatbot widget for small businesses, churches, and ministries. Built by Daniel Ecker, Steadfast Code, Lititz PA.

  The marketing site lives at **steadfastcode.tech**. Its job: communicate what LeoAI is, build trust, and convert visitors to signups (or waitlist during pre-launch).

  ---

  ## Tech Stack

  | Layer | Technology |
  |---|---|
  | Framework | Vue 3 + Vuetify |
  | Hosting | GitHub Pages |
  | Package Manager | Yarn |
  | Repo | GitHub (steadfastcode/steadfastcode-site) — private |

  ---

  ## Hosting — Future Decision

  Currently on **GitHub Pages** (free). Vercel was the original plan but isn't free for orgs.

  **Revisit when:** Daniel is ready to pay for hosting, or the site outgrows GitHub Pages (custom server logic, SSR, edge functions, etc.).

  **Options to evaluate at that point:**
  - Vercel (original preference — great DX, Vue/Vite native)
  - Netlify (comparable)
  - Cloudflare Pages (free tier is generous, good performance)
  - Fly.io / Render (if backend needs to move with it)

  No decision needed until then — don't over-engineer for hypothetical hosting needs.

  ---

  ## Brand & Tone

  **LeoAI personality:** Warm, friendly, almost childlike. Honest. Wants to be your best friend.

  **Marketing tone:** Accessible, human, faith-adjacent without being preachy. Not salesy. Not enterprise. Speaks to the solo business owner who can't afford a full-time customer service rep, and the volunteer-run church that's stretched thin.

  **Two distinct audiences — different messaging, different channels:**

  **Small Business:**
  - Angle: *"Never miss a customer. 24/7 answers, no extra staff."*
  - Pain point: sole proprietors who can't be available around the clock
  - Channels: local business associations, Google/Meta ads, small business communities

  **Church & Ministry:**
  - Angle: *"Serve your congregation better. Leo handles the questions so your team can handle the people."*
  - Pain point: volunteer-run orgs with limited staff; visitors who need connection, not just information
  - Channels: pastor networks, denomination conferences, ministry podcasts, word-of-mouth
  - Tone: warm, mission-driven, not salesy — this audience is allergic to hype

  ---

  ## Pricing Section — Current Direction

  > ⚠️ The detailed pricing grid has been removed (or must be removed before any real traffic hits the site). Numbers were set before Claude API costs were factored in — they will change after alpha.

  **Approved messaging to use in its place:**
  - Headline: *"Start free. Pay as you grow. Never more than you need."*
  - Secondary: *"Free to start • Simple pay-as-you-go • Unlimited plans available"*
  - No specific dollar amounts, no grid
  - "Pricing" CTA → waitlist or contact form until numbers are finalized

  **Do not add pricing numbers back until:**
  1. Tiered model routing is built (Haiku/Sonnet split changes blended API cost significantly)
  2. Alpha usage data shows real message volume per entity
  3. Semantic cache viability is evaluated

  **Likely direction when pricing is rebuilt:** PAYG $0.03-0.05/msg, Infinity $35-40/mo — but treat these as placeholders, not decisions.

  ---

  ## Church & Ministry Plan

  50% off equivalent business pricing. Not a coupon — a distinct plan.

  - Not self-service. Daniel enables Church Mode after review. Site shows "Request Ministry Plan" button.
  - No 501(c)(3) required — that excludes legitimate unincorporated ministries. Honor system + website review.
  - Word-of-mouth through pastor/denomination networks is high-value. Pricing reflects that.

  ---

  ## North Star

  Leo exists to serve people well — with honesty, dignity, and grace. If it helps a small business stay afloat, that's a win. If it helps a church connect with someone quietly seeking, that's the dream.

  *Colossians 3:23*

  ---