// The performance promise, enforced on the built output. The home page says "this whole page is
// under N KB, fonts and styles included" and "the site loads nothing from third parties"; both are
// checked here so they stay true when someone adds an image or an embed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { benchmarks } from '../src/data/site.ts';

const dist = path.resolve('dist');
const pages = fs.existsSync(dist)
  ? fs.readdirSync(dist, { recursive: true }).filter((f) => f.endsWith('.html')).map((f) => path.join(dist, f))
  : [];
const read = (p) => fs.readFileSync(p, 'utf8');
const rel = (p) => path.relative(dist, p);
const sizeOf = (p) => (fs.existsSync(p) ? fs.statSync(p).size : 0);
const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;

/** Local assets a page loads before `load` fires: stylesheets, preloaded fonts, eager images. */
function eagerAssets(html) {
  const urls = new Set();
  for (const m of html.matchAll(/<link[^>]*>/g)) {
    if (!/rel="(stylesheet|preload)"/.test(m[0])) continue;
    const href = m[0].match(/href="([^"]+)"/);
    if (href) urls.add(href[1]);
  }
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"[^>]*>/g)) if (!/loading="lazy"/.test(m[0])) urls.add(m[1]);
  return [...urls].filter((u) => u.startsWith('/'));
}

test('every page, with its styles, fonts and eager images, is under the budget the home page claims', () => {
  assert.ok(pages.length, 'run `yarn build` first');
  const budget = benchmarks.budgetKb * 1024;
  for (const p of pages) {
    const html = read(p);
    // Over the wire means compressed; both hosts gzip/brotli text. Images are already compressed.
    let bytes = gz(Buffer.from(html));
    for (const u of eagerAssets(html)) {
      const f = path.join(dist, u);
      bytes += /\.(css|svg|js|txt|json|xml)$/.test(u) ? gz(fs.readFileSync(f)) : sizeOf(f);
    }
    assert.ok(bytes < budget, `${rel(p)} is ${(bytes / 1024).toFixed(0)} KB over the wire; the budget is ${benchmarks.budgetKb} KB`);
  }
});

test('no page loads anything from a third party', () => {
  for (const p of pages) {
    const html = read(p);
    const name = rel(p);
    for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) assert.ok(m[1].startsWith('/'), `${name} loads a script from ${m[1]}`);
    for (const m of html.matchAll(/<link[^>]+href="([^"]+)"[^>]*>/g)) {
      if (/rel="canonical"/.test(m[0])) continue;
      assert.ok(m[1].startsWith('/'), `${name} links a resource from ${m[1]}`);
    }
    for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) assert.ok(m[1].startsWith('/'), `${name} loads an image from ${m[1]}`);
    for (const m of html.matchAll(/<iframe[^>]+src="([^"]+)"/g)) assert.fail(`${name} embeds an iframe from ${m[1]}`);
    assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com|googletagmanager|google-analytics|tally\.so\/widgets/, `${name} references a third-party loader`);
  }
  for (const css of fs.readdirSync(path.join(dist, '_astro')).filter((f) => f.endsWith('.css'))) {
    const text = read(path.join(dist, '_astro', css));
    for (const m of text.matchAll(/url\(([^)]+)\)/g)) assert.doesNotMatch(m[1], /^['"]?https?:/, `${css} loads ${m[1]} from a third party`);
  }
});

test('the only web font is one latin woff2, preloaded, and the inline scripts are small', () => {
  for (const p of pages) {
    const html = read(p);
    const fonts = [...html.matchAll(/<link[^>]*>/g)].filter((m) => /as="font"/.test(m[0])).map((m) => m[0].match(/href="([^"]+)"/)[1]);
    assert.equal(fonts.length, 1, `${rel(p)} should preload exactly one font`);
    assert.match(fonts[0], /roboto-slab-latin-wght-normal/, `${rel(p)} preloads the wrong font file`);
    assert.ok(sizeOf(path.join(dist, fonts[0])) < 70 * 1024, 'the font file grew');
    const inline = [...html.matchAll(/<script(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)].reduce((a, m) => a + m[1].length, 0);
    assert.ok(inline < 6 * 1024, `${rel(p)} has ${inline} bytes of inline script; keep it under 6 KB`);
    assert.doesNotMatch(html, /<script[^>]+src=/, `${rel(p)} loads an external script bundle; this site ships none`);
  }
});

test('images on the work page carry width and height and the lazy ones stay reasonable', () => {
  const html = read(path.join(dist, 'work.html'));
  for (const m of html.matchAll(/<img[^>]*>/g)) {
    assert.match(m[0], /width="\d+"/, `an image lacks width: ${m[0].slice(0, 80)}`);
    assert.match(m[0], /height="\d+"/, `an image lacks height: ${m[0].slice(0, 80)}`);
    const src = m[0].match(/src="([^"]+)"/)[1];
    assert.ok(sizeOf(path.join(dist, src)) < 160 * 1024, `${src} is over 160 KB`);
  }
});
