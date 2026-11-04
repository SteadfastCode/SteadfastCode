// GET /api/admin/inbox: every conversation, the ones waiting on Daniel first, then the newest.
import { json } from './_middleware.js';

export async function onRequestGet({ env }) {
  const { results } = await env.INTAKE.prepare(`
    SELECT m.project_id, p.answers, MAX(m.id) AS last_id, COUNT(*) AS total,
      SUM(CASE WHEN m.sender = 'client' AND m.read_at IS NULL THEN 1 ELSE 0 END) AS unread
    FROM messages m JOIN projects p ON p.id = m.project_id
    GROUP BY m.project_id ORDER BY unread > 0 DESC, last_id DESC LIMIT 200`).all().catch(() => ({ results: [] }));
  const rows = [];
  for (const r of results) {
    const last = await env.INTAKE.prepare('SELECT at, sender, name, body FROM messages WHERE id = ?').bind(r.last_id).first();
    const a = JSON.parse(r.answers);
    rows.push({ id: r.project_id, business: a.businessName ?? null, contact: a.contactName ?? null, unread: r.unread, total: r.total, last });
  }
  return json({ rows, unread: rows.reduce((s, r) => s + r.unread, 0) });
}
