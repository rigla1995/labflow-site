/**
 * Publication V5 (19/10/2026) : transforme les maquettes de maquettes/v5/ en pages
 * définitives à la racine, met la navigation « Produits » sur les pages secondaires,
 * le sitemap et la liste des pages de verify-pages.js.
 *
 *   node tools/publier-v5.js              → refuse si une capture attendue manque
 *   node tools/publier-v5.js --schemas    → garde les écrans schématiques manquants (aperçu local seulement)
 *
 * Les écrans schématiques des maquettes (role="img") sont REMPLACÉS par les captures
 * réelles de assets/img/ (prises par tools/capture-v5.js) : le site ne montre jamais
 * un écran qui n'existe pas (plan V5 §8, véracité).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const MAQ = path.join(ROOT, 'maquettes', 'v5');
const IMG = path.join(ROOT, 'assets', 'img');
const V5 = process.env.V5_VERSION || '1';      // cache-busting assets/css/v5.css?v=
const VIMG = process.env.IMG_VERSION || '8';   // cache-busting des nouvelles captures
const SCHEMAS_OK = process.argv.includes('--schemas');
const MENTION = 'Compte de démonstration Dar Yasmine';
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

const lire = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'); // tolérant aux CRLF du checkout Windows
const ecrire = (f, s) => fs.writeFileSync(f, s);

/** Fin (exclue) du <div …> ouvert à `debut` : comptage des balises div. */
function finDuDiv(html, debut) {
  const re = /<div\b[^>]*>|<\/div>/g;
  re.lastIndex = debut;
  let prof = 0, m;
  while ((m = re.exec(html))) {
    prof += m[0].startsWith('</') ? -1 : 1;
    if (prof === 0) return m.index + m[0].length;
  }
  throw new Error('div non fermé à ' + debut);
}
function remplacerDiv(html, marqueur, remplacement, obligatoire = true) {
  const i = html.indexOf(marqueur);
  if (i < 0) { if (obligatoire) throw new Error('marqueur introuvable : ' + marqueur); return html; }
  const j = finDuDiv(html, i);
  return html.slice(0, i) + (typeof remplacement === 'function' ? remplacement(html.slice(i, j)) : remplacement) + html.slice(j);
}

// ── Captures : <picture> à partir des déclinaisons présentes dans assets/img ──
async function picture(nom, alt, { lazy = true, style = '' } = {}) {
  const dens = [1, 2, 3, 4].filter((d) => fs.existsSync(path.join(IMG, `${nom}@${d}x.webp`)));
  if (!dens.length) return null;
  const src = (fmt) => dens.map((d) => `assets/img/${nom}@${d}x.${fmt}?v=${VIMG} ${d}x`).join(', ');
  const m = await sharp(path.join(IMG, `${nom}@1x.webp`)).metadata();
  const a = alt.includes(MENTION) ? alt : `${alt.replace(/\.?\s*$/, '')}. ${MENTION}.`;
  return `<picture><source type="image/avif" srcset="${src('avif')}"><source type="image/webp" srcset="${src('webp')}"><img src="assets/img/${nom}@1x.webp?v=${VIMG}" alt="${a.replace(/"/g, '&quot;')}"${lazy ? ' loading="lazy"' : ' fetchpriority="high"'} width="${m.width}" height="${m.height}"${style ? ` style="${style}"` : ''}></picture>`;
}

