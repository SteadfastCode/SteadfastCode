// GET /api/client/messages: the conversation with Daniel (opening it marks his messages read).
// POST /api/client/messages { body }: write to Daniel. The box tells him on Signal.
import { json } from './_middleware.js';
import { cleanMessage, thread, addMessage } from '../../../server/messages.js';

export async function onRequestGet({ env, data }) {
  return json({ messages: await thread(env, data.project.id, 'client') });
}

export async function onRequestPost({ request, env, data }) {
  const m = cleanMessage(await request.json().catch(() => null));
  if (m.error) return json({ error: m.error }, 400);
  const name = (JSON.parse(data.project.answers).contactName || '').trim();
  await addMessage(env, data.project.id, 'client', name, m.text);
  return json({ messages: await thread(env, data.project.id, 'client') });
}
