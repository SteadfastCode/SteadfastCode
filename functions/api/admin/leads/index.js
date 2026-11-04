// GET /api/admin/leads: the whole board (server/leads.js shapes a row), each lead with its last touch
// and the projects started from it. POST /api/admin/leads { …fields, notes? }: add one lead.
import { json } from '../_middleware.js';
import { leadFromRow, newLead, insertStatement, sameName } from '../../../../server/leads.js';
import { seedLeads } from '../../../../server/leads-seed.js';

/** Every lead on the board with what the page needs beside it. */
export async function board(env) {
  const [leads, last, projects] = await Promise.all([
    env.INTAKE.prepare('SELECT * FROM leads ORDER BY updated_at DESC, received_at DESC LIMIT 1000').all(),
    // The newest touch per lead, in one query: the highest id is the newest, ids only grow.
    env.INTAKE.prepare('SELECT t.lead_id, t.at, t.kind, t.text, t.status FROM lead_touches t JOIN (SELECT lead_id, MAX(id) AS id FROM lead_touches GROUP BY lead_id) m ON m.id = t.id').all(),
    env.INTAKE.prepare('SELECT id, lead_id, status, preview_url, answers FROM projects WHERE lead_id IS NOT NULL').all(),
  ]);
  const lastByLead = new Map(last.results.map((t) => [t.lead_id, { at: t.at, kind: t.kind, text: t.text, status: t.status }]));
  const projectsByLead = new Map();
  for (const p of projects.results) {
    const a = (() => { try { return JSON.parse(p.answers || '{}'); } catch { return {}; } })();
    if (!projectsByLead.has(p.lead_id)) projectsByLead.set(p.lead_id, []);
    projectsByLead.get(p.lead_id).push({ id: p.id, status: p.status, previewUrl: p.preview_url, business: a.businessName ?? null });
  }
  const names = new Set(leads.results.map((r) => sameName(r.business)));
  return {
    leads: leads.results.map((r) => ({ ...leadFromRow(r), lastTouch: lastByLead.get(r.id) ?? null, projects: projectsByLead.get(r.id) ?? [] })),
    seedAvailable: seedLeads.filter((s) => !names.has(sameName(s.business))).length,
  };
}

export async function onRequestGet({ env }) {
  return json(await board(env));
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();
  const { lead, problems } = newLead(body, { now });
  if (!lead) return json({ error: problems.join(' ') }, 400);
  const ins = insertStatement(lead);
  const stmts = [env.INTAKE.prepare(ins.sql).bind(...ins.params)];
  const note = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 2000) : null;
  if (note) stmts.push(env.INTAKE.prepare('INSERT INTO lead_touches (lead_id, at, kind, text, status, who) VALUES (?, ?, ?, ?, NULL, ?)').bind(lead.id, now, 'note', note, 'daniel'));
  await env.INTAKE.batch(stmts);
  return json({ lead: { ...lead, lastTouch: note ? { at: now, kind: 'note', text: note, status: null } : null, projects: [] } }, 201);
}
