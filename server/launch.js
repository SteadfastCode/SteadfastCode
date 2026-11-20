// Launching a site (2026-11-20). Until now nothing set a project live: the launch day sat on the
// care page and the search-engine block was taken off the repo by hand. Launch is one button on
// the project in /admin, and this file is its rules:
//
//   1. The project needs a first version (a preview) and a domain.
//   2. The domain has to answer already. Pointing it at the site is DNS, done by hand before
//      launch, and a launch that lets search engines in at an address that isn't serving the site
//      would be wrong. Daniel can launch anyway when he knows better (`force`).
//   3. Launching sets projects.launched_at and status 'live', and the care plan's launch day when
//      there's a plan without one. The box sees launched_at and takes the repo out of preview mode
//      (scripts/client-builds.mjs in steadfast-ai, sweepLaunches), then deploys it.
//   4. Taking it back clears launched_at and the box puts the search-engine block back on.

/** A domain as a host: no scheme, no path, lower-case. Empty when it isn't a domain. */
export function domainHost(domain) {
  const host = String(domain ?? '').trim().replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').toLowerCase();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : '';
}

/** Whether the project is launched: the button's date, or a status set live some other way. */
export const isLaunched = (project) => Boolean(project?.launched_at) || project?.status === 'live';

/** What stands in the way of a launch, in words for the card. Empty means it can go. */
export function launchProblems(project, answers) {
  const problems = [];
  if (!project.preview_url) problems.push('There’s no first version yet. Build the site first.');
  if (['build-requested', 'building'].includes(project.status)) problems.push('A build is running. Launch when it’s finished.');
  if (!domainHost(answers.domain)) problems.push('The project has no domain. Add it under their details first.');
  return problems;
}

/**
 * Whether the domain is serving something. A 200 from https://<domain>/ within a few seconds; a
 * redirect is followed, so a www or http hop is fine.
 */
export async function domainAnswers(host, { fetchImpl = fetch, timeoutMs = 6000 } = {}) {
  try {
    const response = await fetchImpl(`https://${host}/`, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'steadfastcode-launch-check' } });
    return response.ok;
  } catch {
    return false;
  }
}

/** Today in Daniel's time zone, as the care plan keeps its launch day (YYYY-MM-DD). */
export const launchDay = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

/** Said when the column isn't there yet (the migration hasn't been run). */
export const NOT_READY = 'Launch isn’t ready yet: migration 0021_launched.sql hasn’t been run on the database.';
