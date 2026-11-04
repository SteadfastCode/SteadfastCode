// Care plans: billing on the 1st starting after the change window (or launch), the terms a client
// signs, what Daniel can change and when, and Stripe: the Checkout request, the webhook's signature
// check, and what each event changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstBillDate, careTermsFor, planIncludes, carePlanById } from '../src/data/care.ts';
import { cleanCarePatch, checkCareSignature, stripeForm, checkoutParams, verifyStripeSignature, updateFromEvent, statusFromStripe } from '../server/care.js';

test('the first bill is the 1st on or after the later of launch and 30 days from the first preview', () => {
  // Joshua: first preview Nov 3, so the window ends Dec 3 and the first bill is Jan 1.
  assert.deepEqual(firstBillDate({ firstPreview: '2026-11-03T15:20:00Z', launchedAt: '2026-11-10' }), { windowEnds: '2026-12-03', firstBill: '2027-01-01' });
  // A late launch moves it: launched Dec 15, first bill Jan 1 still; launched Jan 1, bills that day.
  assert.equal(firstBillDate({ firstPreview: '2026-11-03', launchedAt: '2027-01-01' }).firstBill, '2027-01-01');
  assert.equal(firstBillDate({ firstPreview: '2026-11-03', launchedAt: '2027-01-02' }).firstBill, '2027-02-01');
  // A window ending on a 1st bills that 1st; too close to signing goes to the next one.
  assert.equal(firstBillDate({ firstPreview: '2026-10-02' }).firstBill, '2026-11-01');
  assert.equal(firstBillDate({ firstPreview: '2026-10-02', minDate: '2026-11-03' }).firstBill, '2026-12-01');
  assert.deepEqual(firstBillDate({}), { windowEnds: null, firstBill: null });
});

test('the terms spell out the plan, the price, the first charge and how to stop', () => {
  const t = careTermsFor({ plan: 'hosted', price: 60, firstBill: '2027-01-01', contactName: 'Joshua Cesavice', businessName: 'N & J Fusions Properties' });
  assert.match(t.text, /Joshua Cesavice, for N & J Fusions Properties/);
  assert.match(t.text, /\$60 a month, plus any sales tax that applies, billed on the 1st of each month/);
  assert.match(t.text, /Your first charge is on January 1, 2027\. Nothing is charged before then/);
  assert.match(t.text, /cancel any time/);
  for (const x of carePlanById('hosted').includes) assert.ok(t.text.includes(x), x);
  // A higher plan lists everything below it, never "Everything in …".
  assert.ok(planIncludes(carePlanById('growth')).length > carePlanById('growth').includes.length);
  assert.doesNotMatch(careTermsFor({ plan: 'growth', price: 300, firstBill: '2027-01-01' }).text, /Everything in /);
  assert.match(careTermsFor({ plan: 'hosted', price: 49, firstBill: '2027-01-01' }).text, /\$49 \(the Hosted plan is normally \$60\) a month/);
  assert.equal(careTermsFor({ plan: 'nope', price: 1, firstBill: '2027-01-01' }), null);
});

test('Daniel sets plan, price, launch and checklist; offering is a draft↔offered switch; signed terms are fixed', () => {
  assert.deepEqual(cleanCarePatch({ plan: 'hands-on', price: '140', launchedAt: '2026-11-20' }, { status: 'draft' }).patch, { plan: 'hands-on', price: 140, launched_at: '2026-11-20' });
  assert.equal(cleanCarePatch({ offer: true }, { status: 'draft' }).patch.status, 'offered');
  assert.equal(cleanCarePatch({ offer: false }, { status: 'offered' }).patch.status, 'draft');
  assert.ok(cleanCarePatch({ offer: false }, { status: 'active', signed_at: 'x' }).problems.length);
  assert.ok(cleanCarePatch({ price: 10 }, { status: 'signed', signed_at: 'x' }).problems.length);
  assert.ok(cleanCarePatch({ plan: 'gold' }, {}).problems.length);
  assert.ok(cleanCarePatch({ price: 0 }, {}).problems.length);
  assert.deepEqual(JSON.parse(cleanCarePatch({ checklist: { access: '2026-11-04', records: null, bogus: '2026-11-04', dns: 'yesterday' } }, {}).patch.checklist), { access: '2026-11-04' });
});

test('signing the care plan needs a full name, the box, and the exact terms shown', () => {
  const terms = { sha256: 'abc' };
  assert.equal(checkCareSignature({ name: 'Joshua', agreed: true, sha256: 'abc' }, terms).error, 'Type your full name (first and last) to sign.');
  assert.ok(checkCareSignature({ name: 'Joshua Cesavice', agreed: false, sha256: 'abc' }, terms).error);
  assert.ok(checkCareSignature({ name: 'Joshua Cesavice', agreed: true, sha256: 'old' }, terms).stale);
  assert.deepEqual(checkCareSignature({ name: ' Joshua   Cesavice ', agreed: true, sha256: 'abc' }, terms), { name: 'Joshua Cesavice' });
});

