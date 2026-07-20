/**
 * Calcul WCAG 2.x des ratios de contraste + garde-fou du tableau §8.3.
 * Aucune dépendance. Deux usages :
 *   node tools/contraste.js              → imprime le tableau, exit 1 si un échec
 *   require('./contraste.js').verifier() → depuis verify-pages.js
 *
 * Ce fichier est la SOURCE DE VÉRITÉ des jetons de couleur : toute modification
 * du :root de assets/css/v3.css doit être reportée dans T ci-dessous, sinon le
 * garde-fou valide une palette qui n'est plus celle du site.
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
/** Aplatit une couleur sous un voile noir bleuté d'opacité o (--grad-marque-texte). */
const voile = (hex, o, sur = [13, 16, 30]) =>
  '#' + [1, 3, 5]
    .map((i, k) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - o) + sur[k] * o))
    .map((c) => c.toString(16).padStart(2, '0')).join('');

const T = {
  lin: '#F7F5F1', surface: '#FFFFFF', surface2: '#F1EEE7',
  trait: '#E7E2D9', traitControle: '#8F8779', traitFort: '#C9C2B4',
  bgNuit: '#101322', nuitCoeur: '#0B0E1A', surfaceNuit: '#151B2E',
  traitNuit: '#232B42', traitControleNuit: '#5C6A93',
  encre: '#1A1F2E', encre2: '#5A6072', texteNuit: '#E8EAF2', texteNuit2: '#9AA3C7',
  ciel: '#0EA5E9', indigo: '#6366F1', violet: '#A855F7', indigoLien: '#4F46E5',
  ambre: '#B8721F', ambreFort: '#96590C', ambreNuit: '#FFB454',
  vert: '#0F9D6E', vertFort: '#0B7350', vertNuit: '#3DDC97',
  rouge: '#C2410C', rougeNuit: '#FB923C',
  erreur: '#B91C1C', erreurFond: '#FDECEC',
  // ÉCART 3 (trouvé par ce script, absent du tableau §8.3) : le brief fixe
  // --seuil-rupture: #DC2626, or .seuil--rupture est du TEXTE de 0,78rem/700,
  // donc soumis au seuil 4,5:1. #DC2626 ne donne que 4,44:1 sur le lin et
  // 4,17:1 sur surface-2 → ÉCHEC AA. Corrigé en #CE2020 (même rouge, 5,01:1
  // sur lin), qui reste nettement distinct de --rouge-cout #C2410C.
  // ⚠️ assets/css/v3.css DOIT reprendre #CE2020, pas #DC2626.
  seuilRupture: '#CE2020',
  safran: '#E39A2E', focus: '#4F46E5', focusNuit: '#A5B4FC',
  pdf: '#C0392B', xls: '#1E7145', wa: '#1D9E4B',
};

