// The outreach board's rules (2026-11-03), kept pure so they are tested without D1: what a lead is,
// how a touch moves its status, how a pasted list is read, and what the CSV holds. The routes under
// functions/api/admin/leads/ do the database work; src/pages/admin/leads.astro is the page.
//
// One table, three kinds, because the outreach is the same motion for all of them: an `inbound`
// lead came to us (the contact form today, Front Desk when it is hosted); a `prospect` is a
// business, church or nonprofit Daniel goes to; a `partner` is a chamber, network or referral
// source that produces prospects. A project starts from an inbound lead or a prospect, never from
// a partner.

import { websiteTiers } from '../src/data/site.ts';

export const KINDS = ['inbound', 'prospect', 'partner'];
export const KIND_LABEL = { inbound: 'Came to us', prospect: 'Prospect', partner: 'Partner' };
export const STATUSES = ['new', 'contacted', 'replied', 'meeting', 'proposal', 'won', 'lost', 'hold'];
export const STATUS_LABEL = { new: 'New', contacted: 'Contacted', replied: 'Replied', meeting: 'Meeting set', proposal: 'Proposal out', won: 'Won', lost: 'Lost', hold: 'On hold' };
/** The statuses a lead is still being worked in; the board's default view. */
export const ACTIVE = ['new', 'contacted', 'replied', 'meeting', 'proposal'];
export const SITE_STATES = ['unknown', 'none', 'facebook', 'outdated', 'slow', 'fine'];
export const SITE_STATE_LABEL = { unknown: 'site not checked', none: 'no website', facebook: 'Facebook only', outdated: 'outdated site', slow: 'slow site', fine: 'site is fine' };
/** What a touch records. `status` is a plain status change; `project` is written when a project starts from the lead. */
export const TOUCH_KINDS = ['note', 'email', 'call', 'text', 'visit', 'video', 'reply', 'meeting', 'status', 'project'];
export const TOUCH_LABEL = { note: 'Note', email: 'Emailed', call: 'Called', text: 'Texted', visit: 'Visited', video: 'Sent a video audit', reply: 'They replied', meeting: 'Met', status: 'Status', project: 'Project started' };
export const TIERS = websiteTiers.map((t) => t.id);

// The board's field names and their columns in `leads` (migrations 0001 and 0011). A contact-form
// submission's name, plan and site are the board's contact, fit and website.
// `mockUrl` (migration 0015): a mock-up Daniel built for the lead before any project exists, on a
// private Pages preview; the board shows it as a link, so he can open it on his phone to show them.
const COLUMN = { business: 'business', contact: 'name', role: 'role', email: 'email', phone: 'phone', website: 'site', town: 'town', category: 'category', source: 'source_detail', why: 'why', nextStep: 'next_step', nextAt: 'next_at', kind: 'kind', status: 'status', siteState: 'site_state', fit: 'plan', mockUrl: 'mock_url' };
const TEXT = { business: 160, contact: 120, role: 80, email: 200, phone: 40, website: 300, town: 80, category: 60, source: 300, why: 1500, nextStep: 300, mockUrl: 300 };
export const TOUCH_TEXT_MAX = 2000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A lead as the page sees it, from a `leads` row. Every field present, every enum valid, however old the row. */
export function leadFromRow(r) {
  return {
    id: r.id,
    kind: KINDS.includes(r.kind) ? r.kind : 'inbound',
    business: r.business ?? '',
    contact: r.name ?? '',
    role: r.role ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    website: r.site ?? '',
    mockUrl: r.mock_url ?? '',
    siteState: SITE_STATES.includes(r.site_state) ? r.site_state : 'unknown',
    town: r.town ?? '',
    category: r.category ?? '',
    fit: TIERS.includes(r.plan) ? r.plan : '',
    status: STATUSES.includes(r.status) ? r.status : r.status === 'started' ? 'won' : r.status === 'closed' ? 'lost' : 'new',
    source: r.source_detail ?? '',
    why: r.why ?? '',
    // What a contact-form visitor wrote; empty for a lead Daniel added.
    message: r.message ?? '',
    nextStep: r.next_step ?? '',
    nextAt: typeof r.next_at === 'string' && DATE_RE.test(r.next_at) ? r.next_at : '',
    createdAt: r.received_at,
    updatedAt: r.updated_at || r.received_at,
  };
}

