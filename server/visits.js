// Visit counts in the client portal (2026-11-26). Steadfast Analytics comes with the care plans, so a
// project's numbers show while it has a care plan that isn't canceled (a draft too: Daniel drafts
// one only for a client who wants it), and for 90 days after a plan is canceled, when the client can
// still download every count before the box deletes them (steadfast-ai scripts/client-builds.mjs,
// same rule). The numbers come from the steadfast-analytics Worker over this project's ANALYTICS
// service binding, with ANALYTICS_REPORT_KEY; the client's private link is the only login.
//
// Also here: Cloudflare's own Web Analytics, which Daniel can switch on for a client from the
// Launch card, or which a contract switches on by including the library line below. The box keeps
// each zone's setting in step with it.

export const EXPORT_DAYS = 90;
export const RANGES = [7, 30, 90, 365];

// The contract-library line that, switched on in a project's contract, turns on Cloudflare's Web
// Analytics for that client (added to the library 2026-11-26; steadfast-ai reads the same id).
export const CF_ANALYTICS_LINE = 'l-cfanalytics';

/** A YYYY-MM-DD date plus some days. */
export function addDays(day, days) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * What the portal offers, from the project's care plan row (status, ends_at): null for nothing,
 * { mode: 'counting' } while a plan runs, { mode: 'ended', until } for the export window after it.
 */
export function visitsState(care, today = new Date().toISOString().slice(0, 10)) {
  if (!care) return null;
  if (care.status !== 'canceled') return { mode: 'counting' };
  const ended = care.ends_at || null;
  if (!ended) return null;
  const until = addDays(ended, EXPORT_DAYS);
  return today <= until ? { mode: 'ended', until } : null;
}

/** Is Cloudflare's Web Analytics on in this project's contract? (Its line added and not switched off.) */
export function contractWantsCfAnalytics(answers) {
  const c = answers?.contract ?? {};
  const added = Object.values(c.add ?? {}).some((ids) => Array.isArray(ids) && ids.includes(CF_ANALYTICS_LINE));
  return added && !(c.off ?? []).includes(CF_ANALYTICS_LINE);
}

export async function careRow(env, projectId) {
  return env.INTAKE.prepare('SELECT status, ends_at FROM care_plans WHERE project_id = ?').bind(projectId).first().catch(() => null);
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function askAnalytics(env, path) {
  if (!env.ANALYTICS || !env.ANALYTICS_REPORT_KEY) return null;
  return env.ANALYTICS.fetch(`https://collector${path}`, { headers: { 'x-report-key': env.ANALYTICS_REPORT_KEY } });
}

/** GET …/visits?days=30: the project's numbers, as the analytics dashboard has them. */
export async function visitsResponse(env, project, url) {
  const state = visitsState(await careRow(env, project.id));
  if (!state) return json({ error: 'Visit counts come with a care plan.' }, 404);
  const asked = Number(url.searchParams.get('days'));
  const days = RANGES.includes(asked) ? asked : 30;
  const r = await askAnalytics(env, `/report?site=${encodeURIComponent(project.slug)}&days=${days}`);
  if (!r) return json({ error: 'Visit counts aren’t available right now.' }, 503);
  // Not registered yet: the counter goes on once the site is launched with its plan.
  if (r.status === 404) return json({ state, report: null });
  if (!r.ok) return json({ error: 'Visit counts aren’t available right now.' }, 502);
  return json({ state, report: await r.json() });
}

/** GET …/visits/export: every count kept for the site, as a CSV file. */
export async function exportResponse(env, project) {
  if (!visitsState(await careRow(env, project.id))) return json({ error: 'Visit counts come with a care plan.' }, 404);
  const r = await askAnalytics(env, `/export?site=${encodeURIComponent(project.slug)}`);
  if (!r || !r.ok) return json({ error: r?.status === 404 ? 'There are no counts for this site yet.' : 'The download isn’t available right now.' }, r?.status === 404 ? 404 : 503);
  return new Response(r.body, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${project.slug}-visits.csv"`, 'cache-control': 'no-store' } });
}