// seuil : 4.5 texte normal · 3 texte large et 1.4.11 (composants) · 0 = décor, informatif
const REGLES = [
  ['--encre / lin',                 T.encre, T.lin, 4.5],
  ['--encre-2 / lin',               T.encre2, T.lin, 4.5],
  ['--encre-2 / surface-2',         T.encre2, T.surface2, 4.5],
  ['--indigo-lien / lin',           T.indigoLien, T.lin, 4.5],
  ['--indigo-lien / blanc',         T.indigoLien, T.surface, 4.5],
  ['--ambre-dt-fort / lin',         T.ambreFort, T.lin, 4.5],
  ['--vert-marge-fort / lin',       T.vertFort, T.lin, 4.5],
  ['--rouge-cout / lin',            T.rouge, T.lin, 4.5],
  ['--ambre-dt / lin (LARGE)',      T.ambre, T.lin, 3],
  ['--vert-marge / lin (LARGE)',    T.vert, T.lin, 3],
  ['--texte-nuit / bg-nuit',        T.texteNuit, T.bgNuit, 4.5],
  ['--texte-nuit-2 / bg-nuit',      T.texteNuit2, T.bgNuit, 4.5],
  ['--texte-nuit-2 / surface-nuit', T.texteNuit2, T.surfaceNuit, 4.5],
  ['--texte-nuit-2 / nuit-coeur',   T.texteNuit2, T.nuitCoeur, 4.5],
  ['--ambre-dt-nuit / surface-nuit',T.ambreNuit, T.surfaceNuit, 4.5],
  ['--vert-marge-nuit / surf-nuit', T.vertNuit, T.surfaceNuit, 4.5],
  ['--rouge-cout-nuit / surf-nuit', T.rougeNuit, T.surfaceNuit, 4.5],
  ['--erreur / --erreur-fond',      T.erreur, T.erreurFond, 4.5],
  ['badge PDF (blanc / #C0392B)',   T.surface, T.pdf, 4.5],
  ['badge XLSX (blanc / #1E7145)',  T.surface, T.xls, 4.5],
  ['pastille annote (blanc / indigo-lien)', T.surface, T.indigoLien, 4.5],
  // 1.4.11 — composants et bordures, 3:1 contre CHAQUE fond adjacent.
  // --trait-controle est testé contre blanc ET lin : un champ blanc posé sur le
  // lin a son bord au contact des deux. C'est l'omission qui avait laissé passer
  // #9A9285 (2,83:1 sur lin) — voir §1.3 écart 1.
  ['--trait-controle / blanc',      T.traitControle, T.surface, 3],
  ['--trait-controle / lin',        T.traitControle, T.lin, 3],
  ['--trait-controle-nuit / bg-nuit', T.traitControleNuit, T.bgNuit, 3],
  ['--trait-controle-nuit / surf-nuit', T.traitControleNuit, T.surfaceNuit, 3],
  ['--focus / lin',                 T.focus, T.lin, 3],
  ['--focus / blanc',               T.focus, T.surface, 3],
  ['--focus-nuit / bg-nuit',        T.focusNuit, T.bgNuit, 3],
  // .seuil--rupture / .seuil--alerte sont du texte 0,78rem gras : seuil 4,5:1,
  // testé sur les TROIS surfaces claires (surface-2 est le pire cas, pas le lin).
  ['--seuil-rupture / lin',         T.seuilRupture, T.lin, 4.5],
  ['--seuil-rupture / surface-2',   T.seuilRupture, T.surface2, 4.5],
  ['--rouge-cout / blanc',          T.rouge, T.surface, 4.5],
  // Bouton primaire : blanc sur les TROIS arrêts du dégradé voilé à 30 %.
  // Tester une moyenne masquait l'échec côté ciel (voile 22 % = 4,16:1) — faille A.
  ['btn blanc / ciel voilé 30%',    T.surface, voile(T.ciel, 0.30), 4.5],
  ['btn blanc / indigo voilé 30%',  T.surface, voile(T.indigo, 0.30), 4.5],
  ['btn blanc / violet voilé 30%',  T.surface, voile(T.violet, 0.30), 4.5],
  // Anti-régressions : ces paires DOIVENT rester basses. Un ratio qui monte
  // signale un jeton détourné de son rôle (décor promu en texte).
  ['⛔ --indigo / lin (texte interdit)', T.indigo, T.lin, 0],
  ['⛔ --safran / lin (décor seul)',     T.safran, T.lin, 0],
  ['⛔ --trait / lin (décor seul)',      T.trait, T.lin, 0],
  ['⛔ --trait-fort / lin (décor porteur)', T.traitFort, T.lin, 0],
  ['⛔ blanc / #25D366 (motive .btn-outline)', T.surface, '#25D366', 0],
  // --focus-anneau = rgba(99,102,241,.35). Composité sur blanc il donne ≈ #C4C5FA,
  // soit ~1,4:1 : il ne PEUT PAS servir d'unique indicateur de focus (1.4.11).
  // Il est resté hors radar tant qu'aucune règle ne le nommait — d'où cette
  // ligne. Seuil 0 : c'est un halo décoratif, l'indicateur conforme est
  // l'outline --focus posée en focus-visible (cf. demande-acces.html).
  ['⛔ --focus-anneau composité / blanc (halo seul)', voile(T.indigo, 0.65, [255, 255, 255]), T.surface, 0,
    'halo décoratif — l’indicateur conforme est l’outline --focus'],
  // Combinaison à NE PAS créer : --rouge-cout tombe à 4,47:1 sur --surface-2.
  // Aucun composant ne la produit aujourd'hui (surface-2 ne porte que --encre
  // et --encre-2). Surveillée ici pour qu'un futur .chiffre--cout posé dans une
  // .onglet-pill ou un :hover de .btn-outline ne passe pas inaperçu.
  ['⚠ --rouge-cout / surface-2', T.rouge, T.surface2, 0, 'interdit — 4,47:1, ne pas combiner'],
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
    console.log('\n── contrastes (WCAG 2.x, sRGB)');
    lignes.forEach((l) => console.log(l));
    console.log(`   ${echecs.length ? '❌ ' + echecs.length + ' échec(s)' : '✅ 0 échec'} sur ${REGLES.length} règles`);
  }
  return { echecs, total: REGLES.length };
}

