// GET /api/admin/projects/:id: the project, its answers, and where they stand against the package.
// PATCH /api/admin/projects/:id { answers }: save some answers (the page autosaves field by field).
import { json } from '../../_middleware.js';
import { mergeAnswers, check } from '../../../../../server/intake.js';

const view = (p, answers = JSON.parse(p.answers)) => ({
  id: p.id, slug: p.slug, status: p.status, previewUrl: p.preview_url, buildNote: p.build_note, leadId: p.lead_id,
  createdAt: p.created_at, updatedAt: p.updated_at, buildRequestedAt: p.build_requested_at, answers, check: check(answers),
});

export async function onRequestGet({ env, params }) {
  const p = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
  return p ? json(view(p)) : json({ error: 'No such project.' }, 404);
}

export async function onRequestPatch({ request, env, params }) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.answers !== 'object') return json({ error: 'Send { answers: { … } }.' }, 400);
  const p = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
  if (!p) return json({ error: 'No such project.' }, 404);
  const { answers, dropped } = mergeAnswers(JSON.parse(p.answers), body.answers);
  const now = new Date().toISOString();
  await env.INTAKE.prepare('UPDATE projects SET answers = ?, tier = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(answers), answers.tier ?? null, now, p.id).run();
  return json({ ...view({ ...p, updated_at: now }, answers), dropped });
}
