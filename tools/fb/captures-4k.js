/**
 * Captures 4K « contenu pur » pour le KIT FACEBOOK — écrans absents de raw2.
 * MÊME STANDARD que tools/refresh-captures.js : sidebar/header masqués,
 * fenêtre proche de la largeur d'affichage, deviceScaleFactor 4.
 * Sorties dans tools/raw2/ : ecran-stock, ecran-ventes, ecran-import-avant
 * (formulaire seul, AUCUNE mutation du compte démo), ecran-histo-stock
 * (déductions Vente/PT), ecran-ventes-canaux (bloc cascade + canaux).
 * Run : node tools/fb/captures-4k.js  (backend 3000 + frontend 5173 démarrés)
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const FRONT = 'http://localhost:5173';
const RAW = path.join(__dirname, '..', 'raw2');
const CLIENT = { email: 'demo@dar-yasmine.tn', password: 'DemoVitrine2026!' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CSS_CONTENU_PUR = `
  .sidebar, .header, .sidebar-overlay { display: none !important; }
  .main-content { max-width: none !important; }
`;

async function login(page) {
  await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.type('input[type="email"]', CLIENT.email, { delay: 10 });
  await page.type('input[type="password"]', CLIENT.password, { delay: 10 });
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
  ]);
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 15000 });
}

async function waitForText(page, needle, { timeout = 30000 } = {}) {
  await page.waitForFunction(
    (n) => {
      const txt = (document.querySelector('main') || document.body).innerText || '';
      if (/Chargement|Loading/i.test(txt)) return false;
      return txt.includes(n);
    },
    { timeout }, needle
  );
  await sleep(900);
}

async function contenuPur(page) {
  await page.addStyleTag({ content: CSS_CONTENU_PUR });
  await sleep(400);
}

/** Cale la hauteur de fenêtre sur le contenu réel de <main> (plafonné). */
async function fitHeight(page, { maxH = 1500 } = {}) {
  const h = await page.evaluate(() => Math.ceil(document.querySelector('main').scrollHeight));
  const vp = page.viewport();
  await page.setViewport({ ...vp, height: Math.min(h + 4, maxH) });
  await sleep(900);
}

