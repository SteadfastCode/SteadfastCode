// GET /api/app-apk/<file>?t=<exp.hmac>: the admin app's APK, for the app's own native download
// (server/apk.js). Not behind Cloudflare Access, because a native download can't carry its sign-in:
// the signed, expiring link from /api/admin/app-apk is the permission instead.
import { APK_PREFIX, verifyDownload } from '../../../server/apk.js';

export async function onRequestGet({ request, env, params }) {
  const t = new URL(request.url).searchParams.get('t');
  if (!env.UPLOADS || !(await verifyDownload(env, params.file, t))) return new Response('Not found', { status: 404 });
  const obj = await env.UPLOADS.get(APK_PREFIX + params.file);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, { headers: { 'content-type': 'application/vnd.android.package-archive', 'content-length': String(obj.size), 'cache-control': 'private, no-store', 'content-disposition': `attachment; filename="${params.file}"` } });
}