/** A patch of lead fields, cleaned: text trimmed and capped, enums checked, a bare domain given its scheme. Unknown keys are ignored; bad values are named. */
export function cleanPatch(patch) {
  const out = {};
  const problems = [];
  if (!patch || typeof patch !== 'object') return { patch: out, problems: ['Send an object of fields.'] };
  for (const [k, max] of Object.entries(TEXT)) {
    if (!(k in patch)) continue;
    const v = patch[k];
    if (v == null) out[k] = '';
    else if (typeof v !== 'string') problems.push(`${k} must be text.`);
    else out[k] = v.trim().slice(0, max);
  }
  if (out.website && !/^https?:\/\//i.test(out.website)) out.website = `https://${out.website}`;
  if (out.website && !/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(out.website)) problems.push('The website does not look like an address.');
  if (out.mockUrl && !/^https?:\/\//i.test(out.mockUrl)) out.mockUrl = `https://${out.mockUrl}`;
  if (out.mockUrl && !/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(out.mockUrl)) problems.push('The mock-up link does not look like an address.');
  if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) problems.push('The email does not look like an address.');
  const pick = (k, allowed) => {
    if (!(k in patch)) return;
    if (allowed.includes(patch[k])) out[k] = patch[k];
    else problems.push(`${k} must be one of ${allowed.join(', ')}.`);
  };
  pick('kind', KINDS);
  pick('status', STATUSES);
  pick('siteState', SITE_STATES);
  if ('fit' in patch) {
    if (patch.fit == null || patch.fit === '') out.fit = '';
    else if (TIERS.includes(patch.fit)) out.fit = patch.fit;
    else problems.push(`fit must be one of ${TIERS.join(', ')}, or empty.`);
  }
  if ('nextAt' in patch) {
    const v = patch.nextAt;
    if (v == null || v === '') out.nextAt = '';
    else if (typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(v))) out.nextAt = v;
    else problems.push('nextAt must be a date like 2026-11-09.');
  }
  return { patch: out, problems };
}

// Columns an empty field clears to NULL. `name`, `email` and `message` are NOT NULL from the
// contact form's days, so a blank contact or email stays ''.
const NULLABLE = new Set(['role', 'phone', 'website', 'town', 'category', 'source', 'why', 'nextStep', 'nextAt', 'fit', 'mockUrl']);

/** The SET clause and parameters for a cleaned patch, plus updated_at. */
export function updateStatement(id, patch, now) {
  const keys = Object.keys(patch).filter((k) => COLUMN[k]);
  const sets = keys.map((k) => `${COLUMN[k]} = ?`);
  const params = keys.map((k) => (NULLABLE.has(k) && patch[k] === '' ? null : patch[k]));
  return { sql: `UPDATE leads SET ${[...sets, 'updated_at = ?'].join(', ')} WHERE id = ?`, params: [...params, now, id] };
}

/** A new lead from a form or an import row: the fields, cleaned, with the board's defaults. */
export function newLead(input, { now, id = crypto.randomUUID() } = {}) {
  const { patch, problems } = cleanPatch(input);
  if (!patch.business) problems.push('The business, church or organization name is required.');
  if (problems.length) return { lead: null, problems };
  const lead = leadFromRow({ id, received_at: now, updated_at: now, kind: 'prospect', status: 'new', site_state: 'unknown', message: '' });
  Object.assign(lead, patch);
  return { lead, problems: [] };
}

