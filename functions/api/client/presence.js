// POST /api/client/presence { field }: which field the client is in (or null), so Daniel's screen
// shows "Joshua is editing this" and doesn't overwrite it.
import { json } from './_middleware.js';
import { setPresence } from '../../../server/view.js';
import { clientName } from './project.js';

export async function onRequestPost({ request, env, data }) {
  const body = await request.json().catch(() => ({}));
  await setPresence(env, data.project.id, 'client', clientName(JSON.parse(data.project.answers)), body.field ?? null);
  return json({ ok: true });
}
