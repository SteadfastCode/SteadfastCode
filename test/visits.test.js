import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visitsState, contractWantsCfAnalytics, addDays, CF_ANALYTICS_LINE, EXPORT_DAYS } from '../server/visits.js';

test('visit counts show while a care plan runs, a draft included', () => {
  assert.equal(visitsState(null), null);
  for (const status of ['draft', 'offered', 'signed', 'active', 'past_due']) {
    assert.deepEqual(visitsState({ status, ends_at: null }), { mode: 'counting' }, status);
  }
});

test('after a plan is canceled, the download stays for 90 days and then goes', () => {
  assert.equal(EXPORT_DAYS, 90);
  const care = { status: 'canceled', ends_at: '2026-12-01' };
  assert.deepEqual(visitsState(care, '2026-12-02'), { mode: 'ended', until: '2027-03-01' });
  assert.deepEqual(visitsState(care, '2027-03-01'), { mode: 'ended', until: '2027-03-01' });
  assert.equal(visitsState(care, '2027-03-02'), null);
  assert.equal(visitsState({ status: 'canceled', ends_at: null }, '2026-12-02'), null);
  assert.equal(addDays('2026-02-27', 2), '2026-03-01');
});

test('the contract line switches Cloudflare analytics on, and switching the line off turns it off', () => {
  assert.equal(contractWantsCfAnalytics({}), false);
  assert.equal(contractWantsCfAnalytics({ contract: { add: { build: ['l-other'] } } }), false);
  assert.equal(contractWantsCfAnalytics({ contract: { add: { build: [CF_ANALYTICS_LINE] } } }), true);
  assert.equal(contractWantsCfAnalytics({ contract: { add: { build: [CF_ANALYTICS_LINE] }, off: [CF_ANALYTICS_LINE] } }), false);
});
