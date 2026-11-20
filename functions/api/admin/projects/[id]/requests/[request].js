// PATCH /api/admin/projects/:id/requests/:request { status?, note?, title?, kind? }: move a change
// request along, or reword it (server/requests.js). A new status is a line in the project's activity,
// which the client sees too.
import { json } from '../../../_middleware.js';
import { adminChange, getRequest, saveRequest, listRequests } from '../../../../../../server/requests.js';
import { logEvent } from '../../../../../../server/view.js';

/** How a status reads in the activity list. */
const SAID = {
  received: 'is back in the queue',
  working: 'is being made',
  preview: 'is on the preview to look at',
  approved: 'was approved',
  live: 'is live',
  closed: 'was closed',
};

export async function onRequestPatch({ request, env, params }) {
  const found = await getRequest(env, params.id, params.request).catch(() => null);
  if (!found) return json({ error: 'That request isn’t on this project.' }, 404);
  const change = adminChange(await request.json().catch(() => null));
  if (change.error) return json({ error: change.error }, 400);
  await saveRequest(env, found.id, change.set);
  if (change.set.status && change.set.status !== found.status) {
    await logEvent(env, params.id, 'daniel', `“${change.set.title ?? found.title}” ${SAID[change.set.status]}`).catch(() => {});
  }
  return json({ requests: await listRequests(env, params.id) });
}
