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
 * ⚠️ Ce script vérifie l'état LIVRÉ du thème « Nuit & Lumière » (v4). L'accueil
 *    n'a plus la structure V3 « Chiffres en main » : plus de chapitres data-t,
 *    plus de #cascade/data-count, plus de figcaption, plus de v2.css/v3.css. Les
 *    contrôles ci-dessous suivent index.html actuel (7 sections Nuit) et
 *    DOIVENT finir à 0 échec.
 */
const puppeteer = require('puppeteer');
const contraste = require('./contraste.js');

// 7 entrées : les 6 pages indexables (tarifs.html CONSERVÉE — décision client D1,
// qui périme la suppression prévue au §3.1/§3.3/§6.1 du plan) + 404.html, qui est
// noindex et hors sitemap mais doit charger v4.css sans erreur.
// NB : l'énoncé « PAGES à 6 entrées dont 404.html » est un report du plan d'avant D1.
const PAGES = [
  '/', '/tarifs.html', '/demande-acces.html', '/merci.html',
  '/mentions-legales.html', '/confidentialite.html', '/404.html',
];
// Le canonical ne concerne PAS 404.html (§3.3 / §6.1 du brief).
const SANS_CANONICAL = ['/404.html'];
const BASE = 'http://localhost:8322';
// §9.4 — durée réelle de assets/video/demo-60s-son.mp4, mesurée à 78,80 s
// depuis le recoupage du 20/07/2026 (tools/video/recouper.js : retrait des plans
// 05-principe et 16-excel-fiche, clôture refaite sans « Réponse sous 24 h »).
// Le libellé « (1 min 19) » de l'accueil suppose cette durée : une remontée de
// la vidéo sans mise à jour du libellé est signalée par le contrôle 3.
const DUREE_VIDEO_ATTENDUE = 78.8;
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

    // plus aucune référence aux anciennes feuilles (v2.css ni v3.css) — tout est sur v4.css
    const css = await page.$$eval('link[rel=stylesheet]', (l) => l.map((e) => e.getAttribute('href') || ''));
    if (css.some((h) => h.includes('v2.css'))) rate(`${p} référence encore assets/css/v2.css`);
    if (css.some((h) => h.includes('v3.css'))) rate(`${p} référence encore assets/css/v3.css`);

    await page.close();
  }

  // ── (contrôle 2) Aucun résidu de calculateur — D1 ─────────────────────────
  // Le calculateur (et son récap #calc-recap, et la clé localStorage lf_calc)
  // a été SUPPRIMÉ : tarifs.html ne chiffre plus rien, demande-acces.html ne
  // relit plus de panier. On vérifie simplement qu'il n'en reste aucune trace,
  // sur les deux pages où il vivait. (Plus de test de purge au boot : rien
  // n'écrit lf_calc, il n'y a donc rien à purger.)
  for (const p of ['/demande-acces.html', '/tarifs.html']) {
    const page = await browser.newPage();
    await page.goto(BASE + p, { waitUntil: 'networkidle0' });
    const etat = await page.evaluate(() => ({
      div: document.getElementById('calc-recap') !== null,
      trace: document.documentElement.innerHTML.includes('lf_calc'),
    }));
    console.log(`── résidu calculateur (${p}) : #calc-recap ${etat.div ? 'PRÉSENT' : 'absent'}, lf_calc ${etat.trace ? 'PRÉSENT' : 'absent'}`);
    if (etat.div) rate(`#calc-recap subsiste dans ${p} (à supprimer, D1)`);
    if (etat.trace) rate(`la chaîne lf_calc subsiste dans le DOM de ${p} (D1)`);
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

  // ── (contrôle 3) Durée de la démo modale — la structure Nuit n'a plus de
  //    chapitres cliquables (data-t) ; on garde le seul fait vérifiable : la
  //    modale #demo-video sert bien le recoupage à ≈ 78,8 s (« 1 min 19 »).
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
        rate(`durée vidéo dérivée (${d.toFixed(2)} s ≠ ${DUREE_VIDEO_ATTENDUE} s) : le libellé « 1 min 19 » de l'accueil n'est plus juste (§9.4)`);
    }
    await page.close();
  }

  // ── (contrôle 6) La mention de démonstration accompagne chaque capture ─────
  // La structure Nuit n'a plus de <figcaption> : la mention D5 vit dans l'alt de
  // chaque capture produit (cartes, écrans, ruban de facture) et dans l'aria-label
  // de la boucle hero. On vérifie que chacune de ces captures la porte, et
  // qu'aucune capture décorative (medaillon, alt="") n'est comptée à tort.
  {
    const page = await browser.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle0' });
    const alts = await page.$$eval('.carte-visu img, .ecran-visu img, .ruban img',
      (imgs) => imgs.map((e) => e.getAttribute('alt') || ''));
    const heroLabel = await page.$eval('#hero-video', (e) => e.getAttribute('aria-label') || '').catch(() => '');
    const cibles = alts.concat(heroLabel ? [heroLabel] : []);
    const manquants = cibles.filter((c) => !c.includes(MENTION_DEMO));
    console.log(`── captures : ${cibles.length} vérifiée(s) (${alts.length} alt + hero), ${manquants.length} sans la mention`);
    if (!alts.length) rate('aucune capture produit trouvée sur index.html (.carte-visu/.ecran-visu/.ruban)');
    if (!heroLabel) rate('boucle hero #hero-video sans aria-label');
    manquants.forEach((c) => rate(`capture sans mention « ${MENTION_DEMO} » : « ${c.slice(0, 70)}… »`));
    await page.close();
  }

  // ── Reduced motion : la page doit être identique à l'état de repos ────────
  {
    const rm = await browser.newPage();
    await rm.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await rm.setViewport({ width: 1440, height: 900 });
    await rm.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));

    // La structure Nuit n'a plus de cascade #cascade/data-count. La seule
    // exigence « animations réduites » qui subsiste sur l'accueil : les blocs
    // à révélation progressive (.reveal) doivent être à leur état final (opacité
    // pleine), et la boucle hero ne doit pas se lancer (vérifié juste après).
    const revCachees = await rm.$$eval('.reveal', (e) => e.filter((n) => getComputedStyle(n).opacity !== '1').length);
    console.log('\n── reduced-motion : révélations .reveal à l’état final ' + (revCachees ? `(${revCachees} invisibles ✗)` : '✓'));
    if (revCachees) rate(`${revCachees} bloc(s) .reveal restent invisibles en reduced-motion`);
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
    // + garde anti-dérive : les jetons servis par v4.css doivent être ceux validés
    contraste.verifierSource().echecs.forEach(rate);
  }

  await browser.close();
  if (echecs.length) {
    console.error(`\n❌ ${echecs.length} échec(s) — voir ci-dessus`);
    process.exit(1);
  }
  console.log('\n✅ vérification terminée — 0 échec');
})().catch((e) => { console.error('❌', e); process.exit(1); });
