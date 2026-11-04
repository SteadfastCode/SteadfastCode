// "Email me my link" (functions/api/link/request.js): the link goes only to the email on the
// project, the answer never says whether there was one, and it's one email per project per 10 minutes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/link/request.js';

function db({ projects, recent = false }) {
  const writes = [];
  return {
    writes,
    prepare: (sql) => ({
      bind: (...args) => ({
        all: async () => ({ results: /FROM projects/.test(sql) ? projects.filter((p) => JSON.parse(p.answers).email.toLowerCase() === args[0]) : [] }),
        first: async () => (/project_events/.test(sql) ? (recent ? { 1: 1 } : null) : null),
        run: async () => { writes.push(sql.split(' ').slice(0, 3).join(' ')); return {}; },
      }),
    }),
  };
}
const projects = [{ id: 'p1', answers: JSON.stringify({ email: 'Joshua@Example.com', businessName: 'N & J', contactName: 'Joshua Cesavice' }) }];
const post = (env, body, origin = 'https://steadfastcode.tech') => onRequestPost({ request: new Request('https://steadfastcode.tech/api/link/request', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }), env });

test('a matching email gets a link by email; a stranger gets the same answer and no email', async () => {
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }); };
  try {
    const LINK_KEY = btoa(String.fromCharCode(...new Uint8Array(32)));
    const env = { INTAKE: db({ projects }), RESEND_API_KEY: 'k', LINK_KEY };
    const a = await (await post(env, { email: ' joshua@example.com ' })).json();
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].to, ['joshua@example.com']);
    assert.match(sent[0].text, /https:\/\/steadfastcode\.tech\/client#[A-Za-z0-9_-]{40,}/);
    assert.ok(env.INTAKE.writes.some((w) => /INSERT INTO client_links/.test(w)), 'a new link when none can be reopened');
    const b = await (await post(env, { email: 'nobody@example.com' })).json();
    assert.deepEqual(a, b, 'the same answer either way');
    assert.equal(sent.length, 1);
    await post({ ...env, INTAKE: db({ projects, recent: true }) }, { email: 'joshua@example.com' });
    assert.equal(sent.length, 1, 'not again within 10 minutes');
    assert.equal((await post(env, { email: 'joshua@example.com' }, 'https://evil.example')).status, 403);
    assert.equal((await post(env, { email: 'not an email' })).status, 400);
  } finally { globalThis.fetch = real; }
});
