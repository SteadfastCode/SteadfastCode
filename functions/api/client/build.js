// POST /api/client/build: "Update my preview" — a rebuild with the latest answers and files. Only
// once a first version exists (Daniel starts the first one), and one at a time.
import { json } from './_middleware.js';
import { check } from '../../../server/intake.js';
import { logEvent } from '../../../server/view.js';
import { clientName } from './project.js';

export const CLIENT_REBUILDS_PER_DAY = 3;
export const CLIENT_REBUILD_GAP_MIN = 15;

export async function onRequestPost({ env, data }) {
  const p = data.project;
  if (p.status !== 'preview') return json({ error: p.status === 'build-requested' || p.status === 'building' ? 'Your preview is already being updated.' : 'Daniel starts the first version; you can update it after that.' }, 409);
  const c = check(JSON.parse(p.answers));
  if (!c.ready) return json({ error: `Still needed first: ${c.missing.map((m) => m.label).join(', ')}.` }, 409);
  // A client's rebuilds are limited (Daniel, 2026-11-02): each one uses Daniel's plan. Daniel's own aren't.
  const day = new Date(Date.now() - 86400_000).toISOString();
  const recent = await env.INTAKE.prepare("SELECT COUNT(*) AS n, MAX(started_at) AS last FROM builds WHERE project_id = ? AND requested_by = 'client' AND started_at > ?").bind(p.id, day).first();
  if (recent.n >= CLIENT_REBUILDS_PER_DAY) return json({ error: `That's ${CLIENT_REBUILDS_PER_DAY} updates today. Your changes are saved; the next update can run tomorrow, or Daniel can run one sooner.` }, 429);
  if (recent.last && Date.now() - Date.parse(recent.last) < CLIENT_REBUILD_GAP_MIN * 60_000) {
    const wait = Math.ceil((CLIENT_REBUILD_GAP_MIN * 60_000 - (Date.now() - Date.parse(recent.last))) / 60_000);
    return json({ error: `Your last update was just now. Keep making changes; you can update again in about ${wait} minute${wait === 1 ? '' : 's'}.` }, 429);
  }
  const now = new Date().toISOString();
  await env.INTAKE.prepare("UPDATE projects SET status = 'build-requested', build_requested_at = ?, build_note = NULL, build_step = NULL, build_activity = NULL, build_started_at = NULL, build_mode = NULL, build_requested_by = 'client', updated_at = ? WHERE id = ? AND status = 'preview'").bind(now, now, p.id).run();
  await logEvent(env, p.id, 'client', `${clientName(JSON.parse(p.answers))} asked for an updated preview`);
  return json({ ok: true });
}
