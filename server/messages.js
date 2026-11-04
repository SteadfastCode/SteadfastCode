// Messages between a client and Daniel (2026-11-04): one conversation per project. Reading marks
// the other side's messages read; Daniel's replies email the client a note with their link. The
// table is migrations/0013_messages.sql; until it exists, counts read as zero, never an error.
import { openToken } from './client.js';

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

/** The conversation, oldest first; opening it as one side marks the other side's messages read. */
export async function thread(env, projectId, side) {
  const from = side === 'daniel' ? 'client' : 'daniel';
  await env.INTAKE.prepare('UPDATE messages SET read_at = ? WHERE project_id = ? AND sender = ? AND read_at IS NULL').bind(new Date().toISOString(), projectId, from).run();
  const { results } = await env.INTAKE.prepare('SELECT id, at, sender, name, body, read_at FROM messages WHERE project_id = ? ORDER BY id LIMIT 500').bind(projectId).all();
  return results;
}

export async function addMessage(env, projectId, sender, name, text) {
  const at = new Date().toISOString();
  const r = await env.INTAKE.prepare('INSERT INTO messages (project_id, at, sender, name, body) VALUES (?, ?, ?, ?, ?)').bind(projectId, at, sender, name || null, text).run();
  return { id: r.meta?.last_row_id ?? null, at };
}

/** Daniel wrote: tell the client by email, with their link when one is kept, never the message itself. */
export async function emailClientAboutReply(env, project, messageId, origin) {
  const answers = JSON.parse(project.answers);
  const to = String(answers.email ?? '').trim();
  if (!env.RESEND_API_KEY || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return false;
  const link = await env.INTAKE.prepare('SELECT token_enc FROM client_links WHERE project_id = ? AND revoked_at IS NULL AND token_enc IS NOT NULL ORDER BY created_at DESC LIMIT 1').bind(project.id).first();
  const token = link ? await openToken(env, link.token_enc) : null;
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
