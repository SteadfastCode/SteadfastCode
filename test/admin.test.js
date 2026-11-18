// The admin intake: the page stays private and self-contained, and the intake rules in
// server/intake.js keep answers clean, count scope against the package, and say when a build can start.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mergeAnswers, answersFromLead, check, slugFor, fields, presetFor, askedFor, applies, alwaysAsked } from '../server/intake.js';
import { intakeSections, siteTypes, defaultPagesFor } from '../src/data/intake.ts';
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
  assert.deepEqual(config.siteTypes.map((t) => t.id), siteTypes.map((t) => t.id));
});

test('field ids are unique, every choice has options, and every ask list and when names something real', () => {
  const ids = intakeSections.flatMap((s) => s.fields.map((f) => f.id));
  assert.equal(new Set(ids).size, ids.length);
  const kinds = siteTypes.map((t) => t.id);
  for (const f of Object.values(fields)) {
    if (f.type === 'choice') assert.ok(f.options.length > 1, f.id);
    if (Array.isArray(f.ask)) for (const k of f.ask) assert.ok(kinds.includes(k), `${f.id} asks for unknown kind ${k}`);
    else if (f.ask) assert.ok(['always', 'all', 'off'].includes(f.ask), `${f.id}: ask ${f.ask}`);
    if (f.when) assert.ok(fields[f.when], `${f.id} waits on unknown field ${f.when}`);
    for (const k of Object.keys(f.wording || {})) assert.ok(kinds.includes(k), `${f.id} has wording for unknown kind ${k}`);
  }
});

test('each kind of site asks its own questions: a store never asks where they work, a church asks its service times', () => {
  const local = presetFor({ tier: 'business' });
  const store = presetFor({ tier: 'store' });
  const church = presetFor({ tier: 'business', siteType: 'church' });
  for (const id of alwaysAsked) for (const p of [local, store, church]) assert.ok(p.includes(id), `${id} is always asked`);
  assert.ok(local.includes('serviceArea') && local.includes('hours') && local.includes('gbp'));
  assert.ok(!store.includes('serviceArea') && !store.includes('hours') && !store.includes('gbp') && !store.includes('mainAction'), 'local-only questions stay off a store');
  assert.ok(store.includes('regions') && store.includes('fulfillment') && store.includes('migrate'));
  assert.ok(church.includes('serviceTimes') && church.includes('givingLink') && !church.includes('bookingLink'));
  assert.ok(!local.includes('serviceTimes'));
  // The Online store package is a store unless Daniel says otherwise; everything else starts local.
  assert.equal(check({ tier: 'store' }).siteType, 'store');
  assert.equal(check({ tier: 'growth' }).siteType, 'local');
  assert.equal(check({ tier: 'store', siteType: 'church' }).siteType, 'church');
  // The store section itself is still the package's: a church on the Business package has no store questions.
  assert.equal(applies(fields.regions, { tier: 'business', siteType: 'store' }), false);
  assert.equal(applies(fields.regions, { tier: 'store' }), true);
  // What to change from the mock-up only shows with a mock-up.
  assert.equal(applies(fields.mockChanges, { tier: 'business' }), false);
  assert.equal(applies(fields.mockChanges, { tier: 'business', mockUrl: 'https://stdfst-x.pages.dev' }), true);
});

test('Daniel’s own question list replaces the preset, keeps what is always asked, and clears back to it', () => {
  let { answers, dropped } = mergeAnswers({ tier: 'business' }, { asked: ['hours', 'serviceTimes', 'tier', 'nope'] });
  assert.deepEqual(dropped, []);
  assert.deepEqual(answers.asked, ['hours', 'serviceTimes'], 'always-asked and unknown ids are not stored');
  let got = askedFor(answers);
  assert.equal(got.preset, false);
  assert.ok(got.asked.includes('serviceTimes') && got.asked.includes('hours') && got.asked.includes('businessName') && !got.asked.includes('serviceArea'));
  // An empty list is a real choice (only the always-asked questions), not "no list".
  ({ answers } = mergeAnswers(answers, { asked: [] }));
  assert.deepEqual(answers.asked, []);
  assert.equal(askedFor(answers).preset, false);
  ({ answers } = mergeAnswers(answers, { asked: null }));
  assert.equal(answers.asked, undefined);
  assert.equal(askedFor(answers).preset, true);
  assert.deepEqual(mergeAnswers({}, { siteType: 'bakery' }).dropped, ['siteType']);
  // A question switched off is never missing: a store with no service area is ready to build.
  const store = { tier: 'store', businessName: 'Lowen Games', contactName: 'Andrew', email: 'a@example.com', services: ['Deliverance'], pages: ['Home', 'Shop'] };
  assert.equal(check(store).ready, true);
  assert.deepEqual(check({ ...store, siteType: 'local' }).missing.map((m) => m.id), ['serviceArea']);
  assert.deepEqual(check({ ...store, siteType: 'local', asked: [] }).missing, []);
});

