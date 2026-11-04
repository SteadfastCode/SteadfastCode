// The website agreement a client signs on their project page before anything is built
// (2026-11-02). It is generated from the project (package, price, add-on, page limit, launch window)
// and the rules already published on /websites, so the agreement and the site can't say different
// things. Signing stores the exact text shown, its SHA-256, the typed name, time, IP and browser
// (server/agreement.js), the same record Plumb keeps for Mr Dandyman's signed estimates.
//
// Bump AGREEMENT_VERSION whenever the wording changes. A signature stays valid while the package,
// the editor add-on and the price are the ones it was signed for; a corrected business name or a
// new answer elsewhere doesn't ask the client to sign again.
//
// Written by Claude as a plain-English draft from Daniel's decisions; not reviewed by a lawyer yet.
// Daniel's calls (2026-11-02): common defaults, deposit non-refundable once the build starts (it
// can start in the first meeting). "Daniel Ecker (Steadfast Code)" rather than "doing business as"
// until the fictitious name is registered.

import { business, money, websiteTiers, addOns, launchNote, domainNote, priceFor, type Pricing } from './site.ts';

export const AGREEMENT_VERSION = '2026-11-02f';

type Tier = (typeof websiteTiers)[number];
export type AgreementInput = {
  tier: string;
  editor?: boolean;
  businessName?: string;
  contactName?: string;
  email?: string;
  pricing?: Pricing;
};

/** What makes a signature stale: the package, the add-on, the price, the wording. */
export function termsKey(a: AgreementInput) {
  const tier = websiteTiers.find((t) => t.id === a.tier);
  const editor = !!a.editor && tier?.scope.editor === 'add-on';
  return [AGREEMENT_VERSION, a.tier, editor ? 'editor' : '', tier ? priceFor(tier, editor, a.pricing).price : ''].join('|');
}

const editorAddOn = addOns.find((x) => x.id === 'editor')!;

const listParts = (tier: Tier, editor: boolean) => (editor ? `${money(tier.price)} for ${tier.name}, plus ${money(editorAddOn.price)} for the content editor` : `${money(tier.price)} for ${tier.name}`);
function priceDetail(tier: Tier, editor: boolean, p: ReturnType<typeof priceFor>) {
  if (p.custom) return ` (a price we agreed on; ${tier.name}${editor ? ' with the content editor' : ''} is normally ${money(p.base)})`;
  if (p.pct) return ` (${listParts(tier, editor)}, less a ${p.pct}% discount)`;
  return editor ? ` (${listParts(tier, editor)})` : '';
}

