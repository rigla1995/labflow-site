/**
 * Captures V2 du compte démo « Dar Yasmine » pour le site vitrine.
 * Prérequis : backend (3000) + frontend (5173) démarrés, seed-demo-vitrine exécuté.
 * Run : node tools/capture.js   → PNG bruts dans tools/raw/ (puis node tools/optimize.js → assets/img/)
 *
 * Principes (plan V2 §4) :
 *  - Attente de DONNÉES, pas de délai : waitForFunction sur la présence de montants DT
 *    et l'absence de « Chargement ». La SSE de la cloche casse networkidle2 — jamais l'utiliser.
 *  - Crops chirurgicaux ancrés sur les éléments (getBoundingClientRect), dpr 2.
 *  - 2 pleines pages max : dashboard et portail catalogue.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const FRONT = 'http://localhost:5173';
const API = 'http://localhost:3000';
const RAW = path.join(__dirname, 'raw');

const CLIENT = { email: 'demo@dar-yasmine.tn', password: 'DemoVitrine2026!' };
const ACHETEUR = { email: 'm.khelil.prof+acheteur1@gmail.com', password: 'Portail2026!' };
const LABO_ID = 55; // Cuisine centrale Dar Yasmine (seed)

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
  await page.waitForFunction(() => !document.querySelector('input[type="password"]'), { timeout: 15000 });
}

/** Attend que la page contienne des montants DT (sauf requireDT:false) et plus aucun « Chargement ». */
async function waitForData(page, { needle = null, timeout = 25000, requireDT = true } = {}) {
  await page.waitForFunction(
    (extra, needDT) => {
      const txt = (document.querySelector('main') || document.body).innerText || '';
      if (needDT && !/\d[\d\s.,]*\s?DT/.test(txt)) return false;
      if (/Chargement|chargement en cours|Loading/i.test(txt)) return false;
      if (extra && !txt.includes(extra)) return false;
      return true;
    },
    { timeout },
    needle,
    requireDT
  );
  await sleep(500); // marge : dernières peintures (graphes, images)
}

