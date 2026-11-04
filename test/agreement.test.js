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
  // A contract, by that name, with the footer credit the client can remove (Daniel, 2026-11-02).
  assert.match(a.text, /^Website contract — /);
  assert.doesNotMatch(a.text, /\bagreement\b/i);
  assert.match(a.text, /small “Built by Steadfast Code” link\. It’s yours to keep or remove; just ask\./);
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

test('a discount or a set price changes the contract, the halves and the signature; list price reads as before', () => {
  const list = agreementFor(base);
  assert.doesNotMatch(list.text, /discount|normally/);
  assert.equal(termsKey(base), termsKey({ ...base, pricing: null }));

  const off = agreementFor({ ...base, pricing: { discountPct: 10 } });
  assert.equal(off.price, 1350);
  assert.match(off.text, /The price is \$1,350 \(\$1,500 for Starter, less a 10% discount\), plus any sales tax/);
  assert.match(off.text, /Half \(\$675\) is due when you sign/);
  assert.notEqual(termsKey(base), termsKey({ ...base, pricing: { discountPct: 10 } }));

  const both = agreementFor({ ...base, editor: true, pricing: { discountPct: 20 } });
  assert.equal(both.price, 1600);
  assert.match(both.text, /\$1,600 \(\$1,500 for Starter, plus \$500 for the content editor, less a 20% discount\)/);

  const set = agreementFor({ ...base, pricing: { price: 1200 } });
  assert.equal(set.price, 1200);
  assert.match(set.text, /The price is \$1,200 \(a price we agreed on; Starter is normally \$1,500\)/);

  const store = agreementFor({ ...base, tier: 'store', pricing: { price: 7000 } });
  assert.match(store.text, /The price is \$7,000 \(a price we agreed on; Online store is normally/);
});
