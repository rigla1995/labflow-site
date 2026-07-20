/**
 * Vérification globale du site local : erreurs console, requêtes en échec,
 * poids réseau de la première vue, interactions clés, reduced-motion,
 * contrastes, canonical, mentions de démonstration.
 * Run : node tools/serve.js  (dans un terminal)
 *       node tools/verify-pages.js
 *
 * ⚠️ tools/serve.js NE COMPRESSE PAS (aucun Content-Encoding, cf. serve.js L.46).
 *    Les poids affichés ci-dessous majorent donc d'environ 25 Ko sur HTML+CSS
 *    par rapport à la production, où nginx applique gzip. Un dépassement de
 *    quelques Ko en local n'est pas nécessairement un dépassement en ligne :
 *    vérifier avec `curl -H 'Accept-Encoding: gzip'` avant de conclure.
 *
 * ⚠️ Ce script EST une recette de l'état CIBLE V3. Tant que la refonte n'est pas
 *    terminée il échoue légitimement (v3.css, 404.html, chapitres, figcaptions
 *    n'existent pas encore). Un échec ici = un reste à faire, pas un bug du test.
 */
const puppeteer = require('puppeteer');
const contraste = require('./contraste.js');

// 7 entrées : les 6 pages indexables (tarifs.html CONSERVÉE — décision client D1,
// qui périme la suppression prévue au §3.1/§3.3/§6.1 du plan) + 404.html, qui est
// noindex et hors sitemap mais doit charger v3.css sans erreur.
// NB : l'énoncé « PAGES à 6 entrées dont 404.html » est un report du plan d'avant D1.
const PAGES = [
  '/', '/tarifs.html', '/demande-acces.html', '/merci.html',
  '/mentions-legales.html', '/confidentialite.html', '/404.html',
];
// Le canonical ne concerne PAS 404.html (§3.3 / §6.1 du brief).
const SANS_CANONICAL = ['/404.html'];
const BASE = 'http://localhost:8322';
// §9.4 — durée réelle de assets/video/demo-60s-son.mp4, mesurée à 89,80 s.
// Toute remontée de la vidéo invalide les 6 data-t des chapitres.
const DUREE_VIDEO_ATTENDUE = 89.8;
const BUDGET_PREMIERE_VUE = 500;     // Ko, §13.6
const MENTION_DEMO = 'Compte de démonstration Dar Yasmine';

