/**
 * Crops ×4 restants pour le KIT FACEBOOK (complète captures-4k.js de la même
 * veille) : ecran-stock v2 (ÉPICERIE dépliée) + stock-valeur, kpi-marge,
 * commandes-table, stepper, facture-timbre, ft-arbre, production-deduction.
 * Sorties dans tools/raw2/. Run : node tools/fb/crops-4k.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const FRONT = 'http://localhost:5173';
const RAW = path.join(__dirname, '..', 'raw2');
const CLIENT = { email: 'demo@dar-yasmine.tn', password: 'DemoVitrine2026!' };
const LABO_ID = 55;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CSS_CONTENU_PUR = `
  .sidebar, .header, .sidebar-overlay { display: none !important; }
  .main-content { max-width: none !important; }
`;

async function login(page) {
  await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', CLIENT.email, { delay: 10 });
  await page.type('input[type="password"]', CLIENT.password, { delay: 10 });
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
  ]);
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 15000 });
}

async function contenuPur(page) {
  await page.addStyleTag({ content: CSS_CONTENU_PUR });
  await sleep(400);
}

async function clickText(page, txt, { near = null } = {}) {
  const ok = await page.evaluate((t, n) => {
    const T = t.toUpperCase();
    let els = [...document.querySelectorAll('button, [role="tab"], [role="button"], a')].filter(
      (e) => e.textContent && e.textContent.toUpperCase().includes(T)
    );
    if (!els.length) {
      els = [...document.querySelectorAll('div, span, h3, h4')].filter(
        (e) => e.textContent && e.textContent.toUpperCase().includes(T) && e.textContent.length < 120
      );
      els.sort((a, b) => a.textContent.length - b.textContent.length);
      els = els.slice(0, 1);
    }
    if (!els.length) return false;
    let el = els[0];
    if (n) {
      el = els.find((e) => {
        let p = e;
        for (let i = 0; i < 9 && p; i++) {
          p = p.parentElement;
          if (p && (p.innerText || '').includes(n) && (p.innerText || '').length < 800) return true;
        }
        return false;
      }) || els[0];
    }
    el.click();
    return true;
  }, txt, near);
  if (!ok) throw new Error(`clickText: « ${txt} » introuvable`);
  await sleep(700);
}

/** Plus petit élément matchant (regex innerText + bornes de taille), scrollé en vue. */
async function rectOf(page, rx, { minW = 200, maxW = 1400, minH = 80, maxH = 1200, pad = 8, scroll = true } = {}) {
  const r = await page.evaluate((rx, minW, maxW, minH, maxH, scroll) => {
    const re = new RegExp(rx, 'i');
    const els = [...document.querySelectorAll('div, section, table')].filter((e) => {
      if (!re.test(e.innerText || '')) return false;
      const b = e.getBoundingClientRect();
      return b.width >= minW && b.width <= maxW && b.height >= minH && b.height <= maxH;
    });
    const el = els.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return ra.width * ra.height - rb.width * rb.height;
    })[0];
    if (!el) return null;
    if (scroll) { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); }
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }, rx, minW, maxW, minH, maxH, scroll);
  if (!r) return null;
  return { x: Math.max(0, r.x - pad), y: Math.max(0, r.y - pad), width: r.width + pad * 2, height: r.height + pad * 2 };
}

