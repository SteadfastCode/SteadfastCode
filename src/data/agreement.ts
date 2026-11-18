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
// Where the words live (Daniel, 2026-11-17: all in one place): the contract library, migration
// 0016 (contract_sections, contract_lines) and 0017 (the standard lines as rows, flagged
// `standard`, some `locked`, in `position` order). A standard line carries placeholders ({client},
// {package}, {price}, {half} …) filled in per project by `fill()`; `{packageLines}` is the one row
// that expands into the package's bullet list, which comes from site.ts because it's the same
// text the public /websites page shows. `standardLines` and `standardSections` below are the
// seed of those rows and the fallback until the migration has run. `answers.contract` holds
// Daniel's edits to one project's contract, from the Contract card on /admin: sections and lines
// switched off, library lines and sections added, lines and headings reworded. `contractCatalog()`
// is every section and line with its key and whether it's on; `agreementFor()` is what's left, the
// text the client signs. A package bullet's key is its section plus a short hash of its text, so
// a bullet that changes comes back on; every other line's key is its library id. Three things
// can't be switched off: who the contract is between, the package heading line, and the
// electronic-signature paragraph. A library wording change never touches a signed contract (its
// text is stored at signing) and doesn't ask anyone to sign again; a project's own edits do.
//
// Written by Claude as a plain-English draft from Daniel's decisions; not reviewed by a lawyer yet.
// Daniel's calls (2026-11-02): common defaults, deposit non-refundable once the build starts (it
// can start in the first meeting). "Daniel Ecker (Steadfast Code)" rather than "doing business as"
// until the fictitious name is registered.

import { business, money, websiteTiers, addOns, launchNote, domainNote, priceFor, contractCarry, contractLocalOnly, type Pricing } from './site.ts';
import { siteTypeFor, LOCAL_KINDS } from './intake.ts';

export const AGREEMENT_VERSION = '2026-11-02f';

type Tier = (typeof websiteTiers)[number];
/**
 * Daniel's edits to one project's contract: keys switched off, library lines added per section (by
 * id), library sections added (by id), and reworded lines and headings (`edit`, by key: a line's or
 * section's key, a library line's or section's id). Any line can be reworded, the locked ones too.
 */
export type Contract = { off?: string[]; add?: Record<string, string[]>; sections?: string[]; edit?: Record<string, string> };
/** The contract library as the server reads it: every section and line Daniel can draw on. */
export type LibraryLine = { id: string; section_id: string; text: string; standard?: number | boolean; locked?: number | boolean; position?: number | null };
export type Library = { sections: { id: string; heading: string; builtin?: number | boolean; position?: number }[]; lines: LibraryLine[] };
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

/** The standard sections, in order: the seed of contract_sections, and the fallback before migration 0016. */
export const standardSections: { id: string; heading: string }[] = [
  { id: 'who', heading: 'Who this is between' },
  { id: 'build', heading: 'What I’ll build' },
  { id: 'price', heading: 'Price and payment' },
  { id: 'deposit', heading: 'The deposit' },
  { id: 'timing', heading: 'Timing' },
  { id: 'changes', heading: 'Changes' },
  { id: 'your-part', heading: 'Your part' },
  { id: 'ownership', heading: 'Who owns what' },
  { id: 'no-promise', heading: 'What I don’t promise' },
  { id: 'fine-print', heading: 'The fine print' },
];

/**
 * The standard lines, in order within their section: the seed of migration 0017 (test/agreement.test.js
 * checks the two agree) and the fallback before it has run. Placeholders are filled by `fill()`.
 */
