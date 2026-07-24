/**
 * Montage de la vidéo de démonstration à partir des séquences de tools/video/seq/.
 *
 * Deux passes, pour rester vérifiable :
 *   1. Normalisation — chaque plan est ramené au même format ; les CARTONS (plans
 *      fixes) reçoivent un très léger zoom avant, sans quoi ils paraissent morts.
 *   2. Assemblage — fondus enchaînés (xfade) entre les plans, puis encodage
 *      MP4 (H.264) + WebM (VP9) + image d'attente.
 *
 * Sortie : assets/video/demo-60s.{mp4,webm}, demo-hero.{mp4,webm} (extrait court
 * pour l'accueil) et demo-poster.jpg.
 *
 * Run : node tools/video/monter.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const SEQ = path.join(__dirname, 'seq');
const NORM = path.join(SEQ, 'norm');
const OUT = path.join(__dirname, '..', '..', 'assets', 'video');
// Chaîne 4K NATIVE (2026-07-24) : séquences tournées en 3840×2160 (tourner.js,
// DSF 8/3), normalisées/assemblées à cette résolution, encodage final en 2160p —
// AUCUNE descente de qualité (demande client : « la vidéo démo en 4K »).
const W = 3840, H = 2160, FPS = 30;
const FONDU = 0.45; // durée d'un fondu enchaîné, en secondes

// Ordre de montage (refonte 2026-07-24 : migration + accompagnement + IA).
// `carton: true` = plan fixe → léger zoom avant.
// ⛔ D5 — plans définitivement RETIRÉS, ne pas les remettre :
//    '05-principe' (cascade aux valeurs fausses), '16-excel-fiche' (xlsx faux).
const PLAN = [
  { f: '01-ouverture', carton: true },
  { f: '02-dashboard' },
  { f: '03-probleme', carton: true },
  { f: '06-stock' },               // depuis le haut de l'écran, en descendant
  { f: '08-fiche-technique' },     // le coût en temps réel
  { f: '09-production' },          // les lignes AUTO qui déduisent
  { f: '19-migration-intro', carton: true },
  { f: '20-migration' },           // vrai import du modèle articles
  { f: '11-portail-intro', carton: true },
  { f: '12-portail' },
  { f: '10-commandes' },           // les commandes B2B viennent après le portail
  { f: '23-accompagnement-intro', carton: true },
  { f: '21-manuel' },              // le « ? » puis la fiche du manuel
  { f: '22-assistant' },           // le guide IA répond en direct
  { f: '18-cloture', carton: true },
];

const ff = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
const duree = (f) => {
  const probe = ffmpeg.replace(/ffmpeg(\.exe)?$/, (m) => m.replace('ffmpeg', 'ffprobe'));
  // ffprobe n'est pas fourni par ffmpeg-static : on lit la durée via ffmpeg lui-même.
  try {
    execFileSync(ffmpeg, ['-hide_banner', '-i', f, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) { /* ffmpeg sort en erreur avec -f null, la sortie est sur stderr */ }
  const out = (() => {
    try { execFileSync(ffmpeg, ['-hide_banner', '-i', f], { stdio: ['ignore', 'pipe', 'pipe'] }); return ''; }
    catch (e) { return (e.stderr || '').toString(); }
  })();
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error('durée introuvable pour ' + f + (probe ? '' : ''));
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
};

