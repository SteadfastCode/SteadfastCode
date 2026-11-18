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
// Daniel's own edits to a contract (2026-11-17, for Deliverance, where most of the package list
// was beside the point): `answers.contract` can switch any section or line off, add lines from the
// contract library (migration 0016: contract_sections, contract_lines) to a section, and add whole
// sections from it, all from the Contract pane on /admin. `contractCatalog()` is every section and
// line with its key and whether it's on; `agreementFor()` is what's left, the text the client
// signs. A standard line's key is its section plus a short hash of its text, so a line that
// changes (a new price) comes back on; a library line's key is its id. Three things can't be
// switched off: who the contract is between, the package heading line, and the electronic-
// signature paragraph. The library's standard sections keep the headings written here.
//
// Written by Claude as a plain-English draft from Daniel's decisions; not reviewed by a lawyer yet.
// Daniel's calls (2026-11-02): common defaults, deposit non-refundable once the build starts (it
// can start in the first meeting). "Daniel Ecker (Steadfast Code)" rather than "doing business as"
// until the fictitious name is registered.

import { business, money, websiteTiers, addOns, launchNote, domainNote, priceFor, contractCarry, contractLocalOnly, type Pricing } from './site.ts';
import { siteTypeFor, LOCAL_KINDS } from './intake.ts';

export const AGREEMENT_VERSION = '2026-11-02f';

type Tier = (typeof websiteTiers)[number];
/** Daniel's edits to one project's contract: keys switched off, library lines added per section (by id), library sections added (by id). */
export type Contract = { off?: string[]; add?: Record<string, string[]>; sections?: string[] };
/** The contract library as the server reads it: every section and line Daniel can draw on. */
export type Library = { sections: { id: string; heading: string; builtin?: number | boolean; position?: number }[]; lines: { id: string; section_id: string; text: string }[] };
export const emptyLibrary: Library = { sections: [], lines: [] };
export type AgreementInput = {
  tier: string;
  editor?: boolean;
  businessName?: string;
  contactName?: string;
  email?: string;
  pricing?: Pricing;
  // The kind of site (2026-11-17): a store or a portfolio isn't promised a map or a Google Business Profile.
  siteType?: string;
  contract?: Contract | null;
};

