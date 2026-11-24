// GET /api/lab?site=<the lab's host>: Daniel's changes to a lab's landing page (server/lab.js), for
// the page to apply on load: { tests: { <folder>: { shown, status, updated } } }. Public and read
// only, from any origin (the lab lives on its own pages.dev address): it says which tests are listed
// and how finished they are, and nothing else. A lab no project points at gets an empty list.
import { labHost, loadOverrides, STATUSES } from '../../server/lab.js';

const answer = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });

export async function onRequestGet({ request, env }) {
  const site = labHost(new URL(request.url).searchParams.get('site') || '');
  if (!site || !env.INTAKE) return answer({ tests: {} });
  const { results } = await env.INTAKE.prepare("SELECT id, answers FROM projects WHERE json_extract(answers, '$.labUrl') LIKE ?").bind(`%${site}%`).all();
  const project = results.find((p) => labHost(JSON.parse(p.answers).labUrl) === site);
  if (!project) return answer({ tests: {} });
  const { byFolder } = await loadOverrides(env, project.id);
  const tests = {};
  for (const [folder, o] of Object.entries(byFolder)) {
    tests[folder] = {
      ...(o.shown == null ? {} : { shown: o.shown === 1 }),
      ...(STATUSES.includes(o.status) ? { status: o.status } : {}),
      ...(o.updated ? { updated: o.updated } : {}),
    };
  }
  return answer({ tests });
}
