// Messages between a client and Daniel: what a message must be, and that the email to the client
// says there's a message and carries their link, never the message itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanMessage, emailClientAboutReply, MAX_MESSAGE } from '../server/messages.js';
import { sealToken } from '../server/client.js';

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
