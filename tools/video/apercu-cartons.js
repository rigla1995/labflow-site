// Aperçu PNG des cartons (contrôle visuel avant tournage) → tools/preview/
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const url = 'file:///' + path.join(__dirname, 'cartons.html').replace(/\\/g, '/');
  const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 810 });
  await p.goto(url, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  for (const id of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']) {
    await p.evaluate((i) => window.montrer(i), id);
    await new Promise((r) => setTimeout(r, 350));
    await p.screenshot({ path: path.join(__dirname, '..', 'preview', `carton-${id}.png`) });
  }
  console.log('✅ 6 cartons → tools/preview/carton-c*.png');
  await b.close();
})().catch((e) => { console.error('❌', e); process.exit(1); });