/** INSERT for a new lead, every column named so the contact form's NOT NULL columns get a value. */
export function insertStatement(lead) {
  return {
    sql: 'INSERT INTO leads (id, received_at, updated_at, kind, name, email, phone, business, plan, site, message, source_detail, status, role, category, town, site_state, why, next_step, next_at, mock_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    params: [lead.id, lead.createdAt, lead.updatedAt, lead.kind, lead.contact, lead.email, lead.phone || null, lead.business, lead.fit || null, lead.website || null, lead.message ?? '', lead.source || null, lead.status, lead.role || null, lead.category || null, lead.town || null, lead.siteState, lead.why || null, lead.nextStep || null, lead.nextAt || null, lead.mockUrl || null],
  };
}

/** Where a touch leaves the status when Daniel does not say: a first email or call is a contact, a reply is a reply, a meeting is a meeting; nothing moves backwards, and nothing comes back from lost or hold on its own. */
export function statusAfter(status, kind) {
  const rank = (s) => STATUSES.indexOf(s);
  if (['email', 'call', 'text', 'visit', 'video'].includes(kind) && status === 'new') return 'contacted';
  if (kind === 'reply' && rank(status) < rank('replied')) return 'replied';
  if (kind === 'meeting' && rank(status) < rank('meeting')) return 'meeting';
  return status;
}

/** A touch from the page, checked: a known kind, text where a note needs it, a status Daniel chose or the one that follows. */
export function cleanTouch(body, lead) {
  const kind = String(body?.kind ?? 'note');
  if (!TOUCH_KINDS.includes(kind) || kind === 'project') return { problems: [`kind must be one of ${TOUCH_KINDS.filter((k) => k !== 'project').join(', ')}.`] };
  const text = String(body?.text ?? '').trim().slice(0, TOUCH_TEXT_MAX);
  if (!text && kind === 'note') return { problems: ['A note needs some text.'] };
  const explicit = body?.status;
  if (explicit != null && explicit !== '' && !STATUSES.includes(explicit)) return { problems: [`status must be one of ${STATUSES.join(', ')}.`] };
  const { patch, problems } = cleanPatch({ ...(body?.nextStep != null ? { nextStep: body.nextStep } : {}), ...(body?.nextAt != null ? { nextAt: body.nextAt } : {}) });
  if (problems.length) return { problems };
  const status = explicit ? explicit : statusAfter(lead.status, kind);
  return { touch: { kind, text: text || TOUCH_LABEL[kind], status: status !== lead.status ? status : null }, patch: { ...patch, ...(status !== lead.status ? { status } : {}) }, problems: [] };
}

// ---------------------------------------------------------------- import

/** Split CSV text into rows of cells, quotes honoured: "a, b" stays one cell, "" inside quotes is a quote, and a quoted cell may run over several lines (a spreadsheet's notes column). Blank lines are skipped. */
export function csvRows(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  const endRow = () => { row.push(cur.trim()); if (row.some((c) => c)) rows.push(row); row = []; cur = ''; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur.trim()); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; endRow(); }
    else cur += c;
  }
  if (cur || row.length) endRow();
  return rows;
}

