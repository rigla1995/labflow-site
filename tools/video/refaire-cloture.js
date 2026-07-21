/**
 * Refabrique le SEUL carton de clôture (`c6` de cartons.html) et le réinjecte
 * en fin de démonstration.
 *
 * Pourquoi : le carton de clôture affichait « Réponse sous 24 h ». D5 fait
 * retirer ce délai des neuf emplacements du site — la vidéo continuait de le
 * projeter. Le texte est corrigé dans cartons.html ; ce script en refait le
 * plan sans avoir à relancer tout le tournage (le carton est une page HTML
 * locale : ni backend ni frontend ne sont nécessaires).
 *
 * Sortie : tools/video/seq/18-cloture.mp4 (5,5 s, 1440×810, muet), consommé
 * ensuite par recouper.js.
 *
 * Run : node tools/video/refaire-cloture.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const ffmpeg = require('ffmpeg-static');

const W = 1440, H = 810, FPS = 30, DUREE = 5.5;
const SEQ = path.join(__dirname, 'seq');
const CARTONS = 'file:///' + path.join(__dirname, 'cartons.html').replace(/\\/g, '/');

(async () => {
  fs.mkdirSync(SEQ, { recursive: true });
  const png = path.join(SEQ, '18-cloture.png');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--lang=fr-FR', '--hide-scrollbars'],
    defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  });
  const page = await browser.newPage();
  await page.goto(CARTONS, { waitUntil: 'networkidle0' });
  await page.evaluate(() => window.montrer('c6'));
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: png, type: 'png' });
  await browser.close();
  console.log(`🖼  carton c6 capturé — ${Math.round(fs.statSync(png).size / 1024)} Ko`);

  // Même traitement que monter.js pour un `carton: true` : zoom avant de 4 %
  // sur toute la durée du plan, sans quoi le plan fixe paraît mort.
  const frames = Math.round(DUREE * FPS);
  const mp4 = path.join(SEQ, '18-cloture.mp4');
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y',
    '-loop', '1', '-t', String(DUREE), '-i', png,
    '-vf', `zoompan=z='min(1+0.04*on/${frames},1.04)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-an', mp4]);
  fs.unlinkSync(png);
  console.log(`🎞  seq/18-cloture.mp4 — ${DUREE} s, ${Math.round(fs.statSync(mp4).size / 1024)} Ko`);
})();
