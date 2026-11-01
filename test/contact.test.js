import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/contact.js';

// A stand-in for the D1 binding: records each insert, or throws when told to.
function fakeD1({ fail = false } = {}) {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      return { bind: (...args) => ({ run: async () => { if (fail) throw new Error('D1 down'); rows.push({ sql, args }); } }) };
    },
  };
}

const post = (fields) => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new Request('https://steadfastcode.tech/api/contact', { method: 'POST', body });
};
const lead = { name: 'Pat', email: 'pat@example.com', business: 'Pat Plumbing', plan: 'business', message: 'Need a site' };

test('a submission is saved to INTAKE and still emailed', async (t) => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return new Response('{}', { status: 200 }); });
  const INTAKE = fakeD1();
  const r = await onRequestPost({ request: post(lead), env: { INTAKE, RESEND_API_KEY: 'k' } });
  assert.match(r.headers.get('location'), /sent=1/);
  assert.equal(INTAKE.rows.length, 1);
  assert.match(INTAKE.rows[0].sql, /INSERT INTO leads/);
  assert.deepEqual(INTAKE.rows[0].args.slice(2, 7), ['Pat', 'pat@example.com', null, 'Pat Plumbing', 'business']);
  assert.equal(sent.length, 1);
});

test('a failed save never stops the email, and a saved row alone is not "sent"', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 200 }));
  const ok = await onRequestPost({ request: post(lead), env: { INTAKE: fakeD1({ fail: true }), RESEND_API_KEY: 'k' } });
  assert.match(ok.headers.get('location'), /sent=1/);
  const INTAKE = fakeD1();
  const noMail = await onRequestPost({ request: post(lead), env: { INTAKE } });
  assert.match(noMail.headers.get('location'), /sent=0/);
  assert.equal(INTAKE.rows.length, 1);
});

test('the honeypot saves nothing', async () => {
  const INTAKE = fakeD1();
  await onRequestPost({ request: post({ ...lead, company: 'bot' }), env: { INTAKE } });
  assert.equal(INTAKE.rows.length, 0);
});