// What a column may be called, so a spreadsheet exported from anywhere imports without renaming.
const HEADERS = {
  business: ['business', 'businessname', 'company', 'organization', 'organisation', 'org', 'name'],
  contact: ['contact', 'contactname', 'person', 'owner'],
  role: ['role', 'title'],
  email: ['email', 'emailaddress'],
  phone: ['phone', 'tel', 'telephone', 'mobile'],
  website: ['website', 'site', 'url', 'web', 'currentsite'],
  town: ['town', 'city', 'location'],
  category: ['category', 'type', 'industry', 'trade'],
  kind: ['kind'],
  siteState: ['sitestate', 'websitestate'],
  fit: ['fit', 'package', 'tier', 'plan'],
  status: ['status', 'stage'],
  nextStep: ['nextstep', 'next'],
  nextAt: ['nextat', 'nextdate', 'due', 'followup', 'followupdate'],
  source: ['source', 'from'],
  why: ['why', 'reason', 'pitch'],
  notes: ['notes', 'note', 'comments'],
};
const headerKey = (h) => {
  const k = String(h ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return Object.keys(HEADERS).find((f) => HEADERS[f].includes(k)) ?? null;
};

/** Rows from pasted text: a JSON array (or {leads: […]}), else CSV with a header row. Every row is a plain object of field names. */
export function parseImport(text) {
  const t = String(text ?? '').replace(/^﻿/, '').trim();
  if (!t) return { rows: [], problems: ['Nothing to import.'] };
  if (t[0] === '[' || t[0] === '{') {
    try {
      const j = JSON.parse(t);
      const arr = Array.isArray(j) ? j : Array.isArray(j?.leads) ? j.leads : null;
      if (!arr) return { rows: [], problems: ['JSON must be an array of leads, or {"leads": [...]}.'] };
      return { rows: arr.filter((r) => r && typeof r === 'object'), problems: [] };
    } catch (err) { return { rows: [], problems: [`Not valid JSON: ${err.message}`] }; }
  }
  const lines = csvRows(t);
  const header = (lines[0] ?? []).map(headerKey);
  if (!header.includes('business')) return { rows: [], problems: [`The first line must name the columns, and one of them the business (got: ${t.split(/\r?\n/)[0].slice(0, 120)}).`] };
  const rows = [];
  for (const cells of lines.slice(1)) {
    const row = {};
    header.forEach((k, i) => { if (k && cells[i] != null && cells[i] !== '') row[k] = cells[i]; });
    if (Object.keys(row).length) rows.push(row);
  }
  return { rows, problems: [] };
}

export const sameName = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Rows onto the board: one whose business is already there is skipped, never merged over; one that fails cleaning is named. `notes` becomes the lead's first touch. */
export function mergeImport(existingNames, rows, { now, newId = () => crypto.randomUUID() } = {}) {
  const names = new Set([...existingNames].map(sameName));
  const added = [];
  const skipped = [];
  const problems = [];
  for (const [i, row] of rows.entries()) {
    const name = sameName(row.business);
    if (name && names.has(name)) { skipped.push(row.business); continue; }
    const { lead, problems: p } = newLead(row, { now, id: newId() });
    if (!lead) { problems.push(`Row ${i + 1}${row.business ? ` (${row.business})` : ''}: ${p.join(' ')}`); continue; }
    names.add(name);
    added.push({ lead, note: typeof row.notes === 'string' && row.notes.trim() ? row.notes.trim().slice(0, TOUCH_TEXT_MAX) : null });
  }
  return { added, skipped, problems };
}

// ---------------------------------------------------------------- CSV out

const CSV_COLUMNS = ['id', 'kind', 'business', 'category', 'town', 'website', 'siteState', 'mockUrl', 'contact', 'role', 'email', 'phone', 'fit', 'status', 'nextAt', 'nextStep', 'source', 'why', 'message', 'createdAt', 'updatedAt', 'touches'];
// A cell that starts like a formula (=, +, -, @, a tab) gets a leading apostrophe, which spreadsheets
// read as "this is text" and hide: anyone can type into the contact form, and what they type ends up
// in this file, so a cell must never run as a formula when Daniel opens it.
const csvCell = (v) => { const s = String(v ?? '').replace(/^(?=[=+\-@\t\r])/, "'"); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** The board as a spreadsheet; `touches` is the log of each lead, oldest first, in one cell. */
export function toCsv(leads, touchesByLead = new Map()) {
  const rows = leads.map((l) => CSV_COLUMNS.map((c) => (c === 'touches' ? (touchesByLead.get(l.id) ?? []).map((t) => `${String(t.at).slice(0, 16)} ${t.kind}: ${t.text}`).join(' | ') : l[c])).map(csvCell).join(','));
  return [CSV_COLUMNS.join(','), ...rows].join('\n') + '\n';
}
