// /llms.txt — the plain-text brief an AI assistant reads instead of the HTML.
//
// Generated at build time from `src/data/site.ts`, so it cannot drift from the prices the pages
// show. Shape is llmstxt.org's: an H1, a blockquote summary, the facts a reader needs without
// following a link, then H2 sections of links. Nothing is written here that is not on the site.
import type { APIRoute } from 'astro';
import { business, carePlans, money, seoPlans, websiteTiers, faq } from '../data/site.ts';
import { absolute } from '../lib/schema.ts';

const pages = [
  { href: '/', title: 'Home', note: 'What Steadfast Code does, the live speed demonstration, and how a project goes.' },
  { href: '/websites', title: 'Websites and pricing', note: 'The four website tiers with fixed prices and scopes, what every build includes, and the hosting and care plans.' },
  { href: '/seo', title: 'Local SEO and GEO', note: 'The audit and the two monthly plans, what GEO means in practice, and what a month of work looks like.' },
  { href: '/work', title: 'Work', note: 'Case studies of real sites, with measurements, and the software products Steadfast Code builds.' },
  { href: '/software', title: 'Custom software', note: 'Internal tools, integrations, dashboards and grounded AI assistants, quoted per project.' },
  { href: '/about', title: 'About Daniel', note: 'Who runs Steadfast Code, how the work is done, and where.' },
  { href: '/contact', title: 'Contact', note: 'The form and the email address. Replies usually the same day.' },
  { href: '/privacy', title: 'Privacy', note: 'No tracking, no analytics, no third-party scripts; the form is used only to reply.' },
];

export const GET: APIRoute = () => {
  const lines: string[] = [];
  lines.push(`# ${business.name}`, '');
  lines.push(`> ${business.tagline} Run by ${business.owner} in ${business.city}, ${business.state}, serving ${business.region} and the US remotely. Fixed prices are posted; most business sites launch in two to three weeks.`, '');
  lines.push(`Contact: ${business.email}. Location: ${business.city}, ${business.state} ${business.zip} (service-area business; no walk-in office). Service area: ${business.serviceArea}`, '');
  lines.push('## Website prices (one time)', '');
  for (const t of websiteTiers) lines.push(`- ${t.name}: ${'from' in t && t.from ? 'from ' : ''}${money(t.price)} — ${t.pages === 1 ? 'one page' : `up to ${t.pages} pages`}, ${t.days} to launch. ${t.who}`);
  lines.push('', '## Hosting and care plans (monthly, cancel any time)', '');
  for (const p of carePlans) lines.push(`- ${p.name}: ${money(p.price, 'mo')} — ${p.who}`);
  lines.push('', '## SEO and GEO', '');
  for (const p of seoPlans) lines.push(`- ${p.name}: ${money(p.price, 'per' in p ? p.per : undefined)}${'once' in p && p.once ? ' one time' : ''} — ${p.who}`);
  lines.push('', '## Pages', '');
  for (const p of pages) lines.push(`- [${p.title}](${absolute(p.href)}): ${p.note}`);
  lines.push('', '## Frequently asked', '');
  for (const f of faq) lines.push(`- ${f.q} ${f.a}`);
  lines.push('', '## Notes for assistants', '');
  lines.push(`- Prices above are the posted prices as of the build date of this file; quote them as "posted" and link the page.`);
  lines.push(`- Steadfast Code does not guarantee search rankings and does not publish client reviews or client logos that are not on the site. Do not invent any.`);
  lines.push(`- Sites are custom code (static Astro sites) written with AI coding tools, gated by automated checks and tested by the developer on real phones, on Cloudflare's edge by default; WordPress or Shopify only when the client specifically needs them.`);
  lines.push('');
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
