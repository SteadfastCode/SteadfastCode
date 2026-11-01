// The admin intake: the page stays private and self-contained, and the intake rules in
// server/intake.js keep answers clean, count scope against the package, and say when a build can start.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mergeAnswers, answersFromLead, check, slugFor, fields } from '../server/intake.js';
import { intakeSections } from '../src/data/intake.ts';
import { websiteTiers } from '../src/data/site.ts';
import { onRequest as adminMiddleware } from '../functions/api/admin/_middleware.js';

const dist = path.resolve('dist');

test('the admin page is noindex, out of the sitemap, and loads nothing from a third party', () => {
  const html = fs.readFileSync(path.join(dist, 'admin.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  for (const m of html.matchAll(/(?:src|href)="(https?:)?\/\/([^"/]+)/g)) assert.equal(m[2], 'steadfastcode.tech', `admin loads ${m[0]}`);
  const sitemaps = fs.readdirSync(dist).filter((f) => f.startsWith('sitemap') && f.endsWith('.xml'));
  for (const f of sitemaps) assert.doesNotMatch(fs.readFileSync(path.join(dist, f), 'utf8'), /\/admin/);
  // The page carries the same questions and packages the server checks against.
  const config = JSON.parse(html.match(/<script type="application\/json" id="intake-config">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(config.tiers.map((t) => t.id), websiteTiers.map((t) => t.id));
  assert.equal(config.sections.length, intakeSections.length);
});

test('field ids are unique and every choice has options', () => {
  const ids = intakeSections.flatMap((s) => s.fields.map((f) => f.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const f of Object.values(fields)) if (f.type === 'choice') assert.ok(f.options.length > 1, f.id);
});

test('answers are cleaned to their type, unknown keys are dropped, and blanks clear a field', () => {
  const { answers, dropped } = mergeAnswers({ phone: '717' }, { businessName: '  Pat Plumbing ', services: 'Drains\n\nWater heaters\n', tier: 'nope', mainAction: 'Fax', hacker: 'x', phone: '' });
  assert.deepEqual(answers, { businessName: 'Pat Plumbing', services: ['Drains', 'Water heaters'] });
  assert.deepEqual(dropped.sort(), ['hacker', 'mainAction', 'tier']);
});

test('picking a package with no pages fills in its usual pages, and never overwrites a list', () => {
  assert.deepEqual(mergeAnswers({}, { tier: 'business' }).answers.pages, ['Home', 'Services', 'About', 'Contact']);
  assert.deepEqual(mergeAnswers({ pages: ['Home'] }, { tier: 'business' }).answers.pages, ['Home']);
});

test('a lead fills in what it knows, and only a real package', () => {
  const a = answersFromLead({ name: 'Pat', email: 'pat@example.com', phone: '', business: 'Pat Plumbing', plan: 'business', site: '', message: 'Need a site' });
  assert.equal(a.tier, 'business');
  assert.equal(a.businessName, 'Pat Plumbing');
  assert.match(a.notes, /Need a site/);
  assert.equal(answersFromLead({ name: 'X', email: 'x@y.z', plan: 'unsure', message: 'hi' }).tier, undefined);
});

test('ready means the required answers are in; scope notes name everything past the package', () => {
  const base = { tier: 'business', businessName: 'Pat Plumbing', contactName: 'Pat', email: 'pat@example.com', serviceArea: 'Lititz', services: ['Drains'], pages: ['Home'] };
  assert.equal(check(base).ready, true);
  assert.deepEqual(check({ ...base, services: undefined }).missing.map((m) => m.id), ['services']);
  const over = check({ ...base, pages: ['1', '2', '3', '4', '5', '6', '7'], integrations: ['Calendly'], editor: true, outOfScope: ['Logo design'] });
  assert.equal(over.ready, true, 'scope never blocks a build');
  assert.match(over.scope[0], /7 pages; Business covers 6\. Growth covers up to 15/);
  assert.ok(over.scope.some((s) => /Integrations \(Calendly\)/.test(s)));
  assert.ok(over.scope.some((s) => /Content editor add-on: \+\$500/.test(s)));
  assert.ok(over.scope.some((s) => /quote separately: Logo design/.test(s)));
  assert.equal(over.price, 3900 + 500);
  assert.equal(check({ ...base, tier: 'growth', editor: true }).price, 6900, 'Growth includes the editor');
  assert.equal(check({}).ready, false);
});

test('slugs are repo-safe', () => {
  assert.equal(slugFor("Joe DiBart Plumbing & Heating"), 'joe-dibart-plumbing-and-heating');
  assert.equal(slugFor('Café Ñandú!'), 'cafe-nandu');
  assert.equal(slugFor('!!!'), null);
});

test('the admin API refuses anyone Access did not sign in, and cross-site writes', async () => {
  const env = { ADMIN_EMAILS: 'daniel@steadfastcode.tech', INTAKE: {}, DEV_EMAIL: 'daniel@steadfastcode.tech' };
  const call = (url, init, e = env) => adminMiddleware({ request: new Request(url, init), env: e, data: {}, next: async () => new Response('ok') });
  assert.equal((await call('https://steadfastcode.tech/api/admin/leads')).status, 401, 'no Access token');
  assert.equal((await call('http://localhost/api/admin/leads')).status, 200, 'local dev email');
  assert.equal((await call('http://localhost/api/admin/leads', {}, { ...env, DEV_EMAIL: 'someone@else.com' })).status, 401, 'not an admin');
  assert.equal((await call('http://localhost/api/admin/projects', { method: 'POST', headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await call('http://localhost/api/admin/projects', { method: 'POST', headers: { origin: 'http://localhost' } })).status, 200);
  assert.equal((await call('http://localhost/api/admin/leads', {}, { ...env, INTAKE: undefined })).status, 503);
});
