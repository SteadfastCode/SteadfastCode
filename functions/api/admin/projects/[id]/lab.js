// GET /api/admin/projects/:id/lab: the lab card, the build's tests with Daniel's changes on top.
// POST /api/admin/projects/:id/lab { folder, shown?, status?, reset? }: change one test's place on
// the lab's landing page (server/lab.js). A new status dates the test today, so it reads as updated.
import { json } from '../../_middleware.js';
import { readManifest, loadOverrides, mergeTest, checkLabChange, labToday } from '../../../../../server/lab.js';
import { logEvent } from '../../../../../server/view.js';

async function card(env, p) {
  const labUrl = JSON.parse(p.answers).labUrl || null;
  if (!labUrl) return { labUrl: null, tests: [] };
  const [manifest, overrides] = await Promise.all([readManifest(labUrl), loadOverrides(env, p.id)]);
  return { labUrl, error: manifest.error || null, missing: !!overrides.missing, tests: (manifest.tests || []).map((t) => mergeTest(t, overrides.byFolder[t.folder])) };
}

export async function onRequestGet({ env, params }) {
  const p = await env.INTAKE.prepare('SELECT id, answers FROM projects WHERE id = ?').bind(params.id).first();
  if (!p) return json({ error: 'No such project.' }, 404);
  return json(await card(env, p));
}

export async function onRequestPost({ request, env, params, data }) {
  const p = await env.INTAKE.prepare('SELECT id, answers FROM projects WHERE id = ?').bind(params.id).first();
  if (!p) return json({ error: 'No such project.' }, 404);
  const c = checkLabChange(await request.json().catch(() => null));
  if (c.error) return json({ error: c.error }, 400);
  const now = new Date().toISOString();
  try {
    if (c.reset) {
      await env.INTAKE.prepare('DELETE FROM lab_tests WHERE project_id = ? AND folder = ?').bind(p.id, c.folder).run();
    } else {
      // Only what was sent changes; the rest of the row (or the build's say) stands.
      await env.INTAKE.prepare(`INSERT INTO lab_tests (project_id, folder, shown, status, updated, set_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (project_id, folder) DO UPDATE SET
          shown = CASE WHEN ?7 THEN excluded.shown ELSE lab_tests.shown END,
          status = CASE WHEN ?8 THEN excluded.status ELSE lab_tests.status END,
          updated = CASE WHEN ?8 THEN excluded.updated ELSE lab_tests.updated END,
          set_at = excluded.set_at`)
        .bind(p.id, c.folder, c.shown === undefined ? null : c.shown ? 1 : 0, c.status ?? null, c.status ? labToday() : null, now, c.shown !== undefined ? 1 : 0, c.status ? 1 : 0).run();
    }
  } catch (e) {
    if (/no such table/i.test(e.message)) return json({ error: 'The lab card needs migration 0025 on the database first.' }, 503);
    throw e;
  }
  const what = c.reset ? 'back to what the build says' : [c.shown === undefined ? null : c.shown ? 'listed' : 'held back', c.status ? `marked ${c.status}` : null].filter(Boolean).join(', ');
  await logEvent(env, p.id, data.email, `Lab: ${c.folder} ${what}`);
  return json(await card(env, p));
}
