// GET /api/admin/leads/export: the board as CSV, every lead with its log in one cell.
import { leadFromRow, toCsv } from '../../../../server/leads.js';

export async function onRequestGet({ env }) {
  const [leads, touches] = await Promise.all([
    env.INTAKE.prepare('SELECT * FROM leads ORDER BY received_at').all(),
    env.INTAKE.prepare('SELECT lead_id, at, kind, text FROM lead_touches ORDER BY id').all(),
  ]);
  const byLead = new Map();
  for (const t of touches.results) { if (!byLead.has(t.lead_id)) byLead.set(t.lead_id, []); byLead.get(t.lead_id).push(t); }
  return new Response(toCsv(leads.results.map(leadFromRow), byLead), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' },
  });
}
