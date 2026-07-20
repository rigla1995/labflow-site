/**
 * Tournage de la vidéo de démonstration LabFlow (60 s).
 *
 * Produit des séquences MP4 dans tools/video/seq/, à assembler ensuite par
 * `node tools/video/monter.js`.
 *
 * Deux natures de plans :
 *   • CARTONS  — page HTML locale (tools/video/cartons.html), plan fixe
 *   • ÉCRANS   — vrais écrans de l'application, filmés en screencast CDP
 *
 * Prérequis : backend 3000 + frontend 5173 démarrés, seed « Dar Yasmine ».
 * ⚠️ Aucune commande n'est envoyée pendant le tournage (on remplit le panier,
 *    on ne valide jamais) : la base de démonstration reste intacte.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const ffmpeg = require('ffmpeg-static');

const FRONT = 'http://localhost:5173';
const CARTONS = 'file:///' + path.join(__dirname, 'cartons.html').replace(/\\/g, '/');
const EXCEL = (f) => 'file:///' + path.join(__dirname, 'excel', f + '.html').replace(/\\/g, '/');
const LABO_ID = 55; // Cuisine centrale Dar Yasmine (seed)
const SEQ = path.join(__dirname, 'seq');
const W = 1440, H = 810, FPS = 30;

const CLIENT = { email: 'demo@dar-yasmine.tn', password: 'DemoVitrine2026!' };
const ACHETEUR = { email: 'm.khelil.prof+acheteur1@gmail.com', password: 'Portail2026!' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Enregistre la page pendant que `scenario` se déroule, et encode en MP4. */
async function filmer(page, nom, dureeMs, scenario) {
  const client = await page.createCDPSession();
  const frames = [];
  client.on('Page.screencastFrame', async (f) => {
    frames.push({ data: Buffer.from(f.data, 'base64'), t: f.metadata.timestamp });
    try { await client.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) { /* frame tardive */ }
  });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  const t0 = Date.now();
  if (scenario) await scenario();
  const reste = dureeMs - (Date.now() - t0);
  if (reste > 0) await sleep(reste);
  await client.send('Page.stopScreencast');
  await sleep(150);

  // Les frames arrivent à cadence variable (une par repaint) : on rééchantillonne
  // à FPS constant en reprenant la dernière frame connue à chaque pas de temps.
  const dir = path.join(SEQ, 'tmp-' + nom);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const total = Math.round((dureeMs / 1000) * FPS);
  const base = frames.length ? frames[0].t : 0;
  let idx = 0;
  for (let i = 0; i < total; i++) {
    const t = base + i / FPS;
    while (idx + 1 < frames.length && frames[idx + 1].t <= t) idx++;
    fs.writeFileSync(path.join(dir, `f${String(i).padStart(5, '0')}.jpg`), frames[Math.min(idx, frames.length - 1)].data);
  }
  await encoder(dir, path.join(SEQ, nom + '.mp4'));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`🎬 ${nom} — ${(dureeMs / 1000).toFixed(1)} s (${frames.length} frames brutes → ${total})`);
}

const encoder = (dir, out) => new Promise((res, rej) => {
  const p = spawn(ffmpeg, [
    '-y', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-vf', `scale=${W}:${H}`, out,
  ], { stdio: 'ignore' });
  p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
});

// ⚠️ Dans l'application, ce n'est PAS la fenêtre qui défile mais un conteneur
// interne (`main.main-content`) : window.scrollTo n'y a aucun effet. On repère
// donc le vrai élément scrollable une fois pour toutes.
const SCROLLEUR = `(() => {
  const c = [...document.querySelectorAll('main, div')]
    .filter(e => e.scrollHeight > e.clientHeight + 40 && ['auto','scroll'].includes(getComputedStyle(e).overflowY));
  return c.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || null;
})()`;

const positionScroll = (page) => page.evaluate(`(() => { const el = ${SCROLLEUR}; return el ? el.scrollTop : window.scrollY; })()`);

/** Défilement fluide, piloté image par image (pas de scroll-behavior CSS). */
async function defiler(page, deTop, aTop, ms) {
  const pas = Math.round((ms / 1000) * FPS);
  for (let i = 0; i <= pas; i++) {
    const p = i / pas;
    // ease-in-out : départ et arrivée en douceur
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const y = Math.round(deTop + (aTop - deTop) * e);
    await page.evaluate(`(() => { const el = ${SCROLLEUR}; if (el) el.scrollTop = ${y}; else window.scrollTo(0, ${y}); })()`);
    await sleep(1000 / FPS);
  }
}

