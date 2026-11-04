// The care plan side of a project (2026-11-03): where it stands, signing its terms, and Stripe.
// Stripe is called over its REST API with fetch (no SDK in a Pages Function); the keys are Pages
// secrets Daniel sets: STRIPE_SECRET_KEY (a restricted key is enough: Checkout Sessions, Customer
// portal, Subscriptions read) and STRIPE_WEBHOOK_SECRET for /api/stripe/webhook.
// The terms wording and the billing dates live in src/data/care.ts.

import { careTermsFor, firstBillDate, carePlanById, careChecklist } from '../src/data/care.ts';
import { sha256 } from './agreement.js';

export const CARE_STATUSES = ['draft', 'offered', 'signed', 'active', 'past_due', 'canceled'];
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (n) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

export async function firstPreviewOf(env, projectId) {
  const r = await env.INTAKE.prepare('SELECT MIN(finished_at) AS at FROM builds WHERE project_id = ? AND ok = 1').bind(projectId).first();
  return r?.at ?? null;
}

/** The terms as they'd read today, and the dates under them. Null until there's a plan and a start. */
export function currentTerms(care, answers, firstPreview) {
  if (!care) return null;
  // Signed terms keep their date; otherwise the first bill is at least 3 days out (Stripe needs it in the future).
  const dates = care.first_bill_at && care.signed_at ? { windowEnds: null, firstBill: care.first_bill_at } : firstBillDate({ firstPreview, launchedAt: care.launched_at, minDate: inDays(3) });
  const terms = dates.firstBill ? careTermsFor({ plan: care.plan, price: care.price, firstBill: dates.firstBill, contactName: answers.contactName, businessName: answers.businessName }) : null;
  return { ...dates, terms };
}

/** What the admin and client pages get. The client sees it only once Daniel offers it. */
export async function careState(env, project, mode) {
  const care = await env.INTAKE.prepare('SELECT * FROM care_plans WHERE project_id = ?').bind(project.id).first().catch(() => null);
  if (!care) return mode === 'admin' ? { exists: false, firstPreview: await firstPreviewOf(env, project.id).catch(() => null) } : null;
  if (mode !== 'admin' && care.status === 'draft') return null;
  const answers = typeof project.answers === 'string' ? JSON.parse(project.answers) : project.answers;
  const firstPreview = await firstPreviewOf(env, project.id);
  const now = care.signed_at ? null : currentTerms(care, answers, firstPreview);
  return {
    exists: true,
    plan: care.plan,
    planName: carePlanById(care.plan)?.name ?? care.plan,
    price: care.price,
    status: care.status,
    launchedAt: care.launched_at,
    firstPreview: firstPreview,
    windowEnds: now?.windowEnds ?? null,
    firstBill: care.first_bill_at ?? now?.firstBill ?? null,
    terms: care.signed_at ? null : now?.terms ? { ...now.terms, sha256: await sha256(now.terms.text) } : null,
    signed: care.signed_at ? { name: care.signer_name, at: care.signed_at, version: care.terms_version } : null,
    billing: { hasCard: !!care.stripe_subscription, stripeStatus: care.stripe_status, paidThrough: care.paid_through },
    ...(mode === 'admin' ? { checklist: JSON.parse(care.checklist || '{}'), notes: care.notes || '', stripeCustomer: care.stripe_customer, stripeSubscription: care.stripe_subscription, stripeReady: !!stripeKey(env) } : {}),
  };
}

