/**
 * Post-traitement des captures brutes (tools/raw/, dpr 2) → assets/img/ en AVIF + WebP, 2 tailles.
 * Budget : ≤ 120 Ko par fichier (plan V2 §2.5) — la qualité descend par paliers si nécessaire.
 * Run : node tools/optimize.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RAW = path.join(__dirname, 'raw');
const OUT = path.join(__dirname, '..', 'assets', 'img');
const MAX_KO = 120;

// Largeur d'affichage cible (CSS px) par capture — @1x = cette largeur, @2x = le double.
// Sources désormais capturées en dpr 3 : on peut viser des @2x plus larges pour
// rester net sur écrans rétina (dpr 2-3, notamment mobile) et sous le léger zoom
// d'affichage des cartes de la section 2. @2x plafonné à la largeur réelle du crop.
const DISPLAY_W = {
  'dashboard.png': 1100,
  'kpi-marge.png': 336,        // source ~672px (224 CSS ×3) → @2x = 672, plein
  'ventes-canaux.png': 700,
  'stock-valeur.png': 900,     // zoomée dans la carte → source large indispensable
  'ft-arbre.png': 520,
  'commandes-table.png': 820,
  'stepper.png': 600,
  'facture-timbre.png': 720,   // ruban large et fin, affiché ~700px
};

async function encode(input, outPath, format, width) {
  let quality = format === 'avif' ? 55 : 74;
  for (;;) {
    const pipe = sharp(input).resize({ width, withoutEnlargement: true });
    const buf =
      format === 'avif'
        ? await pipe.avif({ quality, effort: 5 }).toBuffer()
        : await pipe.webp({ quality }).toBuffer();
    if (buf.length <= MAX_KO * 1024 || quality <= 30) {
      fs.writeFileSync(outPath, buf);
      return { ko: Math.round(buf.length / 1024), quality };
    }
    quality -= 8;
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const files = fs.readdirSync(RAW).filter((f) => f.endsWith('.png'));
  if (!files.length) { console.error('❌ tools/raw/ vide — lancer node tools/capture.js d’abord'); process.exit(1); }

  let total = 0;
  for (const f of files) {
    const base = f.replace(/\.png$/, '');
    const input = path.join(RAW, f);
    const meta = await sharp(input).metadata();
    const w1 = Math.min(DISPLAY_W[f] || 640, meta.width);
    const w2 = Math.min(w1 * 2, meta.width);
    for (const [suffix, w] of [['@1x', w1], ['@2x', w2]]) {
      for (const fmt of ['avif', 'webp']) {
        const out = path.join(OUT, `${base}${suffix}.${fmt}`);
        const { ko, quality } = await encode(input, out, fmt, w);
        total += ko;
        console.log(`🖼  ${path.basename(out)} — ${w}px, q${quality}, ${ko} Ko`);
      }
    }
  }
  console.log(`\n✅ Total encodé : ${total} Ko (budget images du site < 900 Ko — seuls les fichiers réellement référencés comptent)`);
})().catch((e) => { console.error('❌', e); process.exit(1); });
