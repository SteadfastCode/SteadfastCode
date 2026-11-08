// POST /api/client/care/checkout: a Stripe Checkout link to add a card for the signed care plan.
// Nothing is charged until the first bill date (the subscription's trial end), always a 1st.
import { json } from '../_middleware.js';
import { stripe, checkoutParams, stripeProducts, stripeKey, billableFirstBill, updateCare } from '../../../../server/care.js';
import { logEvent } from '../../../../server/view.js';
import { notifyDaniel } from '../../../../server/notify.js';

export async function onRequestPost({ request, env, data }) {
  if (!stripeKey(env)) return json({ error: 'Card setup isn’t switched on yet. Daniel will let you know when it is.' }, 503);
  const p = data.project;
  const care = await env.INTAKE.prepare('SELECT * FROM care_plans WHERE project_id = ?').bind(p.id).first();
  if (!care || !care.signed_at || !care.first_bill_at) return json({ error: 'Sign the care plan first.' }, 400);
  if (care.stripe_subscription && care.status !== 'canceled') return json({ error: 'Your card is already set up.' }, 409);
  // Stripe won't start a subscription whose first charge is under two days away (or past). A card
  // added that late bills from the next 1st instead; the date moves on the plan, and Daniel hears.
  const { firstBill, moved } = billableFirstBill(care);
  if (!firstBill) return json({ error: 'Couldn’t work out your first bill date. Email support@steadfastcode.tech and Daniel will sort it out.' }, 500);
  if (moved) {
    await updateCare(env, p.id, { first_bill_at: firstBill });
    await logEvent(env, p.id, 'box', `First care bill moved from ${care.first_bill_at} to ${firstBill}: the card came too close to the date`);
    await notifyDaniel(env, { kind: 'care', title: 'Care plan: first bill moved', body: `${JSON.parse(p.answers).businessName || 'A client'} · now ${firstBill} (was ${care.first_bill_at})`, url: `https://steadfastcode.tech/admin/care#p/${p.id}` }).catch(() => {});
  }
  try {
    const s = await stripe(env, 'checkout/sessions', checkoutParams({ care: { ...care, first_bill_at: firstBill }, answers: JSON.parse(p.answers), origin: new URL(request.url).origin, customer: care.stripe_customer, products: stripeProducts(env) }));
    return json({ url: s.url });
  } catch (err) {
    return json({ error: `Couldn’t start card setup: ${err.message}` }, 502);
  }
}