/** Daniel's edit: plan, price, launch date, checklist, notes, and offering or taking it back. */
export function cleanCarePatch(body, existing) {
  const out = {};
  const problems = [];
  if ('plan' in body) { if (carePlanById(body.plan)) out.plan = body.plan; else problems.push('Unknown plan.'); }
  if ('price' in body) { const n = Math.round(Number(body.price)); if (n >= 1 && n <= 10_000) out.price = n; else problems.push('The price is dollars a month, 1 to 10,000.'); }
  if ('launchedAt' in body) { if (body.launchedAt === null || body.launchedAt === '') out.launched_at = null; else if (/^\d{4}-\d{2}-\d{2}$/.test(body.launchedAt)) out.launched_at = body.launchedAt; else problems.push('Launch date as YYYY-MM-DD.'); }
  if ('notes' in body) out.notes = String(body.notes ?? '').slice(0, 4000);
  if ('checklist' in body && body.checklist && typeof body.checklist === 'object') {
    const ids = new Set(careChecklist.map((c) => c.id));
    out.checklist = JSON.stringify(Object.fromEntries(Object.entries(body.checklist).filter(([k, v]) => ids.has(k) && (v === null || /^\d{4}-\d{2}-\d{2}$/.test(v)) && v).map(([k, v]) => [k, v])));
  }
  if ('offer' in body) {
    const st = existing?.status ?? 'draft';
    if (body.offer === true && st === 'draft') out.status = 'offered';
    else if (body.offer === false && st === 'offered') out.status = 'draft';
    else if (typeof body.offer === 'boolean' && !['draft', 'offered'].includes(st)) problems.push('This plan is already signed; changes to it go through Stripe.');
  }
  // After signing, the plan and price are what was signed; a new plan is a new offer.
  if (existing?.signed_at && ('plan' in out || 'price' in out)) problems.push('The plan and price are what the client signed. Cancel it in Stripe and offer a new one to change them.');
  return { patch: out, problems };
}

/** A client's signature on the care terms: a typed full name, the box ticked, and the exact text shown. */
export function checkCareSignature(body, terms) {
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 3 || !/\s/.test(name) || name.length > 120) return { error: 'Type your full name (first and last) to sign.' };
  if (body?.agreed !== true) return { error: 'Tick the box to agree and sign.' };
  if (!terms) return { error: 'There’s no care plan to sign yet.' };
  if (body?.sha256 !== terms.sha256) return { error: 'The care plan changed while you were reading it. Read the updated one and sign again.', stale: true };
  return { name };
}

// ------------------------------------------------------------------------------------- Stripe