export const standardLines: { id: string; section: string; text: string; locked?: boolean }[] = [
  { id: 's-who', section: 'who', locked: true, text: 'This contract is between {owner} ({company}), {city}, {state}, “I” or “me” below, and {client}, “you” and “your” below. It covers building your website in the {package} package. {date}.' },
  { id: 's-build-head', section: 'build', locked: true, text: 'The {package} package: {pages}, and everything listed here:' },
  { id: 's-build-list', section: 'build', text: '{packageLines}' },
  { id: 's-build-extra', section: 'build', text: 'Anything you ask for that isn’t in the package gets a written price from me first, and isn’t built unless you say yes to that price.' },
  { id: 's-price', section: 'price', text: '{priceLead} {price}{priceDetail}, plus any sales tax that applies.' },
  { id: 's-halves', section: 'price', text: 'Half ({half}) is due when you sign, to start. The other half ({rest}) is due at launch.' },
  { id: 's-deposit-1', section: 'deposit', text: 'Because I can start building your first version the same day we meet, the deposit isn’t refundable once the build has started.' },
  { id: 's-deposit-2', section: 'deposit', text: 'If you decide to stop before launch, you don’t owe the second half. The work done so far stays with me until it’s paid for; you can pay the second half at any time to get the site.' },
  { id: 's-timing-1', section: 'timing', text: '{package} usually launches {days} from the start. {launchNote}' },
  { id: 's-timing-2', section: 'timing', text: 'If I haven’t heard from you for 30 days after I’ve sent a preview, and I’ve checked in at least twice, I’ll consider the project delivered: the second half is due, and launching it later is still included whenever you’re ready.' },
  { id: 's-changes-1', section: 'changes', text: 'Changes are unlimited for 30 days from the day you first see your site, as long as they’re within the package: wording, photos, colors, layout, whatever it takes to make it yours. After that, changes come with a care plan or a quote.' },
  { id: 's-changes-2', section: 'changes', text: 'If something I built doesn’t work the way I said it would, I fix it free.' },
  { id: 's-yours-1', section: 'your-part', text: 'You’ll provide the content you want on the site (or tell me what you want it to say), and access to your domain and your Google Business Profile when it’s time to launch.' },
  { id: 's-yours-2', section: 'your-part', text: 'If you don’t have a domain yet, I’ll help you buy one. Either way it’s registered in your name and paid with your card, so it’s yours.' },
  { id: 's-yours-3', section: 'your-part', text: '{domainNote}' },
  { id: 's-yours-4', section: 'your-part', text: 'You confirm you have the right to use the words, photos and logos you give me, and that what you tell me about your business is true.' },
  { id: 's-own-1', section: 'ownership', text: 'Once it’s paid in full, the site is yours: its content, its design and its code. I hand the code over at launch, and you can host it anywhere.' },
  { id: 's-own-2', section: 'ownership', text: 'Tools and building blocks I use across projects stay mine, and you get a permanent, free license to use them as part of your site.' },
  { id: 's-own-3', section: 'ownership', text: 'Your site’s footer includes a small “Built by Steadfast Code” link. It’s yours to keep or remove; just ask.' },
  { id: 's-nop-1', section: 'no-promise', text: 'Sites are built to load in well under a second on most phones and connections, but load times are also not a guarantee.' },
  { id: 's-nop-2', section: 'no-promise', text: 'I build the site to follow search engines’ guidelines, but nobody can promise rankings, traffic or sales, and I don’t.' },
  { id: 's-nop-3', section: 'no-promise', text: 'No website can be certified as ADA compliant. I build and check to WCAG 2.1 AA, the standard websites are most commonly judged by for accessibility, and fix any accessibility problem you or a visitor reports.' },
  { id: 's-nop-4', section: 'no-promise', text: 'If something goes wrong, the most I’m responsible for is what you’ve paid me under this contract.' },
  { id: 's-fine-1', section: 'fine-print', text: 'Either of us can end this in writing. If you do, the deposit section above applies; if I do before launch, I refund what you’ve paid.' },
  { id: 's-fine-2', section: 'fine-print', text: 'This contract is governed by Pennsylvania law. It’s the whole contract for this website; anything we add later is in writing (an email is fine).' },
  { id: 's-fine-3', section: 'fine-print', locked: true, text: 'By typing your name and ticking the box below, you agree to sign electronically, and that your electronic signature counts the same as one on paper. You’ll get a copy by email.' },
];

/** `{name}` placeholders filled from the project's values; one with no value is left as written. */
export function fill(text: string, values: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? values[k] : m));
}

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
  const edit = Object.fromEntries(Object.entries(c.edit ?? {}).filter(([, v]) => v).sort(([a], [b]) => (a < b ? -1 : 1)));
  if (!off.length && !Object.keys(add).length && !sections.length && !Object.keys(edit).length) return '';
  return 'c' + lineKey(JSON.stringify({ off, add, sections, ...(Object.keys(edit).length ? { edit } : {}) }));
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

/**
 * `base` is the standard wording when the line or heading has been reworded (`edited`). `lib` says the
 * line is a library row (so a rewording can be saved there too); `standard` that it came with the
 * contract; `added` that Daniel put it on this project.
 */
export type CatalogLine = { key: string; text: string; on: boolean; locked?: boolean; added?: boolean; edited?: boolean; base?: string; lib?: boolean; standard?: boolean };
export type CatalogSection = { key: string; h: string; on: boolean; locked?: boolean; added?: boolean; edited?: boolean; base?: string; p: CatalogLine[] };

const byPosition = <T extends { position?: number | null }>(a: T, b: T) => (a.position ?? 1e9) - (b.position ?? 1e9);

