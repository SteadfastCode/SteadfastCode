// What a project still needs from the client (2026-11-19): a running list on the project, kept by
// Daniel and seen by the client (migrations/0019_assets_needed.sql). An item moves one way:
//
//   needed   → Daniel added it, the client hasn't sent it
//   sent     → the client says they've sent it, with a note saying where it is
//   received → Daniel has it
//
// Either side can step an item back (the client un-sends, Daniel says it's still needed). Until the
// table exists the list reads as empty, never an error, like messages.
//
// Each item says which inputs the client gets on its card (2026-11-20, migration 0022): photos and
// files are uploaded there (server/uploads.js ties each upload to its item), a link, and a typed
// answer. Giving anything through an input marks the item sent; "I sent it another way" is always
// there too, with a note saying where.

export const MAX_TITLE = 120;
export const MAX_DETAIL = 600;
export const MAX_NOTE = 600;
export const STATUSES = ['needed', 'sent', 'received'];
/** What a card can ask for, in the order the card shows them. */
export const INPUTS = ['photos', 'files', 'link', 'text'];
export const MAX_LINK = 500;
export const MAX_ANSWER = 4000;

/** The inputs a request body names, known ones only, in card order. Null when it names none. */
export function cleanInputs(value) {
  if (!Array.isArray(value)) return null;
  const chosen = INPUTS.filter((input) => value.includes(input));
  return chosen.length ? chosen : null;
}

/** An item's inputs as stored (a JSON list, or nothing on an item from before inputs existed). */
export function inputsOf(item) {
  try { return cleanInputs(JSON.parse(item?.inputs || '[]')) ?? []; } catch { return []; }
}

const oneLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const text = (value) => String(value ?? '').replace(/\r\n/g, '\n').trim();

/** A new item from Daniel: a title is required, the detail is optional. */
export function cleanAsset(body) {
  const title = oneLine(body?.title);
  const detail = text(body?.detail);
  if (!title) return { error: 'Say what’s needed first.' };
  if (title.length > MAX_TITLE) return { error: `Keep the name under ${MAX_TITLE} characters.` };
  if (detail.length > MAX_DETAIL) return { error: `Keep the note under ${MAX_DETAIL} characters.` };
  return { title, detail: detail || null, inputs: cleanInputs(body?.inputs) };
}

/**
 * Daniel's change to an item: any of its title, detail and status. Returns the columns to set, with
 * the timestamps that go with a status (received_at when he has it; cleared when it's needed again).
 */
export function adminChange(body, now = new Date().toISOString()) {
  const set = {};
  if (body?.title !== undefined) {
    const title = oneLine(body.title);
    if (!title) return { error: 'Say what’s needed first.' };
    if (title.length > MAX_TITLE) return { error: `Keep the name under ${MAX_TITLE} characters.` };
    set.title = title;
  }
  if (body?.detail !== undefined) {
    const detail = text(body.detail);
    if (detail.length > MAX_DETAIL) return { error: `Keep the note under ${MAX_DETAIL} characters.` };
    set.detail = detail || null;
  }
  if (body?.inputs !== undefined) {
    const inputs = cleanInputs(body.inputs);
    set.inputs = inputs ? JSON.stringify(inputs) : null;
  }
  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) return { error: 'That isn’t a status.' };
    set.status = body.status;
    if (body.status === 'received') set.received_at = now;
    if (body.status === 'needed') { set.sent_at = null; set.received_at = null; }
    if (body.status === 'sent') set.received_at = null;
  }
  if (!Object.keys(set).length) return { error: 'Nothing to change.' };
  return { set };
}