/* ──────────────────────────────────────────────────────────────────────────
   Garde anti-dérive : T ci-dessus n'est qu'une COPIE de la palette. Si le
   :root de v3.css évolue sans être reporté ici, ce script validerait une
   palette fantôme et imprimerait « 0 échec » pendant que le site sert des
   couleurs non conformes. On relit donc la feuille réelle et on compare.
   ────────────────────────────────────────────────────────────────────────── */
const CSS = require('path').join(__dirname, '..', 'assets', 'css', 'v3.css');
const MIROIR = {
  '--bg-lin': 'lin', '--surface': 'surface', '--surface-2': 'surface2',
  '--trait': 'trait', '--trait-controle': 'traitControle', '--trait-fort': 'traitFort',
  '--bg-nuit': 'bgNuit', '--nuit-coeur': 'nuitCoeur', '--surface-nuit': 'surfaceNuit',
  '--trait-nuit': 'traitNuit', '--trait-controle-nuit': 'traitControleNuit',
  '--encre': 'encre', '--encre-2': 'encre2',
  '--texte-nuit': 'texteNuit', '--texte-nuit-2': 'texteNuit2',
  '--ciel': 'ciel', '--indigo': 'indigo', '--violet': 'violet', '--indigo-lien': 'indigoLien',
  '--ambre-dt': 'ambre', '--ambre-dt-fort': 'ambreFort', '--ambre-dt-nuit': 'ambreNuit',
  '--vert-marge': 'vert', '--vert-marge-fort': 'vertFort', '--vert-marge-nuit': 'vertNuit',
  '--rouge-cout': 'rouge', '--rouge-cout-nuit': 'rougeNuit',
  '--erreur': 'erreur', '--erreur-fond': 'erreurFond', '--seuil-rupture': 'seuilRupture',
  '--safran': 'safran', '--focus': 'focus', '--focus-nuit': 'focusNuit',
};

function verifierSource({ silencieux = false } = {}) {
  const fs = require('fs');
  if (!fs.existsSync(CSS)) {
    if (!silencieux) console.log('\n── palette : assets/css/v3.css absent, comparaison ignorée');
    return { echecs: [] };
  }
  const src = fs.readFileSync(CSS, 'utf8');
  const echecs = [];
  for (const [nom, cle] of Object.entries(MIROIR)) {
    const m = src.match(new RegExp('\\' + nom + '\\s*:\\s*(#[0-9A-Fa-f]{6})\\b'));
    if (!m) { echecs.push(`jeton ${nom} introuvable dans v3.css`); continue; }
    if (m[1].toUpperCase() !== T[cle].toUpperCase())
      echecs.push(`dérive ${nom} : v3.css sert ${m[1].toUpperCase()}, ce script valide ${T[cle]}`);
  }
  if (!silencieux) {
    console.log('\n── palette : v3.css vs jetons validés');
    console.log(`   ${echecs.length ? '❌ ' + echecs.length + ' dérive(s)' : '✅ palette conforme'} sur ${Object.keys(MIROIR).length} jetons`);
  }
  return { echecs };
}

module.exports = { ratio, lum, voile, verifier, verifierSource, T };

if (require.main === module) {
  const { echecs } = verifier();
  const { echecs: drift } = verifierSource();
  const tous = [...echecs, ...drift];
  if (tous.length) { tous.forEach((e) => console.error('   ❌ ' + e)); process.exit(1); }
}