/** The whole contract as Daniel sees it in the card: every section and line, on or off, his additions included. */
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
  // Speed is a build target, not a deliverable: it's in "What I don't promise" (Daniel, 2026-11-02).
  const listed = (t: Tier): string[] => t.includes.filter((x) => !/^Everything in /.test(x) && !/well under a second/.test(x)).map((x) => (local || !(x in contractLocalOnly) ? x : contractLocalOnly[x])).filter((x): x is string => !!x);
  const included = listed(tier);
  // A lower package's page-count lines read without the count: the heading above already gives this package's.
  const earlier = websiteTiers.slice(0, websiteTiers.indexOf(tier)).flatMap(listed).map((x) => contractCarry[x] ?? x);
  const day = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  const values: Record<string, string> = {
    owner: business.owner, company: business.name, city: business.city, state: business.state, client,
    package: tier.name, pages: tier.pages === 1 ? 'one page' : `up to ${tier.pages} pages`, date: day,
    priceLead: from && !priced.custom ? 'The price for your store, as we agreed it, starts at' : 'The price is',
    price: money(price), priceDetail: priceDetail(tier, editor, priced), half: money(half), rest: money(price - half),
    days: tier.days, launchNote, domainNote,
  };
  // The package's bullets, where the {packageLines} row sits.
  const bullets = [...[...earlier, ...included].map((x) => `• ${x}`), ...(editor ? [`• The content editor add-on: ${editorAddOn.what}`] : [])];

  // The library's standard rows and sections, or the built-in seed until the migrations have run.
  const rows: LibraryLine[] = library.lines.some((l) => l.standard) ? library.lines.filter((l) => l.standard).sort(byPosition) : standardLines.map((s, i) => ({ id: s.id, section_id: s.section, text: s.text, standard: 1, locked: s.locked ? 1 : 0, position: i }));
  // The standard sections, with the library's heading and order where it has the row, then Daniel's own.
  const libBuiltin = new Map(library.sections.filter((s) => s.builtin).map((s) => [s.id, s]));
  const sections = [
    ...standardSections.map((s, i) => ({ ...s, ...(libBuiltin.get(s.id) ?? {}), builtin: 1, position: libBuiltin.get(s.id)?.position ?? i })),
    ...library.sections.filter((s) => !s.builtin),
  ].sort(byPosition);

  const c = a.contract ?? {};
  const off = new Set(c.off ?? []);
  const edit = c.edit ?? {};
  // A reworded line keeps its bullet when the standard one had it; a rewording may use the placeholders too.
  const worded = (key: string, base: string) => { const e = edit[key] ? fill(edit[key], values) : ''; const text = !e ? base : base.startsWith('• ') && !e.startsWith('• ') ? `• ${e}` : e; return e ? { text, edited: true, base } : { text }; };
  const byId = new Map(library.lines.map((l) => [l.id, l]));
  // Library lines Daniel added to a section, by id; one the library no longer has is simply gone.
  const added = (sectionKey: string, asBullets: boolean): CatalogLine[] => (c.add?.[sectionKey] ?? []).map((id) => byId.get(id)).filter((l): l is LibraryLine => !!l && !l.standard && l.section_id === sectionKey).map((l) => ({ key: l.id, on: true, added: true, lib: true, ...worded(l.id, asBullets && !l.text.startsWith('• ') ? `• ${l.text}` : l.text) }));

  const out: CatalogSection[] = [];
  for (const s of sections) {
    // A section of Daniel's own is on a project only once added to it.
    if (!s.builtin && !(c.sections ?? []).includes(s.id)) continue;
    const lines: CatalogLine[] = [];
    for (const r of rows.filter((x) => x.section_id === s.id)) {
      if (r.text.trim() === '{packageLines}') {
        for (const b of bullets) { const key = `${s.id}.${lineKey(b)}`; lines.push({ key, on: !off.has(key), ...worded(key, b) }); }
        continue;
      }
      const locked = !!r.locked;
      lines.push({ key: r.id, locked, lib: true, standard: true, on: locked || !off.has(r.id), ...worded(r.id, fill(r.text, values)) });
    }
    // Daniel's lines go after the last bullet where there are bullets, else at the end of the section.
    const lastBullet = lines.map((l) => l.text.startsWith('• ')).lastIndexOf(true);
    const extra = added(s.id, lastBullet >= 0);
    const p = lastBullet >= 0 ? [...lines.slice(0, lastBullet + 1), ...extra, ...lines.slice(lastBullet + 1)] : [...lines, ...extra];
    const h = worded(s.id, s.heading);
    const locked = s.id === 'who';
    out.push({ key: s.id, h: h.text, ...(h.edited ? { edited: true, base: s.heading } : {}), locked, on: locked || !off.has(s.id), added: !s.builtin, p });
  }
  return out;
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
