// GET (?t= allowed, for <img>), PATCH { caption }, DELETE: one of this project's files.
import { json } from '../_middleware.js';
import { serveUpload, deleteUpload, setCaption } from '../../../../server/uploads.js';
import { clientName } from '../project.js';

export const onRequestGet = ({ env, data, params }) => serveUpload(env, data.project.id, params.id);

export async function onRequestPatch({ request, env, data, params }) {
  const r = await setCaption(env, data.project.id, params.id, (await request.json().catch(() => ({}))).caption);
  return json(r.error ? { error: r.error } : { ok: true }, r.status);
}

export async function onRequestDelete({ env, data, params }) {
  const r = await deleteUpload(env, data.project, params.id, { who: 'client', whoLabel: clientName(JSON.parse(data.project.answers)) });
  return json(r.error ? { error: r.error } : { ok: true }, r.status);
}
