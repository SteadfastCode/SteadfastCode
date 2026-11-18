// The website agreement: generated from the project, signed only with intent (a full typed name and
// a ticked box) and only for the exact text shown, and stale only when the package, add-on or price
// change. Live signing is checked end to end with wrangler pages dev.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { agreementFor, termsKey, contractCatalog, lineKey, standardLines, standardSections, fill } from '../src/data/agreement.ts';
import { checkSignature, sha256 } from '../server/agreement.js';
import { websiteTiers, launchNote, domainNote, contractCarry, contractLocalOnly } from '../src/data/site.ts';

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

test('higher packages spell out everything they include, not "Everything in ...", with the lower page counts left to the heading', () => {
  const g = agreementFor({ ...base, tier: 'growth' });
  assert.doesNotMatch(g.text, /Everything in /);
  for (const t of websiteTiers.slice(0, 2)) for (const line of t.includes.filter((x) => !/^Everything in /.test(x) && !/well under a second/.test(x))) assert.ok(g.text.includes(contractCarry[line] ?? line), line);
  for (const line of websiteTiers[2].includes.filter((x) => !/^Everything in /.test(x) && !/well under a second/.test(x))) assert.ok(g.text.includes(line), line);
  assert.match(g.text, /The Growth package: up to 15 pages/);
  assert.doesNotMatch(g.text, /• One long-scroll page|• Up to 6 pages/);
  assert.match(g.text, /• A home page written and designed around what you sell/);
  assert.match(g.text, /• Every page written to answer the question people actually search/);
  // Every carried or local-only line is a real line of some package, so a reword there is caught here.
  const all = websiteTiers.flatMap((t) => t.includes);
  for (const line of [...Object.keys(contractCarry), ...Object.keys(contractLocalOnly)]) assert.ok(all.includes(line), `not a package line any more: ${line}`);
});

