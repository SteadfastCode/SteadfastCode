// A client's lab page (2026-11-24): the address where pieces of their site are tried out before
// they go on the preview (answers.labUrl, built from the client repo's lab/). The build publishes
// its tests as tests.json beside the landing page; Daniel's lab card on /admin lists them and keeps
// his overrides in lab_tests (migration 0025): whether a test is listed, and whether it's ready or
// still rough. The landing page asks /api/lab for them on load, so a change shows without a rebuild.

export const STATUSES = ['ready', 'rough'];
const FOLDER = /^[a-z0-9][a-z0-9-]{0,60}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The lab's host, from the address on the project ("https://lab.x.pages.dev/" → "lab.x.pages.dev"). */
export function labHost(url) {
  try { return new URL(/^https?:\/\//.test(String(url)) ? url : `https://${url}`).host.toLowerCase(); } catch { return null; }
}

/** The build's list, checked: anything that isn't a test with a folder and a name is left out. */
export function cleanManifest(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((t) => t && FOLDER.test(t.folder) && typeof t.name === 'string').map((t) => ({
    folder: t.folder,
    name: t.name.slice(0, 120),
    status: STATUSES.includes(t.status) ? t.status : 'rough',
    updated: DAY.test(t.updated) ? t.updated : null,
    shown: t.shown !== false,
  }));
}

/** The build's tests.json, from the lab itself; { error } when it can't be read. */
export async function readManifest(labUrl) {
  const host = labHost(labUrl);
  if (!host) return { error: 'The lab link isn’t a web address.' };
  try {
    const r = await fetch(`https://${host}/tests.json`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5000), cf: { cacheTtl: 0 } });
    if (r.status === 404) return { error: 'The lab doesn’t publish its list yet (tests.json). It needs a rebuild with the newer lab/build.mjs.' };
    if (!r.ok) return { error: `The lab answered ${r.status}.` };
    return { tests: cleanManifest(await r.json()) };
  } catch (e) {
    return { error: `Couldn’t reach the lab: ${e.message}` };
  }
}

/** Daniel's overrides, by folder. Before migration 0025 there are none (`missing`). */
export async function loadOverrides(env, projectId) {
  try {
    const { results } = await env.INTAKE.prepare('SELECT folder, shown, status, updated FROM lab_tests WHERE project_id = ?').bind(projectId).all();
    return { byFolder: Object.fromEntries(results.map((r) => [r.folder, r])) };
  } catch (e) {
    if (/no such table/i.test(e.message)) return { byFolder: {}, missing: true };
    throw e;
  }
}

/** A test as it stands: the build's, with Daniel's changes on top (`changed` when he has any). */
export function mergeTest(test, o) {
  if (!o) return { ...test, changed: false };
  return {
    ...test,
    shown: o.shown == null ? test.shown : o.shown === 1,
    status: STATUSES.includes(o.status) ? o.status : test.status,
    updated: o.updated || test.updated,
    changed: o.shown != null || !!o.status,
  };
}

/** A change from the card: one folder, a shown flag and/or a status. */
export function checkLabChange(body) {
  const folder = String(body?.folder ?? '');
  if (!FOLDER.test(folder)) return { error: 'Which test? Send its folder.' };
  const change = { folder };
  if (body.shown !== undefined) {
    if (typeof body.shown !== 'boolean') return { error: 'shown is true or false.' };
    change.shown = body.shown;
  }
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return { error: 'The status is ready or rough.' };
    change.status = body.status;
  }
  if (body.reset === true) change.reset = true;
  if (change.shown === undefined && !change.status && !change.reset) return { error: 'Nothing to change.' };
  return change;
}

/** Today in Lititz, as the lab writes its dates. */
export const labToday = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
