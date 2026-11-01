// Every /api/admin route: a signed-in admin (Cloudflare Access, verified here too), the INTAKE
// database bound, and writes only from this site's own pages.
import { accessEmail, isAdmin } from '../../../server/access.js';

export async function onRequest(context) {
  const { request, env } = context;
  const email = await accessEmail(request, env);
  if (!email || !isAdmin(env, email)) return json({ error: 'Not signed in as an admin.' }, 401);
  if (!env.INTAKE) return json({ error: 'The INTAKE database is not bound to this deployment.' }, 503);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const origin = request.headers.get('origin');
    if (origin !== new URL(request.url).origin) return json({ error: 'Writes only from the admin page.' }, 403);
  }
  context.data.email = email;
  try {
    return await context.next();
  } catch (err) {
    return json({ error: `Server error: ${err.message}` }, 500);
  }
}

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
