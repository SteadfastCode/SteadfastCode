// "Make a change" (server/changes.js): which lane each kind travels in, what the block says about
// cost, and what a client may send.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHANGE_KINDS, INSTANT_FIELDS, coverageContext, coverageFor, cleanChange, changeMenu, sitePartsOf } from '../server/changes.js';

const answers = { tier: 'starter', pages: ['Home'], phone: '(717) 555-1234', email: 'jo@example.com', hours: { mode: '247', days: {} } };

test('the lanes: facts are instant, wording and photos are checked on the preview, the rest comes to Daniel', () => {
  assert.deepEqual(INSTANT_FIELDS, ['hours', 'phone', 'email']);
  assert.equal(CHANGE_KINDS.details.lane, 'instant');
  assert.equal(CHANGE_KINDS.photos.lane, 'preview');
  assert.equal(CHANGE_KINDS.reword.lane, 'preview');
  for (const kind of ['section', 'page', 'broken', 'other']) assert.equal(CHANGE_KINDS[kind].lane, 'daniel', kind);
});

test('the cost line follows the 30 days, the care plan and the package’s pages, and never over-promises', () => {
  const now = new Date('2026-11-20T15:00:00Z');
  const inWindow = coverageContext({ answers, firstPreview: '2026-11-03T15:00:00Z', care: null, now });
  assert.equal(inWindow.inWindow, true);
  assert.equal(inWindow.windowEnds, 'December 3');
  assert.match(coverageFor('reword', inWindow), /^Covered: changes are unlimited until December 3\.$/);
  assert.match(coverageFor('section', inWindow), /Daniel will confirm/);
  assert.match(coverageFor('page', inWindow), /Starter package covers 1 page and they’re all used, so Daniel will send a quote/);

  const after = (care) => coverageContext({ answers, firstPreview: '2026-09-01T15:00:00Z', care, now });
  assert.equal(coverageFor('photos', after(null)), 'Daniel will send a quote before any work starts.');
  assert.match(coverageFor('photos', after({ plan: 'hands-on', status: 'active' })), /Hands-on plan \(up to one hour of changes a month\)/);
  assert.match(coverageFor('page', after({ plan: 'growth', status: 'active' })), /Starter package covers 1 page/, 'the package limit comes first');
  assert.match(coverageFor('page', coverageContext({ answers: { tier: 'business', pages: ['Home'] }, firstPreview: '2026-09-01T15:00:00Z', care: { plan: 'growth', status: 'signed' }, now })), /part of your Growth plan/);
  assert.match(coverageFor('reword', after({ plan: 'hosted', status: 'active' })), /small fix like a typo is covered by your Hosted plan/);
  assert.equal(coverageFor('photos', after({ plan: 'hands-on', status: 'offered' })), 'Daniel will send a quote before any work starts.', 'a plan that isn’t signed covers nothing');
  for (const context of [inWindow, after(null)]) {
    assert.match(coverageFor('broken', context), /^No charge/);
    assert.match(coverageFor('details', context), /^No charge/);
    assert.match(coverageFor('other', context), /Daniel will tell you/);
  }
});

test('an instant change is one of the three facts, cleaned like the intake cleans it', () => {
  const phone = cleanChange({ kind: 'details', field: 'phone', value: ' 717 555 9999 ' }, { answers });
  assert.equal(phone.lane, 'instant');
  assert.equal(phone.field, 'phone');
  assert.equal(phone.answers.phone, '717 555 9999');
  assert.equal(phone.answers.email, 'jo@example.com', 'nothing else changes');
  assert.match(phone.title, /^New phone$/i);
  assert.match(cleanChange({ kind: 'details', field: 'phone', value: '(717) 555-1234' }, { answers }).error, /already has/);
  assert.match(cleanChange({ kind: 'details', field: 'tier', value: 'growth' }, { answers }).error, /isn’t one of the details/);
  assert.match(cleanChange({ kind: 'details', field: 'businessName', value: 'New Name' }, { answers }).error, /isn’t one of the details/);
  assert.match(cleanChange({ kind: 'nonsense' }, { answers }).error, /Pick what/);
});

test('anything else is the client’s own words, with the part of the site it’s about', () => {
  const parts = [{ key: 'longTermRentals.0', label: 'Darby rental' }];
  const reword = cleanChange({ kind: 'reword', part: 'longTermRentals.0', body: ' It has 3 bedrooms now. ' }, { answers, parts });
  assert.equal(reword.lane, 'preview');
  assert.equal(reword.answers, null);
  assert.equal(reword.title, 'Reword something (Darby rental): It has 3 bedrooms now.');
  assert.equal(reword.message, 'About “Darby rental”: It has 3 bedrooms now.');
  assert.equal(cleanChange({ kind: 'page', body: 'A gallery page', part: 'not-a-part' }, { answers, parts }).title, 'Add a page: A gallery page');
  assert.match(cleanChange({ kind: 'broken', body: '  ' }, { answers }).error, /Tell Daniel/);
  assert.equal(cleanChange({ kind: 'other', body: 'x'.repeat(500) }, { answers }).title.length, 160);
});

test('the menu the client’s page draws: every kind with its lane and cost line, and the site’s parts', () => {
  const project = { site_parts: JSON.stringify([{ key: 'about', label: 'Why work with us' }, { key: 7 }, 'junk']) };
  assert.deepEqual(sitePartsOf(project), [{ key: 'about', label: 'Why work with us' }]);
  assert.deepEqual(sitePartsOf({ site_parts: 'not json' }), []);
  const menu = changeMenu({ project, answers, firstPreview: null, care: null });
  assert.deepEqual(menu.kinds.map((kind) => kind.id), ['details', 'photos', 'reword', 'section', 'page', 'broken', 'other']);
  for (const kind of menu.kinds) assert.ok(kind.name && kind.says && kind.coverage, kind.id);
  assert.deepEqual(menu.parts, [{ key: 'about', label: 'Why work with us' }]);
});
