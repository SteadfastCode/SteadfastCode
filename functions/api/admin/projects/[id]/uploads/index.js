// POST /api/admin/projects/:id/uploads — Daniel adds a photo or logo (server/uploads.js).
import { json } from '../../../_middleware.js';
import { saveUpload } from '../../../../../../server/uploads.js';

export async function onRequestPost({ request, env, params }) {
  const p = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
  if (!p) return json({ error: 'No such project.' }, 404);
  const r = await saveUpload(env, p, await request.formData().catch(() => null), { source: 'admin', who: 'daniel', whoLabel: 'Daniel' });
  return r.error ? json({ error: r.error }, r.status) : json(r.upload, r.status);
}
