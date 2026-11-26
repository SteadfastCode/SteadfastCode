// GET /api/admin/projects/:id/visits/export: every count kept for the project's site, as CSV.
import { json } from '../../../_middleware.js';
import { exportResponse } from '../../../../../../server/visits.js';

export async function onRequestGet({ env, params }) {
  const project = await env.INTAKE.prepare('SELECT id, slug FROM projects WHERE id = ?').bind(params.id).first();
  if (!project) return json({ error: 'No such project.' }, 404);
  return exportResponse(env, project);
}
