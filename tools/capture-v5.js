/**
 * Captures V5 (19/10/2026) : les onze écrans réels qui remplacent les compositions
 * schématiques des maquettes (plan V5 §4, véracité §8).
 *
 * Prérequis (base LOCALE, données fictives) :
 *   - backend de test sur 3000, LabFlow sur 5176, LabFlow Compta sur 5174 ;
 *   - compte démo Dar Yasmine (seed-demo-vitrine) + 2 clients B2C ajoutés ;
 *   - compte de test « Le Patio des Oliviers » (scripts/seed-comptes-test.js, SEED_FIN=2026-10-19)
 *     avec le fournisseur « Primeurs Trabelsi » (matricule de la facture fictive forfait-1) ;
 *   - cabinet d'essai (labflow-reprise/achats-compta/outils/comptes-essai-s4c.js).
 *   Les identifiants sont lus dans un carnet local HORS dépôt (variable CARNET, JSON :
 *   { PATIO:{email,password,dossier}, DAR:{…}, ACHETEUR:{…}, CABINET:{…} }) — jamais écrits ici.
 *
 * Run : CARNET=<chemin.json> node tools/capture-v5.js [--only=<cle>] [--encode-only]
 *   → PNG bruts dans tools/raw2/, déclinaisons @1x..@3x AVIF+WebP dans assets/img/.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const FRONT = 'http://localhost:5176';
const COMPTA = 'http://localhost:5174';
const RAW = path.join(__dirname, 'raw2');
const OUT = path.join(__dirname, '..', 'assets', 'img');
const PDF = 'C:/Users/CHAHDONj/labflow-reprise/achats-compta/factures-exemples/fictives/pdf/forfait-1.pdf';
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;
const ENCODE_ONLY = process.argv.includes('--encode-only');
const veut = (k) => !ENCODE_ONLY && (!ONLY || ONLY === k);
const J = ENCODE_ONLY ? {} : JSON.parse(fs.readFileSync(process.env.CARNET, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CSS_CONTENU_PUR = `.sidebar, .header, .sidebar-overlay { display: none !important; } .main-content { max-width: none !important; }`;

async function login(page, base, creds) {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', creds.email, { delay: 5 });
  await page.type('input[type="password"]', creds.password, { delay: 5 });
  await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})]);
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 15000 });
  await sleep(600);
}
/** Repart d'une session vierge : cookies et stockage des deux applications (sur leur origine, sinon SecurityError). */
async function purger(page) {
  await page.deleteCookie(...(await page.cookies()));
  for (const base of [FRONT, COMPTA]) {
    await page.goto(base + '/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  }
}
async function attendreTexte(page, re, timeout = 30000) {
  try { await page.waitForFunction((src, flags) => new RegExp(src, flags).test(document.body.innerText) && !/Chargement…|Chargement en cours/i.test(document.body.innerText), { timeout }, re.source, re.flags); }
  catch (e) { const t = await page.evaluate(() => location.href + ' :: ' + document.body.innerText.slice(0, 900)); throw new Error('attente « ' + re.source + ' » dépassée — page : ' + t); }
  await sleep(700);
}
/** Plus petit élément (par aire) dont le texte contient TOUS les motifs, largeur ≥ wMin. */
async function cadre(page, motifs, { wMin = 600, hMin = 120, hMax = 1100, marge = 0, tags = 'div, section, article, table, form' } = {}) {
  const r = await page.evaluate((motifs, wMin, hMin, tags) => {
    const els = [...document.querySelectorAll(tags)].filter((e) => {
      const t = e.innerText || '';
      if (!motifs.every((m) => t.includes(m))) return false;
      const b = e.getBoundingClientRect();
      return b.width >= wMin && b.height >= hMin;
    });
    els.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.width * ra.height - rb.width * rb.height; });
    const el = els[0]; if (!el) return null;
    el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -8);
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y + window.scrollY, width: b.width, height: b.height };
  }, motifs, wMin, hMin, tags);
  if (!r) throw new Error(`cadre introuvable : ${motifs.join(' + ')}`);
  return { x: Math.max(0, r.x - marge), y: Math.max(0, r.y - marge), width: r.width + 2 * marge, height: Math.min(r.height + 2 * marge, hMax) };
}
async function shoot(page, file, clip = null) {
  await page.screenshot({ path: path.join(RAW, file), ...(clip ? { clip } : {}) });
  console.log(`📸 ${file}${clip ? ` (${Math.round(clip.width)}×${Math.round(clip.height)})` : ''}`);
}
async function clickTexte(page, txt) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('button, a, [role="button"], summary')].find((e) => (e.innerText || '').trim().includes(t));
    if (!el) return false; el.click(); return true;
  }, txt);
  if (!ok) throw new Error(`bouton introuvable : ${txt}`);
  await sleep(800);
}