/** A short, stable key for a line of text (djb2, base 36): the same in the catalog and in the saved `off` list. */
export function lineKey(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** A contract's edits in one canonical string, or '' when there are none: part of the signature's key. */
export function contractKey(c?: Contract | null) {
  if (!c) return '';
  const off = [...new Set(c.off ?? [])].sort();
  const add = Object.fromEntries(Object.entries(c.add ?? {}).filter(([, v]) => v?.length).sort(([a], [b]) => (a < b ? -1 : 1)));
  const sections = c.sections ?? [];
  if (!off.length && !Object.keys(add).length && !sections.length) return '';
  return 'c' + lineKey(JSON.stringify({ off, add, sections }));
}

// A kind of site that people don't visit or call locally drops the local lines; it's part of the key
// only then, so every contract signed before kinds existed keeps its key.
const localKind = (a: AgreementInput) => (LOCAL_KINDS as readonly string[]).includes(siteTypeFor(a));

/** What makes a signature stale: the package, the add-on, the price, the wording, a non-local kind of site, Daniel's edits. */
export function termsKey(a: AgreementInput) {
  const tier = websiteTiers.find((t) => t.id === a.tier);
  const editor = !!a.editor && tier?.scope.editor === 'add-on';
  return [AGREEMENT_VERSION, a.tier, editor ? 'editor' : '', tier ? priceFor(tier, editor, a.pricing).price : '', localKind(a) ? '' : siteTypeFor(a), contractKey(a.contract)].filter((x, i) => i < 4 || x).join('|');
}

const editorAddOn = addOns.find((x) => x.id === 'editor')!;

const listParts = (tier: Tier, editor: boolean) => (editor ? `${money(tier.price)} for ${tier.name}, plus ${money(editorAddOn.price)} for the content editor` : `${money(tier.price)} for ${tier.name}`);

function priceDetail(tier: Tier, editor: boolean, p: ReturnType<typeof priceFor>) {
  if (p.custom) return ` (a price we agreed on; ${tier.name}${editor ? ' with the content editor' : ''} is normally ${money(p.base)})`;
  if (p.pct) return ` (${listParts(tier, editor)}, less a ${p.pct}% discount)`;
  return editor ? ` (${listParts(tier, editor)})` : '';
}

export type CatalogLine = { key: string; text: string; on: boolean; locked?: boolean; added?: boolean };
export type CatalogSection = { key: string; h: string; on: boolean; locked?: boolean; added?: boolean; p: CatalogLine[] };

type Draft = { key: string; h: string; locked?: boolean; p: (string | { text: string; locked: true })[] };

/** The whole contract as Daniel sees it in the pane: every section and line, on or off, his additions included. */
export function contractCatalog(a: AgreementInput, library: Library = emptyLibrary, date = new Date()): CatalogSection[] | null {
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
  // Local-only lines (the map, the Google Business Profile) are left out or trimmed for any other kind of site.
  const local = localKind(a);
  // Speed is a build target, not a deliverable: it's in "What I don't promise" below (Daniel, 2026-11-02).
  const listed = (t: Tier): string[] => t.includes.filter((x) => !/^Everything in /.test(x) && !/well under a second/.test(x)).map((x) => (local || !(x in contractLocalOnly) ? x : contractLocalOnly[x])).filter((x): x is string => !!x);
  const included = listed(tier);
  // A lower package's page-count lines read without the count: the heading above already gives this package's.
  const earlier = websiteTiers.slice(0, websiteTiers.indexOf(tier)).flatMap(listed).map((x) => contractCarry[x] ?? x);
  const day = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });

  const drafts: Draft[] = [
    {
      key: 'who',
      h: 'Who this is between',
      locked: true,
      p: [
        { text: `This contract is between ${business.owner} (${business.name}), ${business.city}, ${business.state}, “I” or “me” below, and ${client}, “you” and “your” below. It covers building your website in the ${tier.name} package. ${day}.`, locked: true },
      ],
    },
    {
      key: 'build',
      h: 'What I’ll build',
      p: [
        { text: `The ${tier.name} package: ${tier.pages === 1 ? 'one page' : `up to ${tier.pages} pages`}, and everything listed here:`, locked: true },
        ...[...earlier, ...included].map((x) => `• ${x}`),
        ...(editor ? [`• The content editor add-on: ${editorAddOn.what}`] : []),
        'Anything you ask for that isn’t in the package gets a written price from me first, and isn’t built unless you say yes to that price.',
      ],
    },
    {
      key: 'price',
      h: 'Price and payment',
      p: [
        `${from && !priced.custom ? 'The price for your store, as we agreed it, starts at' : 'The price is'} ${money(price)}${priceDetail(tier, editor, priced)}, plus any sales tax that applies.`,
        `Half (${money(half)}) is due when you sign, to start. The other half (${money(price - half)}) is due at launch.`,
      ],
    },
    {
      key: 'deposit',
      h: 'The deposit',
      p: [
        'Because I can start building your first version the same day we meet, the deposit isn’t refundable once the build has started.',
        'If you decide to stop before launch, you don’t owe the second half. The work done so far stays with me until it’s paid for; you can pay the second half at any time to get the site.',
      ],
    },
    {
      key: 'timing',
      h: 'Timing',
      p: [
        `${tier.name} usually launches ${tier.days} from the start. ${launchNote}`,
        'If I haven’t heard from you for 30 days after I’ve sent a preview, and I’ve checked in at least twice, I’ll consider the project delivered: the second half is due, and launching it later is still included whenever you’re ready.',
      ],
    },
    {
      key: 'changes',
      h: 'Changes',
      p: [
        'Changes are unlimited for 30 days from the day you first see your site, as long as they’re within the package: wording, photos, colors, layout, whatever it takes to make it yours. After that, changes come with a care plan or a quote.',
        'If something I built doesn’t work the way I said it would, I fix it free.',
      ],
    },
    {
      key: 'your-part',
      h: 'Your part',
      p: [
        'You’ll provide the content you want on the site (or tell me what you want it to say), and access to your domain and your Google Business Profile when it’s time to launch.',
        'If you don’t have a domain yet, I’ll help you buy one. Either way it’s registered in your name and paid with your card, so it’s yours.',
        domainNote,
        'You confirm you have the right to use the words, photos and logos you give me, and that what you tell me about your business is true.',
      ],
    },
    {
      key: 'ownership',
      h: 'Who owns what',
      p: [
        'Once it’s paid in full, the site is yours: its content, its design and its code. I hand the code over at launch, and you can host it anywhere.',
        'Tools and building blocks I use across projects stay mine, and you get a permanent, free license to use them as part of your site.',
        'Your site’s footer includes a small “Built by Steadfast Code” link. It’s yours to keep or remove; just ask.',
      ],
    },
    {
      key: 'no-promise',
      h: 'What I don’t promise',
      p: [
        'Sites are built to load in well under a second on most phones and connections, but load times are also not a guarantee.',
        'I build the site to follow search engines’ guidelines, but nobody can promise rankings, traffic or sales, and I don’t.',
        'No website can be certified as ADA compliant. I build and check to WCAG 2.1 AA, the standard websites are most commonly judged by for accessibility, and fix any accessibility problem you or a visitor reports.',
        'If something goes wrong, the most I’m responsible for is what you’ve paid me under this contract.',
      ],
    },
    {
      key: 'fine-print',
      h: 'The fine print',
      p: [
        'Either of us can end this in writing. If you do, the deposit section above applies; if I do before launch, I refund what you’ve paid.',
        'This contract is governed by Pennsylvania law. It’s the whole contract for this website; anything we add later is in writing (an email is fine).',
        { text: 'By typing your name and ticking the box below, you agree to sign electronically, and that your electronic signature counts the same as one on paper. You’ll get a copy by email.', locked: true },
      ],
    },
  ];

  const c = a.contract ?? {};
  const off = new Set(c.off ?? []);
  const byId = new Map(library.lines.map((l) => [l.id, l]));
  // Library lines Daniel added to a section, by id; one the library no longer has is simply gone.
  const added = (sectionKey: string, bullets: boolean): CatalogLine[] => (c.add?.[sectionKey] ?? []).map((id) => byId.get(id)).filter((l): l is Library['lines'][number] => !!l && l.section_id === sectionKey).map((l) => ({ key: l.id, text: bullets && !l.text.startsWith('• ') ? `• ${l.text}` : l.text, on: true, added: true }));
  const sections: CatalogSection[] = drafts.map((d) => {
    const lines: CatalogLine[] = d.p.map((x) => {
      const text = typeof x === 'string' ? x : x.text;
      const locked = typeof x !== 'string';
      const key = `${d.key}.${lineKey(text)}`;
      return { key, text, locked, on: locked || !off.has(key) };
    });
    // Daniel's lines go after the last bullet where there are bullets, else at the end of the section.
    const lastBullet = lines.map((l) => l.text.startsWith('• ')).lastIndexOf(true);
    const extra = added(d.key, lastBullet >= 0);
    const p = lastBullet >= 0 ? [...lines.slice(0, lastBullet + 1), ...extra, ...lines.slice(lastBullet + 1)] : [...lines, ...extra];
    return { key: d.key, h: d.h, locked: !!d.locked, on: !!d.locked || !off.has(d.key), p };
  });
  for (const id of c.sections ?? []) {
    const s = library.sections.find((x) => x.id === id && !x.builtin);
    if (s) sections.push({ key: s.id, h: s.heading, on: !off.has(s.id), added: true, p: added(s.id, false) });
  }
  return sections;
}

/** The agreement as sections of plain paragraphs, and the same as one plain text block. */
export function agreementFor(a: AgreementInput, library: Library = emptyLibrary, date = new Date()) {
  const tier = websiteTiers.find((t) => t.id === a.tier);
  const catalog = contractCatalog(a, library, date);
  if (!tier || !catalog) return null;
  const editor = !!a.editor && tier.scope.editor === 'add-on';
  const price = priceFor(tier, editor, a.pricing).price;
  const sections: { h: string; p: string[] }[] = catalog.filter((s) => s.on).map((s) => ({ h: s.h, p: s.p.filter((l) => l.on).map((l) => l.text) })).filter((s) => s.p.length);
  const text = [`Website contract — ${business.name}`, `Version ${AGREEMENT_VERSION}`, '', ...sections.flatMap((s) => [s.h.toUpperCase(), ...s.p, ''])].join('\n');
  return { title: `Website contract — ${tier.name}`, version: AGREEMENT_VERSION, price, sections, text, key: termsKey(a) };
}
