// POST /api/stripe/webhook: Stripe tells us when a card is added, a month is paid, a payment fails
// or a plan is cancelled. Every request is checked against STRIPE_WEBHOOK_SECRET before anything
// is read from it. Events: checkout.session.completed, customer.subscription.created/updated/deleted,
// invoice.paid, invoice.payment_failed (choose those when adding the endpoint in Stripe).
import { verifyStripeSignature, updateFromEvent, updateCare } from '../../../server/care.js';
import { logEvent } from '../../../server/view.js';

const text = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/plain' } });

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  if (!(await verifyStripeSignature(env.STRIPE_WEBHOOK_SECRET, request.headers.get('stripe-signature'), body))) return text('bad signature', 400);
  if (!env.INTAKE) return text('no database', 503);
  let ev;
  try { ev = JSON.parse(body); } catch { return text('bad json', 400); }
  const u = updateFromEvent(ev);
  if (!u) return text('ignored');
  const [col, val] = u.find;
  if (!val) return text('ignored');
  const row = await env.INTAKE.prepare(`SELECT project_id FROM care_plans WHERE ${col === 'project_id' ? 'project_id' : 'stripe_subscription'} = ?`).bind(val).first();
  // Not one of ours (yet): a 200 so Stripe doesn't retry forever, but say so in the dashboard log.
  if (!row) return text('no matching care plan');
  await updateCare(env, row.project_id, u.set);
  if (u.event) await logEvent(env, row.project_id, 'box', u.event);
  return text('ok');
}
