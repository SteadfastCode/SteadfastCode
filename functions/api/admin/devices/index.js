// POST /api/admin/devices { token, label? }: the admin app on Daniel's phone registers for push.
// DELETE /api/admin/devices { token }: stop pushing to it.
import { json } from '../_middleware.js';

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => null);
  const token = typeof b?.token === 'string' ? b.token.trim() : '';
  if (!/^[\w:-]{20,400}$/.test(token)) return json({ error: 'Not a push token.' }, 400);
  const now = new Date().toISOString();
  await env.INTAKE.prepare('INSERT INTO devices (token, label, created_at, last_seen_at) VALUES (?, ?, ?, ?) ON CONFLICT (token) DO UPDATE SET last_seen_at = excluded.last_seen_at, label = COALESCE(excluded.label, devices.label)')
    .bind(token, typeof b.label === 'string' ? b.label.slice(0, 80) : null, now, now).run();
  const n = await env.INTAKE.prepare('SELECT COUNT(*) AS n FROM devices').first();
  return json({ ok: true, devices: n?.n ?? 1 });
}

export async function onRequestDelete({ request, env }) {
  const b = await request.json().catch(() => null);
  await env.INTAKE.prepare('DELETE FROM devices WHERE token = ?').bind(String(b?.token ?? '')).run();
  return json({ ok: true });
}
