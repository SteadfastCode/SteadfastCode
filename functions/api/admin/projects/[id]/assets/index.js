// POST /api/admin/projects/:id/assets { title, detail }: add something the project still needs from
// the client (server/assets.js). The list itself comes with the project (server/view.js).
import { json } from '../../../_middleware.js';
import { cleanAsset, addAsset, listAssets, NOT_READY } from '../../../../../../server/assets.js';
import { logEvent } from '../../../../../../server/view.js';

export async function onRequestPost({ request, env, params }) {
  const project = await env.INTAKE.prepare('SELECT id FROM projects WHERE id = ?').bind(params.id).first();
  if (!project) return json({ error: 'No such project.' }, 404);
  const asset = cleanAsset(await request.json().catch(() => null));
  if (asset.error) return json({ error: asset.error }, 400);
  try {
    await addAsset(env, project.id, asset);
  } catch {
    return json({ error: NOT_READY }, 503);
  }
  await logEvent(env, project.id, 'daniel', `Daniel added to what’s needed: ${asset.title}`).catch(() => {});
  return json({ assets: await listAssets(env, project.id) }, 201);
}
