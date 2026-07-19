/**
 * Captures d'écran du compte démo « Dar Yasmine » pour le site vitrine.
 * Prérequis : backend (3000) + frontend (5173) démarrés, seed-demo-vitrine exécuté.
 * Run : node tools/capture.js   → écrit dans assets/img/ et assets/files/
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const FRONT = 'http://localhost:5173';
const API = 'http://localhost:3000';
const IMG = path.join(__dirname, '..', 'assets', 'img');
const FILES = path.join(__dirname, '..', 'assets', 'files');

const CLIENT = { email: 'demo@dar-yasmine.tn', password: 'DemoVitrine2026!' };
const ACHETEUR = { email: 'm.khelil.prof+acheteur1@gmail.com', password: 'Portail2026!' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page, creds) {
  await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', creds.email, { delay: 10 });
  await page.type('input[type="password"]', creds.password, { delay: 10 });
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
  ]);
  await sleep(1500);
}

async function shoot(page, url, file, { wait = 3000, click = null } = {}) {
  // domcontentloaded + attente fixe : la cloche SSE garde une connexion ouverte
  // en permanence, networkidle ne se déclenche jamais sur certaines pages.
  await page.goto(`${FRONT}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(wait);
  if (click) {
    const done = await page.evaluate((txt) => {
      const els = [...document.querySelectorAll('button, [role="tab"]')];
      const el = els.find((e) => e.textContent && e.textContent.includes(txt));
      if (el) { el.click(); return true; }
      return false;
    }, click);
    if (done) await sleep(1800);
  }
  await page.screenshot({ path: path.join(IMG, file) });
  console.log(`📸 ${file}`);
}

async function saveBinary(token, urlPath, file) {
  const res = await fetch(`${API}${urlPath}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { console.warn(`⚠️ ${urlPath} → ${res.status}`); return; }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(FILES, file), buf);
  console.log(`📄 ${file} (${Math.round(buf.length / 1024)} Ko)`);
}

(async () => {
  fs.mkdirSync(IMG, { recursive: true });
  fs.mkdirSync(FILES, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  // ── Côté client Dar Yasmine ────────────────────────────────────────────────
  const page = await browser.newPage();
  await login(page, CLIENT);

  await shoot(page, '/client/dashboard', 'dashboard.png', { wait: 3200 });
  await shoot(page, '/client/dashboard', 'dashboard-ventes.png', { wait: 2600, click: 'Ventes & marges' });
  await shoot(page, '/client/stock', 'stock.png');
  await shoot(page, '/client/stock/historique-pertes', 'pertes.png');
  await shoot(page, '/client/products', 'produits.png', { wait: 2600 });
  await shoot(page, '/client/labo/historique-transferts', 'transferts.png');
  await shoot(page, '/client/acheteurs/commandes', 'commandes-b2b.png', { wait: 2600 });

  // Token client pour les fichiers de preuve
  const token = await page.evaluate(() => localStorage.getItem('token') || sessionStorage.getItem('token'));

  // Facture acheteur : première facture trouvée via l'API commandes
  try {
    const r = await fetch(`${API}/api/acheteurs/commandes`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    const list = data.commandes || data;
    const withFacture = (Array.isArray(list) ? list : []).find((c) => c.factureId || (c.facture && c.facture.id));
    const factureId = withFacture ? (withFacture.factureId || withFacture.facture.id) : null;
    if (factureId) await saveBinary(token, `/api/acheteurs/factures/${factureId}/pdf`, 'facture-acheteur-exemple.pdf');
    else console.warn('⚠️ Aucune facture trouvée dans les commandes');
  } catch (e) { console.warn('⚠️ facture:', e.message); }

  // Export Excel brandé : historique des appros du labo
  try {
    const labos = await (await fetch(`${API}/api/labo`, { headers: { Authorization: `Bearer ${token}` } })).json();
    const laboId = (labos.labos || labos)[0].id;
    await saveBinary(token, `/api/labo/${laboId}/historique/export-excel`, 'export-excel-exemple.xlsx');
  } catch (e) { console.warn('⚠️ export excel:', e.message); }

  // ── Portail acheteur ───────────────────────────────────────────────────────
  const ctx = await browser.createBrowserContext();
  const pp = await ctx.newPage();
  await pp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await login(pp, ACHETEUR);
  await shoot(pp, '/portail', 'portail-catalogue.png', { wait: 2600 });
  await shoot(pp, '/portail/commandes', 'portail-commandes.png', { wait: 2600 });

  await browser.close();
  console.log('\n✅ Captures terminées.');
})().catch((e) => { console.error('❌', e); process.exit(1); });
