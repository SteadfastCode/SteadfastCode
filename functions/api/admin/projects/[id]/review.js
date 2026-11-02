// POST /api/admin/projects/:id/review: Daniel has looked at what was flagged; clear it.
import { json } from '../../_middleware.js';
import { logEvent } from '../../../../../server/view.js';

export async function onRequestPost({ env, params }) {
  const r = await env.INTAKE.prepare('UPDATE projects SET review_needed = NULL WHERE id = ?').bind(params.id).run();
  if (!r.meta?.changes) return json({ error: 'No such project.' }, 404);
  await logEvent(env, params.id, 'daniel', 'Daniel reviewed the flagged changes');
  return json({ ok: true });
}