test("Stripe Checkout: a monthly price for the agreed amount, free until the first bill, tied to the project", () => {
  const care = { id: 'c1', project_id: 'p1', plan: 'hosted', price: 60, first_bill_at: '2027-01-01' };
  const p = checkoutParams({ care, answers: { email: 'j@example.com', businessName: 'N & J' }, origin: 'https://steadfastcode.tech' });
  const f = stripeForm(p);
  assert.equal(f.get('mode'), 'subscription');
  assert.equal(f.get('line_items[0][price_data][unit_amount]'), '6000');
  assert.equal(f.get('line_items[0][price_data][recurring][interval]'), 'month');
  assert.equal(f.get('subscription_data[metadata][project_id]'), 'p1');
  assert.equal(f.get('customer_email'), 'j@example.com');
  // Jan 1, 2027 at 9am Eastern: the first charge lands on the 1st, and every one after it.
  assert.equal(new Date(Number(f.get('subscription_data[trial_end]')) * 1000).toISOString(), '2027-01-01T14:00:00.000Z');
  assert.equal(stripeForm(checkoutParams({ care, answers: {}, origin: 'x', customer: 'cus_1' })).get('customer'), 'cus_1');
  // With STRIPE_PRODUCTS set, the price hangs off Daniel's own Product for the plan (its name and description).
  const withProduct = stripeForm(checkoutParams({ care, answers: {}, origin: 'x', products: { hosted: 'prod_H' } }));
  assert.equal(withProduct.get('line_items[0][price_data][product]'), 'prod_H');
  assert.equal(withProduct.get('line_items[0][price_data][product_data][name]'), null);
  assert.equal(withProduct.get('line_items[0][price_data][unit_amount]'), '6000', 'the agreed price, whatever the Product lists');
});

test("the webhook trusts only Stripe's signature, and only a fresh one", async () => {
  const secret = 'whsec_test', body = '{"type":"invoice.paid"}', t = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  assert.equal(await verifyStripeSignature(secret, `t=${t},v1=${sig}`, body), true);
  assert.equal(await verifyStripeSignature(secret, `t=${t},v1=${sig}`, body + ' '), false);
  assert.equal(await verifyStripeSignature('other', `t=${t},v1=${sig}`, body), false);
  assert.equal(await verifyStripeSignature(secret, `t=${t - 600},v1=${sig}`, body), false);
  assert.equal(await verifyStripeSignature(undefined, `t=${t},v1=${sig}`, body), false);
  assert.equal(await verifyStripeSignature(secret, '', body), false);
});

test('each Stripe event becomes one update: card added, paid, failed, cancelled', () => {
  assert.deepEqual(updateFromEvent({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', customer: 'cus_1', subscription: 'sub_1', metadata: { project_id: 'p1' } } } }).set, { stripe_customer: 'cus_1', stripe_subscription: 'sub_1', stripe_status: 'trialing', status: 'active' });
  assert.equal(updateFromEvent({ type: 'checkout.session.completed', data: { object: { mode: 'payment', metadata: {} } } }), null);
  const paid = updateFromEvent({ type: 'invoice.paid', data: { object: { subscription: 'sub_1', amount_paid: 5900, lines: { data: [{ period: { end: Date.parse('2027-02-01T14:00:00Z') / 1000 } }] } } } });
  assert.deepEqual(paid.find, ['stripe_subscription', 'sub_1']);
  assert.equal(paid.set.paid_through, '2027-02-01');
  assert.equal(updateFromEvent({ type: 'invoice.paid', data: { object: { subscription: 'sub_1', amount_paid: 0 } } }), null, 'the $0 trial invoice says nothing');
  assert.equal(updateFromEvent({ type: 'invoice.payment_failed', data: { object: { parent: { subscription_details: { subscription: 'sub_1' } } } } }).set.status, 'past_due');
  assert.equal(updateFromEvent({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', status: 'canceled' } } }).set.status, 'canceled');
  assert.equal(statusFromStripe('trialing'), 'active');
  assert.equal(statusFromStripe('unpaid'), 'past_due');
  assert.equal(updateFromEvent({ type: 'customer.created', data: { object: {} } }), null);
});

test('the live key wins; the sandbox key works until there is one', async () => {
  const { stripeKey } = await import('../server/care.js');
  assert.equal(stripeKey({ STRIPE_TEST_KEY: 'rk_test_1' }), 'rk_test_1');
  assert.equal(stripeKey({ STRIPE_TEST_KEY: 'rk_test_1', STRIPE_SECRET_KEY: 'rk_live_1' }), 'rk_live_1');
  assert.equal(stripeKey({}), null);
});

test('a cancel scheduled from Stripe’s billing page says when the plan ends, and only when that changed', () => {
  const end = Date.parse('2027-01-01T14:00:00Z') / 1000;
  const set = updateFromEvent({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'trialing', cancel_at_period_end: true, cancel_at: end }, previous_attributes: { cancel_at_period_end: false, cancel_at: null } } });
  assert.equal(set.event, 'Care plan set to end on 2027-01-01');
  assert.equal(set.set.status, 'active', 'still on until it ends');
  const undo = updateFromEvent({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'trialing', cancel_at_period_end: false, cancel_at: null }, previous_attributes: { cancel_at_period_end: true } } });
  assert.equal(undo.event, 'Care plan no longer set to end');
  assert.equal(updateFromEvent({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active', cancel_at_period_end: true }, previous_attributes: { status: 'trialing' } } }).event, null);
});