// Écrans schématiques → captures. Clé = début de l'attribut aria-label de l'app schématique.
const CAPTURES = {
  'Aperçu de l\'écran Vérifier la facture': ['ecran-verifier-facture', 'Écran Vérifier la facture de LabFlow : la facture du fournisseur à gauche, les lignes lues à droite avec l\'article reconnu, la quantité et le prix, les totaux contrôlés'],
  'Aperçu de la zone de dépôt': ['ecran-depot-facture', 'Zone de dépôt d\'une facture fournisseur dans LabFlow : PDF, scan ou photo, plusieurs pages'],
  'Aperçu de l\'en-tête lu': ['ecran-facture-entete', 'En-tête d\'une facture fournisseur lue par LabFlow : fournisseur reconnu par son matricule, numéro, date, HT, TVA, timbre et TTC contrôlés'],
  'Aperçu de l\'écriture d\'achat préparée': ['ecran-ecriture-achat', 'Écriture d\'achat préparée au brouillard de LabFlow Compta depuis une facture fournisseur, avec les codes des articles et la pièce jointe'],
  'Aperçu d\'une écriture d\'achat au brouillard': ['ecran-ecriture-achat', 'Écriture d\'achat au brouillard de LabFlow Compta, issue du pont des factures, avec sa pièce jointe'],
  'Aperçu des états financiers': ['ecran-bilan', 'États financiers de LabFlow Compta : bilan de l\'exercice présenté selon la NC 01'],
  'Aperçu du plan de comptes': ['ecran-plan-comptes', 'Plan de comptes tunisien chargé dans LabFlow Compta'],
  'Aperçu de l\'état de résultat': ['ecran-etat-resultat', 'État de résultat de l\'exercice dans LabFlow Compta'],
  'Aperçu de la liste des dossiers': ['ecran-cabinet-dossiers', 'Liste des dossiers d\'un cabinet comptable dans LabFlow Compta'],
  'Aperçu du carnet des clients': ['ecran-carnet-clients', 'Carnet des clients de LabFlow : professionnels avec matricule fiscal et RNE, particuliers avec un nom et un téléphone'],
  'Aperçu du portail de commande': ['ecran-portail-commande', 'Portail de commande LabFlow vu par un client professionnel : catalogue et commande en cours'],
  'Aperçu du tableau de bord avec ses onglets': ['ecran-dashboard-filtres', 'Tableau de bord LabFlow : onglets et barre de filtres par période, site, activité, catégorie, produit et canal'],
};
// Deux cartes « preuves » de l'accueil (compositions dans .preuve-visu .app)
const PREUVES = {
  'Vérifier la facture <span class="b">': ['ecran-verifier-facture', 'Écran Vérifier la facture de LabFlow : les lignes lues et l\'article reconnu'],
  'États financiers · Bilan 2026': ['ecran-bilan', 'Bilan de l\'exercice dans LabFlow Compta'],
};

async function remplacerSchemas(html, fichier, manquants) {
  // 1) blocs .visu-schema (pages métier + hero)
  let pos = 0;
  for (;;) {
    const i = html.indexOf('<div class="visu-schema', pos);
    if (i < 0) break;
    const j = finDuDiv(html, i);
    const bloc = html.slice(i, j);
    const lab = (bloc.match(/aria-label="([^"]+)"/) || [])[1] || '';
    const cle = Object.keys(CAPTURES).find((k) => lab.startsWith(k));
    if (!cle) throw new Error(`${fichier} : écran schématique sans capture connue (« ${lab.slice(0, 50)} »)`);
    const [nom, alt] = CAPTURES[cle];
    const pic = await picture(nom, alt, { lazy: !bloc.includes('aria-label="Aperçu de l\'écran Vérifier') });
    if (!pic) { manquants.add(nom); pos = j; continue; }
    const rempl = `<div class="ecran-visu">${pic}</div>`;
    html = html.slice(0, i) + rempl + html.slice(j);
    pos = i + rempl.length;
  }
  // 2) cartes preuves de l'accueil
  for (const [cle, [nom, alt]] of Object.entries(PREUVES)) {
    const k = html.indexOf(cle);
    if (k < 0) continue;
    const i = html.lastIndexOf('<div class="app', k);
    const j = finDuDiv(html, i);
    const pic = await picture(nom, alt, { style: 'width:100%;height:100%;object-fit:cover;object-position:left top;display:block' });
    if (!pic) { manquants.add(nom); continue; }
    html = html.slice(0, i) + `<div class="app capture">${pic}</div>` + html.slice(j);
  }
  return html;
}

