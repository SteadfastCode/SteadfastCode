// GET /api/admin/projects/:id/care: the project's care plan, as the Care plans tab shows it.
// PUT /api/admin/projects/:id/care { plan?, price?, launchedAt?, checklist?, notes?, offer? }:
// make or change it. A new plan starts as a draft at the plan's list price; offer: true shows it on
// the client's portal to sign, offer: false takes it back. Once signed, plan and price are fixed;
// reset: true starts a canceled plan over as a draft.
import { json } from '../../_middleware.js';
import { careState, cleanCarePatch, updateCare } from '../../../../../server/care.js';
import { carePlanById } from '../../../../../src/data/care.ts';
import { logEvent } from '../../../../../server/view.js';

const project = (env, id) => env.INTAKE.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();

export async function onRequestGet({ env, params }) {
  const p = await project(env, params.id);
  if (!p) return json({ error: 'No such project.' }, 404);
  return json({ care: await careState(env, p, 'admin') });
}

export async function onRequestPut({ request, env, params }) {
  const p = await project(env, params.id);
  if (!p) return json({ error: 'No such project.' }, 404);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Send the fields to change.' }, 400);
  let existing = await env.INTAKE.prepare('SELECT * FROM care_plans WHERE project_id = ?').bind(p.id).first();
  const fresh = !existing;
  if (fresh) {
    // The draft the first change makes: checked like any other before anything is written.
    const plan = carePlanById(body.plan) ?? carePlanById('hosted');
    existing = { status: 'draft', plan: plan.id, price: plan.price };
    // A plan change picks up the new plan's list price unless a price came with it.
    if (body.plan && !('price' in body)) body.price = plan.price;
  } else if (body.plan && body.plan !== existing.plan && !('price' in body) && carePlanById(body.plan)) {
    body.price = carePlanById(body.plan).price;
  }
  const { patch, problems } = cleanCarePatch(body, existing);
  if (problems.length) return json({ error: problems.join(' ') }, 400);
  if (fresh) {
    const now = new Date().toISOString();
    await env.INTAKE.prepare('INSERT INTO care_plans (id, project_id, plan, price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), p.id, existing.plan, existing.price, now, now).run();
  }
  await updateCare(env, p.id, patch);
  if (patch.status === 'draft' && existing.status === 'canceled') await logEvent(env, p.id, 'daniel', 'Daniel started a new care plan over the canceled one');
  if (patch.status === 'offered') await logEvent(env, p.id, 'daniel', 'Daniel offered a care plan to sign');
  if (patch.status === 'draft' && existing.status === 'offered') await logEvent(env, p.id, 'daniel', 'Daniel took the care plan offer back');
  return json({ care: await careState(env, p, 'admin') });
}
