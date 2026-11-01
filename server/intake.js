// The admin intake's rules, kept pure so they can be tested without D1: which answers are kept,
// what a lead fills in, what the package covers, and when there is enough to start a first version.
// The questions themselves live in src/data/intake.ts; the packages in src/data/site.ts.

import { intakeSections, defaultPages } from '../src/data/intake.ts';
import { websiteTiers, addOns } from '../src/data/site.ts';

const MAX_TEXT = 2000;
const MAX_LIST = 60;

export const fields = Object.fromEntries(intakeSections.flatMap((s) => s.fields.map((f) => [f.id, { ...f, section: s.id, sectionTiers: s.tiers ?? null }])));
export const tierById = (id) => websiteTiers.find((t) => t.id === id) ?? null;

/** One answer, cleaned to its field's type; undefined means "not a valid value, ignore it". */
export function cleanValue(field, value) {
  if (value === null) return null;
  switch (field.type) {
    case 'bool': return typeof value === 'boolean' ? value : undefined;
    case 'tier': return typeof value === 'string' && tierById(value) ? value : undefined;
    case 'choice': return typeof value === 'string' && (value === '' || field.options.includes(value)) ? value : undefined;
    case 'list':
    case 'pages': {
      const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : null;
      if (!items) return undefined;
      return items.map((v) => String(v).trim().slice(0, 300)).filter(Boolean).slice(0, MAX_LIST);
    }
    default: return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : undefined;
  }
}

/** Merge a partial set of answers into the saved ones. Unknown keys and bad values are dropped. */
export function mergeAnswers(saved, patch) {
  const next = { ...saved };
  const dropped = [];
  for (const [k, v] of Object.entries(patch ?? {})) {
    const field = fields[k];
    const clean = field ? cleanValue(field, v) : undefined;
    if (clean === undefined) { dropped.push(k); continue; }
    if (clean === null || clean === '' || (Array.isArray(clean) && clean.length === 0)) delete next[k];
    else next[k] = clean;
  }
  // A package picked with no pages yet gets that package's usual pages as a starting point.
  if (patch?.tier && next.tier && !next.pages) next.pages = [...defaultPages[next.tier]];
  return { answers: next, dropped };
}

/** The answers a contact-form lead already gives us. */
export function answersFromLead(lead) {
  const { answers } = mergeAnswers({}, {
    tier: tierById(lead.plan) ? lead.plan : undefined,
    contactName: lead.name ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    businessName: lead.business ?? '',
    currentSite: lead.site ?? '',
    notes: lead.message ? `From the contact form: ${lead.message}` : '',
  });
  return answers;
}

/** Fields that apply to this package (a section or field with `tiers` shows only for those). */
export function applies(field, tier) {
  if (field.sectionTiers && !field.sectionTiers.includes(tier)) return false;
  if (field.tiers && !field.tiers.includes(tier)) return false;
  return true;
}

/**
 * Where the answers stand against the package: what's still missing before a first version can
 * start, and every place the answers go past what the package covers. Scope notes never block a
 * build — Daniel decides — they make sure nothing past the package slips in unpriced.
 */
export function check(answers) {
  const tier = tierById(answers.tier);
  const missing = Object.values(fields)
    .filter((f) => f.required && (!tier || applies(f, tier.id)))
    .filter((f) => answers[f.id] == null || answers[f.id] === '' || (Array.isArray(answers[f.id]) && answers[f.id].length === 0))
    .map((f) => ({ id: f.id, label: f.label }));
  const scope = [];
  if (tier) {
    const s = tier.scope;
    const pages = answers.pages?.length ?? 0;
    if (pages > s.pages) {
      const up = websiteTiers.find((t) => t.scope.pages >= pages && t.price > tier.price && !t.scope.store);
      scope.push(`${pages} pages; ${tier.name} covers ${s.pages}. ${up ? `${up.name} covers up to ${up.scope.pages}, or quote` : 'Quote'} the extra pages.`);
    }
    if (answers.integrations?.length && !s.integrations) scope.push(`Integrations (${answers.integrations.join(', ')}) aren't in ${tier.name}.`);
    if (answers.blogTopics?.length && !s.blog) scope.push(`A blog isn't in ${tier.name}.`);
    if (answers.mainAction === 'Buy online' && !s.store) scope.push(`Selling online needs the Online store package.`);
    if (answers.editor && s.editor === 'add-on') {
      const editor = addOns.find((a) => a.id === 'editor');
      scope.push(`Content editor add-on: +$${editor.price.toLocaleString('en-US')}.`);
    }
  }
  for (const item of answers.outOfScope ?? []) scope.push(`Outside the package, quote separately: ${item}`);
  const price = tier ? tier.price + (answers.editor && tier.scope.editor === 'add-on' ? addOns.find((a) => a.id === 'editor').price : 0) : null;
  return { ready: missing.length === 0, missing, scope, price, tier: tier ? { id: tier.id, name: tier.name, price: tier.price, from: !!tier.from, scope: tier.scope } : null };
}

/** A repo-safe slug from the business name: `client-<slug>` is the repo the build makes. */
export function slugFor(name) {
  const s = String(name ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return s || null;
}
