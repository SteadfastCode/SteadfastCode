// GET /api/client/project: the shared form as the client sees it (server/view.js).
// PATCH /api/client/project { answers }: the client's edits, limited to the fields they may change.
import { json } from './_middleware.js';
import { mergeClientAnswers } from '../../../server/client.js';
import { fields } from '../../../server/intake.js';
import { projectView, logEdit, markClientChange } from '../../../server/view.js';

export const clientName = (answers) => (answers.contactName || '').trim().split(/\s+/)[0] || 'Your client';

export async function onRequestGet({ env, data }) {
  return json(await projectView(env, data.project, { mode: 'client' }));
}

export async function onRequestPatch({ request, env, data }) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.answers !== 'object') return json({ error: 'Nothing to save.' }, 400);
  const p = data.project;
  const { answers, dropped } = mergeClientAnswers(JSON.parse(p.answers), body.answers);
  const now = new Date().toISOString();
  await env.INTAKE.prepare('UPDATE projects SET answers = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(answers), now, p.id).run();
  const changed = Object.keys(body.answers).filter((k) => !dropped.includes(k));
  await logEdit(env, p.id, 'client', clientName(answers), changed.map((k) => fields[k]?.you || fields[k]?.label || k));
  await markClientChange(env, p, changed);
  return json({ ...(await projectView(env, { ...p, answers: JSON.stringify(answers), updated_at: now }, { mode: 'client' })), dropped });
}
