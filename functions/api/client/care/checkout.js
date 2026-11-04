// POST /api/client/care/checkout: a Stripe Checkout link to add a card for the signed care plan.
// Nothing is charged until the first bill date (the subscription's trial end), always a 1st.
import { json } from '../_middleware.js';
import { stripe, checkoutParams } from '../../../../server/care.js';

export async function onRequestPost({ request, env, data }) {
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'Card setup isn’t switched on yet. Daniel will let you know when it is.' }, 503);
  const p = data.project;
  const care = await env.INTAKE.prepare('SELECT * FROM care_plans WHERE project_id = ?').bind(p.id).first();
  if (!care || !care.signed_at || !care.first_bill_at) return json({ error: 'Sign the care plan first.' }, 400);
  if (care.stripe_subscription && care.status !== 'canceled') return json({ error: 'Your card is already set up.' }, 409);
  try {
    const s = await stripe(env, 'checkout/sessions', checkoutParams({ care, answers: JSON.parse(p.answers), origin: new URL(request.url).origin, customer: care.stripe_customer }));
    return json({ url: s.url });
  } catch (err) {
    return json({ error: `Couldn’t start card setup: ${err.message}` }, 502);
  }
}
