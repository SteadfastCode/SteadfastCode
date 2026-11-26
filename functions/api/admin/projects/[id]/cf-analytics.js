// POST /api/admin/projects/:id/cf-analytics { on }: Daniel switches Cloudflare's own Web Analytics
// on or off for this client (server/visits.js). Kept in the project's answers as cfAnalytics, set
// with json_set so it can't race a field save. The box switches the zone within a minute or so, once
// the site is launched on a domain in Steadfast Code's Cloudflare account, and logs it in Activity.
import { json } from '../../_middleware.js';
import { projectView, logEvent } from '../../../../../server/view.js';

export async function onRequestPost({ request, env, params }) {
  const body = await request.json().catch(() => null);
  if (typeof body?.on !== 'boolean') return json({ error: 'Send { on: true } or { on: false }.' }, 400);
  const before = await env.INTAKE.prepare('SELECT answers FROM projects WHERE id = ?').bind(params.id).first();
  if (!before) return json({ error: 'No such project.' }, 404);
  await env.INTAKE.prepare("UPDATE projects SET answers = json_set(answers, '$.cfAnalytics', json(?)), updated_at = ? WHERE id = ?")
    .bind(body.on ? 'true' : 'false', new Date().toISOString(), params.id).run();
  if ((JSON.parse(before.answers).cfAnalytics === true) !== body.on) {
    await logEvent(env, params.id, 'daniel', body.on ? 'Daniel switched on Cloudflare’s Web Analytics for the site' : 'Daniel switched off Cloudflare’s Web Analytics for the site').catch(() => {});
  }
  const project = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
  return json(await projectView(env, project, { mode: 'admin' }));
}
