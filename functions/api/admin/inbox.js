// GET /api/admin/inbox: every client for the Inbox's left pane (2026-11-04). Conversations first,
// the ones waiting on Daniel at the top, then the newest; then every other project, so a
// conversation can be started with anyone. Each with its last message and unread count.
import { json } from './_middleware.js';

export async function onRequestGet({ env }) {
  const { results } = await env.INTAKE.prepare(`
    SELECT p.id, p.answers, p.updated_at, m.last_id, m.unread, l.at AS last_at, l.sender AS last_sender, l.body AS last_body
    FROM projects p
    LEFT JOIN (SELECT project_id, MAX(id) AS last_id, SUM(CASE WHEN sender = 'client' AND read_at IS NULL THEN 1 ELSE 0 END) AS unread FROM messages GROUP BY project_id) m ON m.project_id = p.id
    LEFT JOIN messages l ON l.id = m.last_id
    WHERE p.status != 'closed'
    ORDER BY (m.last_id IS NULL), m.unread > 0 DESC, m.last_id DESC, p.updated_at DESC LIMIT 300`).all();
  const rows = results.map((r) => {
    const a = JSON.parse(r.answers);
    return { id: r.id, business: a.businessName ?? null, contact: a.contactName ?? null, unread: r.unread ?? 0, last: r.last_id ? { at: r.last_at, sender: r.last_sender, body: r.last_body } : null };
  });
  return json({ rows, unread: rows.reduce((s, r) => s + r.unread, 0) });
}
