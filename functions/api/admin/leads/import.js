// POST /api/admin/leads/import { text } or { seed: true }: rows onto the board. A business already on
// the board is skipped, never merged over, so a list can be pasted twice without harm.
import { json } from '../_middleware.js';
import { parseImport, mergeImport, insertStatement } from '../../../../server/leads.js';
import { seedLeads } from '../../../../server/leads-seed.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const parsed = body.seed === true ? { rows: seedLeads, problems: [] } : parseImport(body.text);
  if (parsed.problems.length) return json({ error: parsed.problems.join(' ') }, 400);
  const { results } = await env.INTAKE.prepare('SELECT business FROM leads').all();
  const now = new Date().toISOString();
  const m = mergeImport(results.map((r) => r.business), parsed.rows, { now });
  const stmts = m.added.flatMap(({ lead, note }) => {
    const ins = insertStatement(lead);
    const out = [env.INTAKE.prepare(ins.sql).bind(...ins.params)];
    if (note) out.push(env.INTAKE.prepare("INSERT INTO lead_touches (lead_id, at, kind, text, status, who) VALUES (?, ?, 'note', ?, NULL, 'daniel')").bind(lead.id, now, note));
    return out;
  });
  // D1 batches are transactions; a long paste goes in slices so no one request is huge.
  for (let i = 0; i < stmts.length; i += 100) await env.INTAKE.batch(stmts.slice(i, i + 100));
  return json({ added: m.added.length, skipped: m.skipped, problems: m.problems, ids: m.added.map((x) => x.lead.id) });
}
