// The one place the business facts live. Every page reads from here, so a changed price, email or
// claim is one edit, and the tests check the pages against this file rather than against a second
// copy of the numbers.
//
// Two rules for this file:
//   1. Nothing in it is invented. No made-up clients, reviews, or numbers; a field that is not yet
//      true is left empty and the page that would show it shows nothing.
//   2. Prices are numbers, not strings. The pages write the human form through `money()` and the
//      JSON-LD writes the machine form from the same value.

export const business = {
  name: 'Steadfast Code',
  legalName: 'Steadfast Code',
  owner: 'Daniel Ecker',
  tagline: 'Fast, custom websites for small businesses, churches and nonprofits.',
  email: 'support@steadfastcode.tech',
  url: 'https://steadfastcode.tech',
  city: 'Lititz',
  state: 'PA',
  zip: '17543',
  region: 'Lancaster County',
  serviceArea: 'Lititz, PA and the rest of Lancaster County, plus York, Harrisburg, Hershey, Reading and Lebanon. Remote work anywhere in the US.',
  serviceTowns: ['Lititz', 'Lancaster', 'Manheim', 'Ephrata', 'Elizabethtown', 'York', 'Harrisburg', 'Hershey', 'Reading', 'Lebanon'],
  // Profiles. Only the ones that exist are emitted into the JSON-LD `sameAs` list; an empty string
  // means the listing is not claimed yet. Never guess a URL to fill a field.
  github: 'https://github.com/SteadfastCode',
  // Colossians 3:23, Legacy Standard Bible, word for word (Daniel's rule: never paraphrased). The
  // trailing comma is the verse's own. test/site.test.js checks every page carries it exactly.
  verse: 'Whatever you do, do your work heartily, as for the Lord rather than for men,',
  verseRef: 'Colossians 3:23 (LSB)',
  verseCopyright: 'Scripture quotation taken from the Legacy Standard Bible, Copyright \u00a9 2021 by The Lockman Foundation. All rights reserved.',
  googleBusinessProfile: '',
  linkedin: '',
  facebook: '',
} as const;

