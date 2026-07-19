/**
 * Vérification globale du site local : erreurs console, requêtes en échec,
 * poids réseau de la première vue, interactions clés, reduced-motion.
 * Run : node tools/verify-pages.js
 */
const puppeteer = require('puppeteer');

const PAGES = ['/', '/tarifs.html', '/demande-acces.html', '/merci.html', '/mentions-legales.html', '/confidentialite.html'];
const BASE = 'http://localhost:8322';

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  for (const p of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const errors = [];
    const failed = [];
    let bytes = 0;
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
    page.on('requestfailed', (r) => { if (!r.url().startsWith('data:')) failed.push(r.url()); });
    page.on('response', (r) => {
      r.buffer().then((b) => { bytes += b.length; }).catch(() => {});
    });
    await page.goto(BASE + p, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 800));
    console.log(`\n── ${p}`);
    console.log(`   première vue ≈ ${Math.round(bytes / 1024)} Ko transférés`);
    console.log(`   erreurs console : ${errors.length ? errors.join(' | ') : 'aucune'}`);
    console.log(`   requêtes échouées : ${failed.length ? failed.join(', ') : 'aucune'}`);
    await page.close();
  }

  // Interaction calculateur (tarifs) : +1 labo → total recalculé + remise −30 %
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + '/tarifs.html', { waitUntil: 'networkidle0' });
  const t0 = await page.$eval('#total', (e) => e.textContent);
  await page.evaluate(() => chg('lab', 1));
  const t1 = await page.$eval('#total', (e) => e.textContent);
  const detail = await page.$eval('#detail', (e) => e.innerText.replace(/\n/g, ' · '));
  console.log(`\n── calculateur tarifs : ${t0} DT → +1 labo → ${t1} DT`);
  console.log(`   détail : ${detail}`);
  await Promise.all([
    page.evaluate(() => document.getElementById('calc-go').click()),
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {}),
  ]);
  const lf = await page.evaluate(() => localStorage.getItem('lf_calc'));
  const recap = await page.$eval('#calc-recap', (e) => e.style.display !== 'none' ? e.innerText.replace(/\n/g, ' · ') : '(absent)').catch(() => 'n/a');
  console.log(`   lf_calc transmis : ${lf}`);
  console.log(`   récap sur demande-acces : ${recap}`);
  await page.close();

  // Reduced motion : la cascade doit afficher les valeurs finales sans animation
  const rm = await browser.newPage();
  await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await rm.setViewport({ width: 1440, height: 900 });
  await rm.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await rm.evaluate(() => document.getElementById('cascade').scrollIntoView());
  await new Promise((r) => setTimeout(r, 800));
  const vals = await rm.$$eval('#cascade [data-count]', (els) => els.map((e) => e.textContent));
  console.log(`\n── reduced-motion : valeurs cascade = ${vals.join(' / ')} (attendu 2,290 / 1,408 / 66,7)`);
  await rm.close();

  await browser.close();
  console.log('\n✅ vérification terminée');
})().catch((e) => { console.error('❌', e); process.exit(1); });