async function shoot(page, file, clip = null) {
  await page.screenshot({ path: path.join(RAW, file), ...(clip ? { clip } : {}) });
  console.log(`📸 ${file}${clip ? ` (crop ${Math.round(clip.width)}×${Math.round(clip.height)})` : ''}`);
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--lang=fr-FR', '--force-device-scale-factor=4'],
    defaultViewport: { width: 1100, height: 950, deviceScaleFactor: 4 },
  });
  const page = await browser.newPage();
  await login(page);

  // 1) Stock — l'onglet « Achats & stock » du dashboard : valeur du stock en dinars,
  //    données réelles (la page /client/stock s'affiche accordéons fermés, sans valeurs).
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 4 });
  await page.goto(`${FRONT}/client/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForText(page, '%');
  await contenuPur(page);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button, [role="tab"]')].find(
      (e) => /Achats\s*&\s*stock/i.test(e.textContent || '')
    );
    if (!el) throw new Error('onglet Achats & stock introuvable');
    el.click();
  });
  await page.waitForFunction(
    () => /stock/i.test(document.body.innerText) && /\d[\d\s.,]*\s?DT/.test(document.body.innerText),
    { timeout: 20000 }
  );
  await sleep(1200);
  await fitHeight(page, { maxH: 1450 });
  await shoot(page, 'ecran-stock.png');

  // 2) Ventes — l'onglet « Ventes & marges » du dashboard (chiffres réels par canal),
  //    la page de saisie /client/ventes est à zéro → visuel vide.
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 4 });
  await page.goto(`${FRONT}/client/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForText(page, '%');
  await contenuPur(page);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button, [role="tab"]')].find(
      (e) => /Ventes\s*&\s*marges/i.test(e.textContent || '')
    );
    if (!el) throw new Error('onglet Ventes & marges introuvable');
    el.click();
  });
  await page.waitForFunction(
    () => /canal de vente/i.test(document.body.innerText),
    { timeout: 20000 }
  );
  await sleep(1200);
  await fitHeight(page, { maxH: 1500 });
  await shoot(page, 'ecran-ventes.png');

  // 3) Import — AVANT (formulaire + modèle, aucun upload → zéro mutation démo).
  //    Clip au bas de la dropzone : la page a un grand vide dessous.
  await page.setViewport({ width: 1020, height: 1200, deviceScaleFactor: 4 });
  await page.goto(`${FRONT}/client/referentiel/import`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[type="file"]', { timeout: 20000 });
  await sleep(600);
  await contenuPur(page);
  const importClip = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].filter(
      (e) => /Glissez votre fichier ici/i.test(e.innerText || '') && e.getBoundingClientRect().height < 600
    ).sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height)[0];
    const bas = el ? el.getBoundingClientRect().bottom + window.scrollY + 26 : 1100;
    return { x: 0, y: 0, width: 1020, height: Math.ceil(bas) };
  });
  await page.setViewport({ width: 1020, height: Math.min(importClip.height, 1400), deviceScaleFactor: 4 });
  await sleep(700);
  await shoot(page, 'ecran-import-avant.png');

  // 4) Historique d'approvisionnement — les déductions Vente/PT (post « produire déduit »)
  //    La page demande d'abord une ACTIVITÉ, puis « Rechercher ».
  await page.setViewport({ width: 1280, height: 950, deviceScaleFactor: 4 });
  await page.goto(`${FRONT}/client/stock/historique`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForText(page, 'Historique', { timeout: 60000 });
  // L'activité PÂTISSERIE : c'est elle qui a les déductions de production (PT) —
  // mille-feuille, tartes… (le Restaurant n'a que des ventes).
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button, div, a')].filter(
      (e) => /Salon de th/i.test(e.textContent || '') && (e.textContent || '').length < 80
    ).sort((a, b) => a.textContent.length - b.textContent.length)[0];
    if (!el) throw new Error('activité introuvable');
    el.click();
  });
  await sleep(900);
  // Filtre TYPE D'APPRO = PT → les lignes de DÉDUCTION DE PRODUCTION (pas les ventes)
  await page.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((s) =>
      [...s.options].some((o) => /^PT$|Produits Transform/i.test(o.textContent || ''))
    );
    if (sel) {
      const opt = [...sel.options].find((o) => /^PT$|Produits Transform/i.test(o.textContent || ''));
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      setter.call(sel, opt.value);
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await sleep(500);
  const rechercher = () => page.evaluate(() => {
    const el = [...document.querySelectorAll('button')].find((e) => /Rechercher/i.test(e.textContent || ''));
    if (el) el.click();
  });
  await rechercher();
  try {
    await waitForText(page, 'DT', { timeout: 20000 });
  } catch {
    // Repli : le filtre PT ne renvoie rien → tous les types.
    console.warn('↻ filtre PT vide, repli sur tous les types');
    await page.evaluate(() => {
      const sel = [...document.querySelectorAll('select')].find((s) =>
        [...s.options].some((o) => /^PT$|Produits Transform/i.test(o.textContent || ''))
      );
      if (sel) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        setter.call(sel, sel.options[0].value);
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(500);
    await rechercher();
    await waitForText(page, 'DT', { timeout: 30000 });
  }
  await contenuPur(page);
  await fitHeight(page, { maxH: 1300 });
  await shoot(page, 'ecran-histo-stock.png');

  // 5) Dashboard → onglet « Ventes & marges » → bloc cascade + marges par canal
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 4 });
  await page.goto(`${FRONT}/client/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForText(page, '%');
  await contenuPur(page);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('button, [role="tab"]')].find(
      (e) => /Ventes\s*&\s*marges/i.test(e.textContent || '')
    );
    if (!el) throw new Error('onglet Ventes & marges introuvable');
    el.click();
  });
  await page.waitForFunction(
    () => /canal de vente/i.test(document.body.innerText) && /cascade/i.test(document.body.innerText),
    { timeout: 20000 }
  );
  await sleep(1200);
  const clip = await page.evaluate(() => {
    // Le plus petit bloc contenant À LA FOIS la cascade et les marges par canal.
    const els = [...document.querySelectorAll('div, section')].filter((e) => {
      const t = e.innerText || '';
      if (!/cascade/i.test(t) || !/canal de vente/i.test(t)) return false;
      const r = e.getBoundingClientRect();
      return r.width >= 800 && r.height >= 300 && r.height <= 1200;
    });
    const el = els.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return ra.width * ra.height - rb.width * rb.height;
    })[0];
    if (!el) return null;
    el.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -8);
    const r = el.getBoundingClientRect();
    return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: r.width + 8, height: r.height + 8 };
  });
  await shoot(page, 'ecran-ventes-canaux.png', clip);

  await browser.close();
  console.log('\n✅ Captures 4K terminées → tools/raw2/');
})().catch((e) => { console.error('❌', e); process.exit(1); });
