/**
 * Screenshots de contrôle du site local (port 8322) → tools/preview/.
 * Run : node tools/preview-shots.js [urlPath]
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const OUT = path.join(__dirname, 'preview');
const BASE = 'http://localhost:8322';
const arg = (process.argv[2] || '').replace(/^\/+/, '');
const PAGE = arg ? '/' + arg.replace(/^.*[\\/]/, '') : '/';
const slug = PAGE === '/' ? 'index' : PAGE.replace(/[\/.]/g, '-').replace(/^-+|-+$/g, '').replace(/-html$/, '');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();

  // Desktop
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(BASE + PAGE, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(OUT, `${slug}-desktop-top.png`) });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 900));
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT, `${slug}-desktop-full.png`), fullPage: true });

  // Mobile 390
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(BASE + PAGE, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await new Promise((r) => setTimeout(r, 900));
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT, `${slug}-mobile-full.png`), fullPage: true });

  // Erreurs console
  browser.close();
  console.log('✅ previews →', OUT);
})().catch((e) => { console.error('❌', e); process.exit(1); });
