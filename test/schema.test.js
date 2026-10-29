// The structured data, checked at the source: the graph is built from site.ts and every price in
// it is a price on the site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addOns, business, carePlans, faq, seoPlans, websiteTiers } from '../src/data/site.ts';
import { breadcrumb, faqPage, graph, organization, person, webSite } from '../src/lib/schema.ts';

test('the business node has the facts and no invented ones', () => {
  const org = organization();
  assert.equal(org['@type'], 'ProfessionalService');
  assert.equal(org.name, business.name);
  assert.equal(org.email, business.email);
  assert.equal(org.address.addressLocality, business.city);
  assert.ok(!('streetAddress' in org.address), 'no street address on a service-area business');
  assert.ok(!('aggregateRating' in org) && !('review' in org), 'no ratings until real ones exist');
  const sameAs = org.sameAs ?? [];
  assert.ok(sameAs.every((u) => u.startsWith('https://')), 'sameAs must be real URLs');
  assert.ok(!sameAs.includes(''), 'empty profile fields must not be emitted');
});

test('the offer catalog carries every priced thing on the site, with the same numbers', () => {
  const offers = organization().hasOfferCatalog.itemListElement;
  const prices = offers.map((o) => o.priceSpecification.price ?? o.priceSpecification.minPrice);
  for (const t of websiteTiers) assert.ok(prices.includes(t.price), `${t.name} missing from the catalog`);
  for (const p of carePlans) assert.ok(prices.includes(p.price), `${p.name} missing from the catalog`);
  for (const p of seoPlans) assert.ok(prices.includes(p.price), `${p.name} missing from the catalog`);
  for (const a of addOns) assert.ok(prices.includes(a.price), `${a.name} missing from the catalog`);
  assert.equal(offers.length, websiteTiers.length + addOns.length + carePlans.length + seoPlans.length);
  for (const o of offers) assert.ok(o.url.startsWith(business.url), `${o.name} offer url should be on the site`);
});

test('the graph serializes safely and the helpers shape their nodes', () => {
  const json = graph([organization(), person(), webSite(), breadcrumb('/websites', 'Websites'), faqPage('/websites', faq)]);
  assert.ok(!json.includes('</'), 'a closing tag inside the JSON would end the script early');
  const parsed = JSON.parse(json);
  assert.equal(parsed['@graph'][3].itemListElement[1].item, `${business.url}/websites`);
  assert.equal(parsed['@graph'][4].mainEntity.length, faq.length);
  assert.equal(parsed['@graph'][1].name, business.owner);
});
