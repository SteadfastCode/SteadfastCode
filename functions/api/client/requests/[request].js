// PATCH /api/client/requests/:request { approved: true }: "Looks good" on a change that's on the
// client's preview (server/requests.js). Daniel is told, so it can go live.
import { json } from '../_middleware.js';
import { clientChange, getRequest, saveRequest, listRequests } from '../../../../server/requests.js';
import { logEvent } from '../../../../server/view.js';
import { notifyDaniel, projectUrl } from '../../../../server/notify.js';
import { clientName } from '../project.js';

export async function onRequestPatch({ request, env, data, params }) {
  const project = data.project;
  const found = await getRequest(env, project.id, params.request).catch(() => null);
  if (!found) return json({ error: 'That request isn’t on your project.' }, 404);
  const change = clientChange(found, await request.json().catch(() => null));
  if (change.error) return json({ error: change.error }, 400);
  await saveRequest(env, found.id, change.set);
  const answers = JSON.parse(project.answers);
  const who = clientName(answers);
  await logEvent(env, project.id, 'client', `${who} approved “${found.title}”`).catch(() => {});
  await notifyDaniel(env, {
    kind: 'request',
    title: `${answers.businessName || 'A client'}: “${found.title}” approved`,
    body: `${who} looked at the preview and says it looks good. It can go live.`,
    url: projectUrl(project.id),
  });
  return json({ requests: await listRequests(env, project.id) });
}
