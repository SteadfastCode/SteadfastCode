// GET /api/admin/projects/:id: the shared form as Daniel sees it (server/view.js), plus the link.
// PATCH /api/admin/projects/:id { answers }: save some answers (autosaved field by field).
// PATCH /api/admin/projects/:id { intakeClosed: true | false }: close or reopen the intake for the client.
import { json } from '../../_middleware.js';
import { mergeAnswers, fields } from '../../../../../server/intake.js';
import { projectView, logEdit, logEvent } from '../../../../../server/view.js';

export async function onRequestGet({ env, params }) {
  const p = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
  return p ? json(await projectView(env, p, { mode: 'admin' })) : json({ error: 'No such project.' }, 404);
}

export async function onRequestPatch({ request, env, params }) {
  const body = await request.json().catch(() => null);
  const p = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
  if (!p) return json({ error: 'No such project.' }, 404);
  if (typeof body?.intakeClosed === 'boolean') {
    const closedAt = body.intakeClosed ? p.intake_closed_at ?? new Date().toISOString() : null;
    try {
      await env.INTAKE.prepare('UPDATE projects SET intake_closed_at = ? WHERE id = ?').bind(closedAt, p.id).run();
    } catch {
      // The column comes from migrations/0018_intake_closed.sql; until it's run, say so plainly.
      return json({ error: 'The intake switch isn’t ready yet: migration 0018_intake_closed.sql hasn’t been run on the database.' }, 503);
    }
    if (!!p.intake_closed_at !== body.intakeClosed) {
      await logEvent(env, p.id, 'daniel', body.intakeClosed ? 'Daniel closed the intake: changes now come in as messages' : 'Daniel reopened the intake');
    }
    return json(await projectView(env, { ...p, intake_closed_at: closedAt }, { mode: 'admin' }));
  }
  if (!body || typeof body.answers !== 'object') return json({ error: 'Send { answers: { … } }.' }, 400);
  const { answers, dropped } = mergeAnswers(JSON.parse(p.answers), body.answers);
  const now = new Date().toISOString();
  await env.INTAKE.prepare('UPDATE projects SET answers = ?, tier = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(answers), answers.tier ?? null, now, p.id).run();
  await logEdit(env, p.id, 'daniel', 'Daniel', Object.keys(body.answers).filter((k) => !dropped.includes(k)).map((k) => fields[k]?.you || fields[k]?.label || k));
  return json({ ...(await projectView(env, { ...p, answers: JSON.stringify(answers), tier: answers.tier ?? null, updated_at: now }, { mode: 'admin' })), dropped });
}