(async () => {
  fs.rmSync(NORM, { recursive: true, force: true });
  fs.mkdirSync(NORM, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  // ── 1. Normalisation ───────────────────────────────────────────────────────
  const durees = [];
  for (const p of PLAN) {
    const src = path.join(SEQ, p.f + '.mp4');
    if (!fs.existsSync(src)) throw new Error('séquence manquante : ' + p.f);
    const dst = path.join(NORM, p.f + '.mp4');
    const d = duree(src);
    if (p.carton) {
      // Zoom avant de 4 % sur toute la durée du plan : le carton respire.
      const frames = Math.round(d * FPS);
      ff(['-y', '-i', src, '-vf',
        `zoompan=z='min(1+0.04*on/${frames},1.04)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},format=yuv420p`,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-an', dst]);
    } else {
      ff(['-y', '-i', src, '-vf', `scale=${W}:${H},fps=${FPS},format=yuv420p`,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-an', dst]);
    }
    durees.push(duree(dst));
    console.log(`  ✓ ${p.f} — ${durees[durees.length - 1].toFixed(2)} s${p.carton ? ' (zoom)' : ''}`);
  }

  // ── 2. Assemblage avec fondus enchaînés ────────────────────────────────────
  // Chaque fondu consomme FONDU secondes sur la fin du plan précédent :
  // offset_n = (somme des durées jusqu'à n) − (n+1) × FONDU
  const entrees = PLAN.flatMap((p) => ['-i', path.join(NORM, p.f + '.mp4')]);
  let filtre = '';
  let label = '[0:v]';
  let cumul = durees[0];
  for (let i = 1; i < PLAN.length; i++) {
    const offset = (cumul - FONDU).toFixed(3);
    const sortie = i === PLAN.length - 1 ? '[v]' : `[x${i}]`;
    filtre += `${label}[${i}:v]xfade=transition=fade:duration=${FONDU}:offset=${offset}${sortie};`;
    label = `[x${i}]`;
    cumul = cumul + durees[i] - FONDU;
  }
  filtre = filtre.replace(/;$/, '');
  const totale = cumul;
  console.log(`\n⏱  Durée finale : ${totale.toFixed(1)} s`);

  // 2160p (4K) CRF 29 : le fichier reste en pleine résolution de tournage.
  // Le lecteur du site affiche ~940 px mais le plein écran / les écrans denses
  // profitent du 4K. Les Range (206) fonctionnent depuis le fix nginx/CF du
  // 24/07 — le poids se télécharge par morceaux, le seek marche.
  const mp4 = path.join(OUT, 'demo-60s.mp4');
  ff(['-y', ...entrees, '-filter_complex', filtre, '-map', '[v]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '29', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', mp4]);
  console.log(`🎞  demo-60s.mp4 (2160p) — ${Math.round(fs.statSync(mp4).size / 1024)} Ko`);
  // (Le WebM VP9 de la démo complète n'est plus produit : le lecteur du site
  //  est MP4 seul, et l'encodage VP9 4K coûterait très cher pour rien.)

  // ── Extrait pour le HERO du site ───────────────────────────────────────────
  // Uniquement des écrans de l'application, AUCUN carton de titre : la page porte
  // déjà son H1 juste à côté, un second titre dans la vidéo ferait doublon.
  // Muet, sans texte, pensé pour tourner en boucle derrière le discours.
  const HERO = ['02-dashboard', '06-stock', '12-portail'];
  const heroSrc = HERO.map((f) => path.join(NORM, f + '.mp4')).filter((f) => fs.existsSync(f));
  const heroFiltre = heroSrc.map((_, i) => `[${i}:v]trim=start=1:end=5,setpts=PTS-STARTPTS[h${i}]`).join(';')
    + ';' + heroSrc.map((_, i) => `[h${i}]`).join('') + `concat=n=${heroSrc.length}:v=1:a=0[hv]`;
  // 1880 px = 2× la largeur d'affichage du hero (~940 px) : rendu Retina parfait,
  // et le clip reste court (12 s) donc le poids reste raisonnable.
  const heroMp4 = path.join(OUT, 'demo-hero.mp4');
  ff(['-y', ...heroSrc.flatMap((f) => ['-i', f]), '-filter_complex', `${heroFiltre};[hv]scale=1880:-2[hs]`, '-map', '[hs]',
    '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '28', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', heroMp4]);
  const heroWebm = path.join(OUT, 'demo-hero.webm');
  ff(['-y', '-i', heroMp4, '-c:v', 'libvpx-vp9', '-crf', '42', '-b:v', '0', '-row-mt', '1', '-cpu-used', '2', '-an', heroWebm]);
  console.log(`🎞  demo-hero.mp4 — ${Math.round(fs.statSync(heroMp4).size / 1024)} Ko · .webm — ${Math.round(fs.statSync(heroWebm).size / 1024)} Ko`);

  // Image d'attente du hero : la PREMIÈRE image de l'extrait, pour qu'aucun saut
  // ne soit visible au démarrage de la lecture. En AVIF + WebP (budget de la page).
  for (const [ext, args] of [
    ['avif', ['-c:v', 'libaom-av1', '-crf', '32', '-cpu-used', '6', '-still-picture', '1']],
    ['webp', ['-quality', '72']],
  ]) {
    const p = path.join(OUT, `demo-hero-poster.${ext}`);
    ff(['-y', '-i', heroMp4, '-frames:v', '1', ...args, p]);
    console.log(`🖼  demo-hero-poster.${ext} — ${Math.round(fs.statSync(p).size / 1024)} Ko`);
  }

  // Image d'attente de la démo complète (lecteur « voir la démo »)
  const poster = path.join(OUT, 'demo-poster.jpg');
  ff(['-y', '-i', mp4, '-ss', '7.5', '-frames:v', '1', '-q:v', '4', poster]);
  console.log(`🖼  demo-poster.jpg — ${Math.round(fs.statSync(poster).size / 1024)} Ko`);

  console.log('\n✅ Montage terminé → assets/video/');
})();
