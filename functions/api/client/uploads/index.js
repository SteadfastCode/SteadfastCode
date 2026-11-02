// POST /api/client/uploads (multipart: file, kind = logo|photo, caption?) — server/uploads.js.
import { json } from '../_middleware.js';
import { saveUpload } from '../../../../server/uploads.js';
import { clientName } from '../project.js';

export async function onRequestPost({ request, env, data }) {
  const r = await saveUpload(env, data.project, await request.formData().catch(() => null), { source: 'client', who: 'client', whoLabel: clientName(JSON.parse(data.project.answers)) });
  return r.error ? json({ error: r.error }, r.status) : json(r.upload, r.status);
}
