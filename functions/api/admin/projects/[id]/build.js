// POST /api/admin/projects/:id/build: ask the box for a first version. Needs the required answers;
// scope notes don't block it. The box (steadfast-ai) picks up build-requested rows, makes the repo
// `client-<slug>`, and writes status, build_note and preview_url back here.
import { json } from '../../_middleware.js';
import { check, slugFor } from '../../../../../server/intake.js';

export async function onRequestPost({ env, params }) {
  const p = await env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(params.id).first();
  if (!p) return json({ error: 'No such project.' }, 404);
  const answers = JSON.parse(p.answers);
  const c = check(answers);
  if (!c.ready) return json({ error: `Still missing: ${c.missing.map((m) => m.label).join(', ')}.` }, 409);
  if (!['intake', 'preview'].includes(p.status)) return json({ error: `A build is already ${p.status}.` }, 409);
  let slug = p.slug;
  if (!slug) {
    const base = slugFor(answers.businessName);
    if (!base) return json({ error: 'The business name needs letters or numbers for the repo name.' }, 400);
    slug = base;
    for (let n = 2; await env.INTAKE.prepare('SELECT 1 FROM projects WHERE slug = ? AND id != ?').bind(slug, p.id).first(); n++) slug = `${base}-${n}`;
  }
  const now = new Date().toISOString();
  await env.INTAKE.prepare("UPDATE projects SET status = 'build-requested', slug = ?, build_requested_at = ?, build_note = NULL, updated_at = ? WHERE id = ?").bind(slug, now, now, p.id).run();
  return json({ ok: true, slug, status: 'build-requested' });
}
