// PATCH /api/admin/projects/:id/assets/:asset { title?, detail?, status? }: reword an item, or mark
// it received (or still needed).
// DELETE /api/admin/projects/:id/assets/:asset: take it off the list.
import { json } from '../../../_middleware.js';
import { adminChange, getAsset, saveAsset, removeAsset, listAssets } from '../../../../../../server/assets.js';
import { logEvent } from '../../../../../../server/view.js';

export async function onRequestPatch({ request, env, params }) {
  const item = await getAsset(env, params.id, params.asset).catch(() => null);
  if (!item) return json({ error: 'That item isn’t on this project’s list.' }, 404);
  const change = adminChange(await request.json().catch(() => null));
  if (change.error) return json({ error: change.error }, 400);
  await saveAsset(env, item.id, change.set);
  if (change.set.status === 'received' && item.status !== 'received') {
    await logEvent(env, params.id, 'daniel', `Daniel has what was needed: ${change.set.title ?? item.title}`).catch(() => {});
  }
  return json({ assets: await listAssets(env, params.id) });
}

export async function onRequestDelete({ env, params }) {
  const item = await getAsset(env, params.id, params.asset).catch(() => null);
  if (!item) return json({ error: 'That item isn’t on this project’s list.' }, 404);
  await removeAsset(env, params.id, item.id);
  return json({ assets: await listAssets(env, params.id) });
}
