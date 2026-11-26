// GET /api/admin/projects/:id/visits?days=30: the project's visit counts, as its client sees them.
import { json } from '../../_middleware.js';
import { visitsResponse } from '../../../../../server/visits.js';

export async function onRequestGet({ request, env, params }) {
  const project = await env.INTAKE.prepare('SELECT id, slug FROM projects WHERE id = ?').bind(params.id).first();
  if (!project) return json({ error: 'No such project.' }, 404);
  return visitsResponse(env, project, new URL(request.url));
}
