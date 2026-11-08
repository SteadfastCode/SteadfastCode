// Messages between a client and Daniel (2026-11-04): one conversation per project. Reading marks
// the other side's messages read (a page polling in the background peeks instead, so a message
// stays unread, and the box still tells Daniel, until someone is actually looking); Daniel's replies
// email the client a note with their link. The table is migrations/0013_messages.sql; until it
// exists, counts read as zero, never an error.
import { newToken, hashToken, sealToken, openToken, LINK_DAYS } from './client.js';

export const MAX_MESSAGE = 4000;

export function cleanMessage(body) {
  const text = typeof body?.body === 'string' ? body.body.replace(/\r\n/g, '\n').trim() : '';
  if (!text) return { error: 'Write a message first.' };
  if (text.length > MAX_MESSAGE) return { error: `Keep it under ${MAX_MESSAGE.toLocaleString('en-US')} characters.` };
  return { text };
}

/** Unread for one side: messages the other side sent that this side hasn't opened. */
export async function unreadFor(env, projectId, side) {
  const from = side === 'daniel' ? 'client' : 'daniel';
  const r = await env.INTAKE.prepare('SELECT COUNT(*) AS n FROM messages WHERE project_id = ? AND sender = ? AND read_at IS NULL').bind(projectId, from).first().catch(() => null);
  return r?.n ?? 0;
}

/** The conversation, oldest first; opening it as one side marks the other side's messages read, unless it's only a peek (a poll from a window nobody is looking at). */
export async function thread(env, projectId, side, { markRead = true } = {}) {
  const from = side === 'daniel' ? 'client' : 'daniel';
  if (markRead) await env.INTAKE.prepare('UPDATE messages SET read_at = ? WHERE project_id = ? AND sender = ? AND read_at IS NULL').bind(new Date().toISOString(), projectId, from).run();
  const { results } = await env.INTAKE.prepare('SELECT id, at, sender, name, body, read_at FROM messages WHERE project_id = ? ORDER BY id LIMIT 500').bind(projectId).all();
  return results;
}

export async function addMessage(env, projectId, sender, name, text) {
  const at = new Date().toISOString();
  const r = await env.INTAKE.prepare('INSERT INTO messages (project_id, at, sender, name, body) VALUES (?, ?, ?, ?, ?)').bind(projectId, at, sender, name || null, text).run();
  return { id: r.meta?.last_row_id ?? null, at };
}

/**
 * A link that works today for emailing the client: the newest one that is still live, or, when
 * none is (expired, revoked, or made before links were kept), a new one. Older links keep working.
 * Shared by "Email me my link" and Daniel's replies, so neither ever emails a dead link.
 */
export async function tokenForEmail(env, projectId, now = new Date()) {
  const live = await env.INTAKE.prepare('SELECT token_enc FROM client_links WHERE project_id = ? AND revoked_at IS NULL AND expires_at > ? AND token_enc IS NOT NULL ORDER BY created_at DESC LIMIT 1').bind(projectId, now.toISOString()).first();
  const kept = live ? await openToken(env, live.token_enc) : null;
  if (kept) return kept;
  const token = newToken();
  await env.INTAKE.prepare('INSERT INTO client_links (id, project_id, token_hash, token_enc, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), projectId, await hashToken(token), await sealToken(env, token), now.toISOString(), new Date(now.getTime() + LINK_DAYS * 86400_000).toISOString()).run();
  return token;
}

/** Daniel wrote: tell the client by email, with a link that works, never the message itself. */
export async function emailClientAboutReply(env, project, messageId, origin) {
  const answers = JSON.parse(project.answers);
  const to = String(answers.email ?? '').trim();
  if (!env.RESEND_API_KEY || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false;
  const token = await tokenForEmail(env, project.id).catch(() => null);
  const first = (answers.contactName || '').split(' ')[0];
  const text = [
    `Hi${first ? ' ' + first : ''},`,
    '',
    `Daniel sent you a message about ${answers.businessName || 'your website'}.`,
    '',
    token ? `Read and reply here: ${origin}/client#${token}` : `Read and reply at ${origin}/client: type your email there and we'll send you your link.`,
    '',
    '— Steadfast Code',
  ].join('\n');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: env.CONTACT_FROM || 'Steadfast Code <site@steadfastcode.tech>', to: [to], reply_to: env.CONTACT_TO || 'support@steadfastcode.tech', subject: `New message from Daniel · ${answers.businessName || 'Steadfast Code'}`, text }),
  }).catch(() => null);
  if (r?.ok && messageId) await env.INTAKE.prepare('UPDATE messages SET emailed_at = ? WHERE id = ?').bind(new Date().toISOString(), messageId).run();
  return !!r?.ok;
}