async function shoot(page, nom, clip = null) {
  await page.screenshot({ path: path.join(RAW, nom), ...(clip ? { clip } : {}) });
  console.log(`📸 raw2/${nom}${clip ? ` (crop ${Math.round(clip.width)}×${Math.round(clip.height)})` : ''}`);
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--lang=fr-FR', '--hide-scrollbars'],
    defaultViewport: { width: 1160, height: 920, deviceScaleFactor: 4 },
  });
  const page = await browser.newPage();
  await login(page);

  // 1) Stock v2 (ÉPICERIE dépliée, montants visibles) + crop stock-valeur
  await page.goto(`${FRONT}/client/stock?section=activite`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => /ÉPICERIE/i.test(document.body.innerText), { timeout: 25000 });
  await sleep(600);
  await contenuPur(page);
  await clickText(page, 'ÉPICERIE');
  await page.waitForFunction(() => /\d[\d\s.,]*\s?DT/.test((document.querySelector('main') || document.body).innerText), { timeout: 20000 });
  await sleep(1000);
  await shoot(page, 'ecran-stock.png'); // remplace la v1 familles fermées
  const stockTable = await rectOf(page, 'STOCK ACTUEL', { minW: 700, maxH: 980, minH: 220 });
  if (stockTable) await shoot(page, 'stock-valeur.png', stockTable);

  // 2) KPI marge (dashboard Vue d'ensemble)
  await page.goto(`${FRONT}/client/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => /MARGE BRUTE/i.test(document.body.innerText), { timeout: 30000 });
  await sleep(1000);
  await contenuPur(page);
  const kpi = await rectOf(page, 'MARGE BRUTE[\\s\\S]*% du CA', { minW: 150, maxW: 560, minH: 80, maxH: 380, scroll: false });
  if (kpi) await shoot(page, 'kpi-marge.png', kpi);

  // 3) Commandes : table seule, puis modal livrée → stepper + bandeau timbre
  await page.goto(`${FRONT}/client/acheteurs/commandes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => /FA-2026/.test(document.body.innerText), { timeout: 30000 });
  await page.evaluate(() => {
    const dates = [...document.querySelectorAll('input[type="date"]')];
    const set = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      s.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    if (dates.length >= 2) { set(dates[0], '2026-07-01'); set(dates[1], '2026-07-17'); }
  });
  await sleep(1200);
  await contenuPur(page);
  const cmdTable = await rectOf(page, 'ACHETEUR[\\s\\S]*FA-2026', { minW: 700, maxW: 1300, minH: 200, maxH: 640 });
  if (cmdTable) await shoot(page, 'commandes-table.png', cmdTable);
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr')];
    const row = rows.find((r) => /Livrée/i.test(r.innerText || '') && /FA-2026/.test(r.innerText || ''));
    if (!row) throw new Error('ligne livrée introuvable');
    const eye = [...row.querySelectorAll('button')].find((b) => /👁/.test(b.textContent || '')) || row.querySelector('button');
    eye.click();
  });
  await page.waitForFunction(() => /SUIVI DE LA COMMANDE/i.test(document.body.innerText), { timeout: 15000 });
  await sleep(800);
  const stepper = await rectOf(page, 'SUIVI DE LA COMMANDE', { minW: 400, maxW: 1000, minH: 110, maxH: 420, scroll: false });
  if (stepper) await shoot(page, 'stepper.png', stepper);
  const timbre = await rectOf(page, 'Timbre', { minW: 360, maxW: 1000, minH: 36, maxH: 220, scroll: false });
  if (timbre) await shoot(page, 'facture-timbre.png', timbre);
  await page.keyboard.press('Escape').catch(() => {});

  // 4) Arbre de composition (modal FT du Mille-feuille)
  await page.goto(`${FRONT}/client/products/valorises`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => /Mille-feuille/i.test(document.body.innerText), { timeout: 25000 });
  await sleep(600);
  await contenuPur(page);
  await clickText(page, 'Fiche tech.', { near: 'Mille-feuille' });
  await page.waitForFunction(() => /COMPOSITION/i.test(document.body.innerText), { timeout: 15000 });
  await sleep(700);
  const arbre = await rectOf(page, 'Pâte feuilletée[\\s\\S]*Crème pâtissière', { minW: 360, maxW: 1000, minH: 160, maxH: 620, scroll: false });
  if (arbre) await shoot(page, 'ft-arbre.png', arbre);
  await page.keyboard.press('Escape').catch(() => {});

  // 5) Production → déduction (historique appro LABO, lignes PT AUTO)
  await page.goto(`${FRONT}/client/labo/historique-appro?laboId=${LABO_ID}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => /Rechercher/i.test(document.body.innerText), { timeout: 25000 });
  await sleep(500);
  await contenuPur(page);
  await clickText(page, 'Rechercher');
  await page.waitForFunction(() => /AUTO/.test(document.body.innerText) && /-\d/.test(document.body.innerText), { timeout: 25000 });
  await sleep(900);
  const prod = await rectOf(page, 'AUTO', { minW: 700, maxW: 1300, minH: 240, maxH: 640 });
  if (prod) await shoot(page, 'production-deduction.png', prod);

  await browser.close();
  console.log('✅ crops terminés → tools/raw2/');
})().catch((e) => { console.error('❌', e); process.exit(1); });
