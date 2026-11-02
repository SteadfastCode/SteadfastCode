// POST /api/client/build: "Update my preview" — a rebuild with the latest answers and files. Only
// once a first version exists (Daniel starts the first one), and one at a time.
import { json } from './_middleware.js';
import { check } from '../../../server/intake.js';
import { logEvent } from '../../../server/view.js';
import { clientName } from './project.js';

export async function onRequestPost({ env, data }) {
  const p = data.project;
  if (p.status !== 'preview') return json({ error: p.status === 'build-requested' || p.status === 'building' ? 'Your preview is already being updated.' : 'Daniel starts the first version; you can update it after that.' }, 409);
  const c = check(JSON.parse(p.answers));
  if (!c.ready) return json({ error: `Still needed first: ${c.missing.map((m) => m.label).join(', ')}.` }, 409);
  const now = new Date().toISOString();
  await env.INTAKE.prepare("UPDATE projects SET status = 'build-requested', build_requested_at = ?, build_note = NULL, build_step = NULL, build_activity = NULL, build_started_at = NULL, updated_at = ? WHERE id = ? AND status = 'preview'").bind(now, now, p.id).run();
  await logEvent(env, p.id, 'client', `${clientName(JSON.parse(p.answers))} asked for an updated preview`);
  return json({ ok: true });
}
