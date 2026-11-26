// The site says it loads nothing from other companies (src/components/SpeedProof.astro, and the
// "Why I leave out outside scripts" section on /websites). This keeps that true of every built page:
// no script, stylesheet, image, frame or font fetched from another host. Links to other sites are fine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const DIST = new URL('../dist/', import.meta.url);
const LOADS = /<(script|link|img|iframe|source|video|audio|embed|object)\b[^>]*?\b(src|href|srcset|data)\s*=\s*["']\s*(https?:)?\/\/(?!steadfastcode\.tech[/"'])[^"']*/gi;

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(full);
    return e.name.endsWith('.html') ? [full] : [];
  });
}

test('no built page loads anything from another host', () => {
  const files = htmlFiles(DIST.pathname);
  assert.ok(files.length > 5, 'run yarn build first');
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    // A plain <a href> to another site is a link, not a load; only <link rel=stylesheet|preload|icon…> loads.
    const loads = [...html.matchAll(LOADS)].map((m) => m[0]).filter((tag) => !/^<link\b/i.test(tag) || /rel=["']?(stylesheet|preload|modulepreload|icon|apple-touch-icon|manifest|prefetch)/i.test(tag));
    assert.deepEqual(loads, [], `${path.relative(DIST.pathname, file)} loads from another host`);
  }
});
