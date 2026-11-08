// POST /api/stripe/webhook: Stripe tells us when a card is added, a month is paid, a payment fails
// or a plan is cancelled. Every request is checked against STRIPE_WEBHOOK_SECRET before anything
// is read from it. Events: checkout.session.completed, customer.subscription.created/updated/deleted,
// invoice.paid, invoice.payment_failed (choose those when adding the endpoint in Stripe).
import { verifyStripeSignature, updateFromEvent, updateCare, stripeKey } from '../../../server/care.js';
import { logEvent } from '../../../server/view.js';
import { notifyDaniel } from '../../../server/notify.js';

const text = (body, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/plain' } });

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  if (!(await verifyStripeSignature(env.STRIPE_WEBHOOK_SECRET, request.headers.get('stripe-signature'), body))) return text('bad signature', 400);
  if (!env.INTAKE) return text('no database', 503);
  let ev;
  try { ev = JSON.parse(body); } catch { return text('bad json', 400); }
  // A sandbox event never touches a plan while the live key is set, nor the other way round.
  if (Boolean(ev.livemode) !== /_live_/.test(stripeKey(env) || '')) return text('ignored: other mode');
  const u = updateFromEvent(ev);
  if (!u) return text('ignored');
  const [col, val] = u.find;
  if (!val) return text('ignored');
  const row = await env.INTAKE.prepare(`SELECT project_id, stripe_status FROM care_plans WHERE ${col === 'project_id' ? 'project_id' : 'stripe_subscription'} = ?`).bind(val).first();
  // Not one of ours (yet): a 200 so Stripe doesn't retry forever, but say so in the dashboard log.
  if (!row) return text('no matching care plan');
  // A canceled subscription never comes back (a new plan is a new subscription), so a late or
  // repeated event about it changes nothing: Stripe doesn't promise order, and retries happen.
  if (col === 'stripe_subscription' && row.stripe_status === 'canceled') return text('ignored: subscription already canceled');
  await updateCare(env, row.project_id, u.set);
  if (u.event) {
    await logEvent(env, row.project_id, 'box', u.event);
    const p = await env.INTAKE.prepare('SELECT answers FROM projects WHERE id = ?').bind(row.project_id).first();
    const business = p ? JSON.parse(p.answers).businessName : null;
    await notifyDaniel(env, { kind: 'care', title: u.event, body: business || 'A client', url: `https://steadfastcode.tech/admin/care#p/${row.project_id}` });
  }
  return text('ok');
}