test('a mock-up link is kept as a link, and comes along from the lead', () => {
  assert.equal(mergeAnswers({}, { mockUrl: 'stdfst-deliverance.pages.dev' }).answers.mockUrl, 'https://stdfst-deliverance.pages.dev');
  assert.deepEqual(mergeAnswers({}, { mockUrl: 'not a link' }).dropped, ['mockUrl']);
  assert.equal(mergeAnswers({ mockUrl: 'https://x.pages.dev' }, { mockUrl: '' }).answers.mockUrl, undefined);
  const a = answersFromLead({ name: 'Andrew', email: 'a@example.com', business: 'Lowen Games', plan: 'store', mock_url: 'https://stdfst-deliverance.pages.dev', message: 'hi' });
  assert.equal(a.mockUrl, 'https://stdfst-deliverance.pages.dev');
  assert.equal(a.tier, 'store');
  assert.deepEqual(a.pages, ['Home', 'Shop', 'About', 'Contact', 'Blog']);
});

test('the usual pages follow the kind of site', () => {
  assert.deepEqual(defaultPagesFor('starter', 'church'), ['Home']);
  assert.deepEqual(defaultPagesFor('business', 'church'), ['Home', 'About', 'Visit', 'Ministries', 'Contact']);
  assert.deepEqual(defaultPagesFor('growth', 'church'), ['Home', 'About', 'Visit', 'Ministries', 'Contact', 'Sermons', 'Events']);
  assert.deepEqual(defaultPagesFor('growth', 'creative'), ['Home', 'Portfolio', 'About', 'Contact', 'Blog']);
  assert.deepEqual(mergeAnswers({}, { tier: 'business' }).answers.pages, ['Home', 'Services', 'About', 'Contact']);
  assert.deepEqual(mergeAnswers({ tier: 'business' }, { siteType: 'creative' }).answers.pages, ['Home', 'Portfolio', 'About', 'Contact']);
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
  assert.ok(over.scope.some((s) => /quoted separately: Logo design/.test(s)));
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

test('the price: standard or custom discounts and set prices are kept, anything else is dropped, and the check carries the result', async () => {
  const { mergeAnswers, check, cleanPricing } = await import('../server/intake.js');
  assert.deepEqual(cleanPricing({ discountPct: 15 }), { discountPct: 15 });
  assert.deepEqual(cleanPricing({ discountPct: 12.55 }), { discountPct: 12.6 });
  assert.deepEqual(cleanPricing({ price: 1199.6 }), { price: 1200 });
  for (const bad of [{ discountPct: 0 }, { discountPct: 100 }, { discountPct: 'ten' }, { price: 0 }, { price: -5 }, 'cheap', 7]) assert.equal(cleanPricing(bad), undefined, JSON.stringify(bad));
  let { answers, dropped } = mergeAnswers({ tier: 'business' }, { pricing: { discountPct: 25 } });
  assert.deepEqual(dropped, []);
  assert.deepEqual(check(answers).pricing, { base: 3900, price: 2925, custom: false, pct: 25 });
  assert.equal(check(answers).price, 2925);
  ({ answers } = mergeAnswers(answers, { pricing: null }));
  assert.equal(answers.pricing, undefined);
  assert.equal(check(answers).price, 3900);
});

test('the client cannot set the price', async () => {
  const { mergeClientAnswers } = await import('../server/client.js');
  const { answers, dropped } = mergeClientAnswers({ tier: 'starter' }, { pricing: { price: 1 } });
  assert.deepEqual(dropped, ['pricing']);
  assert.equal(answers.pricing, undefined);
});
