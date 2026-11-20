// What a project still needs from the client (2026-11-19): a running list on the project, kept by
// Daniel and seen by the client (migrations/0019_assets_needed.sql). An item moves one way:
//
//   needed   → Daniel added it, the client hasn't sent it
//   sent     → the client says they've sent it, with a note saying where it is
//   received → Daniel has it
//
// Either side can step an item back (the client un-sends, Daniel says it's still needed). Until the
// table exists the list reads as empty, never an error, like messages.

export const MAX_TITLE = 120;
export const MAX_DETAIL = 600;
export const MAX_NOTE = 600;
export const STATUSES = ['needed', 'sent', 'received'];

const oneLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const text = (value) => String(value ?? '').replace(/\r\n/g, '\n').trim();

/** A new item from Daniel: a title is required, the detail is optional. */
export function cleanAsset(body) {
  const title = oneLine(body?.title);
  const detail = text(body?.detail);
  if (!title) return { error: 'Say what’s needed first.' };
  if (title.length > MAX_TITLE) return { error: `Keep the name under ${MAX_TITLE} characters.` };
  if (detail.length > MAX_DETAIL) return { error: `Keep the note under ${MAX_DETAIL} characters.` };
  return { title, detail: detail || null };
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

/**
 * The client's change: they sent it (with a note saying where), or they take that back. They can't
 * touch an item Daniel has already received, or its title and detail.
 */
export function clientChange(item, body, now = new Date().toISOString()) {
  if (item.status === 'received') return { error: 'Daniel already has this one.' };
  if (typeof body?.sent !== 'boolean') return { error: 'Nothing to change.' };
  const note = text(body.note);
  if (note.length > MAX_NOTE) return { error: `Keep the note under ${MAX_NOTE} characters.` };
  if (body.sent) return { set: { status: 'sent', sent_at: now, client_note: note || null } };
  return { set: { status: 'needed', sent_at: null, client_note: null } };
}

/** The list as both sides see it, in the order Daniel added it. */
export async function listAssets(env, projectId) {
  const rows = await env.INTAKE.prepare('SELECT id, title, detail, status, client_note, created_at, sent_at, received_at FROM assets_needed WHERE project_id = ? ORDER BY id LIMIT 200')
    .bind(projectId).all().catch(() => null);
  return (rows?.results ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    detail: row.detail,
    status: row.status,
    clientNote: row.client_note,
    createdAt: row.created_at,
    sentAt: row.sent_at,
    receivedAt: row.received_at,
  }));
}

export const getAsset = (env, projectId, assetId) =>
  env.INTAKE.prepare('SELECT * FROM assets_needed WHERE id = ? AND project_id = ?').bind(Number(assetId), projectId).first();

export async function addAsset(env, projectId, { title, detail }) {
  await env.INTAKE.prepare("INSERT INTO assets_needed (project_id, title, detail, status, created_at) VALUES (?, ?, ?, 'needed', ?)")
    .bind(projectId, title, detail, new Date().toISOString()).run();
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