// The nav, in order. The "Start a project" button is added by the layout.
export const nav = [
  { href: '/', label: 'Home' },
  { href: '/websites', label: 'Websites' },
  { href: '/seo', label: 'SEO & GEO' },
  { href: '/work', label: 'Work' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

/** `$1,200`; `$95/mo` when a unit is given. */
export function money(n: number, per?: string): string {
  return `$${n.toLocaleString('en-US')}${per ? `/${per}` : ''}`;
}

// ------------------------------------------------------------------------------------ websites
// A website is priced by what it has to do, not by the hour. Each tier is a fixed price with a
// stated scope, and anything past that scope is quoted before it's built. `pages` is the ceiling
// the price covers; `days` is the usual working-time to launch once the content is in hand.
export const websiteTiers = [
  {
    id: 'starter',
    name: 'Starter',
    price: 1500,
    pages: 1,
    days: 'about a week',
    who: 'A new business, a side business, or a campaign that needs one great page.',
    includes: [
      'One long-scroll page, written and designed around what you sell',
      'Mobile-first, plain custom code, loads in well under a second',
      'Contact form or booking link, click-to-call, map',
      'Google Business Profile set up or cleaned up',
      'Search basics done right: titles, descriptions, structured data, sitemap',
      'Launch on your domain with SSL, plus 30 days of fixes or tweaks after launch',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: 3900,
    pages: 6,
    days: '2–3 weeks',
    who: 'Most local businesses: a home page, services, about, contact, and room for a couple more.',
    featured: true,
    includes: [
      'Everything in Starter',
      'Up to 6 pages, each one written to answer the question people actually search',
      'Two rounds of revisions on a real, clickable site, not a mockup',
      'Photo and copy help, so you are not stuck writing it alone',
      'Local SEO foundation: service-area pages where they are honest, reviews wired in, schema on every page',
      'Forms that reach you by email or text and never silently drop a lead',
      'A one-hour handoff call and a written guide to your site',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 6900,
    pages: 15,
    days: '3–5 weeks',
    who: 'A business with a lot to say: many services, locations, a blog or resources, a team.',
    includes: [
      'Everything in Business',
      'Up to 15 pages, plus a friendly editor so you can change text and photos yourself',
      'Blog or resources section with a content plan for the first three months',
      'Integrations: scheduling, CRM, newsletter, payments, whatever you already use',
      'Accessibility pass to WCAG 2.1 AA',
      'Performance budget enforced in the build, so it stays fast after launch',
    ],
  },
  {
    id: 'store',
    name: 'Online store',
    price: 8500,
    from: true,
    pages: 15,
    days: '4–6 weeks',
    who: 'Selling products online, from a dozen items to a few hundred.',
    includes: [
      'Everything in Growth',
      'Shopify or a headless store on a fast front end, depending on what you need',
      'Product pages, collections, cart, checkout, shipping and tax set up',
      'Product photography guidance and first-batch product entry',
      'Order notifications and a training session for whoever runs the store',
    ],
  },
] as const;

// One-time extras on a website build. Growth includes the editor; Starter and Business can add it.
// Decided by Daniel 2026-10-29 ($500).
export const addOns = [
  {
    id: 'editor',
    name: 'Content editor',
    price: 500,
    who: 'For Starter and Business sites. Growth includes it.',
    what: 'A simple editor so you can change your own text and photos from a phone or a computer, without touching code. Every save is kept, so nothing is ever lost.',
  },
] as const;

// What every build has in common. Rendered once on /websites; the tiers above list only what
// changes between them.
export const everyBuild = [
  'Custom code, not a template or a page builder. AI coding tools write it, automated checks gate every build, and I direct the work and test the result on real phones. The code is yours, in a GitHub repository under your name if you want it.',
  'Built to score 100 on Google’s performance, accessibility and SEO checks, and tested on real phones before launch.',
  'No plugin sprawl, no monthly license fees for a theme, no surprise "your site needs updating" emails.',
  'You own your domain, your content and your site, and you can take it anywhere, any time.',
  'One person from the first call to launch, and the same person afterward.',
] as const;

// Hosting and care, monthly. Pay-as-you-go: a plan can be cancelled any month, and a site can be
// moved off to another host any time; the hand-off is part of the plan.
export const carePlans = [
  {
    id: 'hosted',
    name: 'Hosted',
    price: 59,
    who: 'Your site, kept online and safe, with nothing for you to think about.',
    includes: [
      'Edge hosting on Cloudflare: fast everywhere, essentially unlimited traffic',
      'SSL, daily backups, uptime monitoring, DNS and domain renewal reminders',
      'Form delivery and spam filtering',
      'Visitor numbers on a private dashboard: pages, sources, calls and form sends, counted without cookies or Google',
      'Security and dependency updates',
      'Small fixes (a typo, a phone number) handled by email, usually same day',
    ],
  },
  {
    id: 'cared-for',
    name: 'Cared for',
    price: 149,
    featured: true,
    who: 'For a business that changes a little every month and wants someone on call.',
    includes: [
      'Everything in Hosted',
      'Up to one hour of changes a month: new photos, a new service, a seasonal banner',
      'Monthly report: visitors, top pages, search terms, form fills, speed score',
      'Google Business Profile kept current, with one post a month',
      'Priority turnaround: changes within two business days',
    ],
  },
  {
    id: 'growing',
    name: 'Growing',
    price: 299,
    who: 'For a business that wants the site working for it, not just sitting there.',
    includes: [
      'Everything in Cared for',
      'Up to three hours of changes a month, including new pages',
      'One new piece of content a month, written with you, about a real job or question',
      'Quarterly review call: what is ranking, what is converting, what to do next',
      'Local SEO upkeep: citations, reviews, schema, and the Google Business Profile',
    ],
  },
] as const;

// ----------------------------------------------------------------------------------- seo / geo
// SEO is sold as a monthly engagement with a stated scope, not a promise of a ranking. GEO —
// showing up in AI answers (Google AI Overviews, ChatGPT, Perplexity, Copilot) — is the same work
// done with that audience in mind, plus monitoring of what the assistants actually say about you.
export const seoPlans = [
  {
    id: 'audit',
    name: 'Site & search audit',
    price: 500,
    once: true,
    who: 'A clear, honest picture of where you stand and what would move the needle, before you spend monthly money.',
    includes: [
      'Technical crawl: speed, mobile, indexing, broken things',
      'Local presence: Google Business Profile, citations, reviews, competitors on the map',
      'Content and keyword gaps for the searches that bring customers',
      'What AI assistants currently say about you, and why',
      'A prioritized, plain-English plan. Credited back if you start a plan within 60 days.',
    ],
  },
  {
    id: 'local',
    name: 'Local SEO',
    price: 750,
    per: 'mo',
    featured: true,
    who: 'For a business that lives and dies by the map pack and "near me" searches.',
    includes: [
      'Google Business Profile managed: categories, services, photos, posts, Q&A, review replies',
      'Citations built and cleaned up so every directory agrees about you',
      'Review strategy and a simple system for asking',
      'One new page or substantial content piece a month, about real work',
      'Technical and on-page fixes on your site as they come up',
      'Monthly report with rankings, calls, direction requests and form fills, in English',
    ],
  },
  {
    id: 'local-geo',
    name: 'Local SEO + GEO',
    price: 1050,
    per: 'mo',
    who: 'For a business that wants to be the answer when someone asks an AI assistant, too.',
    includes: [
      'Everything in Local SEO',
      'Monthly AI-visibility check: what ChatGPT, Gemini, Perplexity and Google AI Overviews say about you and your competitors',
      'Entity work: the same facts about your business on every source assistants actually cite (your Google profile, Yelp, directories, associations), structured data written into the HTML, and answer-first pages',
      'Two content pieces a month, written to be quoted: specific, factual, and about real jobs and real questions',
      'Earned mentions: local press, directories, associations and partners that assistants actually cite',
      'Quarterly strategy call',
    ],
  },
] as const;

// --------------------------------------------------------------------------------- software
// Custom software is the thing Steadfast Code did first, and it stays on the menu; it's priced by
// the project after a scoping conversation. The products are the ones that exist.
export const software = {
  intro:
    'Before websites, Steadfast Code was custom software: internal tools, integrations, dashboards, ' +
    'and a few products of its own. If your business runs on a spreadsheet that has gotten out of hand, ' +
    'or two systems that refuse to talk to each other, that is work I do.',
  products: [
    {
      name: 'Plumb',
      status: 'In daily use & constant improvement',
      what: 'Offline-first project management for a solo contractor: estimates, job costing, photos and invoices, built for my own handyman business.',
    },
    {
      name: 'Tethered',
      status: 'In daily use & constant improvement',
      what: 'Private location sharing for families: an Android app and a live map, self-hosted so your family’s locations stay on a server you control. Built for my own family first.',
    },
    {
      name: 'LeoAI',
      status: 'In development',
      what: 'A friendly assistant for a small business or church website that learns your site and answers visitors’ questions, 24/7, in your voice.',
      href: 'https://tally.so/r/b5OKjo',
      cta: 'Join the waitlist',
    },
    {
      name: 'Front Desk',
      status: 'In development',
      what: 'An AI front desk for trades shops: missed-call text-back, a grounded text assistant, and lead capture that never loses a job.',
    },
    {
      name: 'Expiry Tracker',
      status: 'In development',
      what: 'Shows who is current, expiring or lapsed on documents that renew: volunteer clearances for Pennsylvania churches, and subcontractors’ insurance certificates for general contractors.',
    },
  ],
} as const;

// -------------------------------------------------------------------------------------- work
// Real sites only. A case study is added here when the site is live and the owner is happy to be
// shown. `metrics` are measured, not estimated, and say when and how.
export const work = [
  {
    name: 'Mr Dandyman',
    kind: 'Handyman and general contractor, Lititz PA',
    url: 'https://mrdandyman.biz',
    // Live on Cloudflare Pages since 2026-10-30 (MDS-001's DNS cutover).
    live: true,
    status: 'Launched - October 30, 2026',
    summary:
      'Replaced a slow WordPress site that a plugin had stuffed with auto-generated blog posts. ' +
      'The new site is static custom code, built with AI tools and tested on real phones. It posts the full rate sheet up front, is built to pull job photos ' +
      'straight from the contractor’s own project system, and its contact form never silently loses a lead: it either delivers the message or tells the visitor to call or text.',
    details: [
      'Rates public on every service page, with the price in the first sentence so a search result can quote it',
      'Structured data for every service and price, written into the HTML where search engines and AI crawlers can actually read it',
      'Contact form with express SMS consent, built to hand each lead to the lead system',
      'The whole home page, styles included, is smaller than one typical stock photo',
    ],
    image: '/work/mrdandyman.webp',
    imageAlt: 'The Mr Dandyman home page: the rate sheet, the service cards and a call button.',
    disclosure: 'Full disclosure: this is my own handyman business, which is also why it was the first site through the new process.',
  },
] as const;

// ------------------------------------------------------------------------------------ process
export const process = [
  {
    step: 'Talk',
    text: 'A 30-minute call, or a long email if you would rather. What you do, who you want to reach, what you have (logo, photos, words) and what you do not. You get a fixed price and a date the same day.',
  },
  {
    step: 'Build',
    text: 'With AI tools doing the typing, I build a real first version within days, not a mockup. You click around it on your phone and tell me what is wrong. That is faster and more honest than approving a picture of a website.',
  },
  {
    step: 'Revise',
    text: 'Two rounds of changes are in the price, and small things in between are just a text. Copy, photos, order, colors, whatever it takes to make it yours.',
  },
  {
    step: 'Launch',
    text: 'On your domain, with your Google Business Profile, search setup and forms all tested. Then 30 days of fixes or tweaks on me, and a care plan if you want someone keeping an eye on it.',
  },
] as const;

// The questions people ask before they buy. One list: the page renders it and the FAQ JSON-LD is
// built from it, so a page can't claim an answer the markup doesn't.
export const faq = [
  {
    q: 'Why are your prices posted when most web designers make you call?',
    a: 'Because I hate it when I cannot find a price. A fixed price for a stated scope is fairer to both of us: you know what you are getting into, and I know exactly what I\u2019m getting for it. If your project does not fit a tier, I will tell you a number before I start.',
  },
  {
    q: 'How can you build a custom site in two or three weeks?',
    a: 'Honestly, two reasons. I do not use page builders or templates, so there is no fighting the tool, and I use AI coding tools heavily: they write most of the code. I decide what the site is and what it says, direct the work, test it on real phones, and nothing goes live until the automated checks pass. The thing that actually sets the schedule is usually getting the words and photos from you, so I help with those too.',
  },
  {
    q: 'Do I own the site?',
    a: 'Yes, outright, once the build is paid. The code lives in a GitHub repository I can hand over, the domain is in your name, and nothing about the site needs me or my hosting to keep running. If you ever want to leave, I will help you move.',
  },
  {
    q: 'Do I have to buy a care plan?',
    a: 'No. A static site like the ones I build is pretty happy sitting on free or near-free hosting, and I will set that up for you at launch if you would rather manage it yourself. The care plans are for people who would prefer to never think about it.',
  },
  {
    q: 'What does the site run on?',
    a: `Plain HTML, CSS and a little JavaScript, produced by a modern static site framework (Astro) from code written with AI tools, checked automatically on every version and tested by me on real phones, served from Cloudflare’s edge network. No WordPress, no database, no plugins to update, nothing to get hacked. If you want to change text and photos yourself, there is a simple editor for that: included in Growth, and a ${money(addOns[0].price)} add-on for Starter and Business. If you specifically need WordPress or Shopify, I will tell you honestly whether it is the right call and build it well if it is.`,
  },
  {
    q: 'Can you guarantee a first-page Google ranking?',
    a: 'No, and nobody honest can. What I can promise is that the technical side will be done right, the content will be real and useful, and you will get a plain-English report every month showing exactly what changed.',
  },
  {
    q: 'What is GEO?',
    a: 'Generative engine optimization: showing up correctly when someone asks ChatGPT, Google’s AI Overviews, Perplexity or Copilot for a business like yours. Most of it is good SEO done thoroughly, plus structured data, consistent facts about your business everywhere, and content specific enough to be worth quoting. I measure it by asking the assistants and recording what they say.',
  },
  {
    q: 'How do payments work?',
    a: 'Half to start, half at launch, by card or bank transfer. Monthly plans are billed on the first of the month and can be cancelled any time; the month you cancel is the last one billed. Pennsylvania treats some website work as taxable, so if sales tax applies to your project it is added on top and I will say so on the quote, never as a surprise on the invoice.',
  },
] as const;

// -------------------------------------------------------------------------------- the pitch
// The numbers in the speed comparison, with where they come from. The visitor's own page weight
// and load time are measured live in the browser (src/components/SpeedProof.astro); these are the
// comparison points and must stay cited.
export const benchmarks = {
  medianPageKb: 2311,
  medianJsKb: 570,
  source: 'HTTP Archive Web Almanac 2024, median mobile page',
  sourceUrl: 'https://almanac.httparchive.org/en/2024/page-weight',
  // The ceiling for any page on this site, over the wire, HTML + CSS + fonts + images on the page.
  // test/perf.test.js enforces it on the built output.
  budgetKb: 200,
} as const;

export const values = [
  {
    title: 'Honest',
    text: 'Prices posted, no upsells I would not buy myself, and "I don’t know yet" when that is the truth.',
  },
  {
    title: 'Fast',
    text: 'Fast to build and fast to load. The second one is the one your customers notice.',
  },
  {
    title: 'Yours',
    text: 'Your domain, your content, your code. No lock-in, no hostage situations, no monthly fee to keep what you paid for.',
  },
  {
    title: 'Done',
    text: 'Done right. Done to industry standards and best practices. Done for you.',
  },
] as const;