/** A link the client typed: http or https only, so it's safe to show as a link on Daniel's page. */
function cleanLink(value) {
  const link = oneLine(value);
  if (!link) return { link: null };
  if (link.length > MAX_LINK) return { error: `Keep the link under ${MAX_LINK} characters.` };
  let url;
  try { url = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`); } catch { return { error: 'That doesn’t look like a link.' }; }
  if (!/^https?:$/.test(url.protocol) || !url.hostname.includes('.')) return { error: 'That doesn’t look like a link.' };
  return { link: url.href };
}

/**
 * The client's change to an item, one of:
 *   { sent: true, note }   they sent it another way, and where it is; { sent: false } takes that back
 *   { link }               the link, on an item that takes one
 *   { answer }             the typed answer, on an item that takes one
 * Giving a link or an answer marks the item sent. They can't touch an item Daniel has already
 * received, or its title, detail and inputs.
 */
export function clientChange(item, body, now = new Date().toISOString()) {
  if (item.status === 'received') return { error: 'Daniel already has this one.' };
  const allowed = inputsOf(item);
  const nowSent = item.status === 'needed' ? { status: 'sent', sent_at: now } : {};

  if (body?.link !== undefined) {
    if (!allowed.includes('link')) return { error: 'This one doesn’t take a link.' };
    const cleaned = cleanLink(body.link);
    if (cleaned.error) return { error: cleaned.error };
    return { set: { link: cleaned.link, ...(cleaned.link ? nowSent : {}) } };
  }
  if (body?.answer !== undefined) {
    if (!allowed.includes('text')) return { error: 'This one doesn’t take a typed answer.' };
    const answer = text(body.answer);
    if (answer.length > MAX_ANSWER) return { error: `Keep it under ${MAX_ANSWER.toLocaleString('en-US')} characters.` };
    return { set: { answer: answer || null, ...(answer ? nowSent : {}) } };
  }
  if (typeof body?.sent !== 'boolean') return { error: 'Nothing to change.' };
  const note = text(body.note);
  if (note.length > MAX_NOTE) return { error: `Keep the note under ${MAX_NOTE} characters.` };
  if (body.sent) return { set: { status: 'sent', sent_at: now, client_note: note || null } };
  return { set: { status: 'needed', sent_at: null, client_note: null } };
}

/** The list as both sides see it, in the order Daniel added it. */
export async function listAssets(env, projectId) {
  // SELECT *: the input columns come from a later migration, and the list must read without them.
  const rows = await env.INTAKE.prepare('SELECT * FROM assets_needed WHERE project_id = ? ORDER BY id LIMIT 200')
    .bind(projectId).all().catch(() => null);
  return (rows?.results ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    detail: row.detail,
    status: row.status,
    clientNote: row.client_note,
    inputs: inputsOf(row),
    link: row.link ?? null,
    answer: row.answer ?? null,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    receivedAt: row.received_at,
  }));
}

export const getAsset = (env, projectId, assetId) =>
  env.INTAKE.prepare('SELECT * FROM assets_needed WHERE id = ? AND project_id = ?').bind(Number(assetId), projectId).first();

export async function addAsset(env, projectId, { title, detail, inputs }) {
  const now = new Date().toISOString();
  // An item with no inputs is written the way it was before inputs existed, so adding one works
  // on a database that hasn't had migration 0022 yet.
  if (!inputs) {
    await env.INTAKE.prepare("INSERT INTO assets_needed (project_id, title, detail, status, created_at) VALUES (?, ?, ?, 'needed', ?)").bind(projectId, title, detail, now).run();
    return;
  }
  await env.INTAKE.prepare("INSERT INTO assets_needed (project_id, title, detail, inputs, status, created_at) VALUES (?, ?, ?, ?, 'needed', ?)")
    .bind(projectId, title, detail, JSON.stringify(inputs), now).run();
}

/**
 * An upload landed on an item's card: a needed item becomes sent. Returns true when that is news
 * (it was still needed), so the caller tells Daniel once, not once per photo.
 */
export async function markSentByUpload(env, item) {
  if (item.status !== 'needed') return false;
  await saveAsset(env, item.id, { status: 'sent', sent_at: new Date().toISOString() });
  return true;
}

/** Writes the columns from adminChange or clientChange. Column names come from those, never a request. */
export async function saveAsset(env, assetId, set) {
  const columns = Object.keys(set);
  await env.INTAKE.prepare(`UPDATE assets_needed SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`)
    .bind(...columns.map((column) => set[column]), Number(assetId)).run();
}

export const removeAsset = (env, projectId, assetId) =>
  env.INTAKE.prepare('DELETE FROM assets_needed WHERE id = ? AND project_id = ?').bind(Number(assetId), projectId).run();

/** Said when the table isn't there yet (the migration hasn't been run). */
export const NOT_READY = 'The needed-assets list isn’t ready yet: migration 0019_assets_needed.sql hasn’t been run on the database.';
