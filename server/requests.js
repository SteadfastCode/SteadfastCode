// Change requests (2026-11-20): one record per thing a client asks to change, linked to the message
// it came from (migrations/0020_change_requests.sql). The record shows twice: as a card under that
// message, on both sides, and as a row in the project's request queue on /admin. One store, two views.
//
// A request moves along:
//
//   received → working → preview → approved → live
//                                             closed (not being done, with Daniel's note saying why)
//
// Daniel moves it. The one step that is the client's is preview → approved: "Looks good", which
// tells Daniel it can go live. Until the table exists every list reads as empty, like messages.

/** What a request is about; the "Make a change" choices map onto these. */
export const KINDS = ['details', 'photos', 'reword', 'section', 'page', 'broken', 'other'];
export const STATUSES = ['received', 'working', 'preview', 'approved', 'live', 'closed'];
/** A request is open until it's live or closed; the queue shows open ones first. */
export const isOpen = (status) => status !== 'live' && status !== 'closed';

export const MAX_TITLE = 160;
export const MAX_NOTE = 600;

const oneLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const text = (value) => String(value ?? '').replace(/\r\n/g, '\n').trim();

/** A new request: a title, a kind (anything unknown is "other"), and maybe the message it's from. */
export function cleanRequest(body) {
  const title = oneLine(body?.title);
  if (!title) return { error: 'Say what the request is first.' };
  if (title.length > MAX_TITLE) return { error: `Keep it under ${MAX_TITLE} characters.` };
  const messageId = body?.messageId === undefined || body?.messageId === null ? null : Number(body.messageId);
  if (messageId !== null && !Number.isInteger(messageId)) return { error: 'That isn’t a message.' };
  return { title, kind: KINDS.includes(body?.kind) ? body.kind : 'other', messageId };
}

/** Daniel's change to a request: any of its status, note, title and kind. Returns the columns to set. */
export function adminChange(body, now = new Date().toISOString()) {
  const set = {};
  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) return { error: 'That isn’t a status.' };
    set.status = body.status;
  }
  if (body?.note !== undefined) {
    const note = text(body.note);
    if (note.length > MAX_NOTE) return { error: `Keep the note under ${MAX_NOTE} characters.` };
    set.note = note || null;
  }
  if (body?.title !== undefined) {
    const title = oneLine(body.title);
    if (!title) return { error: 'Say what the request is first.' };
    if (title.length > MAX_TITLE) return { error: `Keep it under ${MAX_TITLE} characters.` };
    set.title = title;
  }
  if (body?.kind !== undefined) {
    if (!KINDS.includes(body.kind)) return { error: 'That isn’t a kind of request.' };
    set.kind = body.kind;
  }
  if (!Object.keys(set).length) return { error: 'Nothing to change.' };
  set.updated_at = now;
  return { set };
}

/** The client's one move: "Looks good" on a request that's on their preview. */
export function clientChange(request, body, now = new Date().toISOString()) {
  if (body?.approved !== true) return { error: 'Nothing to change.' };
  if (request.status !== 'preview') return { error: 'This one isn’t waiting on you right now.' };
  return { set: { status: 'approved', updated_at: now } };
}

const shape = (row) => ({
  id: row.id,
  messageId: row.message_id,
  kind: row.kind,
  title: row.title,
  status: row.status,
  note: row.note,
  // How it travels (server/changes.js): instant | preview | daniel; null on one Daniel opened himself.
  lane: row.lane ?? null,
  field: row.field ?? null,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** A project's requests, oldest first. Empty until the table exists. */
export async function listRequests(env, projectId) {
  const rows = await env.INTAKE.prepare('SELECT * FROM change_requests WHERE project_id = ? ORDER BY id LIMIT 500').bind(projectId).all().catch(() => null);
  return (rows?.results ?? []).map(shape);
}

export const getRequest = (env, projectId, requestId) =>
  env.INTAKE.prepare('SELECT * FROM change_requests WHERE id = ? AND project_id = ?').bind(Number(requestId), projectId).first();

/**
 * Opens a request. With `messageId` it hangs on that message, which must be on this project and
 * not carry a request already. Without one, a message is written for it (from whoever opened it),
 * so every request has a place in the conversation.
 */
export async function openRequest(env, projectId, { title, kind, messageId }, { by, name }) {
  const now = new Date().toISOString();
  let onMessage = messageId;
  if (onMessage !== null) {
    const message = await env.INTAKE.prepare('SELECT id FROM messages WHERE id = ? AND project_id = ?').bind(onMessage, projectId).first();
    if (!message) return { error: 'That message isn’t in this conversation.' };
    const taken = await env.INTAKE.prepare('SELECT id FROM change_requests WHERE message_id = ?').bind(onMessage).first();
    if (taken) return { error: 'That message is already a request.' };
  } else {
    const written = await env.INTAKE.prepare('INSERT INTO messages (project_id, at, sender, name, body) VALUES (?, ?, ?, ?, ?)')
      .bind(projectId, now, by, name || null, title).run();
    onMessage = written.meta?.last_row_id ?? null;
  }
  const made = await env.INTAKE.prepare('INSERT INTO change_requests (project_id, message_id, kind, title, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(projectId, onMessage, kind, title, 'received', by, now, now).run();
  return { id: made.meta?.last_row_id ?? null };
}

/** Writes the columns from adminChange or clientChange. Column names come from those, never a request body. */
export async function saveRequest(env, requestId, set) {
  const columns = Object.keys(set);
  await env.INTAKE.prepare(`UPDATE change_requests SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`)
    .bind(...columns.map((column) => set[column]), Number(requestId)).run();
}

/** Each message with the request that hangs on it, if any: what both conversations draw the card from. */
export async function withRequests(env, projectId, messages) {
  const byMessage = new Map((await listRequests(env, projectId)).filter((request) => request.messageId !== null).map((request) => [request.messageId, request]));
  return messages.map((message) => (byMessage.has(message.id) ? { ...message, request: byMessage.get(message.id) } : message));
}

/** Said when the table isn't there yet (the migration hasn't been run). */
export const NOT_READY = 'Requests aren’t ready yet: migration 0020_change_requests.sql hasn’t been run on the database.';
