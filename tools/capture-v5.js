/**
 * Captures V5 (19/10/2026) : les onze écrans réels qui remplacent les compositions
 * schématiques des maquettes (plan V5 §4, véracité §8).
 *
 * Netteté (règle héritée de refresh-captures.js, « captures 4K » demandées par le client) :
 *   - source à densité 4 (deviceScaleFactor 4) → déclinaisons @1x…@4x AVIF + WebP ;
 *   - la fenêtre de capture reste PROCHE de la largeur d'affichage (texte ≥ ~65 % de sa
 *     taille réelle) : ~860 px pour un visuel de colonne (affiché ~600 px), ~1300 px pour
 *     un visuel pleine largeur (affiché ~1000 px). C'est l'échelle du texte qui fait le net.
 *
 * Prérequis (base LOCALE, données fictives) :
 *   - backend de test sur 3000, LabFlow sur 5176, LabFlow Compta sur 5174 ;
 *   - compte démo Dar Yasmine (seed-demo-vitrine) + 2 clients B2C ajoutés ;
 *   - compte de test « Le Patio des Oliviers » (scripts/seed-comptes-test.js, SEED_FIN=2026-10-19)
 *     avec le fournisseur « Primeurs Trabelsi » (matricule de la facture fictive forfait-1) ;
 *   - cabinet d'essai (labflow-reprise/achats-compta/outils/comptes-essai-s4c.js).
 *   Les identifiants sont lus dans un carnet local HORS dépôt (variable CARNET, JSON :
 *   { PATIO:{email,password,dossier}, DAR:{…}, ACHETEUR:{…}, CABINET:{…} }) — jamais écrits ici.
 *   Le limiteur de /auth/login autorise 20 connexions par 15 min : redémarrer le backend de test au besoin.
 *
 * Run : CARNET=<chemin.json> node tools/capture-v5.js [--only=<cle>] [--encode-only]
 *   → PNG bruts dans tools/raw2/, déclinaisons @1x..@4x AVIF+WebP dans assets/img/.
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
const DSF = 4; // densité de la source : « 4K »

const CSS_CONTENU_PUR = `.sidebar, .header, .sidebar-overlay { display: none !important; } .main-content { max-width: none !important; }`;

async function fenetre(page, width, height = 1000) { await page.setViewport({ width, height, deviceScaleFactor: DSF }); await sleep(500); }
async function login(page, base, creds) {
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.type('input[type="email"]', creds.email, { delay: 5 });
  await page.type('input[type="password"]', creds.password, { delay: 5 });
  await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})]);
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 15000 });
  await sleep(2500); // laisser l'application charger ses accès avant de changer de page (sinon « Chargement… » sans fin)
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
  console.log(`📸 ${file}${clip ? ` (${Math.round(clip.width)}×${Math.round(clip.height)} css px, ×${DSF})` : ''}`);
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
// w1 = largeur d'affichage @1x : 1000 px pour les visuels pleine largeur (hero), 900 px sinon.
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
  let quality = format === 'avif' ? 64 : 80;
  for (;;) {
    const pipe = sharp(input).resize({ width, withoutEnlargement: true }).sharpen({ sigma: 0.7 });
    const buf = format === 'avif' ? await pipe.avif({ quality, effort: 5 }).toBuffer() : await pipe.webp({ quality }).toBuffer();
    if (buf.length <= budgetKo * 1024 || quality <= 44) { fs.writeFileSync(outPath, buf); return { ko: Math.round(buf.length / 1024), quality }; }
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
    for (const d of [1, 2, 3, 4]) {
      const w = Math.min(w1 * d, meta.width);
      if (d > 1 && w === Math.min(w1 * (d - 1), meta.width)) break; // source trop petite : pas de déclinaison vide
      for (const fmt of ['avif', 'webp']) {
        const { ko, quality } = await encode(input, path.join(OUT, `${name}@${d}x.${fmt}`), fmt, w, p.budget * d);
        console.log(`🖼  ${name}@${d}x.${fmt} — ${w}px, q${quality}, ${ko} Ko`);
      }
    }
    // déclinaisons périmées d'un ancien encodage plus dense : à retirer
    for (const d of [1, 2, 3, 4]) if (w1 * d > meta.width && d > 1 && Math.min(w1 * (d - 1), meta.width) === meta.width) for (const fmt of ['avif', 'webp']) { const f = path.join(OUT, `${name}@${d}x.${fmt}`); if (fs.existsSync(f)) fs.unlinkSync(f); }
    const m1 = await sharp(path.join(OUT, `${name}@1x.webp`)).metadata();
    console.log(`   ↳ ${name} : @1x ${m1.width}×${m1.height}, source ${meta.width}×${meta.height}`);
  }
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });
  if (!ENCODE_ONLY) {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--lang=fr-FR', `--force-device-scale-factor=${DSF}`], defaultViewport: { width: 1200, height: 1000, deviceScaleFactor: DSF } });
    const page = await browser.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));

    // ══ A · Le Patio : dépôt (+ panneau lu), en-tête lue, fenêtre « Vérifier la facture » ══
    if (veut('depot-facture') || veut('facture-entete') || veut('verifier-facture')) {
      await login(page, FRONT, J.PATIO);
      await fenetre(page, 860, 1100);
      await page.goto(`${FRONT}/client/stock`, { waitUntil: 'domcontentloaded' });
      await attendreTexte(page, /Facture du fournisseur/);
      await page.addStyleTag({ content: CSS_CONTENU_PUR }); await sleep(500);
      const fi = await page.$('input[type="file"]');
      await fi.uploadFile(PDF);
      await attendreTexte(page, /LU SUR LA FACTURE/, 40000);
      await sleep(1200);
      // dépôt : le bloc d'appro avec la pièce déposée ET le panneau « lu sur la facture » (composition haute, lisible)
      if (veut('depot-facture')) await shoot(page, 'ecran-depot-facture.png', await cadre(page, ['APPROVISIONNEMENT', 'LU SUR LA FACTURE'], { wMin: 500, hMax: 1000, marge: 6 }));
      // en-tête lue : le panneau « Lu sur la facture » seul (fournisseur reconnu, n°, date, HT, TVA, timbre, TTC,
      // 6 lignes lues) dans une fenêtre étroite pour qu'il s'empile et reste lisible dans une colonne du site
      if (veut('facture-entete')) {
        await fenetre(page, 700, 1100);
        await shoot(page, 'ecran-facture-entete.png', await cadre(page, ['LU SUR LA FACTURE', 'TTC'], { wMin: 400, hMax: 900, marge: 6 }));
        await fenetre(page, 860, 1100);
      }
      if (veut('verifier-facture')) {
        await fenetre(page, 1300, 1000);
        await clickTexte(page, 'Vérifier la facture et enregistrer');
        await attendreTexte(page, /Tomates/, 20000);
        await sleep(1800); // rendu de la pièce (pdf.js)
        await page.evaluate(() => { document.querySelectorAll('*').forEach((e) => { if (e.scrollTop > 0) e.scrollTop = 0; }); window.scrollTo(0, 0); });
        await sleep(500);
        // le panneau de la fenêtre = le plus grand enfant de .modal-overlay (pièce à gauche, lignes à droite, pied d'action)
        const clip = await page.evaluate(() => {
          const ov = document.querySelector('.modal-overlay'); if (!ov) return null;
          const el = [...ov.children].sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
          const b = el.getBoundingClientRect();
          return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.min(b.width, 1300 - Math.max(0, b.x)), height: Math.min(b.height, 1000 - Math.max(0, b.y)) };
        });
        if (!clip) throw new Error('fenêtre Vérifier la facture introuvable');
        await shoot(page, 'ecran-verifier-facture.png', clip);
        await page.keyboard.press('Escape').catch(() => {});
      }
    }

    // ══ B · LabFlow Compta (Le Patio) : plan de comptes, écriture du pont, bilan, état de résultat ══
    if (veut('plan-comptes') || veut('ecriture-achat') || veut('bilan') || veut('etat-resultat')) {
      const D = J.PATIO.dossier;
      await fenetre(page, 980, 1000);
      await login(page, COMPTA, J.PATIO);
      if (veut('plan-comptes')) {
        await page.goto(`${COMPTA}/dossiers/${D}/plan`, { waitUntil: 'domcontentloaded' });
        await attendreTexte(page, /Classe 4/);
        await page.evaluate(() => { const l = [...document.querySelectorAll('button, summary, [role="button"], div, h3, h4')].filter((e) => /^▸?\s*Classe 4/.test((e.innerText || '').trim()) && (e.innerText || '').length < 80); (l[l.length - 1] || l[0])?.click(); });
        await attendreTexte(page, /Fournisseurs/);
        await shoot(page, 'ecran-plan-comptes.png', await cadre(page, ['Plan de comptes', 'Fournisseurs'], { wMin: 600, hMax: 950, tags: 'main' }));
      }
      if (veut('ecriture-achat')) {
        await page.goto(`${COMPTA}/dossiers/${D}/ecritures?etat=brouillard`, { waitUntil: 'domcontentloaded' });
        await attendreTexte(page, /B-0000\d\d/);
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
        await shoot(page, 'ecran-ecriture-achat.png', await cadre(page, ['B-0000', 'Débit'], { wMin: 600, hMax: 900, marge: 4 }).catch(() => cadre(page, ['écritures en brouillard'], { wMin: 600, hMax: 900, tags: 'main' })));
      }
      if (veut('bilan') || veut('etat-resultat')) {
        await page.goto(`${COMPTA}/dossiers/${D}/etats`, { waitUntil: 'domcontentloaded' });
        await attendreTexte(page, /Total des actifs/);
        if (veut('etat-resultat')) await shoot(page, 'ecran-etat-resultat.png', await cadre(page, ['État de résultat', 'Résultat net de l\'exercice'], { wMin: 600, hMax: 1000, marge: 4 }));
        if (veut('bilan')) {
          await fenetre(page, 1200, 1000); // visuel pleine largeur (hero de la page Comptabilité)
          await attendreTexte(page, /Total des actifs/);
          await shoot(page, 'ecran-bilan.png', await cadre(page, ['Bilan', 'Total des actifs', 'Total des capitaux propres et des passifs'], { wMin: 700, hMax: 1100, marge: 4 }));
        }
      }
    }

    // ══ C · Cabinet d'essai : mes dossiers ══
    if (veut('cabinet-dossiers')) {
      await fenetre(page, 980, 900);
      await purger(page);
      await login(page, COMPTA, J.CABINET);
      await page.goto(`${COMPTA}/dossiers`, { waitUntil: 'domcontentloaded' });
      try { await attendreTexte(page, /Boulangerie Ben Ali/, 12000); }
      catch { await page.reload({ waitUntil: 'domcontentloaded' }); await attendreTexte(page, /Boulangerie Ben Ali/, 20000); }
      await shoot(page, 'ecran-cabinet-dossiers.png', await cadre(page, ['Boulangerie Ben Ali', 'Menuiserie Sfaxienne'], { wMin: 600, hMax: 800, marge: 4 }));
    }

    // ══ D · Dar Yasmine : carnet des clients (B2B + B2C) et tableau de bord (onglets, filtres, tuiles) ══
    if (veut('carnet-clients') || veut('dashboard-filtres')) {
      await fenetre(page, 860, 1000);
      await purger(page);
      await login(page, FRONT, J.DAR);
      if (veut('carnet-clients')) {
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
        await shoot(page, 'ecran-carnet-clients.png', await cadre(page, ['Karim Jelassi', 'Mme Ben Salah'], { wMin: 600, hMax: 1000, marge: 4 }));
      }
      if (veut('dashboard-filtres')) {
        await fenetre(page, 900, 1000);
        await page.goto(`${FRONT}/client/dashboard`, { waitUntil: 'domcontentloaded' });
        await attendreTexte(page, /Vue d'ensemble/);
        await page.waitForFunction(() => /\d[\d\s.,]*\s?DT/.test(document.body.innerText), { timeout: 25000 });
        // période de juillet 2026 : celle des ventes du compte démo (la période courante serait à zéro)
        await page.evaluate(() => {
          const dates = [...document.querySelectorAll('input[type="date"]')];
          const set = (el, v) => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
          if (dates.length >= 2) { set(dates[0], '2026-07-01'); set(dates[1], '2026-07-22'); }
        });
        await page.waitForFunction(() => /[1-9]\d* ventes/.test(document.body.innerText), { timeout: 25000 });
        await sleep(1200);
        await page.addStyleTag({ content: CSS_CONTENU_PUR }); await sleep(800);
        // le haut du tableau de bord : bandeau, onglets, barre de filtres, premières tuiles
        await shoot(page, 'ecran-dashboard-filtres.png', await cadre(page, ['Vue d\'ensemble', 'PÉRIODE'], { wMin: 600, hMax: 720, tags: 'main' }));
      }
    }

    // ══ E · Portail acheteur : catalogue et commande ══
    if (veut('portail-commande')) {
      await fenetre(page, 860, 1000);
      await purger(page);
      await login(page, FRONT, J.ACHETEUR);
      await page.goto(`${FRONT}/portail`, { waitUntil: 'domcontentloaded' });
      await attendreTexte(page, /\d[\d\s.,]*\s?DT/);
      await sleep(800);
      const c = await cadre(page, ['DT'], { wMin: 600, hMax: 1100, tags: 'main' });
      // le titre du catalogue porte le nom du compte acheteur (réel) : on commence sous la barre de recherche
      const sousTitre = await page.evaluate(() => { const i = document.querySelector('main input[type="search"], main input[placeholder*="Rechercher"]'); if (!i) return 0; const b = i.closest('div').getBoundingClientRect(); return b.y + window.scrollY - 14; });
      const y = sousTitre > c.y ? sousTitre : c.y + 120;
      await shoot(page, 'ecran-portail-commande.png', { ...c, y, height: Math.min(c.height - (y - c.y), 900) });
    }

    await browser.close();
  }

  console.log('\n— Encodage —');
  await encodeAll();
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
