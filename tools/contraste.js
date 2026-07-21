/**
 * Calcul WCAG 2.x des ratios de contraste + garde-fou de la palette « Nuit &
 * Lumière » (v4). Aucune dépendance. Deux usages :
 *   node tools/contraste.js              → imprime le tableau, exit 1 si un échec
 *   require('./contraste.js').verifier() → depuis verify-pages.js
 *
 * Ce fichier est la SOURCE DE VÉRITÉ des jetons de couleur : toute modification
 * du :root de assets/css/v4.css doit être reportée dans T ci-dessous, sinon le
 * garde-fou (verifierSource) valide une palette qui n'est plus celle du site.
 *
 * Thème verrouillé (tools/maquette-nuit.html, validé mot pour mot par le client) :
 * fond noir, le dégradé du logo (ciel → indigo → violet) est la SEULE lumière.
 * Palette bien plus courte que l'ancien thème clair : ce fichier a été refait
 * pour v4 (l'ancien tableau clair — encre/lin/surface/ambre/… — n'existe plus).
 */

const canal = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => canal(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** Aplatit un blanc translucide (--verre, --trait-controle) d'opacité o sur un fond hex.
 *  Le thème n'a plus de voile noir : ses surfaces sont du blanc à faible opacité sur le noir. */
const surNuit = (o, base) =>
  '#' + [1, 3, 5]
    .map((i) => Math.round(255 * o + parseInt(base.slice(i, i + 2), 16) * (1 - o)))
    .map((c) => c.toString(16).padStart(2, '0')).join('');

const T = {
  // Fonds de section
  nuit: '#04050B', nuit2: '#080A14',
  // Texte
  blanc: '#F7F8FC', gris: '#A6ACC4', grisFonce: '#767D96',
  // Arrêts du dégradé CLAIR --grad (décoratifs : lumière, halos, filets — jamais du texte)
  ciel: '#0EA5E9', indigo: '#6366F1', violet: '#A855F7',
  // Arrêts du dégradé ASSOMBRI --grad-btn (surfaces qui PORTENT du texte blanc)
  cielBtn: '#0A78AB', indigoBtn: '#4F46E5', violetBtn: '#8B33D4',
  // États
  ok: '#5AD07A', erreur: '#FCA5A5',
  // Indicateur de focus (:focus-visible → outline #A5B4FC ; littéral, non tokenisé)
  focus: '#A5B4FC',
  // Littéraux du thème repris tels quels (non tokenisés dans le :root)
  pastille: '#C6CCE6', oeil: '#8B93B4', rubanBarre: '#8A90A8',
  liste: '#D4D9EC', tag: '#CBD1EC',
};

// Surfaces composites réelles : --verre (blanc .035) et --trait-controle (blanc .22)
// aplatis sur chaque fond. Ce sont les fonds effectifs des cartes et des champs.
const verre = surNuit(0.035, T.nuit);
const verre2 = surNuit(0.035, T.nuit2);
const traitC = surNuit(0.22, T.nuit);
const traitC2 = surNuit(0.22, T.nuit2);

// seuil : 4.5 texte normal · 3 texte large et 1.4.11 (composants) · 0 = informatif / anti-régression
const REGLES = [
  // — Texte principal et secondaire sur les deux fonds de section —
  ['--blanc / --nuit',                 T.blanc, T.nuit, 4.5],
  ['--blanc / --nuit-2',               T.blanc, T.nuit2, 4.5],
  ['--gris / --nuit',                  T.gris, T.nuit, 4.5],
  ['--gris / --nuit-2',                T.gris, T.nuit2, 4.5],
  ['--gris / carte (verre/nuit)',      T.gris, verre, 4.5],
  // — Texte tertiaire (--gris-fonce) : petit texte, 4,5:1. Pire cas = champ (verre) sur nuit-2 —
  ['--gris-fonce / --nuit',                 T.grisFonce, T.nuit, 4.5],
  ['--gris-fonce / --nuit-2',               T.grisFonce, T.nuit2, 4.5],
  ['--gris-fonce / champ (verre/nuit)',     T.grisFonce, verre, 4.5],
  ['--gris-fonce / champ (verre/nuit-2)',   T.grisFonce, verre2, 4.5],
  // — États (texte) —
  ['--ok / --nuit',                    T.ok, T.nuit, 4.5],
  ['--erreur / --nuit',                T.erreur, T.nuit, 4.5],
  // — Littéraux repris du thème validé (texte sur fond noir) —
  ['pastille #C6CCE6 / --nuit',        T.pastille, T.nuit, 4.5],
  ['oeil #8B93B4 / --nuit',            T.oeil, T.nuit, 4.5],
  ['oeil #8B93B4 / --nuit-2',          T.oeil, T.nuit2, 4.5],
  ['ruban-barre #8A90A8 / --nuit',     T.rubanBarre, T.nuit, 4.5],
  ['liste #D4D9EC / --nuit',           T.liste, T.nuit, 4.5],
  ['tag #CBD1EC / --nuit-2',           T.tag, T.nuit2, 4.5],
  // — Indicateur de focus (1.4.11) : outline #A5B4FC, 3:1 sur chaque fond —
  ['focus #A5B4FC / --nuit',           T.focus, T.nuit, 3],
  ['focus #A5B4FC / --nuit-2',         T.focus, T.nuit2, 3],

  // ── Boutons et pastilles : #fff sur le dégradé ASSOMBRI --grad-btn ─────────
  //    Le --grad clair échouait l'AA sous le texte (ciel 2,77:1). --grad-btn
  //    (stops assombris) est appliqué aux SEULES surfaces porteuses de texte
  //    (.btn, .regard.moi .tag, .progression .pas.actif .puce, .f-radio button.on,
  //    .es .pastille) et doit tenir 4,5:1 à CHAQUE arrêt. Le pire cas = le ciel.
  ['btn #fff / --grad-btn ciel',   '#FFFFFF', T.cielBtn,   4.5],
  ['btn #fff / --grad-btn indigo', '#FFFFFF', T.indigoBtn, 4.5],
  ['btn #fff / --grad-btn violet', '#FFFFFF', T.violetBtn, 4.5],
  //    --trait-controle est un blanc à .22 : ~1,9:1 sur le noir. Il n'est PAS
  //    l'indicateur de focus conforme (c'est l'outline #A5B4FC, ~10:1 ci-dessus).
  ['⚠ --trait-controle comp / --nuit',   traitC,  T.nuit,  0, 'bord translucide ~1,85:1 — focus conforme = outline #A5B4FC'],
  ['⚠ --trait-controle comp / --nuit-2', traitC2, T.nuit2, 0, 'bord translucide ~1,91:1 — focus conforme = outline #A5B4FC'],

  // ── Anti-régression : les arrêts du dégradé sont DÉCORATIFS. Un ratio qui
  //    grimperait ici signalerait un jeton détourné en couleur de texte.
  ['⛔ --indigo / --nuit (décor seul)', T.indigo, T.nuit, 0, 'décor — dégradé/halo, jamais du texte'],
  ['⛔ --violet / --nuit (décor seul)', T.violet, T.nuit, 0, 'décor — dégradé/halo, jamais du texte'],
];

function verifier({ silencieux = false } = {}) {
  const echecs = [];
  const lignes = REGLES.map(([nom, a, b, seuil, note]) => {
    const r = ratio(a, b);
    const ok = seuil === 0 ? true : r >= seuil;
    if (!ok) echecs.push(`contraste ${nom} = ${r.toFixed(2)}:1 (exigé ${seuil}:1)`);
    return `   ${ok ? '✓' : '✗'} ${nom.padEnd(40)} ${r.toFixed(2).padStart(6)}:1` +
           (seuil ? ` (≥ ${seuil})` : `  (${note || 'décor, informatif'})`);
  });
  if (!silencieux) {
    console.log('\n── contrastes (WCAG 2.x, sRGB) — thème Nuit (v4)');
    lignes.forEach((l) => console.log(l));
    console.log(`   ${echecs.length ? '❌ ' + echecs.length + ' échec(s)' : '✅ 0 échec'} sur ${REGLES.length} règles`);
  }
  return { echecs, total: REGLES.length };
}

/* ──────────────────────────────────────────────────────────────────────────
   Garde anti-dérive : T ci-dessus n'est qu'une COPIE de la palette. Si le
   :root de v4.css évolue sans être reporté ici, ce script validerait une
   palette fantôme et imprimerait « 0 échec » pendant que le site sert des
   couleurs non conformes. On relit donc la feuille réelle et on compare.
   NB : seuls les jetons EN #hex sont vérifiables ici — les jetons translucides
   (--verre, --trait, --trait-controle : rgba) sont hors de ce miroir.
   ────────────────────────────────────────────────────────────────────────── */
const CSS = require('path').join(__dirname, '..', 'assets', 'css', 'v4.css');
const MIROIR = {
  '--ciel': 'ciel', '--indigo': 'indigo', '--violet': 'violet',
  '--nuit': 'nuit', '--nuit-2': 'nuit2',
  '--blanc': 'blanc', '--gris': 'gris', '--gris-fonce': 'grisFonce',
  '--ok': 'ok', '--erreur': 'erreur',
};

function verifierSource({ silencieux = false } = {}) {
  const fs = require('fs');
  if (!fs.existsSync(CSS)) {
    if (!silencieux) console.log('\n── palette : assets/css/v4.css absent, comparaison ignorée');
    return { echecs: [] };
  }
  const src = fs.readFileSync(CSS, 'utf8');
  const echecs = [];
  for (const [nom, cle] of Object.entries(MIROIR)) {
    // \s*:\s* impose le « : » juste après le nom → --nuit ne capture pas --nuit-2.
    const m = src.match(new RegExp('\\' + nom + '\\s*:\\s*(#[0-9A-Fa-f]{6})\\b'));
    if (!m) { echecs.push(`jeton ${nom} introuvable dans v4.css`); continue; }
    if (m[1].toUpperCase() !== T[cle].toUpperCase())
      echecs.push(`dérive ${nom} : v4.css sert ${m[1].toUpperCase()}, ce script valide ${T[cle]}`);
  }
  if (!silencieux) {
    console.log('\n── palette : v4.css vs jetons validés');
    console.log(`   ${echecs.length ? '❌ ' + echecs.length + ' dérive(s)' : '✅ palette conforme'} sur ${Object.keys(MIROIR).length} jetons`);
  }
  return { echecs };
}

module.exports = { ratio, lum, surNuit, verifier, verifierSource, T };

if (require.main === module) {
  const { echecs } = verifier();
  const { echecs: drift } = verifierSource();
  const tous = [...echecs, ...drift];
  if (tous.length) { tous.forEach((e) => console.error('   ❌ ' + e)); process.exit(1); }
}
