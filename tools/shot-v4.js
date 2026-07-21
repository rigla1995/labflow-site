// Capture d'aperçu v4 : accueil à 1440 px et 390 px (plein page).
const puppeteer = require('puppeteer');
const path = require('path');
const OUT = path.join(__dirname, 'preview');
const URL = process.env.URL || 'http://localhost:8322/';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  // Force les blocs .reveal à s'afficher (la branche « animations réduites »
  // leur pose .vu d'emblée) — sinon la capture pleine page les fige à opacity:0.
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(String(e)));
  page.on('requestfailed', r => {
    const u = r.url();
    if (u.includes('/api/')) return; // l'API n'existe pas en local
    errs.push('REQ FAIL ' + u + ' — ' + (r.failure() && r.failure().errorText));
  });

  for (const [w, h, tag] of [[1440, 900, 'desk'], [390, 844, 'mob']]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 700));
    await page.screenshot({ path: path.join(OUT, `v4-${tag}-top.png`) });
    await page.screenshot({ path: path.join(OUT, `v4-${tag}-full.png`), fullPage: true });
  }
  console.log('ERREURS CONSOLE/RESEAU:', errs.length ? JSON.stringify(errs, null, 2) : 'aucune');
  await browser.close();
})();
