// The admin intake's rules, kept pure so they can be tested without D1: which answers are kept,
// what a lead fills in, which questions a project asks, what the package covers, and when there is
// enough to start a first version. The questions themselves live in src/data/intake.ts; the
// packages in src/data/site.ts.

import { intakeSections, siteTypes, siteTypeFor, defaultPagesFor } from '../src/data/intake.ts';
import { websiteTiers, addOns, priceFor } from '../src/data/site.ts';

const MAX_TEXT = 2000;
const MAX_LIST = 60;

export const fields = Object.fromEntries(intakeSections.flatMap((s) => s.fields.map((f) => [f.id, { ...f, section: s.id, sectionTiers: s.tiers ?? null }])));
export const tierById = (id) => websiteTiers.find((t) => t.id === id) ?? null;
export { siteTypes, siteTypeFor };

/** The questions no project can drop: the package, the name, the pages, Daniel's own controls. */
export const alwaysAsked = Object.values(fields).filter((f) => f.ask === 'always').map((f) => f.id);

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
    // The questions asked on this project: known field ids only; the ones always asked go without saying.
    case 'fieldset': return Array.isArray(value) ? [...new Set(value.filter((id) => fields[id] && fields[id].ask !== 'always'))] : undefined;
    case 'hours': return cleanHours(value);
    case 'pricing': return cleanPricing(value);
    case 'contract': return cleanContract(value);
    // The address the site's form relay sends to: an address, or blank, never anything else.
    case 'email': { if (typeof value !== 'string') return undefined; const v = value.trim().slice(0, 200); return v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : undefined; }
    // A link: blank, or an http(s) address (a bare host gets https://), never anything that isn't one.
    case 'url': {
      if (typeof value !== 'string') return undefined;
      let v = value.trim().slice(0, 300);
      if (v && !/^https?:\/\//i.test(v)) v = `https://${v}`;
      return v === '' || /^https?:\/\/[^\s/]+\.[^\s/]+/i.test(v) ? v : undefined;
    }
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

// A contract key: a section id ('build', or a library section's id) or a standard line ('build.1a2b3c').
const CONTRACT_KEY = /^[a-z0-9][a-z0-9-]{0,40}(\.[a-z0-9]{1,12})?$/;
const ID = /^[a-z0-9][a-z0-9-]{0,40}$/;

/**
 * Daniel's contract edits (2026-11-17): keys switched off, library lines added per section (ids),
 * library sections added (ids). Empty edits clear the field. Anything else in shape is ignored.
 */
export function cleanContract(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const off = [...new Set((Array.isArray(value.off) ? value.off : []).filter((k) => typeof k === 'string' && CONTRACT_KEY.test(k)))].slice(0, 200);
  const add = {};
  for (const [k, v] of Object.entries(value.add && typeof value.add === 'object' ? value.add : {})) {
    if (!ID.test(k) || !Array.isArray(v)) continue;
    const ids = [...new Set(v.filter((x) => typeof x === 'string' && ID.test(x)))].slice(0, 40);
    if (ids.length) add[k] = ids;
  }
  const sections = [...new Set((Array.isArray(value.sections) ? value.sections : []).filter((x) => typeof x === 'string' && ID.test(x)))].slice(0, 20);
  // Reworded lines and headings, by key; blank wording means "back to the standard one", so it's dropped.
  const edit = {};
  for (const [k, v] of Object.entries(value.edit && typeof value.edit === 'object' ? value.edit : {}).slice(0, 100)) {
    if (!CONTRACT_KEY.test(k) || typeof v !== 'string') continue;
    const text = v.replace(/\s+/g, ' ').trim().slice(0, 600);
    if (text) edit[k] = text;
  }
  if (!off.length && !Object.keys(add).length && !sections.length && !Object.keys(edit).length) return null;
  return { ...(off.length ? { off } : {}), ...(Object.keys(add).length ? { add } : {}), ...(sections.length ? { sections } : {}), ...(Object.keys(edit).length ? { edit } : {}) };
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
    if (clean === null || clean === '' || (Array.isArray(clean) && clean.length === 0 && k !== 'asked')) delete next[k];
    else next[k] = clean;
  }
  // A package or kind of site picked with no pages yet gets that kind's usual pages as a starting point.
  if ((patch?.tier || patch?.siteType) && next.tier && !next.pages) next.pages = defaultPagesFor(next.tier, siteTypeFor(next));
  return { answers: next, dropped };
}

/**
 * The answers a lead already gives us: a contact-form submission's own fields, and for a lead
 * from the outreach board (2026-11-03) its town, why Daniel reached out, where it came from and
 * the last few touches, so the meeting starts with the story in front of him. A mock-up built for
 * the lead (2026-11-09) comes along too, so the project starts from it rather than from nothing.
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
    mockUrl: lead.mock_url ?? '',
    notes,
  });
  return answers;
}

/** The questions a kind of site asks by default, within a package: the preset the menu starts from. */
export function presetFor(answers) {
  const kind = siteTypeFor(answers);
  return Object.values(fields).filter((f) => {
    const ask = f.ask ?? 'all';
    return ask === 'always' || ask === 'all' || (Array.isArray(ask) && ask.includes(kind));
  }).map((f) => f.id);
}

/**
 * The questions this project asks: Daniel's own list when he has made one (plus the ones always
 * asked), else the preset for its kind of site. `preset` says which it is, so the menu can offer
 * a way back.
 */
export function askedFor(answers) {
  const own = Array.isArray(answers.asked);
  const ids = own ? [...new Set([...alwaysAsked, ...answers.asked])] : presetFor(answers);
  return { asked: ids, preset: !own };
}

/**
 * Whether a question is on this project's form: its package (a section or field with `tiers`
 * shows only for those), its `when` answer, and the asked list. A tier id alone still works, for
 * the package check by itself.
 */
export function applies(field, answers) {
  const a = typeof answers === 'string' ? { tier: answers } : answers ?? {};
  const tier = a.tier;
  if (field.sectionTiers && !field.sectionTiers.includes(tier)) return false;
  if (field.tiers && !field.tiers.includes(tier)) return false;
  if (typeof answers === 'string') return true;
  if (field.when && !a[field.when]) return false;
  return askedFor(a).asked.includes(field.id);
}

/**
 * Where the answers stand against the package: what's still missing before a first version can
 * start, and every place the answers go past what the package covers. Scope notes never block a
 * build — Daniel decides — they make sure nothing past the package slips in unpriced. Only a
 * question that is asked can be missing: a store never waits on "Where they work".
 */
export function check(answers) {
  const tier = tierById(answers.tier);
  const { asked, preset } = askedFor(answers);
  const missing = Object.values(fields)
    .filter((f) => f.required && asked.includes(f.id) && (!tier || applies(f, tier.id)))
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
  return { ready: missing.length === 0, missing, scope, price, pricing: priced, tier: tier ? { id: tier.id, name: tier.name, price: tier.price, from: !!tier.from, scope: tier.scope } : null, siteType: siteTypeFor(answers), asked, preset };
}

/** A repo-safe slug from the business name: `client-<slug>` is the repo the build makes. */
export function slugFor(name) {
  const s = String(name ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return s || null;
}