async function goto(page, url, opts = {}) {
  await page.goto(`${FRONT}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  try {
    await waitForData(page, opts);
  } catch (e) {
    console.warn(`  ↻ données lentes sur ${url}, 2ᵉ essai…`);
    await page.goto(`${FRONT}${url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForData(page, opts);
  }
}

/** Clique le premier bouton/onglet dont le texte contient `txt` (optionnellement près d'un ancêtre contenant `near`). */
async function clickText(page, txt, { near = null } = {}) {
  const ok = await page.evaluate(
    (t, n) => {
      const T = t.toUpperCase();
      let els = [...document.querySelectorAll('button, [role="tab"], [role="button"], a')].filter(
        (e) => e.textContent && e.textContent.toUpperCase().includes(T)
      );
      if (!els.length) {
        // repli : cartes/divs cliquables (ex. « FT Stock » dans la modal FT)
        els = [...document.querySelectorAll('div, span, h3, h4')].filter(
          (e) => e.textContent && e.textContent.toUpperCase().includes(T) && e.textContent.length < 120
        );
        els.sort((a, b) => a.textContent.length - b.textContent.length);
        els = els.slice(0, 1);
      }
      if (!els.length) return false;
      let el = els[0];
      if (n) {
        el =
          els.find((e) => {
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
    txt,
    near
  );
  if (!ok) throw new Error(`clickText: « ${txt} » introuvable`);
  await sleep(600);
}

/**
 * Calcule le rect (coordonnées document, CSS px) d'une zone à cropper.
 * `finder` s'exécute dans la page et doit retourner un Element (ou null).
 */
async function rectOf(page, finder, { pad = 12, maxH = null } = {}) {
  const rect = await page.evaluate(
    (fnSrc) => {
      const el = eval(`(${fnSrc})`)();
      if (!el) return null;
      const r0 = el.getBoundingClientRect();
      const docY = r0.y + window.scrollY;
      // si la zone n'est pas déjà entièrement visible, la placer SOUS le header fixe
      // de l'app (~70px) : évite bandeau/thead sticky composités par-dessus le crop.
      if (r0.top < 90 || r0.bottom > window.innerHeight - 20) {
        window.scrollTo(0, Math.max(0, docY - 140));
      }
      const r = el.getBoundingClientRect();
      return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height };
    },
    finder.toString()
  );
  if (!rect) return null;
  const clip = {
    x: Math.max(0, rect.x - pad),
    y: Math.max(0, rect.y - pad),
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
  if (maxH && clip.height > maxH) clip.height = maxH;
  return clip;
}

async function shootFull(page, file) {
  await page.screenshot({ path: path.join(RAW, file) });
  console.log(`📸 ${file} (pleine vue)`);
}

async function shootClip(page, file, clip) {
  if (!clip) {
    console.warn(`⚠️ ${file} : zone introuvable, capture ignorée`);
    return false;
  }
  await page.screenshot({ path: path.join(RAW, file), clip });
  console.log(`📸 ${file} (crop ${Math.round(clip.width)}×${Math.round(clip.height)})`);
  return true;
}

async function saveBinary(token, urlPath, file) {
  const FILES = path.join(__dirname, '..', 'assets', 'files');
  const res = await fetch(`${API}${urlPath}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { console.warn(`⚠️ ${urlPath} → ${res.status}`); return; }
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(FILES, file), buf);
  console.log(`📄 ${file} (${Math.round(buf.length / 1024)} Ko)`);
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--lang=fr-FR', '--force-device-scale-factor=3'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 3 },
  });

  // ── Côté client Dar Yasmine ────────────────────────────────────────────────
  const page = await browser.newPage();
  await login(page, CLIENT);

  // 1) Dashboard — pleine vue (hero) + crop KPI marge
  await goto(page, '/client/dashboard', { needle: '%' });
  await shootFull(page, 'dashboard.png');

  // Tous les crops suivants : viewport HAUT, sinon les zones sous la ligne de
  // flottaison ne sont pas peintes par le compositeur et sortent en blanc.
  await page.setViewport({ width: 1440, height: 2400, deviceScaleFactor: 3 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForData(page, { needle: '%' });
  await shootClip(
    page,
    'kpi-marge.png',
    await rectOf(page, () => {
      // carte KPI « Marge brute » (avec « % du CA » — cohérente avec la Cascade du site)
      const cands = [...document.querySelectorAll('main *')].filter((e) => {
        const t = (e.innerText || '').trim();
        if (!/Marge brute/i.test(t) || !/% du CA/i.test(t) || t.length > 120) return false;
        const r = e.getBoundingClientRect();
        return r.width > 140 && r.width < 560 && r.height > 70 && r.height < 380;
      });
      return cands.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width).pop() || null;
    })
  );

  // 2) Onglet Ventes & marges — crop de la zone multi-canaux (prestataires)
  try {
    await clickText(page, 'Ventes & marges');
    await waitForData(page, { needle: 'Jibli' });
    await shootClip(
      page,
      'ventes-canaux.png',
      await rectOf(page, () => {
        const hit = [...document.querySelectorAll('main *')].find(
          (e) => /Jibli/.test(e.innerText || '') && e.childElementCount && (e.innerText || '').length < 1500
        );
        if (!hit) return null;
        let p = hit;
        for (let i = 0; i < 6 && p.parentElement; i++) {
          const r = p.parentElement.getBoundingClientRect();
          if (r.height > 560 || r.width > 1200) break;
          p = p.parentElement;
        }
        return p;
      }, { maxH: 520 })
    );
  } catch (e) {
    console.warn('⚠️ ventes-canaux :', e.message);
  }

  // 3) Stock activité — sections repliées au chargement : déplier ÉPICERIE puis cropper la table.
  await goto(page, '/client/stock', { needle: 'ÉPICERIE', requireDT: false });
  await clickText(page, 'ÉPICERIE');
  await waitForData(page, { timeout: 15000 });
  await sleep(900); // fin du smooth-scroll éventuel
  const tableRect = await rectOf(page, () => {
    const tables = [...document.querySelectorAll('main table')].filter((t) => /DT/.test(t.innerText || ''));
    return tables.sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height).pop() || null;
  }, { maxH: 560 });
  await shootClip(page, 'stock-valeur.png', tableRect);

  // 4) Fiche technique Mille-feuille — arbre de recette + coût temps réel
  await goto(page, '/client/products/valorises', { needle: 'Mille-feuille', requireDT: false });
  await clickText(page, 'Fiche tech.', { near: 'Mille-feuille' });
  await clickText(page, 'FT Stock');
  await page.waitForFunction(
    () => /COÛT EN TEMPS RÉEL/i.test(document.body.innerText) && /\d[\d.,]*\s?DT/.test(document.body.innerText),
    { timeout: 15000 }
  );
  await sleep(400);
  await shootClip(
    page,
    'ft-arbre.png',
    await rectOf(page, () => {
      // la modal : ancêtre commun de « COMPOSITION » et « COÛT EN TEMPS RÉEL »
      const els = [...document.querySelectorAll('div')].filter((e) => {
        const t = e.innerText || '';
        return t.includes('COMPOSITION') && /COÛT EN TEMPS RÉEL/i.test(t);
      });
      return els.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0] || null;
    }, { pad: 0 })
  );
  await page.keyboard.press('Escape').catch(() => {});
  await clickText(page, 'Fermer').catch(() => {});

  // 5) Historique appro labo — lignes de déduction automatique (type PT, AUTO)
  await goto(page, '/client/labo/historique-appro?laboId=' + LABO_ID, { needle: 'Rechercher' }).catch(async () => {});
  await clickText(page, 'Rechercher');
  await page.waitForFunction(() => /AUTO/.test(document.body.innerText) && /-\d/.test(document.body.innerText), { timeout: 20000 });
  await sleep(400);
  await shootClip(
    page,
    'production-deduction.png',
    await rectOf(page, () => {
      const table = [...document.querySelectorAll('main table')].find((t) => /AUTO/.test(t.innerText || ''));
      return table || null;
    }, { maxH: 540 })
  );

  // 6) Commandes B2B — table 4 états, puis détail : stepper + facture avec timbre
  await goto(page, '/client/acheteurs/commandes', { needle: 'FA-2026' });
  await shootClip(
    page,
    'commandes-table.png',
    await rectOf(page, () => {
      const table = [...document.querySelectorAll('main table')].find((t) => /FA-2026/.test(t.innerText || ''));
      return table || null;
    }, { maxH: 560 })
  );
  // ouvre le détail de la commande expédiée FA-2026-0004
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll('tr')];
    const row = rows.find((r) => /FA-2026-0004/.test(r.innerText || ''));
    if (!row) throw new Error('ligne FA-2026-0004 introuvable');
    const eye = [...row.querySelectorAll('button')].find((b) => /👁/.test(b.textContent || '')) || row.querySelector('button');
    eye.click();
  });
  await page.waitForFunction(() => /SUIVI DE LA COMMANDE/i.test(document.body.innerText), { timeout: 15000 });
  await sleep(400);
  await shootClip(
    page,
    'stepper.png',
    await rectOf(page, () => {
      const lbl = [...document.querySelectorAll('*')].find(
        (e) => /SUIVI DE LA COMMANDE/i.test(e.innerText || '') && (e.innerText || '').length < 400 && e.childElementCount
      );
      return lbl || null;
    })
  );
  await shootClip(
    page,
    'facture-timbre.png',
    await rectOf(page, () => {
      const els = [...document.querySelectorAll('div')].filter((e) => {
        const t = e.innerText || '';
        return /FA-2026-0004/.test(t) && /Timbre/.test(t) && t.length < 400;
      });
      return els.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0] || null;
    })
  );

  // Fichiers de preuve (inchangés si déjà présents — on rafraîchit quand même)
  const token = await page.evaluate(() => localStorage.getItem('token') || sessionStorage.getItem('token'));
  try {
    const r = await fetch(`${API}/api/acheteurs/commandes`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json();
    const list = data.commandes || data;
    const withFacture = (Array.isArray(list) ? list : []).find((c) => c.factureId || (c.facture && c.facture.id));
    const factureId = withFacture ? (withFacture.factureId || withFacture.facture.id) : null;
    if (factureId) await saveBinary(token, `/api/acheteurs/factures/${factureId}/pdf`, 'facture-acheteur-exemple.pdf');
  } catch (e) { console.warn('⚠️ facture:', e.message); }
  try {
    await saveBinary(token, `/api/labo/${LABO_ID}/historique/export-excel`, 'export-excel-exemple.xlsx');
  } catch (e) { console.warn('⚠️ export excel:', e.message); }

  // ── Portail acheteur ───────────────────────────────────────────────────────
  const ctx = await browser.createBrowserContext();
  const pp = await ctx.newPage();
  await pp.setViewport({ width: 1440, height: 900, deviceScaleFactor: 3 });
  await login(pp, ACHETEUR);
  await pp.goto(`${FRONT}/portail`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForData(pp);
  await shootFull(pp, 'portail-catalogue.png');

  await browser.close();
  console.log('\n✅ Captures brutes terminées → tools/raw/. Lancer : node tools/optimize.js');
})().catch((e) => { console.error('❌', e); process.exit(1); });
