// GET /api/client/messages: the conversation with Daniel (opening it marks his messages read;
// with ?peek=1 it doesn't, for a poll from a window the client isn't looking at).
// POST /api/client/messages { body }: write to Daniel. The box tells him by push, or on Signal.
import { json } from './_middleware.js';
import { cleanMessage, thread, addMessage } from '../../../server/messages.js';

export async function onRequestGet({ request, env, data }) {
  return json({ messages: await thread(env, data.project.id, 'client', { markRead: !new URL(request.url).searchParams.has('peek') }) });
}

export async function onRequestPost({ request, env, data }) {
  const m = cleanMessage(await request.json().catch(() => null));
  if (m.error) return json({ error: m.error }, 400);
  const name = (JSON.parse(data.project.answers).contactName || '').trim();
  await addMessage(env, data.project.id, 'client', name, m.text);
  return json({ messages: await thread(env, data.project.id, 'client') });
}
