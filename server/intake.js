// The admin intake's rules, kept pure so they can be tested without D1: which answers are kept,
// what a lead fills in, what the package covers, and when there is enough to start a first version.
// The questions themselves live in src/data/intake.ts; the packages in src/data/site.ts.

import { intakeSections, defaultPages } from '../src/data/intake.ts';
import { websiteTiers, addOns, priceFor } from '../src/data/site.ts';

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
    case 'choice': return typeof value === 'string' && (value === '' || field.options.some((o) => (o.value ?? o) === value)) ? value : undefined;
    case 'list':
    case 'pages': {
      const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : null;
      if (!items) return undefined;
      return items.map((v) => String(v).trim().slice(0, 300)).filter(Boolean).slice(0, MAX_LIST);
    }
    case 'hours': return cleanHours(value);
    case 'pricing': return cleanPricing(value);
    default: return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : undefined;
  }
}

/** A discount (a percent, 0 < p < 100) or a set price in whole dollars; anything else isn't a price. */
export function cleanPricing(value) {
  if (!value || typeof value !== 'object') return undefined;
  const pct = Number(value.discountPct), price = Number(value.price);
  if (value.price != null) return Number.isFinite(price) && price >= 1 && price <= 1_000_000 ? { price: Math.round(price) } : undefined;
  if (value.discountPct != null) return Number.isFinite(pct) && pct > 0 && pct < 100 ? { discountPct: Math.round(pct * 10) / 10 } : undefined;
  return null;
}

export const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Hours, structured. An old free-text answer ("Mon-Sat 6am-6pm") becomes the note, so nothing is lost. */
export function cleanHours(value) {
  if (typeof value === 'string') return value.trim() ? { mode: 'set', days: {}, note: value.trim().slice(0, 300) } : null;
  if (!value || typeof value !== 'object') return undefined;
  const mode = ['set', '247', 'appointment'].includes(value.mode) ? value.mode : 'set';
  const days = {};
  // Days are kept in every mode (a switch to 24/7 and back shouldn't lose them); they count only under 'set'.
  for (const [d] of DAYS) {
    const x = value.days?.[d];
    if (x && TIME.test(x.open) && TIME.test(x.close)) days[d] = { open: x.open, close: x.close };
  }
  const note = typeof value.note === 'string' ? value.note.trim().slice(0, 300) : '';
  if (mode === 'set' && !Object.keys(days).length && !note) return null;
  return { mode, days, ...(note ? { note } : {}) };
}

const clock = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'am' : 'pm'}`; };

/** "Mon–Fri 7am–5pm, Sat 8am–noon" — consecutive days with the same hours are grouped. */
export function hoursText(h) {
  if (!h) return '';
  if (typeof h === 'string') return h;
  const parts = [];
  if (h.mode === '247') parts.push('Open 24/7');
  else if (h.mode === 'appointment') parts.push('By appointment');
  else {
    let run = null;
    const flush = () => { if (run) parts.push(`${run.from === run.to ? run.from : `${run.from}–${run.to}`} ${run.span}`); run = null; };
    for (const [d, name] of DAYS) {
      const x = h.days?.[d];
      const span = x ? `${clock(x.open)}–${clock(x.close)}`.replace(/12pm/g, 'noon') : null;
      const short = name.slice(0, 3);
      if (span && run && run.span === span) run.to = short;
      else { flush(); if (span) run = { from: short, to: short, span }; }
    }
    flush();
  }
  if (h.note) parts.push(h.note);
  return parts.join(', ');
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

/**
 * The answers a lead already gives us: a contact-form submission's own fields, and for a lead
 * from the outreach board (2026-11-03) its town, why Daniel reached out, where it came from and
 * the last few touches, so the meeting starts with the story in front of him.
 */
export function answersFromLead(lead, touches = []) {
  const outreach = lead.kind && lead.kind !== 'inbound';
  const notes = [
    lead.message ? `${outreach ? 'They wrote' : 'From the contact form'}: ${lead.message}` : '',
    lead.why ? `Why we reached out: ${lead.why}` : '',
    outreach && lead.source_detail ? `Found through: ${lead.source_detail}` : '',
    touches.length ? `From the leads board:\n${touches.map((t) => `${String(t.at).slice(0, 10)} ${t.kind}: ${t.text}`).join('\n')}` : '',
  ].filter(Boolean).join('\n');
  const { answers } = mergeAnswers({}, {
    tier: tierById(lead.plan) ? lead.plan : undefined,
    contactName: lead.name ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    businessName: lead.business ?? '',
    currentSite: lead.site ?? '',
    serviceArea: lead.town ?? '',
    notes,
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
  for (const item of answers.outOfScope ?? []) scope.push(`Extra, quoted separately: ${item}`);
  const priced = tier ? priceFor(tier, !!answers.editor && tier.scope.editor === 'add-on', answers.pricing) : null;
  const price = priced ? priced.price : null;
  return { ready: missing.length === 0, missing, scope, price, pricing: priced, tier: tier ? { id: tier.id, name: tier.name, price: tier.price, from: !!tier.from, scope: tier.scope } : null };
}

/** A repo-safe slug from the business name: `client-<slug>` is the repo the build makes. */
export function slugFor(name) {
  const s = String(name ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return s || null;
}