test('an online store’s contract drops the map, the Google Business Profile and local SEO; a local business keeps them', () => {
  const store = agreementFor({ ...base, tier: 'store' });
  assert.match(store.text, /The Online store package: up to 15 pages/);
  assert.doesNotMatch(store.text, /Google Business Profile set up|service-area pages|click-to-call, map|• Up to 15 pages/);
  assert.match(store.text, /• Contact form, click-to-call\n/);
  assert.match(store.text, /• Reviews wired in, schema on every page/);
  assert.match(store.text, /• A friendly editor so you can change text and photos yourself/);
  assert.match(store.text, /Shopify or a headless store/);
  const church = agreementFor({ ...base, tier: 'store', siteType: 'church' });
  assert.match(church.text, /Google Business Profile set up or cleaned up/);
  const local = agreementFor({ ...base, tier: 'business' });
  assert.match(local.text, /Google Business Profile set up or cleaned up/);
  assert.match(local.text, /click-to-call, map/);
  // The kind is in the signature's key only when it changes the text, so older signatures keep their key.
  assert.equal(termsKey({ ...base, tier: 'business' }), termsKey({ ...base, tier: 'business', siteType: 'local' }));
  assert.notEqual(termsKey({ ...base, tier: 'business' }), termsKey({ ...base, tier: 'business', siteType: 'creative' }));
  assert.equal(termsKey({ ...base, tier: 'business' }).split('|').length, 4);
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

test('Daniel can switch sections and lines off, add library lines and sections, and the client signs what is left', () => {
  const library = {
    sections: [{ id: 'build', heading: 'What I’ll build', builtin: 1 }, { id: 'x-regions', heading: 'Regions and inventory', builtin: 0 }],
    lines: [{ id: 'l-shop', section_id: 'build', text: 'Shopify Markets set up for each region you sell in' }, { id: 'l-inv', section_id: 'x-regions', text: 'Stock is tracked per fulfillment location in Shopify.' }, { id: 'l-else', section_id: 'price', text: 'Not added anywhere' }],
  };
  const store = { ...base, tier: 'store' };
  const plain = contractCatalog(store, library);
  assert.deepEqual(plain.map((s) => s.key), ['who', 'build', 'price', 'deposit', 'timing', 'changes', 'your-part', 'ownership', 'no-promise', 'fine-print']);
  assert.ok(plain.every((s) => s.on && s.p.every((l) => l.on)), 'everything is on until Daniel says otherwise');
  const gbp = plain.find((s) => s.key === 'your-part').p[0];
  assert.equal(gbp.key, 's-yours-1', 'a standard line is keyed by its library id');
  assert.ok(gbp.lib && gbp.standard && !gbp.locked);
  const home = plain[1].p[1];
  assert.equal(home.key, 'build.' + lineKey(home.text), 'a package bullet is keyed by its text');
  assert.ok(!home.lib);
  const edited = { ...store, contract: { off: ['ownership', gbp.key, 'who', 's-fine-3'], add: { build: ['l-shop', 'l-missing'], 'x-regions': ['l-inv'] }, sections: ['x-regions'] } };
  const cat = contractCatalog(edited, library);
  assert.equal(cat.find((s) => s.key === 'ownership').on, false);
  assert.equal(cat.find((s) => s.key === 'who').on, true, 'who the contract is between can’t be switched off');
  assert.equal(cat.at(-2).p.at(-1).on, true, 'the e-signature paragraph can’t be switched off');
  assert.equal(cat.find((s) => s.key === 'your-part').p[0].on, false);
  const build = cat.find((s) => s.key === 'build');
  const addedAt = build.p.findIndex((l) => l.key === 'l-shop');
  assert.ok(build.p[addedAt].added && build.p[addedAt].text === '• Shopify Markets set up for each region you sell in', 'a library line joins the bullets, as a bullet');
  assert.ok(build.p[addedAt - 1].text.startsWith('• ') && !build.p[addedAt + 1].text.startsWith('• '), 'after the last bullet, before the closing sentence');
  assert.ok(!build.p.some((l) => l.key === 'l-missing'), 'a line the library no longer has is gone');
  const regions = cat.at(-1);
  assert.deepEqual([regions.key, regions.h, regions.added, regions.p.map((l) => l.text)], ['x-regions', 'Regions and inventory', true, ['Stock is tracked per fulfillment location in Shopify.']]);
  const a = agreementFor(edited, library);
  assert.doesNotMatch(a.text, /WHO OWNS WHAT|Google Business Profile when it’s time to launch/);
  assert.match(a.text, /REGIONS AND INVENTORY\nStock is tracked per fulfillment location/);
  assert.match(a.text, /• Shopify Markets set up/);
  assert.match(a.text, /sign electronically/);
  // Any line or heading can be reworded, the locked ones too; a bullet keeps its bullet, and the standard wording is remembered.
  const who = plain[0].p[0];
  const reworded = { ...store, contract: { edit: { [who.key]: 'This contract is between us two.', build: 'What gets built', 'l-shop': 'Shopify Markets for every region', [plain[1].p[1].key]: 'A home page built around the game', 'x-regions': 'Regions' }, add: { build: ['l-shop'] }, sections: ['x-regions'] } };
  const rc = contractCatalog(reworded, library);
  assert.deepEqual([rc[0].p[0].text, rc[0].p[0].edited, rc[0].p[0].base, rc[0].p[0].locked, rc[0].p[0].on], ['This contract is between us two.', true, who.text, true, true]);
  assert.deepEqual([rc[1].h, rc[1].edited, rc[1].base], ['What gets built', true, 'What I’ll build']);
  assert.equal(rc[1].p[1].text, '• A home page built around the game');
  assert.equal(rc[1].p.find((l) => l.key === 'l-shop').text, '• Shopify Markets for every region');
  assert.equal(rc.at(-1).h, 'Regions');
  assert.match(agreementFor(reworded, library).text, /WHAT GETS BUILT\n[^\n]*\n• A home page built around the game/);
  assert.notEqual(termsKey(reworded), termsKey({ ...store, contract: { add: { build: ['l-shop'] }, sections: ['x-regions'] } }), 'rewording changes the signature key');
  // The edits are part of the signature's key, so a change after signing asks for a new signature; no edits, the old key.
  assert.notEqual(termsKey(edited), termsKey(store));
  assert.equal(termsKey({ ...store, contract: { off: [] } }), termsKey(store));
  assert.equal(termsKey({ ...store, contract: { off: ['ownership'] } }), termsKey({ ...store, contract: { off: ['ownership'] } }));
});

test('the standard lines come from the library once it has them, placeholders filled, in their order; the seed and migration 0017 agree', () => {
  const sql = fs.readFileSync('migrations/0017_contract_standard_lines.sql', 'utf8');
  for (const l of standardLines) assert.ok(sql.includes(`('${l.id}', '${l.section}', '${l.text.replace(/'/g, "''")}', '2026-11-17T00:00:00Z', 1, ${l.locked ? 1 : 0}, ${standardLines.indexOf(l)})`), `migration 0017 lacks ${l.id} as seeded`);
  assert.equal((sql.match(/\('s-/g) || []).length, standardLines.length, 'no extra rows in the migration');
  // A library with the standard rows reworded: the catalog follows the library, not the seed.
  const library = { sections: standardSections.map((s, i) => ({ ...s, builtin: 1, position: i })), lines: standardLines.map((s, i) => ({ id: s.id, section_id: s.section, text: s.id === 's-halves' ? 'Half ({half}) now, the rest ({rest}) at launch.' : s.text, standard: 1, locked: s.locked ? 1 : 0, position: i })) };
  const a = agreementFor({ ...base, tier: 'business' }, library);
  assert.match(a.text, /Half \(\$1,950\) now, the rest \(\$1,950\) at launch\./);
  assert.doesNotMatch(a.text, /\{[a-zA-Z]+\}/, 'every placeholder is filled');
  assert.match(a.text, /The Business package: up to 6 pages, and everything listed here:\n• /);
  // A project rewording may use the placeholders too.
  const r = agreementFor({ ...base, tier: 'business', contract: { edit: { 's-price': 'You pay {price}, taxes extra.' } } }, library);
  assert.match(r.text, /You pay \$3,900, taxes extra\./);
  // The library's wording isn't in the signature key: a library tweak never asks a signed client to sign again.
  assert.equal(termsKey({ ...base, tier: 'business' }), termsKey({ ...base, tier: 'business' }));
  assert.equal(fill('{a} and {b} and {c}', { a: 'x', b: 'y' }), 'x and y and {c}');
  // A standard line reworded in the library without its placeholders is flagged: the website no longer feeds it.
  const drifted = { ...library, lines: library.lines.map((l) => (l.id === 's-timing-1' ? { ...l, text: 'Online stores should launch 2–6 weeks from the start. {launchNote}' } : l)) };
  const timing = contractCatalog({ ...base, tier: 'store' }, drifted).find((s) => s.key === 'timing').p[0];
  assert.deepEqual(timing.fixed, ['package', 'days']);
  assert.equal(contractCatalog({ ...base, tier: 'store' }, library).find((s) => s.key === 'timing').p[0].fixed, undefined);
});

test('a change after signing asks for a new signature only while the project is active', async () => {
  const { agreementState } = await import('../server/agreement.js');
  const signedKey = termsKey({ tier: 'business' });
  const db = () => ({ prepare: (sql) => { const q = { all: async () => ({ results: [] }), first: async () => (/FROM agreements/.test(sql) ? { id: 's1', version: 'v', terms_key: signedKey, sha256: 'x', signer_name: 'Joshua Smith', signed_at: '2026-11-10T12:00:00Z', portfolio_ok: 1, emailed_to: null } : null) }; return { ...q, bind: () => q }; } });
  const env = { INTAKE: db() };
  const same = { id: 'p', status: 'intake', answers: JSON.stringify({ tier: 'business' }) };
  const changed = { ...same, answers: JSON.stringify({ tier: 'business', contract: { off: ['ownership'] } }) };
  assert.equal((await agreementState(env, same)).needed, false);
  assert.deepEqual([(await agreementState(env, changed)).needed, (await agreementState(env, changed)).reason], [true, 'changed'], 'active: the edit asks for a new signature');
  for (const status of ['live', 'closed']) {
    const s = await agreementState(env, { ...changed, status });
    assert.deepEqual([s.needed, s.reason, s.signed.valid], [false, null, true], `${status}: the signed contract stands`);
  }
  assert.equal((await agreementState(env, { ...changed, status: 'preview' })).needed, true);
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
