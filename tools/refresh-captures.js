/**
 * Refonte netteté/cadrage des captures du site (2026-07) — « contenu pur » :
 * sidebar + header de l'app MASQUÉS, le contenu occupe toute la largeur.
 * Recapture : ecran-dashboard, ecran-commandes (données mises en scène par la
 * période), ecran-commande-detail (NOUVEAU : modal suivi/étapes), ecran-ft.
 * Ré-encode SANS recapture (source @2x existante, downscale = net) :
 * ecran-facture, ecran-import-succes.
 * Sorties : @1x = largeur d'affichage réelle (896-900 px mesurés), puis ×2/×3/×4
 * (le ×4 ≈ 3 100-3 600 px : qualité « 4K » demandée par le client, servie par
 * srcset aux seuls écrans denses), AVIF/WebP qualité plancher relevée + légère
 * accentuation. Le budget de poids est PROPORTIONNEL à la densité (budget × d) :
 * un plafond unique écraserait la qualité des grandes déclinaisons.
 * Run : node tools/refresh-captures.js  (backend 3000 + frontend 5173 démarrés)
 *       node tools/refresh-captures.js --encode-only   (ré-encode depuis tools/raw2
 *       sans navigateur ni app : les sources ×4 déjà shootées suffisent)
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const FRONT = 'http://localhost:5173';
const RAW = path.join(__dirname, 'raw2');
const OUT = path.join(__dirname, '..', 'assets', 'img');
const CLIENT = { email: 'demo@dar-yasmine.tn', password: 'DemoVitrine2026!' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// `node tools/refresh-captures.js --only=dashboard|ft|commandes` : itération
// rapide sur un seul écran (capture + encodage), sans re-shooter les autres.
const ONLY = process.argv.includes('--only-dashboard')
  ? 'dashboard'
  : (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;
// `--encode-only` : aucune capture (ni navigateur, ni app locale) — ré-encode
// les déclinaisons depuis les sources ×4 déjà présentes dans tools/raw2.
const ENCODE_ONLY = process.argv.includes('--encode-only');
const veut = (k) => !ENCODE_ONLY && (!ONLY || ONLY === k);

// Masque la chrome de l'app (sidebar + header) : le flex .layout-body étire
// automatiquement .main-content sur toute la largeur.
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

async function waitForData(page, { needle = null, timeout = 30000 } = {}) {
  await page.waitForFunction(
    (extra) => {
      const txt = (document.querySelector('main') || document.body).innerText || '';
      if (!/\d[\d\s.,]*\s?DT/.test(txt)) return false;
      if (/Chargement|Loading/i.test(txt)) return false;
      if (extra && !txt.includes(extra)) return false;
      return true;
    },
    { timeout },
    needle
  );
  await sleep(900);
}

async function contenuPur(page) {
  await page.addStyleTag({ content: CSS_CONTENU_PUR });
  await sleep(400); // reflow + repeints (recharts se redimensionne)
}

async function clickText(page, txt, { near = null } = {}) {
  const ok = await page.evaluate(
    (t, n) => {
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
    },
    txt, near
  );
  if (!ok) throw new Error(`clickText: « ${txt} » introuvable`);
  await sleep(700);
}

async function shoot(page, file, clip = null) {
  await page.screenshot({ path: path.join(RAW, file), ...(clip ? { clip } : {}) });
  console.log(`📸 ${file}${clip ? ` (crop ${Math.round(clip.width)}×${Math.round(clip.height)})` : ''}`);
}

// ── Encodage : @1x/@2x AVIF+WebP, qualité plancher relevée, accentuation douce ──
const PLANS = {
  // name → { raw | asset, w1: largeur @1x, dens (défaut [1,2]), qual: {avif,webp} }
  // Règle de NETTETÉ PERÇUE : la fenêtre de capture doit rester PROCHE de la
  // largeur d'affichage (texte ≥ ~50 % de sa taille réelle) — c'est l'échelle du
  // texte qui fait le « clean », pas les pixels.
  // Densités : jusqu'à ×4 quand la source ×4 le permet (« captures 4K », demande
  // client 2026-07-24). ecran-ft plafonne à ×3 : sa source (crop modal) fait
  // 2 544 px — withoutEnlargement borne, inutile de déclarer ×4.
  'ecran-dashboard':       { raw: 'ecran-dashboard.png',       w1: 780, budget: 260, dens: [1, 2, 3, 4] },
  // Commandes : table + modal détail LIVRÉE ouverte par-dessus (fenêtre 1100).
  'ecran-commandes':       { raw: 'ecran-commandes.png',       w1: 900, budget: 220, dens: [1, 2, 3, 4] },
  'ecran-ft':              { raw: 'ecran-ft.png',              w1: 900, budget: 200, dens: [1, 2, 3] },
  // Facture : rendu pdf.js recadré sur l'essentiel (en-tête → NET À PAYER) —
  // texte ~40 % plus grand qu'en A4 entière ; qualité relevée (texte fin dense).
  'ecran-facture':         { raw: 'ecran-facture.png',         w1: 470, budget: 220, dens: [1, 2, 3, 4], qual: { avif: 68, webp: 84 } },
  // Import : fenêtre 1020 + crop sur la carte « Import terminé » (texte lisible).
  'ecran-import-succes':   { raw: 'ecran-import-succes.png',   w1: 900, budget: 220, dens: [1, 2, 3, 4] },
};

async function encode(input, outPath, format, width, budgetKo, qual = null) {
  let quality = qual?.[format] ?? (format === 'avif' ? 62 : 78);
  for (;;) {
    const pipe = sharp(input)
      .resize({ width, withoutEnlargement: true })
      .sharpen({ sigma: 0.7 }); // texte UI plus dense après resize
    const buf = format === 'avif'
      ? await pipe.avif({ quality, effort: 5 }).toBuffer()
      : await pipe.webp({ quality }).toBuffer();
    if (buf.length <= budgetKo * 1024 || quality <= 40) {
      fs.writeFileSync(outPath, buf);
      return { ko: Math.round(buf.length / 1024), quality };
    }
    quality -= 6;
  }
}

async function encodeAll() {
  let total = 0;
  for (const [name, p] of Object.entries(PLANS)) {
    // --only=<k> : n'encoder que les sorties de l'écran itéré
    const APPARTIENT = {
      'ecran-dashboard': 'dashboard',
      'ecran-commandes': 'commandes',
      'ecran-ft': 'ft',
      'ecran-facture': 'facture',
      'ecran-import-succes': 'import',
    };
    if (ONLY && APPARTIENT[name] !== ONLY) continue;
    const srcPath = p.raw ? path.join(RAW, p.raw) : path.join(OUT, p.asset);
    if (!fs.existsSync(srcPath)) { console.warn(`⚠️ ${name} : source absente (${srcPath})`); continue; }
    // Buffer : évite le verrou Windows quand la sortie écrase le fichier source.
    const input = fs.readFileSync(srcPath);
    const meta = await sharp(input).metadata();
    const w1 = Math.min(p.w1, meta.width);
    const pairs = (p.dens || [1, 2]).map((d) => [`@${d}x`, Math.min(w1 * d, meta.width), d]);
    for (const [suffix, w, d] of pairs) {
      for (const fmt of ['avif', 'webp']) {
        const out = path.join(OUT, `${name}${suffix}.${fmt}`);
        // budget × densité : à budget constant, les grandes déclinaisons
        // finiraient à q40 — le contraire du « 4K propre » recherché.
        const { ko, quality } = await encode(input, out, fmt, w, p.budget * d, p.qual);
        total += ko;
        console.log(`🖼  ${name}${suffix}.${fmt} — ${w}px, q${quality}, ${ko} Ko`);
      }
    }
    const m1 = await sharp(path.join(OUT, `${name}@1x.webp`)).metadata();
    console.log(`   ↳ attrs HTML : width="${m1.width}" height="${m1.height}"`);
  }
  console.log(`\n✅ Total encodé : ${total} Ko`);
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });

  if (ENCODE_ONLY) {
    console.log('— Encodage seul (sources tools/raw2, aucune capture) —');
    await encodeAll();
    return;
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--lang=fr-FR', '--force-device-scale-factor=3'],
    defaultViewport: { width: 1440, height: 950, deviceScaleFactor: 3 },
  });
  const page = await browser.newPage();
  await login(page);

  if (veut('dashboard')) {
  // 1) Dashboard — Vue d'ensemble, contenu pur. Le dashboard a un conteneur à
  // largeur max : on MESURE la largeur/hauteur réelles du contenu puis on cale la
  // fenêtre dessus → il remplit le cadre, sans bande grise à droite ni blanc en bas.
  await page.goto(`${FRONT}/client/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForData(page, { needle: '%' });
  await page.waitForFunction(() => !!document.querySelector('main svg'), { timeout: 15000 });
  await contenuPur(page);
  const dims = await page.evaluate(() => {
    const main = document.querySelector('main');
    // largeur réelle du contenu = le bloc le plus large DANS main (conteneur maxWidth)
    let w = 0;
    for (const el of main.children) w = Math.max(w, el.getBoundingClientRect().width);
    for (const el of (main.firstElementChild?.children || [])) w = Math.max(w, el.getBoundingClientRect().width);
    const cs = getComputedStyle(main);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    return { w: Math.ceil(w + padX), h: Math.ceil(main.scrollHeight) };
  });
  await page.setViewport({
    width: Math.min(Math.max(dims.w, 900), 1440),
    height: Math.min(dims.h + 4, 1500),
    deviceScaleFactor: 4, // source 4K (~4120 px de large) → déclinaisons 1x/2x/3x nettes
  });
  await sleep(1000); // reflow + recharts à la nouvelle taille
  await shoot(page, 'ecran-dashboard.png');
  } // fin dashboard

  if (veut('commandes')) {
  // 2) Commandes — UNE SEULE capture : la table (période 01→17/07, mix crédible)
  //    avec la modal du détail d'une commande LIVRÉE ouverte PAR-DESSUS (stepper
  //    3/3 accompli). Fenêtre 1100 : texte à ~50 % de sa taille dans le cadre.
  await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 4 });
  await page.goto(`${FRONT}/client/acheteurs/commandes`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForData(page, { needle: 'FA-2026' });
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

  // Ouvrir le détail d'une commande LIVRÉE (stepper 3/3) PAR-DESSUS la table.
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr')];
    const row = rows.find((r) => /FA-2026-0002/.test(r.innerText || '') && /Livrée/i.test(r.innerText || ''))
      || rows.find((r) => /Livrée/i.test(r.innerText || '') && /FA-2026/.test(r.innerText || ''));
    if (!row) throw new Error('ligne livrée introuvable');
    const eye = [...row.querySelectorAll('button')].find((b) => /👁/.test(b.textContent || '')) || row.querySelector('button');
    eye.click();
  });
  await page.waitForFunction(() => /SUIVI DE LA COMMANDE/i.test(document.body.innerText), { timeout: 15000 });
  await sleep(900);
  await shoot(page, 'ecran-commandes.png');
  await page.keyboard.press('Escape').catch(() => {});
  } // fin commandes

  if (veut('ft')) {
  // 4) Fiche technique — modal FT STOCK du Mille-feuille (coût en temps réel) :
  //    on crop la MODAL, en ×4 comme le standard dashboard (source 4K).
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 4 });
  await page.goto(`${FRONT}/client/products/valorises`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => /Mille-feuille/i.test(document.body.innerText), { timeout: 25000 });
  await sleep(600);
  await contenuPur(page);
  await clickText(page, 'Fiche tech.', { near: 'Mille-feuille' });
  await clickText(page, 'FT Stock');
  await page.waitForFunction(
    () => /COÛT EN TEMPS RÉEL/i.test(document.body.innerText) && /\d[\d.,]*\s?DT/.test(document.body.innerText),
    { timeout: 20000 }
  );
  await sleep(800);
  const ftClip = await page.evaluate(() => {
    // La carte COMPLÈTE de la modal FT (avec son en-tête) = le plus petit div
    // contenant À LA FOIS le titre (Mille-feuille / Fiche technique) et le coût
    // temps réel — pas le corps interne seul (en-tête coupé sinon).
    const els = [...document.querySelectorAll('div')].filter((e) => {
      const t = e.innerText || '';
      if (!/COÛT EN TEMPS RÉEL/i.test(t)) return false;
      if (!/Mille-feuille|Fiche technique/i.test(t)) return false;
      const r = e.getBoundingClientRect();
      return r.width >= 480 && r.width <= 1300 && r.height >= 500;
    });
    const el = els.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return ra.width * ra.height - rb.width * rb.height;
    })[0];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // Inset 2px : aucun pixel du fond assombri derrière la modal ; les coins
    // sont ré-arrondis par le cadre du site (.ecran-in overflow hidden).
    return { x: r.x + 2, y: r.y + 2, width: r.width - 4, height: Math.min(r.height - 4, 1080) };
  });
  await shoot(page, 'ecran-ft.png', ftClip);
  await page.keyboard.press('Escape').catch(() => {});
  } // fin ft

  if (veut('import')) {
  // 5) Ajout dynamique — VRAI import du fichier tools/import-demo.xlsx (6 articles,
  //    4 catégories, 1 famille inédits) puis capture de l'état « Import terminé ».
  //    ⚠️ Mutation du compte démo : lancer ensuite le nettoyage SQL (voir sortie).
  // Fenêtre 1020 (texte lisible dans le cadre) + crop sur la CARTE « Import
  // terminé » (compteurs + table) : c'est elle le message, pas le mode d'emploi.
  await page.setViewport({ width: 1020, height: 1500, deviceScaleFactor: 4 });
  await page.goto(`${FRONT}/client/referentiel/import`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('input[type="file"]', { timeout: 20000 });
  await contenuPur(page);
  const fileInput = await page.$('input[type="file"]');
  await fileInput.uploadFile(path.join(__dirname, 'import-demo.xlsx'));
  await sleep(600);
  await clickText(page, "Lancer l'import");
  await page.waitForFunction(() => /Import terminé/i.test(document.body.innerText), { timeout: 30000 });
  await sleep(900);
  const importClip = await page.evaluate(() => {
    // La carte résultat = le plus petit bloc contenant le bandeau ET la table.
    const els = [...document.querySelectorAll('div, section')].filter((e) => {
      const t = e.innerText || '';
      if (!/Import terminé/i.test(t) || !/LIGNE|ARTICLE/i.test(t)) return false;
      const r = e.getBoundingClientRect();
      return r.width >= 700 && r.height >= 400;
    });
    const el = els.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return ra.width * ra.height - rb.width * rb.height;
    })[0];
    if (!el) return null;
    el.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -10);
    const r = el.getBoundingClientRect();
    return { x: Math.max(0, r.x - 6), y: Math.max(0, r.y + window.scrollY - 6), width: r.width + 12, height: r.height + 12 };
  });
  await shoot(page, 'ecran-import-succes.png', importClip);
  console.log('⚠️ Nettoyage démo requis : supprimer les 6 articles, 4 catégories, 1 famille créés par import-demo.xlsx');
  } // fin import

  if (veut('facture')) {
  // 6) Facture — rendu HAUTE RÉSOLUTION de la vraie facture PDF via pdf.js
  //    (page 1 complète, ~2500 px de large), depuis le serveur du site (8322).
  await page.setViewport({ width: 2600, height: 3700, deviceScaleFactor: 1 });
  await page.goto('http://localhost:8322/merci.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js' });
  await page.evaluate(async () => {
    document.body.innerHTML = '<canvas id="pdfcv" style="display:block"></canvas>';
    document.body.style.margin = '0';
    const lib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
    lib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const doc = await lib.getDocument('/assets/files/facture-acheteur-exemple.pdf').promise;
    const p1 = await doc.getPage(1);
    const vp = p1.getViewport({ scale: 4.2 }); // A4 595pt → ~2500 px de large
    const cv = document.getElementById('pdfcv');
    cv.width = Math.ceil(vp.width);
    cv.height = Math.ceil(vp.height);
    await p1.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
  });
  await sleep(400);
  const cvRect = await page.evaluate(() => {
    const r = document.getElementById('pdfcv').getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  // Recadrage sur l'essentiel (en-tête → NET À PAYER, ~62 % de la page) :
  // texte ~40 % plus grand dans le cadre qu'en A4 entière.
  cvRect.height = Math.round(cvRect.height * 0.62);
  await shoot(page, 'ecran-facture.png', cvRect);
  } // fin facture

  await browser.close();

  console.log('\n— Encodage —');
  await encodeAll();
})().catch((e) => { console.error('❌', e); process.exit(1); });
