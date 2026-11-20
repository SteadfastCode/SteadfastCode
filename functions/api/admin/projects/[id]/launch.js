// POST /api/admin/projects/:id/launch { launch: true, force? }: launch the site (server/launch.js).
// POST /api/admin/projects/:id/launch { launch: false }: take it back to preview.
// The box does the rest within a minute or two: it lets search engines in (or shuts them out
// again), marks the repo launched, and deploys.
import { json } from '../../_middleware.js';
import { domainHost, isLaunched, launchProblems, domainAnswers, launchDay, NOT_READY } from '../../../../../server/launch.js';
import { projectView, logEvent } from '../../../../../server/view.js';

export async function onRequestPost({ request, env, params }) {
  const body = await request.json().catch(() => null);
  if (typeof body?.launch !== 'boolean') return json({ error: 'Send { launch: true } or { launch: false }.' }, 400);
  const project = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
  if (!project) return json({ error: 'No such project.' }, 404);
  const answers = JSON.parse(project.answers);
  const now = new Date();

  if (body.launch) {
    if (isLaunched(project)) return json(await projectView(env, project, { mode: 'admin' }));
    const problems = launchProblems(project, answers);
    if (problems.length) return json({ error: problems.join(' ') }, 409);
    const host = domainHost(answers.domain);
    if (!body.force && !(await domainAnswers(host))) {
      return json({ error: `${host} isn’t answering yet. Point the domain at the site first, or launch anyway if you know it’s on its way.`, canForce: true }, 409);
    }
    try {
      await env.INTAKE.prepare("UPDATE projects SET launched_at = ?, status = 'live', updated_at = ? WHERE id = ?").bind(now.toISOString(), now.toISOString(), project.id).run();
    } catch {
      return json({ error: NOT_READY }, 503);
    }
    // The care plan counts its free window from the launch day; give it one when it has none.
    await env.INTAKE.prepare('UPDATE care_plans SET launched_at = ? WHERE project_id = ? AND launched_at IS NULL').bind(launchDay(now), project.id).run().catch(() => {});
    await logEvent(env, project.id, 'daniel', `Daniel launched the site at ${host}`).catch(() => {});
    return json(await projectView(env, { ...project, launched_at: now.toISOString(), status: 'live' }, { mode: 'admin' }));
  }

  if (!isLaunched(project)) return json(await projectView(env, project, { mode: 'admin' }));
  const status = project.status === 'live' ? 'preview' : project.status;
  try {
    await env.INTAKE.prepare('UPDATE projects SET launched_at = NULL, status = ?, updated_at = ? WHERE id = ?').bind(status, now.toISOString(), project.id).run();
  } catch {
    return json({ error: NOT_READY }, 503);
  }
  await logEvent(env, project.id, 'daniel', 'Daniel took the site back to preview').catch(() => {});
  return json(await projectView(env, { ...project, launched_at: null, status }, { mode: 'admin' }));
}
