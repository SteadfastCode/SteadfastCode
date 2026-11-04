// Accessibility, checked on the built site (2026-11-02). Every page, on a desktop and a phone, with
// and without the visitor's "Increase contrast" setting, goes through axe-core's WCAG 2.0/2.1/2.2 A and
// AA rules; every page has to reflow at 320 px (no sideways scrolling, WCAG 1.4.10); and the first Tab
// lands on a visible "Skip to content". This is what an automated check can catch, about a third of
// what matters; keyboard, screen-reader and zoom passes by a person cover the rest.
//
// Uses the box's global Playwright (it comes with a browser); where there is none, the test says so and skips.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const dist = path.resolve('dist');
const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
let playwright = null;
try { playwright = require(path.join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'playwright')); } catch { /* none here */ }

// Tools, not public pages: their own tests cover them.
const SKIP = new Set(['admin.html', 'client.html', 'admin/usage.html', 'admin/leads.html', 'admin/care.html']);
const pages = fs.existsSync(dist) ? fs.readdirSync(dist, { recursive: true }).filter((f) => f.endsWith('.html') && !SKIP.has(f)).sort() : [];
const route = (f) => '/' + f.replace(/index\.html$/, '').replace(/\.html$/, '');

function serve() {
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const tries = [u, u + '.html', path.join(u, 'index.html')].map((x) => path.join(dist, x));
    const file = tries.find((x) => x.startsWith(dist) && fs.existsSync(x) && fs.statSync(x).isFile());
    if (!file) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

// Scroll through once so scroll-in animations settle on their final colors before contrast is measured.
const settle = (p) => p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } scrollTo(0, 0); });

test('every page passes axe (WCAG A/AA) in light and dark, on desktop and phone, with and without increased contrast', { skip: !playwright && 'no Playwright on this machine', timeout: 600_000 }, async () => {
  assert.ok(pages.length, 'run `yarn build` first');
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await playwright.chromium.launch();
  const problems = [];
  try {
    const modes = [];
    for (const scheme of ['light', 'dark']) {
      modes.push([`desktop ${scheme}`, { viewport: { width: 1280, height: 900 }, colorScheme: scheme }], [`phone ${scheme}`, { ...playwright.devices['iPhone 13'], colorScheme: scheme }], [`phone ${scheme}, more contrast`, { ...playwright.devices['iPhone 13'], colorScheme: scheme, contrast: 'more' }]);
    }
    for (const [label, opts] of modes) {
      const ctx = await browser.newContext({ ...opts, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      for (const f of pages) {
        await page.goto(base + route(f), { waitUntil: 'load' });
        await settle(page);
        await page.addScriptTag({ content: axeSource });
        const v = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((x) => `${x.id} (${x.nodes.length}): ${x.help} — ${x.nodes[0]?.target?.join(' ')}`));
        for (const x of v) problems.push(`${route(f)} [${label}] ${x}`);
      }
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('every page reflows at 320 px wide (no sideways scrolling), and the first Tab is a visible skip link', { skip: !playwright && 'no Playwright on this machine', timeout: 300_000 }, async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await playwright.chromium.launch();
  const problems = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: 320, height: 640 }, reducedMotion: 'reduce' })).newPage();
    for (const f of pages) {
      await page.goto(base + route(f), { waitUntil: 'load' });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 1) problems.push(`${route(f)} scrolls sideways by ${over}px at 320px`);
      // Focus the page and let the browser apply :focus before reading it; reading in the same
      // tick sometimes saw the skip link still parked off-screen.
      await page.bringToFront();
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);
      const first = await page.evaluate(() => { const el = document.activeElement; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { text: el.textContent.trim(), href: el.getAttribute('href'), visible: r.width > 0 && r.left >= 0 && r.top >= 0, outline: cs.outlineStyle !== 'none' || cs.boxShadow !== 'none' }; });
      if (!/skip to content/i.test(first.text) || !first.href?.startsWith('#')) problems.push(`${route(f)} first Tab lands on "${first.text.slice(0, 40)}", not a skip link`);
      else if (!first.visible) problems.push(`${route(f)} skip link doesn't appear when focused`);
      else if (!first.outline) problems.push(`${route(f)} skip link has no visible focus indicator`);
    }
  } finally { await browser.close(); server.close(); }
  assert.deepEqual(problems, [], problems.join('\n'));
});
