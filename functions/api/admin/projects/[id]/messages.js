// GET /api/admin/projects/:id/messages: the conversation with this client (marks theirs read;
// with ?peek=1 it doesn't, for a poll from a window Daniel isn't looking at).
// POST /api/admin/projects/:id/messages { body }: reply; the client gets an email with their link.
import { json } from '../../_middleware.js';
import { cleanMessage, thread, addMessage, emailClientAboutReply } from '../../../../../server/messages.js';

const project = (env, id) => env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();

export async function onRequestGet({ request, env, params }) {
  const p = await project(env, params.id);
  if (!p) return json({ error: 'No such project.' }, 404);
  return json({ messages: await thread(env, p.id, 'daniel', { markRead: !new URL(request.url).searchParams.has('peek') }) });
}

export async function onRequestPost({ request, env, params }) {
  const p = await project(env, params.id);
  if (!p) return json({ error: 'No such project.' }, 404);
  const m = cleanMessage(await request.json().catch(() => null));
  if (m.error) return json({ error: m.error }, 400);
  const { id } = await addMessage(env, p.id, 'daniel', 'Daniel', m.text);
  const emailed = await emailClientAboutReply(env, p, id, new URL(request.url).origin);
  return json({ emailed, messages: await thread(env, p.id, 'daniel') });
}
