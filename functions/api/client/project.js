// GET /api/client/project: the shared form as the client sees it (server/view.js).
// PATCH /api/client/project { answers }: the client's edits, limited to the fields they may change,
// and only while the intake is open (server/client.js intakeOpen).
import { json } from './_middleware.js';
import { mergeClientAnswers, intakeOpen } from '../../../server/client.js';
import { fields } from '../../../server/intake.js';
import { projectView, logEdit, markClientChange } from '../../../server/view.js';

export const clientName = (answers) => (answers.contactName || '').trim().split(/\s+/)[0] || 'Your client';

export async function onRequestGet({ env, data }) {
  return json(await projectView(env, data.project, { mode: 'client' }));
}

export async function onRequestPatch({ request, env, data }) {
  const body = await request.json().catch(() => null);
  if (!body?.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) return json({ error: 'Nothing to save.' }, 400);
  const p = data.project;
  // The page already shows a closed intake read-only; this is for a tab left open from before.
  if (!intakeOpen(p)) return json({ error: 'Your details are set now. To change anything, send Daniel a message and he’ll take care of it.' }, 409);
  const { answers, dropped } = mergeClientAnswers(JSON.parse(p.answers), body.answers);
  const now = new Date().toISOString();
  await env.INTAKE.prepare('UPDATE projects SET answers = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(answers), now, p.id).run();
  const changed = Object.keys(body.answers).filter((k) => !dropped.includes(k));
  await logEdit(env, p.id, 'client', clientName(answers), changed.map((k) => fields[k]?.you || fields[k]?.label || k));
  await markClientChange(env, p, changed);
  return json({ ...(await projectView(env, { ...p, answers: JSON.stringify(answers), updated_at: now }, { mode: 'client' })), dropped });
}
