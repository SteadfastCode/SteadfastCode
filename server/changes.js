// "Make a change" (2026-11-20): what a client can ask for from the block above their message box,
// which lane each ask travels in, and what the block tells them about cost before they send.
//
// The lanes (decided with Daniel 2026-11-19):
//   instant  a fact the client keeps current themselves: phone, email, hours. The answer is saved,
//            and the box writes it straight into the site's content file and deploys. No AI session.
//   preview  rewording and photos: made, then put on the preview for the client to approve.
//   daniel   a new page or section, something broken, anything else: comes to Daniel first.
//
// The coverage line never promises more than the package and the care plans say (src/data/site.ts),
// and says "Daniel will confirm" or "a quote first" whenever it can't be sure.
import { websiteTiers, carePlans } from '../src/data/site.ts';
import { fields, mergeAnswers } from './intake.js';

/** The facts a client changes themselves, each an intake field with its own editor. */
export const INSTANT_FIELDS = ['hours', 'phone', 'email'];

/** Every kind of change the block offers, in the order it lists them. */
export const CHANGE_KINDS = {
  details: { name: 'Business details', hint: 'Hours, phone, email', lane: 'instant' },
  photos: { name: 'Photos', hint: 'Add, replace or remove photos', lane: 'preview' },
  reword: { name: 'Reword something', hint: 'Change the words in one part of your site', lane: 'preview' },
  section: { name: 'Add a section', hint: 'Something new on a page you already have', lane: 'daniel' },
  page: { name: 'Add a page', hint: 'A whole new page', lane: 'daniel' },
  broken: { name: 'Something looks broken', hint: 'Tell Daniel right away', lane: 'daniel' },
  other: { name: 'Something else', hint: 'Anything that doesn’t fit above', lane: 'daniel' },
};

/** What happens after sending, in the client's words, per lane. */
export const LANE_SAYS = {
  instant: 'This goes onto your site on its own, usually within a few minutes.',
  preview: 'Once it’s made you’ll see it on your preview, and it goes live when you say it looks good.',
  daniel: 'This goes to Daniel, who gets back to you about it.',
};

const day = (date) => new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' });

/**
 * Where the project stands on cost: the 30 days of unlimited changes from the first preview, the
 * care plan when one is signed, and how many of the package's pages are used.
 */
export function coverageContext({ answers, firstPreview, care, now = new Date() }) {
  const tier = websiteTiers.find((t) => t.id === answers.tier) ?? null;
  const windowEnds = firstPreview && tier?.scope.changeDays ? new Date(new Date(firstPreview).getTime() + tier.scope.changeDays * 86400_000) : null;
  const plan = care && ['signed', 'active', 'past_due'].includes(care.status) ? carePlans.find((p) => p.id === care.plan) ?? null : null;
  return {
    tierName: tier?.name ?? null,
    pagesAllowed: tier?.scope.pages ?? null,
    pagesUsed: Array.isArray(answers.pages) ? answers.pages.length : 0,
    inWindow: Boolean(windowEnds && now < windowEnds),
    windowEnds: windowEnds ? day(windowEnds) : null,
    plan: plan ? { id: plan.id, name: plan.name } : null,
  };
}

const QUOTE = 'Daniel will send a quote before any work starts.';
/** The monthly changes each care plan includes, as its own terms put it. */
const PLAN_CHANGES = { 'hands-on': 'up to one hour of changes a month', growth: 'up to three hours of changes a month' };

