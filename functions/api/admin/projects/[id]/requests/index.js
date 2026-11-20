// POST /api/admin/projects/:id/requests { title, kind?, messageId? }: open a change request, on a
// client's message when messageId is given, or with a message of its own (server/requests.js).
import { json } from '../../../_middleware.js';
import { cleanRequest, openRequest, listRequests, NOT_READY } from '../../../../../../server/requests.js';
import { logEvent } from '../../../../../../server/view.js';

export async function onRequestPost({ request, env, params }) {
  const project = await env.INTAKE.prepare('SELECT id FROM projects WHERE id = ?').bind(params.id).first();
  if (!project) return json({ error: 'No such project.' }, 404);
  const wanted = cleanRequest(await request.json().catch(() => null));
  if (wanted.error) return json({ error: wanted.error }, 400);
  let opened;
  try {
    opened = await openRequest(env, project.id, wanted, { by: 'daniel', name: 'Daniel' });
  } catch {
    return json({ error: NOT_READY }, 503);
  }
  if (opened.error) return json({ error: opened.error }, 400);
  await logEvent(env, project.id, 'daniel', `Request opened: ${wanted.title}`).catch(() => {});
  return json({ requests: await listRequests(env, project.id) }, 201);
}
