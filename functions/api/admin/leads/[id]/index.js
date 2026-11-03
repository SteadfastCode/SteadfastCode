// GET /api/admin/leads/:id: one lead with its whole log and the projects started from it.
// PATCH /api/admin/leads/:id { patch }: change its fields; a status change is logged as a touch.
// DELETE /api/admin/leads/:id: off the board, log and all; refused while a project points at it.
import { json } from '../../_middleware.js';
import { leadFromRow, cleanPatch, updateStatement, STATUS_LABEL } from '../../../../../server/leads.js';

export async function leadView(env, r) {
  const [touches, projects] = await Promise.all([
    env.INTAKE.prepare('SELECT id, at, kind, text, status, who FROM lead_touches WHERE lead_id = ? ORDER BY id DESC LIMIT 200').bind(r.id).all(),
    env.INTAKE.prepare('SELECT id, status, preview_url, answers FROM projects WHERE lead_id = ? ORDER BY created_at').bind(r.id).all(),
  ]);
  return {
    lead: { ...leadFromRow(r), lastTouch: touches.results[0] ? { at: touches.results[0].at, kind: touches.results[0].kind, text: touches.results[0].text, status: touches.results[0].status } : null, projects: projects.results.map((p) => ({ id: p.id, status: p.status, previewUrl: p.preview_url, business: (() => { try { return JSON.parse(p.answers || '{}').businessName ?? null; } catch { return null; } })() })) },
    touches: touches.results,
  };
}

const find = (env, id) => env.INTAKE.prepare('SELECT * FROM leads WHERE id = ?').bind(String(id)).first();

export async function onRequestGet({ env, params }) {
  const r = await find(env, params.id);
  return r ? json(await leadView(env, r)) : json({ error: 'No such lead.' }, 404);
}

export async function onRequestPatch({ request, env, params }) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.patch !== 'object') return json({ error: 'Send { patch: { … } }.' }, 400);
  const r = await find(env, params.id);
  if (!r) return json({ error: 'No such lead.' }, 404);
  const { patch, problems } = cleanPatch(body.patch);
  if (problems.length) return json({ error: problems.join(' ') }, 400);
  const now = new Date().toISOString();
  const lead = leadFromRow(r);
  const stmts = [];
  if (Object.keys(patch).length) { const u = updateStatement(r.id, patch, now); stmts.push(env.INTAKE.prepare(u.sql).bind(...u.params)); }
  if (patch.status && patch.status !== lead.status) stmts.push(env.INTAKE.prepare("INSERT INTO lead_touches (lead_id, at, kind, text, status, who) VALUES (?, ?, 'status', ?, ?, 'daniel')").bind(r.id, now, `${STATUS_LABEL[lead.status]} → ${STATUS_LABEL[patch.status]}`, patch.status));
  if (stmts.length) await env.INTAKE.batch(stmts);
  return json(await leadView(env, await find(env, params.id)));
}

export async function onRequestDelete({ env, params }) {
  const r = await find(env, params.id);
  if (!r) return json({ error: 'No such lead.' }, 404);
  const p = await env.INTAKE.prepare('SELECT id FROM projects WHERE lead_id = ? LIMIT 1').bind(r.id).first();
  if (p) return json({ error: 'A project was started from this lead, so it stays; mark it lost or won instead.' }, 409);
  await env.INTAKE.batch([
    env.INTAKE.prepare('DELETE FROM lead_touches WHERE lead_id = ?').bind(r.id),
    env.INTAKE.prepare('DELETE FROM leads WHERE id = ?').bind(r.id),
  ]);
  return json({ ok: true, removed: r.id });
}
