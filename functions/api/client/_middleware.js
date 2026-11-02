// Every /api/client route: a live private link (not expired, not revoked) for one project. The
// token comes as a bearer header; image GETs may carry it as ?t= because an <img> can't send headers.
// Writes only from this site's own pages. Not behind Cloudflare Access: the link is the login.
import { hashToken } from '../../../server/client.js';
import { agreementState } from '../../../server/agreement.js';

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.INTAKE) return json({ error: 'Not available right now.' }, 503);
  const url = new URL(request.url);
  const bearer = (request.headers.get('authorization') || '').match(/^Bearer\s+(\S+)$/)?.[1];
  const token = bearer || (request.method === 'GET' ? url.searchParams.get('t') : null);
  if (!token || token.length < 20 || token.length > 100) return json({ error: 'This link isn’t valid. Ask Daniel for a new one.' }, 401);
  const link = await env.INTAKE.prepare('SELECT * FROM client_links WHERE token_hash = ?').bind(await hashToken(token)).first();
  const now = new Date().toISOString();
  if (!link || link.revoked_at || link.expires_at < now) return json({ error: 'This link has expired or been turned off. Ask Daniel for a new one.' }, 401);
  if (request.method !== 'GET' && request.method !== 'HEAD' && request.headers.get('origin') !== url.origin) return json({ error: 'Changes only from your project page.' }, 403);
  const project = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(link.project_id).first();
  if (!project || project.status === 'closed') return json({ error: 'This project isn’t open anymore.' }, 404);
  // Mark the link used at most once a minute, so a page polling for build progress isn't a write every 3 s.
  if (!link.last_used_at || Date.parse(now) - Date.parse(link.last_used_at) > 60_000) {
    await env.INTAKE.prepare('UPDATE client_links SET last_used_at = ? WHERE id = ?').bind(now, link.id).run();
  }
  context.data.link = link;
  context.data.project = project;
  // The agreement comes first (2026-11-02): until it's signed for the current package, the only
  // change a client can make is signing it. Reading their page is fine; it shows the agreement.
  if (request.method !== 'GET' && request.method !== 'HEAD' && url.pathname !== '/api/client/agreement') {
    if ((await agreementState(env, project)).needed) return json({ error: 'Sign the agreement first.', needsAgreement: true }, 403);
  }
  try {
    return await context.next();
  } catch (err) {
    return json({ error: 'Something went wrong on our side. Try again in a minute.' }, 500);
  }
}
