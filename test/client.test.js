// The client side: what a client may change, what they may upload, how the link is kept, and that
// their page stays private. The live behaviour (two screens, one form) is checked end to end with
// wrangler pages dev; these are the rules underneath it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mergeClientAnswers, clientEditable, sniffImage, newToken, hashToken, clientStatus } from '../server/client.js';
import { intakeSections } from '../src/data/intake.ts';
import { onRequest as clientMiddleware } from '../functions/api/client/_middleware.js';

test('a client can change everything except the package and what sets the scope', () => {
  const owned = intakeSections.flatMap((s) => s.fields).filter((f) => f.owner === 'daniel').map((f) => f.id).sort();
  assert.deepEqual(owned, ['editor', 'outOfScope', 'tier']);
  assert.ok(clientEditable.has('pages'), 'pages are the client\'s to edit; the scope note shows both sides when they go past the package');
  for (const id of owned) assert.equal(clientEditable.has(id), false, id);
  assert.ok(clientEditable.has('notes'), 'notes are shared, not private');
  const { answers, dropped } = mergeClientAnswers({ tier: 'starter', pages: ['Home'] }, { tier: 'growth', pages: ['Home', 'Gallery'], services: 'Drains\nHeaters', outOfScope: 'free logo', editor: true });
  assert.equal(answers.tier, 'starter');
  assert.deepEqual(answers.pages, ['Home', 'Gallery']);
  assert.deepEqual(answers.services, ['Drains', 'Heaters']);
  assert.deepEqual(dropped.sort(), ['editor', 'outOfScope', 'tier']);
});

test('every question, help line and dropdown answer has client wording, or wording that already works for them', () => {
  // The question and the help line under it, as the client reads them (Daniel caught the help lines, 2026-11-01).
  for (const f of intakeSections.flatMap((s) => s.fields)) {
    const answers = (f.options || []).map((o) => o.you || o.value || o);
    for (const text of [f.you || f.label, f.youHelp || f.help, ...answers].filter(Boolean)) assert.doesNotMatch(text, /\b(they|their|them|theirs)\b/i, `${f.id}: "${text}" talks about the client in the third person`);
  }
});

test('uploads are typed from their bytes; SVG and anything else are refused', () => {
  const bytes = (...xs) => new Uint8Array([...xs, ...new Array(16).fill(0)]);
  const ascii = (s, at = 0) => { const b = new Uint8Array(32); [...s].forEach((c, i) => { b[at + i] = c.charCodeAt(0); }); return b; };
  assert.equal(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0)).type, 'image/jpeg');
  assert.equal(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)).type, 'image/png');
  const webp = ascii('RIFF'); webp.set(ascii('WEBP').slice(0, 4), 8);
  assert.equal(sniffImage(webp).type, 'image/webp');
  const heic = ascii('ftypheic', 4);
  assert.deepEqual(sniffImage(heic), { type: 'image/heic', ext: 'heic', noPreview: true });
  assert.equal(sniffImage(ascii('%PDF-1.7')).type, 'application/pdf');
  assert.equal(sniffImage(ascii('<svg xmlns="http://www.w3.org/2000/svg">')), null);
  assert.equal(sniffImage(ascii('<html><script>')), null);
});

test('link tokens are long and random, and only their hash is kept', async () => {
  const a = newToken(), b = newToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
  assert.match(await hashToken(a), /^[0-9a-f]{64}$/);
  assert.notEqual(await hashToken(a), a);
});

test('a client sees a plain build status; a failed build is flagged but not explained to them', () => {
  assert.deepEqual(clientStatus({ status: 'building', build_step: 3, build_note: 'x', build_activity: 'Writing', build_started_at: 't', preview_url: null }).step, 3);
  assert.equal(clientStatus({ status: 'intake', build_note: 'Build failed: git push' }).failed, true);
  assert.equal(clientStatus({ status: 'preview', preview_url: 'https://stdfst-x.pages.dev' }).step, 6);
});

test('the client API refuses a missing, malformed or unknown link', async () => {
  const INTAKE = { prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({}) }) }) };
  const call = (url, headers = {}) => clientMiddleware({ request: new Request(url, { headers }), env: { INTAKE }, data: {}, next: async () => new Response('ok') });
  assert.equal((await call('https://steadfastcode.tech/api/client/project')).status, 401);
  assert.equal((await call('https://steadfastcode.tech/api/client/project', { authorization: 'Bearer short' })).status, 401);
  assert.equal((await call('https://steadfastcode.tech/api/client/project', { authorization: `Bearer ${newToken()}` })).status, 401);
});

test('the client page is private: noindex, no referrer, out of the sitemap, nothing third-party', () => {
  const dist = path.resolve('dist');
  const html = fs.readFileSync(path.join(dist, 'client.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
  for (const m of html.matchAll(/(?:src|href)="(https?:)?\/\/([^"/]+)/g)) assert.equal(m[2], 'steadfastcode.tech');
  for (const f of fs.readdirSync(dist).filter((x) => x.startsWith('sitemap') && x.endsWith('.xml'))) assert.doesNotMatch(fs.readFileSync(path.join(dist, f), 'utf8'), /\/client/);
});
