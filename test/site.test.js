// Gate over the built site (run `yarn build` first; `yarn gate` does both). These are the rules the
// pages must keep whatever else changes: every price on a page comes from site.ts, every page has
// the metadata search engines and assistants read, the voice stays Daniel's, and nothing from the
// "coming soon" era is left over.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { addOns, business, carePlans, money, nav, seoPlans, websiteTiers } from '../src/data/site.ts';

const dist = path.resolve('dist');
const pages = fs.existsSync(dist)
  ? fs.readdirSync(dist, { recursive: true }).filter((f) => f.endsWith('.html')).map((f) => path.join(dist, f))
  : [];
const read = (p) => fs.readFileSync(p, 'utf8');
const rel = (p) => path.relative(dist, p);
const expected = ['index.html', 'websites.html', 'seo.html', 'work.html', 'software.html', 'about.html', 'contact.html', 'privacy.html', '404.html'];

test('the build exists and has every page', () => {
  assert.ok(pages.length >= expected.length, 'run `yarn build` first');
  for (const p of expected) assert.ok(fs.existsSync(path.join(dist, p)), `${p} missing`);
});

test('every page has a title, a description, a canonical that matches its URL, and one JSON-LD graph', () => {
  for (const p of pages) {
    const html = read(p);
    const name = rel(p);
    assert.match(html, /<title>[^<]{10,}<\/title>/, `${name} lacks a title`);
    assert.match(html, /<meta name="description" content="[^"]{50,}"/, `${name} lacks a real description`);
    if (name !== '404.html') {
      const route = name === 'index.html' ? '/' : `/${name.replace(/\.html$/, '')}`;
      const canonical = route === '/' ? `${business.url}/` : `${business.url}${route}`;
      assert.ok(html.includes(`<link rel="canonical" href="${canonical}"`), `${name} canonical should be ${canonical}`);
    }
    const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) ?? [];
    assert.equal(blocks.length, 1, `${name} should carry exactly one JSON-LD block`);
    const json = JSON.parse(blocks[0].replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
    assert.equal(json['@context'], 'https://schema.org');
    assert.ok(Array.isArray(json['@graph']) && json['@graph'].length >= 3, `${name} graph is thin`);
    assert.ok(json['@graph'].some((n) => n['@type'] === 'ProfessionalService'), `${name} graph lacks the business node`);
  }
});

test('every page has the nav from site.ts, the email, and the skip link', () => {
  for (const p of pages) {
    const html = read(p);
    // Daniel's rule: the verse is the LSB text word for word, never paraphrased.
    assert.ok(html.includes(`${business.verse} — ${business.verseRef}`), `${rel(p)} lacks the exact LSB verse`);
    assert.doesNotMatch(html, /work at it with all your heart/i, `${rel(p)} has the paraphrased verse`);
    for (const n of nav) assert.ok(html.includes(`href="${n.href}"`), `${rel(p)} nav lacks ${n.href}`);
    assert.ok(html.includes(business.email), `${rel(p)} lacks the email`);
    assert.match(html, /class="skip" href="#main"/, `${rel(p)} lacks the skip link`);
  }
});

test('every price shown on a page is a price from site.ts', () => {
  const known = new Set();
  for (const t of websiteTiers) known.add(money(t.price));
  for (const a of addOns) known.add(money(a.price));
  for (const p of carePlans) { known.add(money(p.price)); known.add(money(p.price, 'mo')); }
  for (const p of seoPlans) { known.add(money(p.price)); known.add(money(p.price, 'mo')); }
  for (const p of pages) {
    const html = read(p).replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '');
    for (const m of html.matchAll(/\$\d{1,3}(?:,\d{3})*(?:\/mo)?/g)) {
      assert.ok(known.has(m[0]), `${rel(p)} shows ${m[0]}, which is not a price in site.ts`);
    }
  }
});

test('the websites page shows every tier and every care plan; the SEO page shows every SEO plan', () => {
  const w = read(path.join(dist, 'websites.html'));
  for (const t of websiteTiers) { assert.ok(w.includes(`id="${t.id}"`), `/websites lacks #${t.id}`); assert.ok(w.includes(money(t.price)), `/websites lacks ${money(t.price)}`); }
  for (const p of carePlans) { assert.ok(w.includes(`id="${p.id}"`), `/websites lacks #${p.id}`); assert.ok(w.includes(money(p.price)), `/websites lacks ${money(p.price)}`); }
  for (const a of addOns) { assert.ok(w.includes(`id="${a.id}"`), `/websites lacks #${a.id}`); assert.ok(w.includes(money(a.price)), `/websites lacks ${money(a.price)}`); }
  const s = read(path.join(dist, 'seo.html'));
  for (const p of seoPlans) { assert.ok(s.includes(`id="${p.id}"`), `/seo lacks #${p.id}`); assert.ok(s.includes(money(p.price)), `/seo lacks ${money(p.price)}`); }
});

