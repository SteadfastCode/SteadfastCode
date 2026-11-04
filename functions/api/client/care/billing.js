// POST /api/client/care/billing: Stripe's own page for changing the card, seeing invoices or
// cancelling. Needs the customer portal saved once in the Stripe dashboard (Settings → Billing).
import { json } from '../_middleware.js';
import { stripe, stripeKey } from '../../../../server/care.js';

export async function onRequestPost({ request, env, data }) {
  if (!stripeKey(env)) return json({ error: 'Billing isn’t switched on yet.' }, 503);
  const care = await env.INTAKE.prepare('SELECT stripe_customer FROM care_plans WHERE project_id = ?').bind(data.project.id).first();
  if (!care?.stripe_customer) return json({ error: 'There’s no card on file yet.' }, 404);
  try {
    const s = await stripe(env, 'billing_portal/sessions', { customer: care.stripe_customer, return_url: `${new URL(request.url).origin}/client?care=billing` });
    return json({ url: s.url });
  } catch (err) {
    return json({ error: `Couldn’t open billing: ${err.message}` }, 502);
  }
}
