// POST /api/admin/projects/:id/link/view { token }: a pass to open the client's page as Daniel
// (2026-11-23), added to their link as ?as=. With it the visit isn't counted as theirs and nothing
// can be changed (functions/api/client/_middleware.js). Good for VIEW_HOURS, for that link only.
import { json } from '../../../_middleware.js';
import { hashToken, signViewPass, VIEW_HOURS } from '../../../../../../server/client.js';

export async function onRequestPost({ request, env, params }) {
  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? '');
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return json({ error: 'Send { token } from the client link.' }, 400);
  const link = await env.INTAKE.prepare('SELECT id FROM client_links WHERE project_id = ? AND token_hash = ? AND revoked_at IS NULL').bind(params.id, await hashToken(token)).first();
  if (!link) return json({ error: 'That link is off. Make a new one first.' }, 404);
  const pass = await signViewPass(env, link.id);
  if (!pass) return json({ error: 'Viewing as the client needs the LINK_KEY secret on the site.' }, 503);
  return json({ pass, expiresAt: new Date(Date.now() + VIEW_HOURS * 3600_000).toISOString() });
}
