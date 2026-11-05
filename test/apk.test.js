// The admin app's update download: a link for one file, for ten minutes, that can't be bent to
// another file or forged without the key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signDownload, verifyDownload, validFile } from '../server/apk.js';

const env = { LINK_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(3))) };

test('a signed link opens its own file until it expires, and nothing else', async () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const t = await signDownload(env, 'steadfast-code-445000.apk', now);
  assert.equal(await verifyDownload(env, 'steadfast-code-445000.apk', t, now), true);
  assert.equal(await verifyDownload(env, 'steadfast-code-445000.apk', t, now + 9 * 60_000), true);
  assert.equal(await verifyDownload(env, 'steadfast-code-445000.apk', t, now + 11 * 60_000), false, 'expired');
  assert.equal(await verifyDownload(env, 'steadfast-code-445001.apk', t, now), false, 'another file');
  assert.equal(await verifyDownload({ LINK_KEY: btoa('x'.repeat(32)) }, 'steadfast-code-445000.apk', t, now), false, 'another key');
  assert.equal(await verifyDownload(env, 'steadfast-code-445000.apk', t.replace(/.$/, (c) => (c === '0' ? '1' : '0')), now), false, 'tampered');
  assert.equal(await verifyDownload(env, 'steadfast-code-445000.apk', '', now), false);
  assert.equal(await signDownload({}, 'steadfast-code-1.apk'), null, 'no key, no links');
});

test('only the app’s own file names', () => {
  assert.ok(validFile('steadfast-code-445000.apk'));
  for (const bad of ['../apk.json', 'apk.json', 'steadfast-code-1.apk/../x', 'uploads/p1/photo.jpg', 'steadfast-code-.apk']) assert.equal(validFile(bad), false, bad);
});