/** Stripe's form encoding: nested objects and arrays as a[b][0]=c. */
export function stripeForm(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') stripeForm(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

/** The Stripe key: STRIPE_SECRET_KEY (live), else STRIPE_TEST_KEY (the sandbox key Daniel set first, 2026-11-04). */
export const stripeKey = (env) => env.STRIPE_SECRET_KEY || env.STRIPE_TEST_KEY || null;

/** STRIPE_PRODUCTS, a Pages variable: {"hosted":"prod_…","hands-on":"prod_…","growth":"prod_…"}. Sandbox and live IDs differ. */
export function stripeProducts(env) {
  try { const p = JSON.parse(env.STRIPE_PRODUCTS || '{}'); return p && typeof p === 'object' ? p : {}; } catch { return {}; }
}

export async function stripe(env, path, params, method = 'POST') {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { authorization: `Bearer ${stripeKey(env)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : stripeForm(params ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || `Stripe answered ${r.status}`);
  return j;
}

const unixAt = (ymd) => Math.floor(Date.parse(ymd + 'T09:00:00-05:00') / 1000);

/** The Checkout Session that collects a card and starts the subscription, free until the first bill. */
export function checkoutParams({ care, answers, origin, customer, products = {} }) {
  const plan = carePlanById(care.plan);
  // Daniel's own Product for the plan when STRIPE_PRODUCTS names one (its name and description show
  // on Checkout and invoices); otherwise a product made inline. The amount is always the agreed price.
  const product = typeof products[care.plan] === 'string' && /^prod_\w+$/.test(products[care.plan]) ? { product: products[care.plan] } : null;
  return {
    mode: 'subscription',
    ...(customer ? { customer } : answers.email ? { customer_email: answers.email } : {}),
    client_reference_id: care.project_id,
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: care.price * 100, recurring: { interval: 'month' }, ...(product ?? { product_data: { name: `${plan?.name ?? 'Care'} Care Plan${answers.businessName ? ` — ${answers.businessName}` : ''}` } }) } }],
    subscription_data: { trial_end: unixAt(care.first_bill_at), description: `Steadfast Code ${plan?.name ?? ''} care plan, billed on the 1st`, metadata: { project_id: care.project_id, care_plan: care.id } },
    metadata: { project_id: care.project_id, care_plan: care.id },
    success_url: `${origin}/client?care=done`,
    cancel_url: `${origin}/client?care=later`,
  };
}

/** Stripe-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.body">; within five minutes. */
export async function verifyStripeSignature(secret, header, body, now = Date.now()) {
  const parts = Object.fromEntries(String(header ?? '').split(',').map((kv) => kv.split('=')).filter((x) => x.length === 2).map(([k, v]) => [k.trim(), v.trim()]));
  const sigs = String(header ?? '').split(',').filter((kv) => kv.trim().startsWith('v1=')).map((kv) => kv.trim().slice(3));
  const t = Number(parts.t);
  if (!secret || !t || !sigs.length || Math.abs(now / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => s.length === hex.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

const ymd = (unix) => (unix ? new Date(unix * 1000).toISOString().slice(0, 10) : null);
/** Our status from Stripe's: trialing counts as active (the card is on file, billing starts on the 1st). */
export const statusFromStripe = (s) => (['active', 'trialing'].includes(s) ? 'active' : ['past_due', 'unpaid', 'incomplete'].includes(s) ? 'past_due' : ['canceled', 'incomplete_expired'].includes(s) ? 'canceled' : null);

/**
 * One webhook event as the update it makes: { find: [column, value], set: {…}, event?: text for
 * the project's activity }. Null for events we don't use. Pure, so it's tested without D1.
 */
export function updateFromEvent(ev) {
  const o = ev?.data?.object ?? {};
  switch (ev?.type) {
    case 'checkout.session.completed':
      if (o.mode !== 'subscription' || !o.metadata?.project_id) return null;
      return { find: ['project_id', o.metadata.project_id], set: { stripe_customer: o.customer, stripe_subscription: o.subscription, stripe_status: 'trialing', status: 'active' }, event: 'Care plan: card added, billing starts on the 1st' };
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const st = ev.type === 'customer.subscription.deleted' ? 'canceled' : o.status;
      const ours = statusFromStripe(st);
      // A cancel from Stripe's billing page usually waits for the end of the paid (or free) period:
      // the plan stays active until then, and the activity says when it ends (2026-11-04).
      const prev = ev.data?.previous_attributes ?? {};
      const scheduled = ('cancel_at_period_end' in prev || 'cancel_at' in prev) && ours !== 'canceled'
        ? (o.cancel_at_period_end || o.cancel_at ? `Care plan set to end on ${ymd(o.cancel_at || o.current_period_end || o.trial_end || o.items?.data?.[0]?.current_period_end)}` : 'Care plan no longer set to end')
        : null;
      return { find: ['stripe_subscription', o.id], set: { stripe_status: st, ...(ours ? { status: ours } : {}) }, event: ours === 'canceled' ? 'Care plan canceled' : ours === 'past_due' ? 'Care plan payment is past due' : scheduled };
    }
    case 'invoice.paid': {
      const sub = o.subscription ?? o.parent?.subscription_details?.subscription;
      const end = o.lines?.data?.[0]?.period?.end ?? o.period_end;
      if (!sub || !o.amount_paid) return null;
      return { find: ['stripe_subscription', sub], set: { paid_through: ymd(end) }, event: `Care plan paid: $${(o.amount_paid / 100).toFixed(2)}` };
    }
    case 'invoice.payment_failed': {
      const sub = o.subscription ?? o.parent?.subscription_details?.subscription;
      if (!sub) return null;
      return { find: ['stripe_subscription', sub], set: { status: 'past_due' }, event: 'Care plan payment failed; Stripe will retry and email them' };
    }
    default:
      return null;
  }
}

export const CARE_COLUMNS = new Set(['plan', 'price', 'status', 'launched_at', 'first_bill_at', 'terms_version', 'terms_text', 'terms_sha256', 'signer_name', 'signed_at', 'signer_ip', 'signer_agent', 'stripe_customer', 'stripe_subscription', 'stripe_status', 'paid_through', 'checklist', 'notes']);

export function updateCare(env, projectId, set) {
  const cols = Object.keys(set).filter((k) => CARE_COLUMNS.has(k));
  if (!cols.length) return null;
  return env.INTAKE.prepare(`UPDATE care_plans SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE project_id = ?`).bind(...cols.map((c) => set[c] ?? null), new Date().toISOString(), projectId).run();
}

export { today };
