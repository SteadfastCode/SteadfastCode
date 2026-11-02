// POST /api/admin/projects/:id/presence { field }: which field Daniel is in, for the client's screen.
import { json } from '../../_middleware.js';
import { setPresence } from '../../../../../server/view.js';

export async function onRequestPost({ request, env, params }) {
  const body = await request.json().catch(() => ({}));
  await setPresence(env, params.id, 'daniel', 'Daniel', body.field ?? null);
  return json({ ok: true });
}
