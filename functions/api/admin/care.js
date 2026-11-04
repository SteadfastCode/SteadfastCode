// GET /api/admin/care: every project that has a preview or a care plan, with where its plan stands,
// for the Care plans tab. Monthly totals count plans that are signed or active.
import { json } from './_middleware.js';
import { carePlanById } from '../../../src/data/care.ts';

export async function onRequestGet({ env }) {
  const { results } = await env.INTAKE.prepare(`
    SELECT p.id, p.status AS project_status, p.preview_url, p.answers, c.plan, c.price, c.status, c.launched_at, c.first_bill_at, c.signed_at, c.stripe_status, c.paid_through, c.checklist,
      (SELECT MIN(finished_at) FROM builds b WHERE b.project_id = p.id AND b.ok = 1) AS first_preview
    FROM projects p LEFT JOIN care_plans c ON c.project_id = p.id
    WHERE p.preview_url IS NOT NULL OR c.id IS NOT NULL
    ORDER BY (c.id IS NULL), p.updated_at DESC LIMIT 200`).all();
  const rows = results.map((r) => {
    const a = JSON.parse(r.answers);
    return {
      id: r.id, business: a.businessName ?? null, contact: a.contactName ?? null, previewUrl: r.preview_url, projectStatus: r.project_status, firstPreview: r.first_preview,
      care: r.plan ? { plan: r.plan, planName: carePlanById(r.plan)?.name ?? r.plan, price: r.price, status: r.status, launchedAt: r.launched_at, firstBill: r.first_bill_at, signedAt: r.signed_at, stripeStatus: r.stripe_status, paidThrough: r.paid_through, done: Object.keys(JSON.parse(r.checklist || '{}')).length } : null,
    };
  });
  const billing = rows.filter((r) => r.care && ['signed', 'active', 'past_due'].includes(r.care.status));
  return json({ rows, monthly: billing.reduce((s, r) => s + r.care.price, 0), count: billing.length, stripeReady: !!env.STRIPE_SECRET_KEY });
}
