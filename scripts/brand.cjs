// Renders the raster brand files from public/logo.svg, so they never drift from the logo:
//   public/og.jpg              1200x630 social card (link previews on Facebook, iMessage, Slack);
//                              JPEG because the gradients make a PNG 450 KB
//   public/apple-touch-icon.png 180x180 home-screen icon (iOS rounds the corners itself)
// Run after changing the logo or the headline: NODE_PATH=$(npm root -g) node scripts/brand.cjs
// (Playwright is installed globally on the box; this site doesn't depend on it.)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const logo = fs.readFileSync(path.join(root, 'public/logo.svg'), 'utf8');
const font = fs.readFileSync(path.join(root, 'node_modules/@fontsource-variable/roboto-slab/files/roboto-slab-latin-wght-normal.woff2')).toString('base64');
const logoImg = (style) => `<img src="data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}" style="${style}">`;
const fontFace = `@font-face{font-family:'Roboto Slab';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}`;

const og = `<!doctype html><html><head><style>${fontFace}
  *{margin:0;box-sizing:border-box}
  body{width:1200px;height:630px;overflow:hidden;color:#fff;font-family:system-ui,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    background:radial-gradient(520px 380px at 12% 6%,rgba(74,144,226,.32),transparent 70%),radial-gradient(420px 320px at 92% 98%,rgba(249,115,22,.30),transparent 70%),linear-gradient(160deg,#1a202c 0%,#0b0f17 60%,#000 100%);
    padding:72px 80px}
  .brand{display:flex;align-items:center;gap:26px}
  .brand span{font:700 62px 'Roboto Slab',Georgia,serif;letter-spacing:-.5px;text-shadow:0 0 18px rgba(74,144,226,.35)}
  h1{font:700 64px/1.12 'Roboto Slab',Georgia,serif;margin-top:78px;letter-spacing:-.5px;text-shadow:0 0 24px rgba(74,144,226,.25)}
  h1 em{font-style:normal;color:#fb923c;text-shadow:0 0 22px rgba(249,115,22,.45)}
  .sub{margin-top:40px;font-size:30px;color:#a7b0c0}
  .url{margin-top:52px;font-size:28px;color:#00d5f1}
</style></head><body>
  <div class="brand">${logoImg('height:96px;filter:drop-shadow(0 0 14px rgba(74,144,226,.45))')}<span>Steadfast Code</span></div>
  <h1>A custom website, built fast,<br>that loads <em>even faster.</em></h1>
  <p class="sub">Websites · Local SEO &amp; GEO · Software — Lititz, PA</p>
  <p class="url">steadfastcode.tech</p>
</body></html>`;

const icon = `<!doctype html><html><head><style>*{margin:0}body{width:180px;height:180px;background:#0b151f;display:grid;place-items:center}</style></head>
  <body>${logoImg('width:156px;height:auto')}</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const shoot = async (html, width, height, file) => {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const jpeg = file.endsWith('.jpg');
    await page.screenshot({ path: path.join(root, file), type: jpeg ? 'jpeg' : 'png', ...(jpeg ? { quality: 88 } : {}) });
    await page.close();
    console.log('wrote', file);
  };
  await shoot(og, 1200, 630, 'public/og.jpg');
  await shoot(icon, 180, 180, 'public/apple-touch-icon.png');
  await browser.close();
})();
