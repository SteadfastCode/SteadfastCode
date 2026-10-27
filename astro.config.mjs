// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static output on purpose: the site is pages, and a server is a thing to patch. The one dynamic
// piece, the contact form, is a Cloudflare Pages Function under functions/ (see the notes there).
//
// `format: 'file'` writes `/websites` as `dist/websites.html` rather than `dist/websites/index.html`.
// Both GitHub Pages (where the site lives today) and Cloudflare Pages (where it is headed) serve an
// extensionless `/websites` from that file without a redirect, so the canonical URL on the page is
// the URL the visitor is actually on, on either host. With the directory form GitHub Pages 301s
// `/websites` to `/websites/`, and every canonical on the site would point at a redirect.
export default defineConfig({
  site: 'https://steadfastcode.tech',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  integrations: [sitemap()],
});
