// POST /api/admin/projects/:id/link: a new private client link (any earlier one is turned off).
// The full link is in this response only; the database keeps its hash.
// DELETE /api/admin/projects/:id/link: turn the client's link off.
import { json } from '../../_middleware.js';
import { newToken, hashToken, LINK_DAYS } from '../../../../../server/client.js';

export async function onRequestPost({ request, env, params, data }) {
  const p = await env.INTAKE.prepare('SELECT id FROM projects WHERE id = ?').bind(params.id).first();
  if (!p) return json({ error: 'No such project.' }, 404);
  const token = newToken();
  const now = new Date();
  const expires = new Date(now.getTime() + LINK_DAYS * 86400_000).toISOString();
  await env.INTAKE.batch([
    env.INTAKE.prepare('UPDATE client_links SET revoked_at = ? WHERE project_id = ? AND revoked_at IS NULL').bind(now.toISOString(), p.id),
    env.INTAKE.prepare('INSERT INTO client_links (id, project_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').bind(crypto.randomUUID(), p.id, await hashToken(token), now.toISOString(), expires),
    env.INTAKE.prepare('INSERT INTO project_events (project_id, at, who, what) VALUES (?, ?, ?, ?)').bind(p.id, now.toISOString(), data.email, 'Made a client link'),
  ]);
  return json({ url: `${new URL(request.url).origin}/client#${token}`, expiresAt: expires }, 201);
}

export async function onRequestDelete({ env, params, data }) {
  const now = new Date().toISOString();
  const r = await env.INTAKE.prepare('UPDATE client_links SET revoked_at = ? WHERE project_id = ? AND revoked_at IS NULL').bind(now, params.id).run();
  if (r.meta?.changes) await env.INTAKE.prepare('INSERT INTO project_events (project_id, at, who, what) VALUES (?, ?, ?, ?)').bind(params.id, now, data.email, 'Turned the client link off').run();
  return json({ ok: true, turnedOff: r.meta?.changes ?? 0 });
}