/** The agreement as sections of plain paragraphs, and the same as one plain text block. */
export function agreementFor(a: AgreementInput, date = new Date()) {
  const tier = websiteTiers.find((t) => t.id === a.tier);
  if (!tier) return null;
  const editor = !!a.editor && tier.scope.editor === 'add-on';
  // A changed price (2026-11-03) adds a line saying what it was; without one the wording is as before,
  // so contracts already signed at list price stay valid without a version bump.
  const priced = priceFor(tier, editor, a.pricing);
  const price = priced.price;
  const half = Math.round(price / 2);
  const from = 'from' in tier && tier.from;
  const client = [a.contactName, a.businessName].filter(Boolean).join(', for ') || 'the client';
  // Speed is a build target, not a deliverable: it's in "What I don't promise" below (Daniel, 2026-11-02).
  const listed = (t: Tier) => t.includes.filter((x) => !/^Everything in /.test(x) && !/well under a second/.test(x));
  const included = listed(tier);
  const earlier = websiteTiers.slice(0, websiteTiers.indexOf(tier)).flatMap(listed);
  const day = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });

  const sections: { h: string; p: string[] }[] = [
    {
      h: 'Who this is between',
      p: [
        `This contract is between ${business.owner} (${business.name}), ${business.city}, ${business.state}, “I” or “me” below, and ${client}, “you” and “your” below. It covers building your website in the ${tier.name} package. ${day}.`,
      ],
    },
    {
      h: 'What I’ll build',
      p: [
        `The ${tier.name} package: ${tier.pages === 1 ? 'one page' : `up to ${tier.pages} pages`}, and everything listed here:`,
        ...[...earlier, ...included].map((x) => `• ${x}`),
        ...(editor ? [`• The content editor add-on: ${editorAddOn.what}`] : []),
        'Anything you ask for that isn’t in the package gets a written price from me first, and isn’t built unless you say yes to that price.',
      ],
    },
    {
      h: 'Price and payment',
      p: [
        `${from && !priced.custom ? 'The price for your store, as we agreed it, starts at' : 'The price is'} ${money(price)}${priceDetail(tier, editor, priced)}, plus any sales tax that applies.`,
        `Half (${money(half)}) is due when you sign, to start. The other half (${money(price - half)}) is due at launch.`,
        'Hosting and care plans are separate, month to month, and optional. Nothing in this contract signs you up for one.',
      ],
    },
    {
      h: 'The deposit',
      p: [
        'Because I can start building your first version the same day we meet, the deposit isn’t refundable once the build has started.',
        'If you decide to stop before launch, you don’t owe the second half. The work done so far stays with me until it’s paid for; you can pay the second half at any time to get the site.',
      ],
    },
    {
      h: 'Timing',
      p: [
        `${tier.name} usually launches ${tier.days} from the start. ${launchNote}`,
        'If I haven’t heard from you for 30 days after I’ve sent a preview, and I’ve checked in at least twice, I’ll consider the project delivered: the second half is due, and launching it later is still included whenever you’re ready.',
      ],
    },
    {
      h: 'Changes',
      p: [
        'Changes are unlimited for 30 days from the day you first see your site, as long as they’re within the package: wording, photos, colors, layout, whatever it takes to make it yours. After that, changes come with a care plan or a quote.',
        'If something I built doesn’t work the way I said it would, I fix it free.',
      ],
    },
    {
      h: 'Your part',
      p: [
        'You’ll provide the content you want on the site (or tell me what you want it to say), and access to your domain and your Google Business Profile when it’s time to launch.',
        'If you don’t have a domain yet, I’ll help you buy one. Either way it’s registered in your name and paid with your card, so it’s yours.',
        domainNote,
        'You confirm you have the right to use the words, photos and logos you give me, and that what you tell me about your business is true.',
      ],
    },
    {
      h: 'Who owns what',
      p: [
        'Once it’s paid in full, the site is yours: its content, its design and its code. I hand the code over at launch, and you can host it anywhere.',
        'Tools and building blocks I use across projects stay mine, and you get a permanent, free license to use them as part of your site.',
        'Your site’s footer includes a small “Built by Steadfast Code” link. It’s yours to keep or remove; just ask.',
      ],
    },
    {
      h: 'What I don’t promise',
      p: [
        'Sites are built to load in well under a second on most phones and connections, but load times are also not a guarantee.',
        'I build the site to follow search engines’ guidelines, but nobody can promise rankings, traffic or sales, and I don’t.',
        'No website can be certified as ADA compliant. I build and check to WCAG 2.1 AA, the standard websites are most commonly judged by for accessibility, and fix any accessibility problem you or a visitor reports.',
        'If something goes wrong, the most I’m responsible for is what you’ve paid me under this contract.',
      ],
    },
    {
      h: 'The fine print',
      p: [
        'Either of us can end this in writing. If you do, the deposit section above applies; if I do before launch, I refund what you’ve paid.',
        'This contract is governed by Pennsylvania law. It’s the whole contract for this website; anything we add later is in writing (an email is fine).',
        'By typing your name and ticking the box below, you agree to sign electronically, and that your electronic signature counts the same as one on paper. You’ll get a copy by email.',
      ],
    },
  ];
  const text = [`Website contract — ${business.name}`, `Version ${AGREEMENT_VERSION}`, '', ...sections.flatMap((s) => [s.h.toUpperCase(), ...s.p, ''])].join('\n');
  return { title: `Website contract — ${tier.name}`, version: AGREEMENT_VERSION, price, sections, text, key: termsKey(a) };
}
