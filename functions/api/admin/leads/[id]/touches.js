// POST /api/admin/leads/:id/touches { kind, text, status?, nextStep?, nextAt? }: what happened with
// this lead. A first email or call moves it to Contacted on its own, a reply to Replied, a meeting
// to Meeting set (server/leads.js statusAfter); a status Daniel picks wins.
import { json } from '../../_middleware.js';
import { leadFromRow, cleanTouch, updateStatement } from '../../../../../server/leads.js';
import { leadView } from './index.js';

export async function onRequestPost({ request, env, params }) {
  const body = await request.json().catch(() => ({}));
  const r = await env.INTAKE.prepare('SELECT * FROM leads WHERE id = ?').bind(String(params.id)).first();
  if (!r) return json({ error: 'No such lead.' }, 404);
  const lead = leadFromRow(r);
  const { touch, patch, problems } = cleanTouch(body, lead);
  if (problems.length) return json({ error: problems.join(' ') }, 400);
  const now = new Date().toISOString();
  const u = updateStatement(r.id, patch, now);
  await env.INTAKE.batch([
    env.INTAKE.prepare("INSERT INTO lead_touches (lead_id, at, kind, text, status, who) VALUES (?, ?, ?, ?, ?, 'daniel')").bind(r.id, now, touch.kind, touch.text, touch.status),
    env.INTAKE.prepare(u.sql).bind(...u.params),
  ]);
  return json(await leadView(env, await env.INTAKE.prepare('SELECT * FROM leads WHERE id = ?').bind(r.id).first()));
}
