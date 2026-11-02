// GET /api/admin/usage: every client build with what it used (scripts/client-builds.mjs records
// it), for /admin/usage. POST { planMonthlyUsd }: the plan price that turns weekly-usage
// percentages into dollars.
import { json } from './_middleware.js';

export async function onRequestGet({ env }) {
  const { results } = await env.INTAKE.prepare(`SELECT b.id, b.project_id, b.tier, b.kind, b.mode, b.requested_by, b.started_at, b.finished_at, b.seconds, b.ok,
      b.model, b.effort, b.input_tokens, b.output_tokens, b.cache_read_tokens, b.cache_write_tokens, b.cost_usd, b.turns, b.session_seconds,
      b.weekly_before, b.weekly_after, b.change_count, b.changes, b.rules_refreshed, p.answers
    FROM builds b LEFT JOIN projects p ON p.id = b.project_id ORDER BY b.started_at DESC LIMIT 500`).all();
  const plan = await env.INTAKE.prepare("SELECT value FROM settings WHERE key = 'planMonthlyUsd'").first();
  return json({
    planMonthlyUsd: plan ? Number(plan.value) : null,
    builds: results.map(({ answers, ...b }) => ({ ...b, business: (() => { try { return JSON.parse(answers || '{}').businessName ?? null; } catch { return null; } })() })),
  });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const v = Number(body.planMonthlyUsd);
  if (!Number.isFinite(v) || v < 0 || v > 10000) return json({ error: 'Enter the plan price in dollars per month.' }, 400);
  await env.INTAKE.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('planMonthlyUsd', ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at").bind(String(v), new Date().toISOString()).run();
  return json({ ok: true, planMonthlyUsd: v });
}