// ── Têtes de page (référencement) ──
const PAGES = {
  'accueil-b.html': { sortie: 'index.html', titre: 'LabFlow — Du bon de livraison au bilan', desc: 'Vous photographiez la facture du fournisseur : LabFlow la lit, met le stock à jour et prépare l\'écriture comptable. Votre comptable valide, dans le même logiciel.', og: 'Du bon de livraison au bilan', canon: 'https://labflow-tn.com/' },
  'approvisionnements.html': { sortie: 'approvisionnements.html', titre: 'Approvisionnements & factures — LabFlow', desc: 'Déposez la facture du fournisseur en PDF, scan ou photo : LabFlow reconnaît le fournisseur, lit les lignes, vous vérifiez. Le stock et la comptabilité suivent.', og: 'La facture entre toute seule', canon: 'https://labflow-tn.com/approvisionnements.html' },
  'comptabilite.html': { sortie: 'comptabilite.html', titre: 'Comptabilité — LabFlow Compta', desc: 'Plan comptable tunisien prêt, écritures d\'achat automatiques, TVA et déclaration préparées, clôture et états financiers selon la NC 01. Votre comptable travaille dans votre dossier.', og: 'Votre comptable travaille dans votre dossier', canon: 'https://labflow-tn.com/comptabilite.html' },
  'ventes-clients.html': { sortie: 'ventes-clients.html', titre: 'Ventes & clients, pros et particuliers — LabFlow', desc: 'Carnet de clients professionnels et particuliers, portail de commande, commandes en quatre états, facture de vente conforme avec timbre fiscal.', og: 'Vos clients commandent. La facture suit.', canon: 'https://labflow-tn.com/ventes-clients.html' },
  'stock-suivi.html': { sortie: 'stock-suivi.html', titre: 'Stock, production & suivi — LabFlow', desc: 'Stock par site, fiches techniques au coût réel, production, inventaires, pertes et un tableau de bord filtrable par période, site, produit et canal.', og: 'Le stock juste, la marge vraie', canon: 'https://labflow-tn.com/stock-suivi.html' },
};
function tete(p, estAccueil) {
  return `<title>${p.titre}</title>
<!-- ≤ 155 caractères : au-delà, Google tronque. Aucun terme « ERP ». -->
<meta name="description" content="${p.desc}">
<meta property="og:title" content="${p.og}">
<meta property="og:description" content="${p.desc}">
<meta property="og:image" content="https://labflow-tn.com/assets/img/og.jpg?v=6">
<meta property="og:url" content="${p.canon}">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_TN">
<link rel="canonical" href="${p.canon}">
${estAccueil ? '<link rel="preload" as="image" href="assets/video/demo-hero-poster.webp?v=11" fetchpriority="high">\n' : ''}<link rel="preload" as="font" type="font/woff2" href="assets/fonts/bricolage-grotesque-latin.woff2" crossorigin>
<link rel="stylesheet" href="assets/css/v4.css?v=8">
<link rel="stylesheet" href="assets/css/v5.css?v=${V5}">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="assets/img/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">`;
}

// ── Navigation commune (pages secondaires) ──
const SOUS = [
  ['approvisionnements.html', '🧾', 'Approvisionnements &amp; factures', 'La facture entre toute seule'],
  ['comptabilite.html', '📒', 'Comptabilité', 'Votre comptable, dans votre dossier'],
  ['ventes-clients.html', '🤝', 'Ventes &amp; clients', 'Pros et particuliers, portail, factures'],
  ['stock-suivi.html', '📊', 'Stock, production &amp; suivi', 'Du stock au tableau de bord'],
];
const cur = (f, s) => (f === s ? ' aria-current="page"' : '');
const navLiens = (f) => `<div class="nav-liens">
      <div class="deroulant">
        <a href="index.html#preuves" aria-haspopup="true">Produits<i aria-hidden="true"></i></a>
        <div class="sous">
${SOUS.map(([s, ic, nom, det]) => `          <a href="${s}"${cur(f, s)}><span class="ic" aria-hidden="true">${ic}</span><span>${nom}<small>${det}</small></span></a>`).join('\n')}
        </div>
      </div>
      <a href="index.html#demo">Démo</a>
      <a href="tarifs.html"${cur(f, 'tarifs.html')}>Combien ça coûte&nbsp;?</a>
      <a href="index.html#accompagnement">Accompagnement</a>
    </div>`;
const menuMobile = (f) => `<div class="menu-mobile" id="menu-mobile">
  <span class="mm-groupe">Produits</span>
${SOUS.map(([s, , nom]) => `  <a class="mm-sous" href="${s}"${cur(f, s)}>${nom}</a>`).join('\n')}
  <a href="index.html#demo">Démo</a>
  <a href="tarifs.html"${cur(f, 'tarifs.html')}>Combien ça coûte&nbsp;?</a>
  <a class="btn mm-cta" href="demande-acces.html"${cur(f, 'demande-acces.html')}>Demander un accès</a>
</div>`;
const pied = (f) => `<nav class="pied-liens" aria-label="Pied de page">
      <a href="index.html"${cur(f, 'index.html')}>Accueil</a>
${SOUS.map(([s, , nom]) => `      <a href="${s}"${cur(f, s)}>${nom}</a>`).join('\n')}
      <a href="demande-acces.html"${cur(f, 'demande-acces.html')}>Demande d'accès</a>
      <a href="tarifs.html"${cur(f, 'tarifs.html')}>Combien coûte LabFlow&nbsp;?</a>
      <a href="mentions-legales.html"${cur(f, 'mentions-legales.html')}>Mentions légales</a>
      <a href="confidentialite.html"${cur(f, 'confidentialite.html')}>Confidentialité</a>
    </nav>`;

