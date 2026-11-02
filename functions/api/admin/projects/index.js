// GET /api/admin/projects: every project, newest first.
// POST /api/admin/projects { tier?, leadId? }: start one, from a package or from a lead.
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
  let leadId = null;
  if (body.leadId) {
    const lead = await env.INTAKE.prepare("SELECT * FROM leads WHERE id = ?").bind(String(body.leadId)).first();
    if (!lead) return json({ error: 'No such lead.' }, 404);
    answers = answersFromLead(lead);
    leadId = lead.id;
  }
  if (body.tier) answers = mergeAnswers(answers, { tier: body.tier }).answers;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const stmts = [env.INTAKE.prepare('INSERT INTO projects (id, lead_id, tier, answers, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, leadId, answers.tier ?? null, JSON.stringify(answers), data.email, now, now)];
  if (leadId) stmts.push(env.INTAKE.prepare("UPDATE leads SET status = 'started' WHERE id = ?").bind(leadId));
  await env.INTAKE.batch(stmts);
  return json({ id, answers, check: check(answers) }, 201);
}
