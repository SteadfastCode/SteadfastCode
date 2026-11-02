// The website agreement: generated from the project, signed only with intent (a full typed name and
// a ticked box) and only for the exact text shown, and stale only when the package, add-on or price
// change. Live signing is checked end to end with wrangler pages dev.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreementFor, termsKey } from '../src/data/agreement.ts';
import { checkSignature, sha256 } from '../server/agreement.js';
import { websiteTiers, launchNote, domainNote } from '../src/data/site.ts';

const base = { tier: 'starter', businessName: 'Joshua Lawn & Garden', contactName: 'Joshua Smith', email: 'j@example.com' };

test('the agreement carries the package, its full list, the price and the halves', () => {
  const a = agreementFor(base);
  assert.equal(a.price, 1500);
  assert.match(a.text, /Joshua Smith, for Joshua Lawn & Garden/);
  assert.match(a.text, /The Starter package: one page/);
  for (const line of websiteTiers[0].includes.filter((x) => !/well under a second/.test(x))) assert.ok(a.text.includes(line), line);
  // Speed is a target, said once, as not a guarantee (Daniel, 2026-11-02).
  assert.doesNotMatch(a.text, /• Built to load/);
  assert.match(a.text, /load in well under a second on most phones and connections, but load times are also not a guarantee/);
  assert.match(a.text, /registered in your name and paid with your card/);
  assert.ok(a.text.includes(domainNote), 'who holds the domain, word for word as on /websites');
  assert.match(a.text, /Half \(\$750\) is due when you sign.*The other half \(\$750\) is due at launch/s);
  assert.ok(a.text.includes(launchNote));
  assert.match(a.text, /plus any sales tax that applies/);
});

test('higher packages spell out everything they include, not "Everything in ..."', () => {
  const g = agreementFor({ ...base, tier: 'growth' });
  assert.doesNotMatch(g.text, /Everything in /);
  for (const t of websiteTiers.slice(0, 3)) for (const line of t.includes.filter((x) => !/^Everything in /.test(x) && !/well under a second/.test(x))) assert.ok(g.text.includes(line), line);
});

test('the editor add-on adds its price on Starter and Business, and is ignored where it is included', () => {
  assert.equal(agreementFor({ ...base, editor: true }).price, 2000);
  assert.match(agreementFor({ ...base, editor: true }).text, /\$1,500 for Starter, plus \$500 for the content editor/);
  assert.equal(agreementFor({ ...base, tier: 'growth', editor: true }).price, 6900);
});

test('a signature goes stale with the package, add-on or price, not with a corrected name', () => {
  const k = termsKey(base);
  assert.equal(termsKey({ ...base, businessName: 'Joshua’s Lawn & Garden LLC', contactName: 'Josh Smith' }), k);
  assert.notEqual(termsKey({ ...base, tier: 'business' }), k);
  assert.notEqual(termsKey({ ...base, editor: true }), k);
});

test('signing needs a full typed name, the ticked box, and the exact text that was shown', async () => {
  const a = agreementFor(base);
  const current = { ...a, sha256: await sha256(a.text) };
  assert.match(checkSignature({ name: 'Joshua', agreed: true, sha256: current.sha256 }, current).error, /full name/);
  assert.match(checkSignature({ name: 'Joshua Smith', agreed: false, sha256: current.sha256 }, current).error, /Tick the box/);
  assert.equal(checkSignature({ name: 'Joshua Smith', agreed: true, sha256: 'x'.repeat(64) }, current).stale, true);
  const ok = checkSignature({ name: '  Joshua   Smith ', agreed: true, sha256: current.sha256, portfolio: false }, current);
  assert.deepEqual(ok, { name: 'Joshua Smith', portfolioOk: 0 });
  assert.equal(checkSignature({ name: 'Joshua Smith', agreed: true, sha256: current.sha256 }, current).portfolioOk, null, 'not asked is not a no');
});

test('the agreement makes no claim of a track record', () => {
  for (const t of websiteTiers) assert.doesNotMatch(agreementFor({ ...base, tier: t.id }).text, /\b(often|usually build|always|every client|most clients)\b/i);
});
