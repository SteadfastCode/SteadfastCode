// Messages between a client and Daniel: what a message must be, and that the email to the client
// says there's a message and carries their link, never the message itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanMessage, emailClientAboutReply, thread, tokenForEmail, MAX_MESSAGE } from '../server/messages.js';
import { sealToken, hashToken } from '../server/client.js';

test('a poll that only peeks leaves the other side’s messages unread', async () => {
  const ran = [];
  const env = { INTAKE: { prepare: (sql) => ({ bind: () => ({ run: async () => ran.push(sql), all: async () => ({ results: [] }) }) }) } };
  await thread(env, 'p1', 'daniel', { markRead: false });
  assert.deepEqual(ran, [], 'a peek writes nothing');
  await thread(env, 'p1', 'daniel');
  assert.equal(ran.length, 1);
  assert.match(ran[0], /UPDATE messages SET read_at/);
});

test('the link in an email is one that still works: an expired one is replaced, not sent', async () => {
  const env = { LINK_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(7))) };
  const inserted = [];
  env.INTAKE = { prepare: (sql) => ({ bind: (...a) => ({ first: async () => null, run: async () => inserted.push({ sql, a }) }) }) };
  const now = new Date('2026-11-08T12:00:00Z');
  const token = await tokenForEmail(env, 'p1', now);
  assert.ok(token.length >= 20);
  assert.equal(inserted.length, 1);
  assert.match(inserted[0].sql, /INSERT INTO client_links/);
  assert.equal(inserted[0].a[1], 'p1');
  assert.equal(inserted[0].a[2], await hashToken(token), 'only the hash is stored for the lookup');
  assert.equal(inserted[0].a[5], '2027-01-07T12:00:00.000Z', '60 days');
  // The query that finds a kept link asks for one that has not expired.
  const asked = [];
  env.INTAKE = { prepare: (sql) => ({ bind: (...a) => ({ first: async () => { asked.push({ sql, a }); return null; }, run: async () => {} }) }) };
  await tokenForEmail(env, 'p1', now);
  assert.match(asked[0].sql, /expires_at > \?/);
  assert.equal(asked[0].a[1], now.toISOString());
});

test('a message is some text, under the limit, with Windows line breaks made plain', () => {
  assert.equal(cleanMessage({ body: '   ' }).error, 'Write a message first.');
  assert.equal(cleanMessage({}).error, 'Write a message first.');
  assert.ok(cleanMessage({ body: 'x'.repeat(MAX_MESSAGE + 1) }).error);
  assert.equal(cleanMessage({ body: ' Hi\r\nthere ' }).text, 'Hi\nthere');
});

test("Daniel's reply emails the client their link and not the message", async () => {
  const env = { RESEND_API_KEY: 'k', LINK_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(7))) };
  const sealed = await sealToken(env, 'tok_abcdefghijklmnopqrstuvwxyz');
  const updates = [];
  env.INTAKE = { prepare: (sql) => ({ bind: (...a) => ({ first: async () => (/client_links/.test(sql) ? { token_enc: sealed } : null), run: async () => updates.push(sql) }) }) };
  const sent = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (u, init) => { sent.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }); };
  try {
    const ok = await emailClientAboutReply(env, { id: 'p1', answers: JSON.stringify({ email: 'j@example.com', contactName: 'Joshua C', businessName: 'N & J' }) }, 5, 'https://steadfastcode.tech');
    assert.equal(ok, true);
    assert.deepEqual(sent[0].to, ['j@example.com']);
    assert.match(sent[0].text, /Hi Joshua,/);
    assert.match(sent[0].text, /https:\/\/steadfastcode\.tech\/client#tok_abcdefghijklmnopqrstuvwxyz/);
    assert.ok(updates.some((u) => /emailed_at/.test(u)));
    assert.equal(await emailClientAboutReply({ ...env, RESEND_API_KEY: undefined }, { id: 'p1', answers: '{}' }, 1, 'x'), false);
  } finally { globalThis.fetch = real; }
});
