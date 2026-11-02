// GET, PATCH { caption }, DELETE: one of the project's files, from Daniel's side.
import { json } from '../../../_middleware.js';
import { serveUpload, deleteUpload, setCaption } from '../../../../../../server/uploads.js';

export const onRequestGet = ({ env, params }) => serveUpload(env, params.id, params.uid);

export async function onRequestPatch({ request, env, params }) {
  const r = await setCaption(env, params.id, params.uid, (await request.json().catch(() => ({}))).caption);
  return json(r.error ? { error: r.error } : { ok: true }, r.status);
}

export async function onRequestDelete({ env, params }) {
  const p = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
  if (!p) return json({ error: 'No such project.' }, 404);
  const r = await deleteUpload(env, p, params.uid, { who: 'daniel', whoLabel: 'Daniel' });
  return json(r.error ? { error: r.error } : { ok: true }, r.status);
}
