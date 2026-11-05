// GET /api/admin/app-apk: the published admin app build (server/apk.js), with a ten-minute download
// link for the app to fetch it natively. 404 when nothing is published yet.
import { json } from './_middleware.js';
import { APK_MANIFEST, signDownload } from '../../../server/apk.js';

export async function onRequestGet({ request, env }) {
  if (!env.UPLOADS) return json({ error: 'No storage bound.' }, 503);
  const obj = await env.UPLOADS.get(APK_MANIFEST);
  if (!obj) return json({ error: 'No app build published yet.' }, 404);
  const m = await obj.json();
  const t = await signDownload(env, m.file);
  if (!t) return json({ error: 'Downloads need the LINK_KEY secret.' }, 503);
  return json({ ...m, url: `${new URL(request.url).origin}/api/app-apk/${m.file}?t=${t}` });
}