/** The line under a kind of change saying whether it's covered. Honest when it can't be sure. */
export function coverageFor(kind, context) {
  const { inWindow, windowEnds, plan, pagesAllowed, pagesUsed, tierName } = context;
  const unlimited = `changes are unlimited until ${windowEnds}`;
  if (kind === 'details') return 'No charge. These are yours to keep current.';
  if (kind === 'broken') return 'No charge. Anything that doesn’t work the way it should is fixed free.';
  if (kind === 'other') return 'Daniel will tell you whether it’s covered before any work starts.';

  if (kind === 'page') {
    const room = pagesAllowed !== null ? pagesAllowed - pagesUsed : null;
    if (room !== null && room <= 0) return `Your ${tierName} package covers ${pagesAllowed} ${pagesAllowed === 1 ? 'page' : 'pages'} and they’re all used, so ${QUOTE}`;
    if (inWindow) return `Covered: your package has room for ${room === 1 ? 'one more page' : `${room} more pages`}, and ${unlimited}.`;
    if (plan?.id === 'growth') return 'New pages are part of your Growth plan’s monthly changes. Daniel will confirm.';
    return QUOTE;
  }

  if (inWindow) return kind === 'section' ? `Covered if it fits your package: ${unlimited}. Daniel will confirm.` : `Covered: ${unlimited}.`;
  if (plan && PLAN_CHANGES[plan.id]) return `Covered by your ${plan.name} plan (${PLAN_CHANGES[plan.id]})${kind === 'section' ? '. Daniel will confirm.' : '.'}`;
  if (plan?.id === 'hosted' && kind === 'reword') return `A small fix like a typo is covered by your Hosted plan. For anything bigger, ${QUOTE}`;
  return QUOTE;
}

/** The site's named parts as the box published them: [{ key, label }]. Empty until a deploy has. */
export function sitePartsOf(project) {
  try {
    const parts = JSON.parse(project?.site_parts || '[]');
    return Array.isArray(parts) ? parts.filter((part) => part && typeof part.key === 'string' && typeof part.label === 'string').slice(0, 200) : [];
  } catch {
    return [];
  }
}

/** Everything the block needs to draw itself, for the client's view of the project. */
export function changeMenu({ project, answers, firstPreview, care }) {
  const context = coverageContext({ answers, firstPreview, care });
  return {
    kinds: Object.entries(CHANGE_KINDS).map(([id, kind]) => ({ id, name: kind.name, hint: kind.hint, lane: kind.lane, says: LANE_SAYS[kind.lane], coverage: coverageFor(id, context) })),
    instantFields: INSTANT_FIELDS,
    parts: sitePartsOf(project),
  };
}

export const MAX_BODY = 4000;
const oneLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const text = (value) => String(value ?? '').replace(/\r\n/g, '\n').trim();

/**
 * A change the client sent from the block, checked. One of:
 *   { kind: 'details', field, value }   an instant fact; the value is cleaned as the intake cleans it
 *   { kind, body, part? }               anything else, in their words; `part` is the site part it's about
 * Returns what to save: the request's title and message, and for an instant change the new answers.
 */
export function cleanChange(body, { answers, parts = [] }) {
  const kind = body?.kind;
  if (!CHANGE_KINDS[kind]) return { error: 'Pick what you’d like to change first.' };

  if (kind === 'details') {
    const field = body?.field;
    if (!INSTANT_FIELDS.includes(field)) return { error: 'That isn’t one of the details you can change here. Describe it under Something else.' };
    const merged = mergeAnswers(answers, { [field]: body.value });
    if (merged.dropped.includes(field)) return { error: 'That doesn’t look right. Check it and try again.' };
    if (JSON.stringify(merged.answers[field] ?? null) === JSON.stringify(answers[field] ?? null)) return { error: 'That’s what your site already has.' };
    const label = fields[field]?.you || fields[field]?.label || field;
    return { kind, lane: 'instant', field, answers: merged.answers, title: `New ${label.toLowerCase()}`, message: `I changed my ${label.toLowerCase()}.` };
  }

  const words = text(body?.body);
  if (!words) return { error: 'Tell Daniel what you’d like first.' };
  if (words.length > MAX_BODY) return { error: `Keep it under ${MAX_BODY.toLocaleString('en-US')} characters.` };
  const part = parts.find((p) => p.key === body?.part) ?? null;
  const name = CHANGE_KINDS[kind].name;
  // The request's title: the kind, the part when there is one, and the start of what they said.
  const title = oneLine(`${name}${part ? ` (${part.label})` : ''}: ${words}`).slice(0, 160);
  return { kind, lane: CHANGE_KINDS[kind].lane, field: null, answers: null, title, message: part ? `About “${part.label}”: ${words}` : words };
}