(async () => {
  const manquants = new Set();
  const v4Index = execSync('git show main:index.html', { cwd: ROOT, encoding: 'utf8' });
  const videoV4 = v4Index.match(/<video id="hero-video"[\s\S]*?<\/video>/)[0];
  const modaleV4 = v4Index.match(/<!-- ══ MODALE VIDÉO[\s\S]*?<\/div>\n<\/div>/)[0];
  const scriptV4 = v4Index.match(/<script>[\s\S]*<\/script>/)[0];
  const partenairesV4 = v4Index.match(/<!-- Carrousel de partenaires[\s\S]*?<\/div>\n    <\/div>/)[0];

  // 1) feuille v5 : sans la barre de maquettes ni le thème clair
  let css = lire(path.join(MAQ, 'v5.css'));
  const couper = (s, de, a) => { const i = s.indexOf(de), j = s.indexOf(a); if (i < 0 || j < 0) throw new Error('section css ' + de); return s.slice(0, i) + s.slice(j); };
  css = couper(css, '/* ══ 1 · NAVIGATION ENTRE MAQUETTES', '/* ══ 2 · MENU');
  css = couper(css, '/* ══ 9 · THÈME CLAIR', '/* ══ 10 · VISUELS');
  css = css.split('\n').filter((l) => !l.startsWith('body.clair') && !l.includes('.maq-nav') && !l.startsWith('.note-maquette')).join('\n');
  css = css.replace(/^\/\* ═+\n[\s\S]*?═+ \*\/\n/, `/* LabFlow — site vitrine V5 (19/10/2026) : surcouche de v4.css.\n   Menu Produits, trois preuves, circuit à 7 étapes, hero « parcours », pages métier. */\n`);
  css += `\n/* ══ 12 · CAPTURES DANS LES CARTES PREUVES ══ */\n.preuve-visu .app.capture img{width:100%;height:100%;object-fit:cover;object-position:left top;display:block}\n.ecran-visu img{width:100%;height:auto;display:block}\n`;
  ecrire(path.join(ROOT, 'assets', 'css', 'v5.css'), css);

  // 2) pages issues des maquettes
  for (const [maquette, p] of Object.entries(PAGES)) {
    const estAccueil = p.sortie === 'index.html';
    let h = lire(path.join(MAQ, maquette));
    h = h.replace(/\.\.\/\.\.\//g, '');                                  // assets/ et pages à la racine
    h = h.replace(/<nav class="maq-nav"[\s\S]*?<\/nav>\n\n?/, '');
    h = h.replace(/<p class="legende centre note-maquette">[^<]*<\/p>\n?/g, '');
    h = h.replace(/\s*<a class="voir-demo" href="#[a-z]+">[\s\S]*?<\/a>/g, '');   // vidéos courtes : lot ultérieur
    h = h.replace(/href="accueil-b\.html/g, 'href="index.html');
    h = h.replace(/href="#final"/g, 'href="demande-acces.html"');
    h = h.replace(/<title>[^<]*<\/title>\n<meta name="robots" content="noindex">\n<link rel="preload"[^\n]*\n<link rel="stylesheet" href="assets\/css\/v4\.css\?v=8">\n<link rel="stylesheet" href="v5\.css">\n<link rel="icon"[^\n]*/, tete(p, estAccueil));
    if (!h.includes('<link rel="canonical"')) throw new Error(maquette + ' : tête non remplacée');
    if (estAccueil) {
      h = h.replace(/<video id="hero-video"[\s\S]*?<\/video>/, videoV4);
      h = h.replace(/<a class="voir-demo reveal" href="#demo">([\s\S]*?)<\/a>/, '<button type="button" class="voir-demo reveal" id="ouvrir-demo">$1</button>').replace('(2 min)', '(1 min 30)');
      if (!h.includes('id="ouvrir-demo"')) throw new Error('bouton démo non posé');
      h = h.replace('<a class="marque" href="#top"', '<a class="marque" href="index.html"');
      // partenaires (contrat inchangé) après les quatre cartes d'accompagnement
      h = remplacerDiv(h, '<div class="quatre">', (bloc) => bloc + '\n    ' + partenairesV4);
      h = h.replace(/<\/footer>\n\n<script>[\s\S]*<\/script>/, '</footer>\n\n' + modaleV4 + '\n\n' + scriptV4);
      if (!h.includes('id="demo-modale"')) throw new Error('modale démo non posée');
      h = h.replace(/(<a href="index\.html"[^>]*>Accueil<\/a>)/, '<a href="index.html" aria-current="page">Accueil</a>');
    }
    h = await remplacerSchemas(h, maquette, manquants);
    // mention de démonstration sur chaque capture réelle
    h = h.replace(/(<img src="assets\/img\/ecran-[^"]+" alt=")([^"]*)(")/g, (m, a, alt, b) => a + (alt.includes(MENTION) ? alt : alt.replace(/\.?\s*$/, '') + '. ' + MENTION + '.') + b);
    h = h.replace(/aria-label="Boucle de démonstration[^"]*"/, '');
    ecrire(path.join(ROOT, p.sortie), h);
    console.log('✓', p.sortie, Math.round(h.length / 1024), 'Ko');
  }

  // 3) pages secondaires : navigation Produits + v5.css
  for (const f of ['tarifs.html', 'demande-acces.html', 'merci.html', 'mentions-legales.html', 'confidentialite.html', '404.html']) {
    const fp = path.join(ROOT, f);
    let h = lire(fp);
    if (!h.includes('assets/css/v5.css')) h = h.replace('<link rel="stylesheet" href="assets/css/v4.css?v=8">', `<link rel="stylesheet" href="assets/css/v4.css?v=8">\n<link rel="stylesheet" href="assets/css/v5.css?v=${V5}">`);
    else h = h.replace(/assets\/css\/v5\.css\?v=\d+/, `assets/css/v5.css?v=${V5}`);
    h = remplacerDiv(h, '<div class="nav-liens">', navLiens(f), false);
    h = remplacerDiv(h, '<div class="menu-mobile" id="menu-mobile">', menuMobile(f), false);
    h = h.replace(/<nav class="pied-liens" aria-label="Pied de page">[\s\S]*?<\/nav>/, pied(f));
    ecrire(fp, h);
    console.log('✓', f, '(navigation)');
  }

  // 4) sitemap + verify-pages
  let sm = lire(path.join(ROOT, 'sitemap.xml'));
  sm = sm.replace(/<lastmod>[^<]+<\/lastmod>/g, `<lastmod>${AUJOURDHUI}</lastmod>`);
  if (!sm.includes('approvisionnements.html')) {
    const urls = SOUS.map(([s]) => `  <url>\n    <loc>https://labflow-tn.com/${s}</loc>\n    <lastmod>${AUJOURDHUI}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>`).join('\n');
    sm = sm.replace('</urlset>', urls + '\n</urlset>').replace('3 URLs indexables', '7 URLs indexables (V5 : 4 pages Produits)');
  }
  ecrire(path.join(ROOT, 'sitemap.xml'), sm);
  const vp = path.join(ROOT, 'tools', 'verify-pages.js');
  let v = lire(vp);
  if (!v.includes("'/approvisionnements.html'")) {
    // le fichier peut être en CRLF : on remplace le seul segment « '/', '/tarifs.html', »
    v = v.replace("'/', '/tarifs.html',", "'/', '/approvisionnements.html', '/comptabilite.html', '/ventes-clients.html', '/stock-suivi.html', '/tarifs.html',");
    v = v.replace("const DUREE_VIDEO_ATTENDUE = 89.7;", "const DUREE_VIDEO_ATTENDUE = 89.7;\n// V5 (19/10/2026) : index.html = accueil B des maquettes ; 4 pages Produits en plus.");
    ecrire(vp, v);
  }

  if (manquants.size) {
    console.log(`\n${SCHEMAS_OK ? '⚠️' : '❌'} captures manquantes : ${[...manquants].join(', ')}`);
    if (!SCHEMAS_OK) { console.log('   → lancer tools/capture-v5.js, ou --schemas pour un aperçu local.'); process.exit(1); }
  } else console.log('\n✅ toutes les captures sont en place');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