// ── Encodage (même règle que refresh-captures.js : budget × densité, netteté douce) ──
const PLANS = {
  'ecran-verifier-facture':  { w1: 1000, budget: 240 },
  'ecran-depot-facture':     { w1: 900, budget: 200 },
  'ecran-facture-entete':    { w1: 900, budget: 200 },
  'ecran-ecriture-achat':    { w1: 900, budget: 220 },
  'ecran-plan-comptes':      { w1: 900, budget: 220 },
  'ecran-bilan':             { w1: 1000, budget: 240 },
  'ecran-etat-resultat':     { w1: 900, budget: 220 },
  'ecran-cabinet-dossiers':  { w1: 900, budget: 220 },
  'ecran-carnet-clients':    { w1: 900, budget: 220 },
  'ecran-portail-commande':  { w1: 900, budget: 220 },
  'ecran-dashboard-filtres': { w1: 900, budget: 220 },
};
async function encode(input, outPath, format, width, budgetKo) {
  let quality = format === 'avif' ? 62 : 78;
  for (;;) {
    const pipe = sharp(input).resize({ width, withoutEnlargement: true }).sharpen({ sigma: 0.7 });
    const buf = format === 'avif' ? await pipe.avif({ quality, effort: 5 }).toBuffer() : await pipe.webp({ quality }).toBuffer();
    if (buf.length <= budgetKo * 1024 || quality <= 40) { fs.writeFileSync(outPath, buf); return { ko: Math.round(buf.length / 1024), quality }; }
    quality -= 6;
  }
}
async function encodeAll() {
  for (const [name, p] of Object.entries(PLANS)) {
    if (ONLY && ONLY !== name.replace('ecran-', '')) continue;
    const src = path.join(RAW, `${name}.png`);
    if (!fs.existsSync(src)) { console.warn(`⚠️ ${name} : source absente`); continue; }
    const input = fs.readFileSync(src);
    const meta = await sharp(input).metadata();
    const w1 = Math.min(p.w1, meta.width);
    for (const d of [1, 2, 3]) {
      const w = Math.min(w1 * d, meta.width);
      if (d > 1 && w === Math.min(w1 * (d - 1), meta.width)) break; // source trop petite : pas de déclinaison vide
      for (const fmt of ['avif', 'webp']) {
        const { ko, quality } = await encode(input, path.join(OUT, `${name}@${d}x.${fmt}`), fmt, w, p.budget * d);
        console.log(`🖼  ${name}@${d}x.${fmt} — ${w}px, q${quality}, ${ko} Ko`);
      }
    }
  }
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });
  if (!ENCODE_ONLY) {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--lang=fr-FR'], defaultViewport: { width: 1200, height: 1000, deviceScaleFactor: 3 } });
    const page = await browser.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));

    // ══ A · Le Patio : dépôt, en-tête lu, fenêtre « Vérifier la facture » ══
    if (veut('depot-facture') || veut('facture-entete') || veut('verifier-facture')) {
      await login(page, FRONT, J.PATIO);
      await page.setViewport({ width: 860, height: 1100, deviceScaleFactor: 3 });
      await page.goto(`${FRONT}/client/stock`, { waitUntil: 'domcontentloaded' });
      await attendreTexte(page, /Facture du fournisseur/);
      await page.addStyleTag({ content: CSS_CONTENU_PUR }); await sleep(500);
      const fi = await page.$('input[type="file"]');
      await fi.uploadFile(PDF);
      await attendreTexte(page, /LU SUR LA FACTURE/, 40000);
      await sleep(1200);
      // dépôt : le bloc d'appro avec la pièce déposée ET le panneau « lu sur la facture » (composition haute, lisible)
      if (veut('depot-facture')) await shoot(page, 'ecran-depot-facture.png', await cadre(page, ['APPROVISIONNEMENT', 'LU SUR LA FACTURE'], { wMin: 500, hMax: 1000, marge: 6 }));
      if (veut('verifier-facture') || veut('facture-entete')) {
        await page.setViewport({ width: 1600, height: 1080, deviceScaleFactor: 3 }); await sleep(600);
        await clickTexte(page, 'Vérifier la facture et enregistrer');
        await attendreTexte(page, /Tomates/, 20000);
        await sleep(1800); // rendu de la pièce (pdf.js)
        // la fenêtre s'ouvre parfois défilée : tout remonter en haut avant la prise
        await page.evaluate(() => { document.querySelectorAll('*').forEach((e) => { if (e.scrollTop > 0) e.scrollTop = 0; }); window.scrollTo(0, 0); });
        await sleep(500);
        // le panneau de la fenêtre = le plus grand enfant de .modal-overlay (pièce à gauche, lignes à droite, pied d'action)
        const clip = await page.evaluate(() => {
          const ov = document.querySelector('.modal-overlay'); if (!ov) return null;
          const el = [...ov.children].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
          const b = el.getBoundingClientRect();
          return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.min(b.width, 1600 - Math.max(0, b.x)), height: Math.min(b.height, 1080 - Math.max(0, b.y)) };
        });
        if (!clip) throw new Error('fenêtre Vérifier la facture introuvable');
        if (veut('verifier-facture')) await shoot(page, 'ecran-verifier-facture.png', clip);
        // en-tête lu : le haut de la fenêtre (fournisseur reconnu, n°, date, premières lignes proposées)
        if (veut('facture-entete')) await shoot(page, 'ecran-facture-entete.png', { ...clip, height: Math.min(clip.height, 560) });
        await page.keyboard.press('Escape').catch(() => {});
      }
    }

    // ══ B · LabFlow Compta (Le Patio) : plan de comptes, écriture du pont, bilan, état de résultat ══
    if (veut('plan-comptes') || veut('ecriture-achat') || veut('bilan') || veut('etat-resultat')) {
      const D = J.PATIO.dossier;
      await page.setViewport({ width: 1200, height: 1000, deviceScaleFactor: 3 });
      await login(page, COMPTA, J.PATIO);
      if (veut('plan-comptes')) {
        await page.goto(`${COMPTA}/dossiers/${D}/plan`, { waitUntil: 'domcontentloaded' });
        await attendreTexte(page, /Classe 4/);
        await page.evaluate(() => { const l = [...document.querySelectorAll('button, summary, [role="button"], div, h3, h4')].filter((e) => /^▸?\s*Classe 4/.test((e.innerText || '').trim()) && (e.innerText || '').length < 80); (l[l.length - 1] || l[0])?.click(); });
        await attendreTexte(page, /Fournisseurs/);
        await shoot(page, 'ecran-plan-comptes.png', await cadre(page, ['Plan de comptes', 'Fournisseurs'], { wMin: 700, hMax: 950, tags: 'main' }));
      }
      if (veut('ecriture-achat')) {
        await page.goto(`${COMPTA}/dossiers/${D}/ecritures?etat=brouillard`, { waitUntil: 'domcontentloaded' });
        await attendreTexte(page, /B-0000\d\d/);
        // déplier la première écriture du pont (Facture … — fournisseur)
        // déplier la première ligne : le bouton ▸ (ou le premier bouton) de la ligne B-0000xx, sinon la ligne elle-même
        await page.evaluate(() => {
          const lignes = [...document.querySelectorAll('div, tr, li')].filter((e) => /B-0000\d\d/.test(e.innerText || '') && (e.innerText || '').length < 300);
          lignes.sort((a, b) => a.innerText.length - b.innerText.length);
          const ligne = lignes[0]; if (!ligne) return;
          const bouton = [...ligne.querySelectorAll('button, [role="button"], svg, span')].find((b) => /^[▸▾►▼]?$/.test((b.innerText || '').trim()) && b.getBoundingClientRect().width < 40) || ligne.querySelector('button');
          (bouton || ligne).click();
        });
        await page.waitForFunction(() => /D[ée]bit/i.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
        await sleep(1200);
        await shoot(page, 'ecran-ecriture-achat.png', await cadre(page, ['B-0000', 'Débit'], { wMin: 700, hMax: 900, marge: 4 }).catch(() => cadre(page, ['écritures en brouillard'], { wMin: 700, hMax: 900, tags: 'main' })));
      }
      if (veut('bilan') || veut('etat-resultat')) {
        await page.goto(`${COMPTA}/dossiers/${D}/etats`, { waitUntil: 'domcontentloaded' });
        await attendreTexte(page, /Total des actifs/);
        if (veut('bilan')) await shoot(page, 'ecran-bilan.png', await cadre(page, ['Bilan', 'Total des actifs', 'Total des capitaux propres et des passifs'], { wMin: 700, hMax: 1100, marge: 4 }));
        if (veut('etat-resultat')) await shoot(page, 'ecran-etat-resultat.png', await cadre(page, ['État de résultat', 'Résultat net de l\'exercice'], { wMin: 700, hMax: 1000, marge: 4 }));
      }
    }

    // ══ C · Cabinet d'essai : mes dossiers ══
    if (veut('cabinet-dossiers')) {
      await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 3 });
      await purger(page);
      await login(page, COMPTA, J.CABINET);
      await sleep(2500); // laisser l'application charger ses accès avant de changer de page (sinon « Chargement… » sans fin)
      await page.goto(`${COMPTA}/dossiers`, { waitUntil: 'domcontentloaded' });
      try { await attendreTexte(page, /Boulangerie Ben Ali/, 12000); }
      catch { await page.reload({ waitUntil: 'domcontentloaded' }); await attendreTexte(page, /Boulangerie Ben Ali/, 20000); }
      await shoot(page, 'ecran-cabinet-dossiers.png', await cadre(page, ['Boulangerie Ben Ali', 'Menuiserie Sfaxienne'], { wMin: 700, hMax: 800, marge: 4 }));
    }

    // ══ D · Dar Yasmine : carnet des clients (B2B + B2C) ══
    if (veut('carnet-clients')) {
      await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 3 });
      await purger(page);
      await login(page, FRONT, J.DAR);
      await page.goto(`${FRONT}/client/acheteurs`, { waitUntil: 'domcontentloaded' });
      await attendreTexte(page, /Mme Ben Salah/);
      // Les quatre acheteurs pros du compte démo portent des alias d'une boîte réelle (compte portail : l'e-mail
      // n'est pas modifiable par l'API) : on les anonymise à l'affichage, le reste de l'écran est inchangé.
      await page.evaluate(() => {
        const FICTIFS = { 1: 'achats@cafe-el-medina.example', 2: 'achats@hotel-dar-el-bhar.example', 3: 'achats@comptoir-carthage.example', 4: 'achats@legrandbleu.example' };
        const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
        let n; while ((n = it.nextNode())) { n.nodeValue = n.nodeValue.replace(/m\.khelil\.prof\+acheteur(\d)@gmail\.com/g, (_, i) => FICTIFS[i] || `achats@client-${i}.example`); }
      });
      await page.addStyleTag({ content: CSS_CONTENU_PUR }); await sleep(500);
      await shoot(page, 'ecran-carnet-clients.png', await cadre(page, ['Karim Jelassi', 'Mme Ben Salah'], { wMin: 700, hMax: 800, marge: 4 }));
    }

    // ══ E · Portail acheteur : catalogue et commande ══
    if (veut('portail-commande')) {
      await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 3 });
      await purger(page);
      await login(page, FRONT, J.ACHETEUR);
      await page.goto(`${FRONT}/portail`, { waitUntil: 'domcontentloaded' });
      await attendreTexte(page, /\d[\d\s.,]*\s?DT/);
      await sleep(800);
      await shoot(page, 'ecran-portail-commande.png', await cadre(page, ['DT'], { wMin: 800, hMax: 820, tags: 'main' }));
    }

    await browser.close();
  }

  // ══ F · Tableau de bord : onglets + filtres + tuiles (recadrage de la source 4K existante) ══
  if (veut('dashboard-filtres')) {
    const src = path.join(RAW, 'ecran-dashboard.png');
    const m = await sharp(src).metadata();
    await sharp(src).extract({ left: 0, top: 0, width: m.width, height: Math.round(m.height * 0.42) }).toFile(path.join(RAW, 'ecran-dashboard-filtres.png'));
    console.log('📸 ecran-dashboard-filtres.png (recadrage haut du tableau de bord)');
  }

  console.log('\n— Encodage —');
  await encodeAll();
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
