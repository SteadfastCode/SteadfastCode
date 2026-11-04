// GET /api/admin/projects: every project, newest first.
// POST /api/admin/projects { tier?, leadId? }: start one, from a package or from a lead on the
// board (a contact-form lead or a prospect; a partner sends prospects and never becomes a project).
// Starting from a lead marks it Won and logs it on the lead.
import { json } from '../_middleware.js';
import { mergeAnswers, answersFromLead, check } from '../../../../server/intake.js';

export async function onRequestGet({ env }) {
  const { results } = await env.INTAKE.prepare('SELECT id, slug, tier, status, answers, preview_url, updated_at, review_needed FROM projects ORDER BY updated_at DESC LIMIT 100').all();
  return json({
    projects: results.map((p) => {
      const a = JSON.parse(p.answers);
      return { id: p.id, slug: p.slug, tier: p.tier, status: p.status, previewUrl: p.preview_url, updatedAt: p.updated_at, business: a.businessName ?? null, ready: check(a).ready, needsReview: !!(p.review_needed && p.review_needed !== '[]') };
    }),
  });
}

export async function onRequestPost({ request, env, data }) {
  const body = await request.json().catch(() => ({}));
  let answers = {};
  let lead = null;
  if (body.leadId) {
    lead = await env.INTAKE.prepare('SELECT * FROM leads WHERE id = ?').bind(String(body.leadId)).first();
    if (!lead) return json({ error: 'No such lead.' }, 404);
    if (lead.kind === 'partner') return json({ error: 'A partner sends prospects; start the project from the prospect it sent.' }, 400);
    const touches = await env.INTAKE.prepare("SELECT at, kind, text FROM lead_touches WHERE lead_id = ? AND kind != 'status' ORDER BY id DESC LIMIT 5").bind(lead.id).all();
    answers = answersFromLead(lead, touches.results.reverse());
  }
  if (body.tier) answers = mergeAnswers(answers, { tier: body.tier }).answers;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const stmts = [env.INTAKE.prepare('INSERT INTO projects (id, lead_id, tier, answers, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, lead?.id ?? null, answers.tier ?? null, JSON.stringify(answers), data.email, now, now)];
  if (lead) {
    stmts.push(env.INTAKE.prepare("UPDATE leads SET status = 'won', updated_at = ? WHERE id = ?").bind(now, lead.id));
    stmts.push(env.INTAKE.prepare("INSERT INTO lead_touches (lead_id, at, kind, text, status, who) VALUES (?, ?, 'project', ?, ?, 'daniel')").bind(lead.id, now, `Project started: ${answers.businessName || lead.business || lead.name}`, lead.status === 'won' ? null : 'won'));
  }
  await env.INTAKE.batch(stmts);
  return json({ id, answers, check: check(answers) }, 201);
}