/** Amène un élément en haut du conteneur scrollable, sans animation. */
async function cadrer(page, selecteurJs, marge = 110) {
  await page.evaluate(`(() => {
    const cible = ${selecteurJs};
    const el = ${SCROLLEUR};
    if (!cible) return;
    if (el) el.scrollTop = el.scrollTop + cible.getBoundingClientRect().top - el.getBoundingClientRect().top - ${marge};
    else window.scrollTo(0, cible.getBoundingClientRect().top + window.scrollY - ${marge});
  })()`);
}

async function login(page, creds) {
  await page.goto(`${FRONT}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.type('input[type="email"]', creds.email, { delay: 8 });
  await page.type('input[type="password"]', creds.password, { delay: 8 });
  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {}),
  ]);
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 20000 });
  await sleep(1200);
}

/** Attend que des montants en DT soient peints (jamais networkidle : la SSE ne finit pas). */
async function attendreDonnees(page, needle) {
  await page.waitForFunction((n) => {
    const t = (document.querySelector('main') || document.body).innerText || '';
    if (/Chargement|Loading/i.test(t)) return false;
    return n ? t.includes(n) : /\d[\d\s.,]*\s?DT/.test(t);
  }, { timeout: 30000 }, needle);
  await sleep(900);
}

// `node tools/video/tourner.js 06-stock` ne retourne que ce plan (les autres
// séquences déjà présentes sont conservées).
const CIBLE = process.argv[2] || null;
const aTourner = (nom) => !CIBLE || nom.includes(CIBLE);

(async () => {
  if (!CIBLE) fs.rmSync(SEQ, { recursive: true, force: true });
  fs.mkdirSync(SEQ, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--lang=fr-FR', `--window-size=${W},${H}`, '--hide-scrollbars'],
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  });

  // ── CARTONS ────────────────────────────────────────────────────────────────
  const plansCartonTous = [
    ['01-ouverture', 'c1', 4500],
    ['03-probleme', 'c2', 6000],
    ['05-principe', 'c3', 5500],
    ['07-transferts-intro', 'c4', 4000],   // ex-« Le système », devenu Transferts
    ['11-portail-intro', 'c5', 3500],
    ['13-produits-intro', 'c8', 4000],
    ['18-cloture', 'c6', 5500],
  ].filter(([n]) => aTourner(n));

  const carton = await browser.newPage();
  await carton.setViewport({ width: W, height: H });
  await carton.goto(CARTONS, { waitUntil: 'networkidle0' });
  await carton.evaluate(() => document.fonts.ready);
  await sleep(600);

  for (const [nom, id, duree] of plansCartonTous) {
    await carton.evaluate((i) => window.montrer(i), id);
    await sleep(400);
    await filmer(carton, nom, duree);
  }
  await carton.close();

  // ── ÉCRANS CÔTÉ VENDEUR ────────────────────────────────────────────────────
  const app = await browser.newPage();
  await app.setViewport({ width: W, height: H });
  await login(app, CLIENT);

  // Tableau de bord : on descend doucement sur les KPI puis le graphique
  if (aTourner('02-dashboard')) {
  await app.goto(`${FRONT}/client/dashboard`, { waitUntil: 'domcontentloaded' });
  await attendreDonnees(app, '%');
  const yDash = await positionScroll(app);
  await filmer(app, '02-dashboard', 6000, async () => {
    await sleep(1200);
    await defiler(app, yDash, yDash + 400, 3000);
    await sleep(1500);
  }); }

  // Stock valorisé : on ouvre la catégorie AVANT de filmer, et on démarre le plan
  // directement sur la table (les montants en DT sont le sujet, pas les filtres).
  if (aTourner('06-stock')) {
    await app.goto(`${FRONT}/client/stock`, { waitUntil: 'domcontentloaded' });
    await app.waitForFunction(() => /ÉPICERIE/i.test(document.body.innerText), { timeout: 25000 });
    await app.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /ÉPICERIE/i.test(x.textContent || ''));
      if (b) b.click();
    });
    await attendreDonnees(app);
    // On démarre EN HAUT de l'écran (titre + filtres) et on descend jusqu'aux
    // montants : le spectateur comprend où il est avant de voir les chiffres.
    await app.evaluate(`(() => { const el = ${SCROLLEUR}; if (el) el.scrollTop = 0; else window.scrollTo(0, 0); })()`);
    await sleep(700);
    await filmer(app, '06-stock', 7000, async () => {
      await sleep(1600);
      await defiler(app, 0, 700, 3600);
      await sleep(1500);
    });
  }

  // Produits vendables / transformés : le catalogue de production, avant d'ouvrir
  // une fiche technique. On part du haut de l'écran et on descend sur les cartes.
  if (aTourner('13b-produits')) {
    await app.goto(`${FRONT}/client/products`, { waitUntil: 'domcontentloaded' });
    await app.waitForFunction(() => /Produits|Vendable/i.test(document.body.innerText), { timeout: 25000 });
    await sleep(1800);
    await app.evaluate(`(() => { const el = ${SCROLLEUR}; if (el) el.scrollTop = 0; else window.scrollTo(0, 0); })()`);
    await sleep(600);
    await filmer(app, '13b-produits', 6500, async () => {
      await sleep(1700);
      await defiler(app, 0, 620, 3200);
      await sleep(1400);
    });
  }

  // Fiche technique du mille-feuille : l'arbre de recette + le coût en temps réel
  await app.goto(`${FRONT}/client/products/valorises`, { waitUntil: 'domcontentloaded' });
  await app.waitForFunction(() => /Mille-feuille/.test(document.body.innerText), { timeout: 25000 });
  await sleep(900);
  await app.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter((e) => /Fiche tech/i.test(e.textContent || ''));
    const cible = btns.find((e) => {
      let p = e;
      for (let i = 0; i < 9 && p; i++) { p = p.parentElement; if (p && /Mille-feuille/.test(p.innerText || '') && (p.innerText || '').length < 800) return true; }
      return false;
    }) || btns[0];
    cible.click();
  });
  await sleep(900);
  await filmer(app, '08-fiche-technique', 7500, async () => {
    await sleep(1500);
    // on bascule sur FT Stock : le coût de revient s'affiche en temps réel
    await app.evaluate(() => {
      const els = [...document.querySelectorAll('div,span,h3,h4')].filter((e) => /FT Stock/.test(e.textContent || '') && (e.textContent || '').length < 90);
      els.sort((a, b) => a.textContent.length - b.textContent.length);
      if (els[0]) els[0].click();
    });
    await sleep(1600);
    // … puis on descend DANS la modal pour révéler « COÛT EN TEMPS RÉEL » :
    // c'est le chiffre que la séquence doit montrer.
    await app.evaluate(() => {
      const cible = [...document.querySelectorAll('*')].find((e) => /COÛT EN TEMPS RÉEL/i.test(e.textContent || '') && (e.textContent || '').length < 200);
      if (cible) cible.scrollIntoView({ block: 'center' });
    });
    await sleep(3400);
  });

  // Production : les lignes AUTO qui déduisent les ingrédients
  await app.goto(`${FRONT}/client/labo/historique-appro?laboId=55`, { waitUntil: 'domcontentloaded' });
  await app.waitForFunction(() => /Rechercher/.test(document.body.innerText), { timeout: 25000 });
  await app.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Rechercher/i.test(x.textContent || ''));
    if (b) b.click();
  });
  await app.waitForFunction(() => /AUTO/.test(document.body.innerText), { timeout: 25000 });
  await sleep(700);
  await cadrer(app, `[...document.querySelectorAll('main table')].find(x => /AUTO/.test(x.innerText || ''))`);
  await sleep(600);
  const yProd = await positionScroll(app);
  await filmer(app, '09-production', 5000, async () => {
    await sleep(900);
    await defiler(app, yProd, yProd + 420, 2600);
    await sleep(1300);
  });

  // Transferts labo → points de vente : on montre D'ABORD la barre de filtres
  // (période, activité, article…) puis le résultat filtré. C'est le point que
  // le client veut voir : on ne subit pas la liste, on l'interroge.
  if (aTourner('15-transferts')) {
    await app.goto(`${FRONT}/client/labo/historique-transferts?laboId=${LABO_ID}`, { waitUntil: 'domcontentloaded' });
    await app.waitForFunction(() => /Rechercher|Filtres|Exporter/i.test(document.body.innerText), { timeout: 25000 });
    await sleep(900);
    await app.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /Rechercher/i.test(x.textContent || ''));
      if (b) b.click();
    });
    // ⚠️ attendre les DONNÉES, pas un délai : sinon on filme « Chargement… »
    await attendreDonnees(app);
    // Départ en haut : titre, puis la barre de filtres, puis les lignes valorisées
    await app.evaluate(`(() => { const el = ${SCROLLEUR}; if (el) el.scrollTop = 0; else window.scrollTo(0, 0); })()`);
    await sleep(600);
    await filmer(app, '15-transferts', 7500, async () => {
      await sleep(2600);                       // on laisse lire la barre de filtres
      await defiler(app, 0, 560, 3000);        // puis on descend sur les lignes valorisées
      await sleep(1500);
    });
  }

  // Commandes B2B + facture fiscale avec timbre
  await app.goto(`${FRONT}/client/acheteurs/commandes`, { waitUntil: 'domcontentloaded' });
  await attendreDonnees(app, 'FA-2026');
  await filmer(app, '10-commandes', 5500, async () => {
    await sleep(1100);
    await app.evaluate(() => {
      const row = [...document.querySelectorAll('tr')].find((r) => /FA-2026-0004/.test(r.innerText || ''));
      const eye = row && ([...row.querySelectorAll('button')].find((b) => /👁/.test(b.textContent || '')) || row.querySelector('button'));
      if (eye) eye.click();
    });
    await sleep(1200);
    await app.evaluate(() => {
      const el = [...document.querySelectorAll('*')].find((e) => /SUIVI DE LA COMMANDE/i.test(e.innerText || '') && (e.innerText || '').length < 400);
      if (el) el.scrollIntoView({ block: 'center' });
    });
    await sleep(2000);
  });
  await app.close();

  // ── PORTAIL ACHETEUR ───────────────────────────────────────────────────────
  const ctx = await browser.createBrowserContext();
  const portail = await ctx.newPage();
  await portail.setViewport({ width: W, height: H });
  await login(portail, ACHETEUR);
  await portail.goto(`${FRONT}/portail`, { waitUntil: 'domcontentloaded' });
  await attendreDonnees(portail);
  await filmer(portail, '12-portail', 7000, async () => {
    await sleep(1100);
    await defiler(portail, 0, 260, 1600);
    // un tap sur « Reprendre » : la quantité se remplit et le panier apparaît
    await portail.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /Reprendre/.test(x.textContent || ''));
      if (b) { b.scrollIntoView({ block: 'center' }); b.click(); }
    });
    await sleep(2600);
    await defiler(portail, 260, 430, 1000);
    await sleep(700);
  });
  // ⚠️ la commande n'est PAS envoyée — la base de démonstration reste intacte
  await portail.close();

  // ── LES EXPORTS EXCEL ──────────────────────────────────────────────────────
  // Un navigateur n'ouvre pas un .xlsx : on relit les VRAIS fichiers exportés par
  // l'application (cf. excel-en-html.js) et on filme leur contenu, à l'identique.
  const xls = await browser.newPage();
  await xls.setViewport({ width: W, height: H });
  const exports = [
    ['16-excel-fiche', 'fiche-technique-exemple', 5500],
    ['17-excel-transferts', 'export-transferts-exemple', 6000],
    ['17b-excel-appro', 'export-excel-exemple', 5500],
  ].filter(([n]) => aTourner(n));
  for (const [nom, fichier, duree] of exports) {
    await xls.goto(EXCEL(fichier), { waitUntil: 'networkidle0' });
    await sleep(500);
    await filmer(xls, nom, duree, async () => {
      await sleep(1500);
      // léger défilement dans le tableau : on montre qu'il y a de la matière
      await xls.evaluate(() => window.scrollTo({ top: 0 }));
      const h = await xls.evaluate(() => Math.max(0, document.body.scrollHeight - window.innerHeight));
      if (h > 20) await defiler(xls, 0, Math.min(h, 180), 1600);
      await sleep(900);
    });
  }
  await xls.close();

  await browser.close();
  const liste = fs.readdirSync(SEQ).filter((f) => f.endsWith('.mp4')).sort();
  console.log(`\n✅ ${liste.length} séquences dans tools/video/seq/ :`);
  liste.forEach((f) => console.log('   ' + f + ' — ' + Math.round(fs.statSync(path.join(SEQ, f)).size / 1024) + ' Ko'));
  console.log('\n→ Assembler : node tools/video/monter.js');
})().catch((e) => { console.error('❌', e); process.exit(1); });