test('the contact form posts to the function, carries the honeypot, and preselects from ?plan=', () => {
  const html = read(path.join(dist, 'contact.html'));
  assert.match(html, /action="\/api\/contact"/);
  assert.match(html, /name="company"/);
  assert.match(html, /data-email="support@steadfastcode\.tech"/);
  for (const t of websiteTiers) assert.ok(html.includes(`value="${t.id}"`), `contact form lacks option ${t.id}`);
  assert.match(html, /href="\/privacy"/);
});

test('the voice is Daniel’s: American spelling, no hype words, nothing left from the coming-soon page', () => {
  const british = /\b(colour|optimis(e|ed|ation)|licen[cs]e fee|prioritis|organis(e|ation)|favourite|centre|behaviour|catalogue)\b/i;
  const hype = /\b(world-class|cutting-edge|unleash|supercharge|revolutionary|game-changing|synergy|leverage our)\b/i;
  const leftovers = /coming soon!|stay tuned|launch date tbd|join the waitlist →|save small business owners 5\+ hours/i;
  // AI tools write most of the code and Daniel reviews it; calling that hand-coded is disingenuous (his word).
  const dishonest = /\b(hand[- ]?coded|hand[- ]?written|hand[- ]?crafted|artisanal?)\b|\b(read|review(?:s|ed|ing)?|fix(?:es|ed)?) (every|each) line\b|line by line|checked by me|reviewed by (me|a real developer|the developer)/i;
  for (const p of pages) {
    const html = read(p).replace(/<script[\s\S]*?<\/script>/g, '');
    assert.doesNotMatch(html, british, `${rel(p)} has British spelling`);
    assert.doesNotMatch(html, hype, `${rel(p)} has a hype word`);
    assert.doesNotMatch(html, leftovers, `${rel(p)} has coming-soon leftovers`);
    assert.doesNotMatch(html, dishonest, `${rel(p)} claims hand-coded; say AI tools write it and Daniel reviews it`);
  }
});

test('llms.txt and robots.txt are in the build and agree with the pages', () => {
  const llms = read(path.join(dist, 'llms.txt'));
  assert.match(llms, new RegExp(`^# ${business.name}\\n\\n> `), 'llms.txt shape');
  assert.doesNotMatch(llms, /hand[- ]?coded|hand[- ]?written/i, 'llms.txt claims hand-coded');
  for (const t of websiteTiers) assert.ok(llms.includes(money(t.price)), `llms.txt lacks ${t.name} price`);
  for (const p of seoPlans) assert.ok(llms.includes(money(p.price)), `llms.txt lacks ${p.name} price`);
  for (const p of expected.filter((f) => f !== '404.html')) {
    const route = p === 'index.html' ? `${business.url}/` : `${business.url}/${p.replace(/\.html$/, '')}`;
    assert.ok(llms.includes(`(${route})`), `llms.txt does not link ${route}`);
  }
  const robots = read(path.join(dist, 'robots.txt'));
  assert.match(robots, /Allow: \//);
  assert.match(robots, /Sitemap: https:\/\/steadfastcode\.tech\/sitemap-index\.xml/);
  assert.ok(fs.existsSync(path.join(dist, 'sitemap-index.xml')), 'sitemap missing');
  assert.ok(fs.existsSync(path.join(dist, 'CNAME')), 'CNAME missing (GitHub Pages custom domain)');
});

test('every page counts visits only through its own /api/hit, and the privacy page says what is counted', () => {
  for (const p of pages) {
    const html = read(p);
    assert.match(html, /navigator\.sendBeacon\('\/api\/hit'/, `${rel(p)} lacks the Steadfast Analytics beacon`);
    assert.doesNotMatch(html, /document\.cookie|localStorage|sessionStorage/, `${rel(p)} touches browser storage`);
  }
  const privacy = read(path.join(dist, 'privacy.html'));
  assert.match(privacy, /Steadfast Analytics/);
  assert.match(privacy, /No cookie is set/);
  assert.match(privacy, /not stored/);
  assert.doesNotMatch(privacy, /no analytics/i, 'the privacy page must not say there are no analytics');
  assert.ok(fs.existsSync('functions/api/hit.js'), 'the /api/hit function is missing');
});
