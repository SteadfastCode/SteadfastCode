// POST /api/admin/projects/:id/signing { open }: let the client sign now, or keep the agreement
// review-only until the meeting.
import { json } from '../../_middleware.js';
import { logEvent } from '../../../../../server/view.js';

export async function onRequestPost({ request, env, params }) {
  const body = await request.json().catch(() => ({}));
  if (typeof body.open !== 'boolean') return json({ error: 'Send { open: true | false }.' }, 400);
  const r = await env.INTAKE.prepare('UPDATE projects SET signing_open = ?, updated_at = ? WHERE id = ?').bind(body.open ? 1 : 0, new Date().toISOString(), params.id).run();
  if (!r.meta?.changes) return json({ error: 'No such project.' }, 404);
  await logEvent(env, params.id, 'daniel', body.open ? 'Daniel opened the agreement for signing' : 'Daniel set the agreement to review only');
  return json({ ok: true, open: body.open });
}
