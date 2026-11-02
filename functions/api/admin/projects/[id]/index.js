// GET /api/admin/projects/:id: the shared form as Daniel sees it (server/view.js), plus the link.
// PATCH /api/admin/projects/:id { answers }: save some answers (autosaved field by field).
import { json } from '../../_middleware.js';
import { mergeAnswers, fields } from '../../../../../server/intake.js';
import { projectView, logEdit } from '../../../../../server/view.js';

export async function onRequestGet({ env, params }) {
  const p = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
  return p ? json(await projectView(env, p, { mode: 'admin' })) : json({ error: 'No such project.' }, 404);
}

export async function onRequestPatch({ request, env, params }) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.answers !== 'object') return json({ error: 'Send { answers: { … } }.' }, 400);
  const p = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
  if (!p) return json({ error: 'No such project.' }, 404);
  const { answers, dropped } = mergeAnswers(JSON.parse(p.answers), body.answers);
  const now = new Date().toISOString();
  await env.INTAKE.prepare('UPDATE projects SET answers = ?, tier = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(answers), answers.tier ?? null, now, p.id).run();
  await logEdit(env, p.id, 'daniel', 'Daniel', Object.keys(body.answers).filter((k) => !dropped.includes(k)).map((k) => fields[k]?.you || fields[k]?.label || k));
  return json({ ...(await projectView(env, { ...p, answers: JSON.stringify(answers), tier: answers.tier ?? null, updated_at: now }, { mode: 'admin' })), dropped });
}
