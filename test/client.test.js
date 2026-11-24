// The client side: what a client may change, what they may upload, how the link is kept, and that
// their page stays private. The live behaviour (two screens, one form) is checked end to end with
// wrangler pages dev; these are the rules underneath it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mergeClientAnswers, clientEditable, sniffImage, newToken, hashToken, clientStatus, intakeOpen, editableFor } from '../server/client.js';
import { intakeSections } from '../src/data/intake.ts';
import { onRequest as clientMiddleware } from '../functions/api/client/_middleware.js';

test('a client can change everything except the package and what sets the scope', () => {
  const owned = intakeSections.flatMap((s) => s.fields).filter((f) => f.owner === 'daniel').map((f) => f.id).sort();
  assert.deepEqual(owned, ['asked', 'contract', 'editor', 'labUrl', 'mockUrl', 'outOfScope', 'pricing', 'siteType', 'tier']);
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
  const third = /\b(they|their|them|theirs)\b/i;
  for (const sec of intakeSections) {
    assert.doesNotMatch(sec.you || sec.title, third, `section "${sec.you || sec.title}" talks about the client in the third person`);
    for (const [k, w] of Object.entries(sec.wording || {})) assert.doesNotMatch(w.you || w.title, third, `section ${sec.id} for ${k}: "${w.you || w.title}"`);
  }
  for (const f of intakeSections.flatMap((s) => s.fields).filter((f) => !f.clientHidden)) {
    const answers = (f.options || []).map((o) => o.you || o.value || o);
    for (const text of [f.you || f.label, f.youHelp || f.help, ...answers].filter(Boolean)) assert.doesNotMatch(text, third, `${f.id}: "${text}" talks about the client in the third person`);
    // The same for each kind of site's wording, read the way the form reads it (public/intake/project.js).
    for (const [k, w] of Object.entries(f.wording || {})) {
      for (const text of [w.you || w.label || f.you || f.label, w.youHelp ?? w.help ?? f.youHelp ?? f.help].filter(Boolean)) assert.doesNotMatch(text, third, `${f.id} for ${k}: "${text}" talks about the client in the third person`);
    }
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
  assert.equal(clientStatus({ status: 'preview', preview_url: 'https://stdfst-x.pages.dev' }).step, 8);
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

test('phone numbers are masked to (###) ###-####', async () => {
  const { phoneMask } = await import('../public/intake/project.js');
  assert.equal(phoneMask('7175385640'), '(717) 538-5640');
  assert.equal(phoneMask('1 717 538 5640'), '(717) 538-5640');
  assert.equal(phoneMask('717'), '(717');
  assert.equal(phoneMask('71753'), '(717) 53');
  assert.equal(phoneMask('(717) 538-56401234'), '(717) 538-5640');
  assert.equal(phoneMask(''), '');
});

test('the box’s notes to Daniel never reach the client; their own big asks are acknowledged neutrally', async () => {
  const { forClient, flagKind } = await import('../server/view.js');
  const ev = (who, what) => ({ at: 'x', who, what });
  assert.equal(forClient(ev('box', 'Flagged for Daniel: In their own words has text that reads like instructions to the build rather than content for the site')), null);
  assert.equal(forClient(ev('box', 'Flagged for Daniel: 5 automatic updates today already; their latest changes (hours) are saved')), null);
  assert.equal(forClient(ev('box', 'Flagged for Daniel: From the build: the logo looks like another business’s')), null);
  assert.equal(forClient(ev('box', 'Flagged for Daniel: Notes changed: “Could you add a booking page?”')).what, 'Passed your note along to Daniel');
  assert.equal(forClient(ev('box', 'Updating the preview with the client’s changes (1 thing)')).what, 'Updating your preview with your changes');
  assert.equal(forClient(ev('client', 'Jimmy updated Hours')).what, 'Jimmy updated Hours');
  assert.equal(flagKind({ what: 'x', kind: 'suspicious' }), 'suspicious');
});

// The intake retires after the first meeting (2026-11-19): Daniel closes it, and from then on the
// client's answers are read-only to them and the server refuses their edits.
test('a closed intake leaves the client nothing to edit, and their PATCH is refused', async () => {
  assert.equal(intakeOpen({ intake_closed_at: null }), true);
  assert.equal(intakeOpen({}), true, 'a project from before the column existed is open');
  assert.equal(intakeOpen({ intake_closed_at: '2026-11-19T20:00:00.000Z' }), false);
  assert.deepEqual(editableFor({ intake_closed_at: '2026-11-19T20:00:00.000Z' }), []);
  assert.ok(editableFor({}).includes('pages'));

  const { onRequestPatch } = await import('../functions/api/client/project.js');
  let wrote = false;
  const env = { INTAKE: { prepare: () => { wrote = true; throw new Error('a closed intake must not reach the database'); } } };
  const request = new Request('https://steadfastcode.tech/api/client/project', { method: 'PATCH', body: JSON.stringify({ answers: { phone: '717 555 0000' } }) });
  const response = await onRequestPatch({ request, env, data: { project: { id: 'p1', answers: '{}', intake_closed_at: '2026-11-19T20:00:00.000Z' } } });
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /send Daniel a message/);
  assert.equal(wrote, false);
});

// Daniel viewing as the client (2026-11-23): with a pass from the admin the visit isn't the client's
// (the link isn't marked used, the request knows it's him) and nothing can be changed; a forged or
// run-out pass, or one for another link, is refused.
test('a view-as-the-client pass: not counted as their visit, read only, bound to the link', async () => {
  const { signViewPass, verifyViewPass } = await import('../server/client.js');
  const env0 = { LINK_KEY: btoa(String.fromCharCode(...new Uint8Array(32).fill(7))) };
  const pass = await signViewPass(env0, 'L1');
  assert.ok(await verifyViewPass(env0, 'L1', pass));
  assert.equal(await verifyViewPass(env0, 'L2', pass), false, 'another link');
  assert.equal(await verifyViewPass(env0, 'L1', pass.replace(/.$/, (c) => (c === '0' ? '1' : '0'))), false, 'tampered');
  assert.equal(await verifyViewPass(env0, 'L1', await signViewPass(env0, 'L1', Date.now() - 13 * 3600_000)), false, 'run out');
  assert.equal(await signViewPass({}, 'L1'), null, 'no LINK_KEY, no pass');

  const token = newToken();
  const hash = await hashToken(token);
  const writes = [];
  const INTAKE = { prepare: (sql) => ({ bind: (...a) => ({
    first: async () => (/client_links/.test(sql) ? (a[0] === hash ? { id: 'L1', project_id: 'p1', expires_at: '2999-01-01', last_used_at: null, revoked_at: null } : null) : /FROM projects/.test(sql) ? { id: 'p1', status: 'intake' } : null),
    run: async () => { writes.push(sql); return {}; },
  }) }) };
  const env = { ...env0, INTAKE };
  const call = (method, headers = {}, url = 'https://steadfastcode.tech/api/client/project') => clientMiddleware({ request: new Request(url, { method, headers: { authorization: `Bearer ${token}`, origin: 'https://steadfastcode.tech', ...headers } }), env, data: {}, next: async () => new Response('ok') });
  const ctx = (method, headers) => { const c = { request: new Request('https://steadfastcode.tech/api/client/project', { method, headers: { authorization: `Bearer ${token}`, origin: 'https://steadfastcode.tech', ...headers } }), env, data: {}, next: async () => new Response('ok') }; return clientMiddleware(c).then((r) => ({ r, c })); };
  const daniel = await ctx('GET', { 'x-admin-view': pass });
  assert.equal(daniel.r.status, 200);
  assert.equal(daniel.c.data.adminView, true);
  assert.equal(writes.length, 0, 'the link isn’t marked used');
  assert.equal((await call('POST', { 'x-admin-view': pass })).status, 403, 'read only');
  assert.equal((await call('GET', { 'x-admin-view': 'nope' })).status, 401, 'a bad pass is refused, not ignored');
  const client = await ctx('GET', {});
  assert.equal(client.c.data.adminView, false);
  assert.equal(writes.length, 1, 'the client’s own visit marks the link used');
});
