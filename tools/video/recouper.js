/**
 * Recoupe la démonstration sonorisée : retire deux plans et refait la clôture.
 *
 * Pourquoi : la décision client D5 interdit d'afficher au visiteur un chiffre
 * ou un délai non vérifié. Trois plans du montage d'origine en projetaient :
 *
 *   • 05-principe    (26,75 → 32,25 s) — la cascade « 1,904→2,290 ·
 *     1,375→1,408 · 67,0→66,7 ». Ces trois valeurs ont été retirées de
 *     index.html (cf. le commentaire D5 de la section #principe) : elles ne
 *     peuvent pas continuer d'être diffusées en mouvement.  → RETIRÉ
 *   • 16-excel-fiche (48,45 → 53,95 s) — le contenu de
 *     assets/files/fiche-technique-exemple.xlsx, fichier déclaré FAUX par D5
 *     (5 ingrédients sur 9 à 0 DT) et retiré du dépôt.  → RETIRÉ
 *   • 18-cloture     (84,75 → 89,80 s) — affichait « ✓ Réponse sous 24 h »,
 *     délai retiré des neuf emplacements du site (§6.2.6).  → REFAIT par
 *     tools/video/refaire-cloture.js, à lancer AVANT ce script.
 *
 * Le remontage complet (monter.js + sonoriser.js) n'est pas rejouable : la
 * vidéo muette de travail et le fichier de musique source ne sont plus dans le
 * dépôt. On coupe donc directement dans le master sonorisé, en un seul
 * réencodage pour ne pas empiler les générations.
 *
 * Les bornes des deux coupes tombent exactement sur des images à pleine
 * opacité des plans voisins (fondus de 0,45 s entièrement contenus dans les
 * segments retirés) : la coupe est franche, sans image fantôme. Vérifié image
 * par image. La clôture, elle, est réintroduite par un fondu enchaîné de
 * 0,45 s, exactement comme le faisait monter.js.
 *
 * L'audio est une nappe musicale sans parole : on la reprend en continu depuis
 * le début (aucun saut audible) et on refait le fondu de sortie.
 *
 * Durée : 89,80 s → 78,80 s (inchangée en fin de compte, la clôture refaite
 * ayant la même longueur que l'ancienne). Les six `data-t` du chapitrage
 * d'index.html et merci.html ont été recalculés en conséquence :
 * 5 · 16 · 37 · 47 · 63 · 69.
 *
 * Run : node tools/video/refaire-cloture.js && node tools/video/recouper.js
 *       (le master d'origine se récupère par `git show HEAD:assets/video/demo-60s-son.mp4`)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const OUT = path.join(__dirname, '..', '..', 'assets', 'video');
const SRC = process.argv[2] || path.join(OUT, 'demo-60s-son.mp4');
const CLOTURE = path.join(__dirname, 'seq', '18-cloture.mp4');
const DST = path.join(OUT, 'demo-60s-son.mp4');
const TMP = path.join(OUT, 'demo-60s-son.recoupe.mp4');

// Segments CONSERVÉS du master, en secondes. Les deux trous correspondent aux
// plans 05-principe et 16-excel-fiche ; la borne finale 84,75 coupe l'ancienne
// clôture, remplacée plus bas.
const GARDES = [[0, 26.75], [32.25, 48.45], [53.95, 84.75]];
const FONDU = 0.45;   // identique à monter.js
const D_CLOTURE = 5.5;
const FADE_OUT = 2.5;

for (const f of [SRC, CLOTURE]) {
  if (!fs.existsSync(f)) { console.error('Introuvable : ' + f); process.exit(1); }
}

const dCorps = GARDES.reduce((s, [a, b]) => s + (b - a), 0);
const dureeFinale = dCorps + D_CLOTURE - FONDU;

const parts = GARDES.map(([a, b], i) =>
  `[0:v]trim=start=${a}:end=${b},setpts=PTS-STARTPTS[v${i}]`).join(';');
// settb=AVTB des deux côtés : xfade refuse de s'initialiser si ses deux entrées
// n'ont pas la même base de temps (concat rend 1/1000000, scale garde 1/30).
const concat = GARDES.map((_, i) => `[v${i}]`).join('')
  + `concat=n=${GARDES.length}:v=1:a=0,fps=30,settb=AVTB[corps]`;
// La clôture est en 1440×810 (format de tournage) : on la ramène au format de
// diffusion AVANT le fondu, xfade exigeant deux entrées de mêmes dimensions.
const cloture = `[1:v]scale=1280:720,fps=30,format=yuv420p,setpts=PTS-STARTPTS,settb=AVTB[fin]`;
const fondu = `[corps][fin]xfade=transition=fade:duration=${FONDU}:offset=${(dCorps - FONDU).toFixed(3)}[v]`;
const audio = `[0:a]atrim=start=0:end=${dureeFinale.toFixed(2)},asetpts=PTS-STARTPTS,`
  + `afade=t=out:st=${(dureeFinale - FADE_OUT).toFixed(2)}:d=${FADE_OUT}[a]`;

console.log(`✂  89,80 s → ${dureeFinale.toFixed(2)} s (2 plans retirés, clôture refaite)`);

execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y',
  '-i', SRC, '-i', CLOTURE,
  '-filter_complex', `${parts};${concat};${cloture};${fondu};${audio}`,
  '-map', '[v]', '-map', '[a]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '29', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
  '-movflags', '+faststart', TMP], { stdio: ['ignore', 'inherit', 'inherit'] });

// copyFile puis unlink, et non rename : sous Windows, renommer PAR-DESSUS un
// fichier existant remonte EPERM dès que la cible est ouverte ailleurs.
fs.copyFileSync(TMP, DST);
fs.unlinkSync(TMP);
console.log(`🔊 demo-60s-son.mp4 — ${Math.round(fs.statSync(DST).size / 1024)} Ko`);
console.log('\n⚠️  Chapitrage attendu (index.html ET merci.html) : 5 · 16 · 37 · 47 · 63 · 69');
