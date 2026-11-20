// PATCH /api/client/assets/:asset { sent: true, note } or { sent: false }: the client says they've
// sent something on the needed list, and where it is, or takes that back (server/assets.js).
// Daniel is told when something is sent.
import { json } from '../_middleware.js';
import { clientChange, getAsset, saveAsset, listAssets } from '../../../../server/assets.js';
import { logEvent } from '../../../../server/view.js';
import { notifyDaniel, projectUrl } from '../../../../server/notify.js';
import { clientName } from '../project.js';

export async function onRequestPatch({ request, env, data, params }) {
  const project = data.project;
  const item = await getAsset(env, project.id, params.asset).catch(() => null);
  if (!item) return json({ error: 'That item isn’t on your list anymore.' }, 404);
  const change = clientChange(item, await request.json().catch(() => null));
  if (change.error) return json({ error: change.error }, 400);
  await saveAsset(env, item.id, change.set);
  if (change.set.status === 'sent') {
    const answers = JSON.parse(project.answers);
    const who = clientName(answers);
    await logEvent(env, project.id, 'client', `${who} sent: ${item.title}`).catch(() => {});
    await notifyDaniel(env, {
      kind: 'asset',
      title: `${answers.businessName || 'A client'}: ${item.title} sent`,
      body: change.set.client_note ? `${who} says: ${change.set.client_note}` : `${who} marked it sent.`,
      url: projectUrl(project.id),
    });
  }
  return json({ assets: await listAssets(env, project.id) });
}