const echecs = [];
const rate = (m) => { echecs.push(m); console.error('   ❌ ' + m); };

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });

  for (const p of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const errors = [], failed = [], abandons = [];
    let bytes = 0, bytesVideo = 0;          // compteur vidéo séparé (cf. plus bas)
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
    page.on('requestfailed', (r) => {
      if (r.url().startsWith('data:')) return;
      // net::ERR_ABORTED n'est PAS une requête cassée : <video> à sources multiples
      // abandonne la piste qu'il ne retient pas (demo-hero.webm répond bien 200).
      // Sanctionner l'abandon condamnerait index.html en permanence.
      const raison = (r.failure() && r.failure().errorText) || '';
      (raison === 'net::ERR_ABORTED' ? abandons : failed).push(`${r.url()} (${raison})`);
    });
    page.on('response', (r) => {
      const estVideo = /assets\/video\//.test(r.url());
      r.buffer().then((b) => { if (estVideo) bytesVideo += b.length; else bytes += b.length; })
        .catch(() => {});
    });

    try {
      // Le statut est ASSERTÉ : tools/serve.js renvoie un corps navigable (« not
      // found ») pour un fichier absent, si bien qu'une page manquante traverserait
      // tous les contrôles suivants sans rien signaler. Les 7 entrées de PAGES sont
      // des fichiers réels, y compris 404.html demandée par son URL directe.
      const rep = await page.goto(BASE + p, { waitUntil: 'networkidle0', timeout: 30000 });
      if (rep && rep.status() !== 200) rate(`${p} : HTTP ${rep.status()} — fichier absent ou non servi`);
    } catch (e) {
      rate(`${p} : chargement impossible (${e.message.split('\n')[0]})`);
      await page.close();
      continue;
    }
    await new Promise((r) => setTimeout(r, 800));

    const ko = Math.round(bytes / 1024);
    console.log(`\n── ${p}`);
    console.log(`   première vue hors vidéo ≈ ${ko} Ko  (budget ${BUDGET_PREMIERE_VUE} Ko — non gzippé)`);
    console.log(`   avec boucle hero        ≈ ${Math.round((bytes + bytesVideo) / 1024)} Ko  (informatif)`);
    console.log(`   erreurs console   : ${errors.length ? errors.join(' | ') : 'aucune'}`);
    console.log(`   requêtes échouées : ${failed.length ? failed.join(', ') : 'aucune'}`);
    if (abandons.length) console.log(`   requêtes abandonnées (normal, non sanctionné) : ${abandons.length}`);
    if (ko > BUDGET_PREMIERE_VUE) rate(`${p} dépasse le budget première vue (${ko} Ko > ${BUDGET_PREMIERE_VUE} Ko)`);
    if (errors.length) rate(`${p} : erreur console — ${errors[0]}`);
    if (failed.length) rate(`${p} : requête en échec — ${failed[0]}`);

    // (contrôle 5) exactement un canonical, absolu, https://labflow-tn.com/
    const canon = await page.$$eval('link[rel=canonical]', (l) => l.map((e) => e.getAttribute('href')));
    if (SANS_CANONICAL.includes(p)) {
      if (canon.length) rate(`${p} ne doit pas porter de canonical (noindex, hors sitemap)`);
      else console.log('   canonical : absent (attendu)');
    } else if (canon.length !== 1 || !canon[0].startsWith('https://labflow-tn.com/')) {
      rate(`${p} : canonical attendu unique et absolu, reçu ${JSON.stringify(canon)}`);
    } else {
      console.log(`   canonical : ${canon[0]}`);
    }

    // 404.html doit être explicitement noindex
    if (p === '/404.html') {
      const robots = await page.$eval('meta[name=robots]', (e) => e.content).catch(() => null);
      if (!robots || !/noindex/.test(robots)) rate('/404.html : meta robots noindex absente');
    }

    // plus aucune référence à l'ancienne feuille
    const css = await page.$$eval('link[rel=stylesheet]', (l) => l.map((e) => e.getAttribute('href') || ''));
    if (css.some((h) => h.includes('v2.css'))) rate(`${p} référence encore assets/css/v2.css`);

    await page.close();
  }

  // ── (contrôle 2) Absence de récap fantôme — ASSERTION POSITIVE ────────────
  // Le motif V2 `$eval('#calc-recap', …).catch(() => 'n/a')` réussissait toujours
  // une fois le div retiré du DOM : le .catch avalait l'erreur et le test passait
  // quoi qu'il arrive. Ici, double condition explicite.
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/demande-acces.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('lf_calc', '{"act":2}'));
    await page.reload({ waitUntil: 'networkidle0' });
    const etat = await page.evaluate(() => ({
      div: document.getElementById('calc-recap') !== null,
      cle: localStorage.getItem('lf_calc'),
    }));
    console.log(`\n── récap fantôme : div ${etat.div ? 'PRÉSENT' : 'absent'}, lf_calc = ${JSON.stringify(etat.cle)}`);
    if (etat.div) rate('#calc-recap subsiste dans demande-acces.html (à supprimer, D1)');
    if (etat.cle !== null) rate('lf_calc non purgé : ajouter localStorage.removeItem("lf_calc") au boot de demande-acces.html');
    // aucune trace de calculateur nulle part
    const traces = await page.evaluate(() => document.documentElement.innerHTML.includes('lf_calc'));
    if (traces) rate('la chaîne lf_calc subsiste dans le DOM de demande-acces.html');
    await page.close();
  }

  // ── (contrôle 1) Parcours formulaire 2 étapes ─────────────────────────────
  // Identifiants VÉRIFIÉS contre demande-acces.html : #nom (L.173), #email (L.179),
  // #telephone (L.187), #step2 (L.199) et le bouton #btn-continuer (L.194).
  // ⚠️ le brief supposait « #go-step2 » : cet id n'existe pas dans la page.
  // Le bouton naît disabled et n'est activé que par majContinuer() (L.387), d'où
  // l'attente explicite avant le clic.
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/demande-acces.html', { waitUntil: 'networkidle0' });
    await page.type('#nom', 'Recette Automatique');
    await page.type('#email', 'recette@example.tn');
    await page.type('#telephone', '20123456');   // masqué en « 20 123 456 » à la frappe
    const activable = await page
      .waitForFunction(() => { const b = document.getElementById('btn-continuer'); return b && !b.disabled; }, { timeout: 3000 })
      .then(() => true).catch(() => false);
    if (!activable) rate('#btn-continuer reste désactivé après saisie valide (validation cassée)');
    await page.click('#btn-continuer').catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
    const etape2 = await page.$eval('#step2', (e) => e.classList.contains('actif')).catch(() => false);
    console.log(`── formulaire 2 étapes : passage étape 1 → 2 ${etape2 ? '✓' : '✗'}`);
    if (!etape2) rate('le formulaire ne passe pas à l’étape 2');
    // honeypot et garde anti-bot intacts (verrou §13.2)
    if (!(await page.$('input[name="website"]'))) rate('honeypot "website" absent (verrou §13.2)');
    await page.close();
  }

  // ── (contrôle 3) Durée de la vidéo — détecte une remontée sans MAJ des chapitres
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    const d = await page.evaluate(async () => {
      const v = document.getElementById('demo-video');
      if (!v) return null;
      if (v.readyState < 1) {
        v.preload = 'metadata'; v.load();
        await new Promise((r) => {
          v.addEventListener('loadedmetadata', r, { once: true });
          setTimeout(r, 8000);
        });
      }
      return v.duration;
    });
    if (d === null || !isFinite(d)) {
      rate('#demo-video introuvable ou métadonnées illisibles');
    } else {
      console.log(`── durée vidéo : ${d.toFixed(2)} s (attendu ≈ ${DUREE_VIDEO_ATTENDUE} s)`);
      if (Math.abs(d - DUREE_VIDEO_ATTENDUE) > 0.6)
        rate(`durée vidéo dérivée (${d.toFixed(2)} s) : les 6 data-t des chapitres sont à recalculer (§9.4)`);
      const ts = await page.$$eval('.chapitre', (b) => b.map((e) => Number(e.dataset.t)));
      if (ts.length !== 6) rate(`6 chapitres attendus, ${ts.length} trouvé(s)`);
      const hors = ts.filter((t) => !(Number.isFinite(t) && t >= 0 && t < d));
      if (hors.length) rate(`data-t hors de la durée de la vidéo : ${hors.join(', ')}`);
    }
    await page.close();
  }

  // ── (contrôle 6) Chaque figcaption d'index.html porte la mention ──────────
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    const caps = await page.$$eval('figcaption', (f) => f.map((e) => e.textContent.trim()));
    const manquants = caps.filter((c) => !c.includes(MENTION_DEMO));
    console.log(`── figcaption : ${caps.length} trouvé(s), ${manquants.length} sans la mention`);
    manquants.forEach((c) => rate(`figcaption sans mention « ${MENTION_DEMO} » : « ${c.slice(0, 70)}… »`));
    if (!caps.length) rate('aucun figcaption sur index.html');
    await page.close();
  }

  // ── Reduced motion : la page doit être identique à l'état de repos ────────
  {
    const rm = await browser.newPage();
    await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await rm.setViewport({ width: 1440, height: 900 });
    await rm.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await rm.evaluate(() => document.getElementById('cascade')?.scrollIntoView());
    await new Promise((r) => setTimeout(r, 800));

    // L'attendu n'est PLUS codé en dur : on le lit dans le DOM.
    // D5 : la cascade peut légitimement ne porter AUCUN chiffre (montants non
    // vérifiables → interdits en clair). Zéro nœud n'est donc pas un échec.
    const noeuds = await rm.$$eval('#cascade [data-count]', (els) =>
      els.map((e) => ({ lu: e.textContent.trim(), attendu: (e.dataset.count || '').split('|')[1] })));
    // data-count porte le POINT décimal (« 2.290 ») alors que le count-up rend la
    // VIRGULE française (« 2,290 »). Comparer les bruts ferait échouer le contrôle
    // même quand le code est juste : on normalise séparateurs et espaces fines.
    const norm = (s) => String(s).replace(/[\s  ]/g, '').replace(',', '.');
    if (!noeuds.length) {
      console.log('\n── reduced-motion : cascade sans chiffres (conforme D5, aucun montant non vérifié)');
    } else {
      console.log('\n── reduced-motion : cascade');
      noeuds.forEach((n, i) => {
        const ok = norm(n.lu) === norm(n.attendu);
        console.log(`   ${ok ? '✓' : '✗'} maillon ${i + 1} : lu « ${n.lu} » / attendu « ${n.attendu} »`);
        if (!ok) rate(`cascade maillon ${i + 1} : count-up n'a pas posé la valeur finale en reduced-motion`);
      });
    }
    // les révélations doivent être à leur état final
    const revCachees = await rm.$$eval('.rev', (e) => e.filter((n) => getComputedStyle(n).opacity !== '1').length);
    if (revCachees) rate(`${revCachees} bloc(s) .rev restent invisibles en reduced-motion`);
    // la vidéo hero ne doit pas jouer et doit exposer des contrôles
    const v = await rm.evaluate(() => {
      const el = document.querySelector('.hero video'); if (!el) return null;
      return { joue: !el.paused, controls: el.controls };
    });
    if (v && v.joue) rate('la boucle hero démarre malgré prefers-reduced-motion');
    if (v && !v.controls) rate('la boucle hero n’expose pas de controls en reduced-motion');
    await rm.close();
  }

  // ── (contrôle 4) Contrastes ───────────────────────────────────────────────
  {
    const { echecs: e, total } = contraste.verifier();
    e.forEach(rate);
    if (!e.length) console.log(`   (${total} règles de contraste vérifiées)`);
    // + garde anti-dérive : les jetons servis par v3.css doivent être ceux validés
    contraste.verifierSource().echecs.forEach(rate);
  }

  await browser.close();
  if (echecs.length) {
    console.error(`\n❌ ${echecs.length} échec(s) — voir ci-dessus`);
    process.exit(1);
  }
  console.log('\n✅ vérification terminée — 0 échec');
})().catch((e) => { console.error('❌', e); process.exit(1); });
