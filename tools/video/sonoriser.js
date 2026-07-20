/**
 * Ajoute une musique de fond à la vidéo de démonstration.
 *
 *   node tools/video/sonoriser.js "C:/chemin/vers/musique.mp3"
 *
 * Ce que fait le script, pour que le résultat sonne « monté » et pas « collé » :
 *   • coupe la musique à la durée exacte de la vidéo ;
 *   • ouverture en fondu (1,2 s) et fermeture en fondu (2,5 s) ;
 *   • normalisation du volume à −16 LUFS, la référence des plateformes web —
 *     sans quoi une piste trop forte sature et une piste trop faible s'entend à
 *     peine, selon le morceau fourni ;
 *   • réencode l'audio seul : la vidéo est copiée telle quelle (aucune perte
 *     d'image, et l'opération prend quelques secondes).
 *
 * Sortie : assets/video/demo-60s-son.mp4 et .webm, plus l'extrait court sonorisé.
 * L'original muet est conservé — rien n'est écrasé.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ffmpeg = require('ffmpeg-static');

const OUT = path.join(__dirname, '..', '..', 'assets', 'video');
const MUET = path.join(OUT, 'demo-60s.mp4');
const HERO_MUET = path.join(OUT, 'demo-hero.mp4');

const musique = process.argv[2];
if (!musique) {
  console.error('Usage : node tools/video/sonoriser.js "chemin/vers/musique.mp3"');
  process.exit(1);
}
if (!fs.existsSync(musique)) { console.error('Fichier audio introuvable : ' + musique); process.exit(1); }
if (!fs.existsSync(MUET)) { console.error('Vidéo muette introuvable — lancez d\'abord monter.js'); process.exit(1); }

const ff = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });

/** Durée d'un média, lue dans la sortie d'information de ffmpeg. */
const duree = (f) => {
  let out = '';
  try { execFileSync(ffmpeg, ['-hide_banner', '-i', f], { stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { out = (e.stderr || '').toString(); }
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error('durée illisible : ' + f);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
};

const dVideo = duree(MUET);
const dAudio = duree(musique);
console.log(`🎬 vidéo ${dVideo.toFixed(1)} s · 🎵 musique ${dAudio.toFixed(1)} s`);
if (dAudio < dVideo - 0.5) {
  console.warn(`⚠️  La musique est plus courte que la vidéo : elle sera bouclée pour combler ${(dVideo - dAudio).toFixed(1)} s.`);
}

const FADE_IN = 1.2;
const FADE_OUT = 2.5;
const filtreAudio = [
  `afade=t=in:st=0:d=${FADE_IN}`,
  `afade=t=out:st=${(dVideo - FADE_OUT).toFixed(2)}:d=${FADE_OUT}`,
  'loudnorm=I=-16:TP=-1.5:LRA=11', // niveau de référence du web
].join(',');

const sortieMp4 = path.join(OUT, 'demo-60s-son.mp4');
ff([
  '-y', '-i', MUET,
  '-stream_loop', '-1', '-i', musique,          // boucle si la piste est plus courte
  '-filter_complex', `[1:a]${filtreAudio}[a]`,
  '-map', '0:v', '-map', '[a]',
  '-c:v', 'copy',                                 // l'image n'est pas retouchée
  '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
  '-shortest', '-movflags', '+faststart', sortieMp4,
]);
console.log(`🔊 demo-60s-son.mp4 — ${Math.round(fs.statSync(sortieMp4).size / 1024)} Ko`);

const sortieWebm = path.join(OUT, 'demo-60s-son.webm');
ff(['-y', '-i', sortieMp4, '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-row-mt', '1',
  '-cpu-used', '2', '-c:a', 'libopus', '-b:a', '96k', sortieWebm]);
console.log(`🔊 demo-60s-son.webm — ${Math.round(fs.statSync(sortieWebm).size / 1024)} Ko`);

// Extrait court : même traitement, fondu de sortie plus rapide
if (fs.existsSync(HERO_MUET)) {
  const dHero = duree(HERO_MUET);
  const sortieHero = path.join(OUT, 'demo-hero-son.mp4');
  ff([
    '-y', '-i', HERO_MUET, '-stream_loop', '-1', '-i', musique,
    '-filter_complex', `[1:a]afade=t=in:st=0:d=0.8,afade=t=out:st=${(dHero - 1.2).toFixed(2)}:d=1.2,loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
    '-shortest', '-movflags', '+faststart', sortieHero,
  ]);
  console.log(`🔊 demo-hero-son.mp4 — ${Math.round(fs.statSync(sortieHero).size / 1024)} Ko`);
}

console.log('\n✅ Sonorisation terminée. Les versions muettes sont conservées :');
console.log('   • pour le HERO du site, garder la version MUETTE (les navigateurs coupent le son en lecture auto) ;');
console.log('   • la version sonorisée sert au lecteur « voir la démo » et aux réseaux sociaux.');
