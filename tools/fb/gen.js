/**
 * Générateur du KIT FACEBOOK LabFlow — thème « Nuit & Lumière » (v4).
 * Produit dans C:\Users\CHAHDONj\labflow-facebook :
 *   01-identite/  photo-profil.png (1024²), couverture.png (1640×924, zone sûre centrale),
 *                 logo-nuit.png, logo-blanc-transparent.png, + SVG sources
 *   02-video/     demo-labflow-1min19.mp4 (copie), demo-labflow-sous-titres.srt,
 *                 reel-demo-vertical.mp4 (1080×1920, sous-titres incrustés)
 *   03-posts/     11 cartes 1080×1350 prêtes à publier
 *   04-captures/  écrans complets convertis en PNG (upload direct)
 * Usage : node tools/fb/gen.js [--skip-video]
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const SITE = path.join(__dirname, '..', '..');
const KIT = 'C:\\Users\\CHAHDONj\\labflow-facebook';
const IMG = p => path.join(SITE, 'assets', 'img', p);
const b64 = (file, mime) => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;

const FONT = b64(path.join(SITE, 'assets', 'fonts', 'bricolage-grotesque-latin.woff2'), 'font/woff2');
const LOGO_SVG = fs.readFileSync('C:\\Users\\CHAHDONj\\fiche-technique-frontend\\public\\logo.svg', 'utf8');
const MARK_SVG = fs.readFileSync(IMG('favicon.svg'), 'utf8');
const logoData = 'data:image/svg+xml;base64,' + Buffer.from(LOGO_SVG).toString('base64');
const markData = 'data:image/svg+xml;base64,' + Buffer.from(MARK_SVG).toString('base64');

/* Drapeau tunisien en SVG (les emojis drapeaux ne se rendent pas sous Windows). */
const FLAG_TN = `<svg viewBox="0 0 60 40" style="height:.95em;vertical-align:-.12em;border-radius:4px;" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="40" rx="5" fill="#E70013"/><circle cx="30" cy="20" r="11.5" fill="#fff"/><circle cx="30" cy="20" r="8.6" fill="#E70013"/><circle cx="32.6" cy="20" r="7" fill="#fff"/><path d="M31.2 14.6l1.65 3.6 3.95.35-3 2.6.9 3.85-3.5-2.05-3.5 2.05.9-3.85-3-2.6 3.95-.35z" fill="#E70013"/></svg>`;

const BASE_CSS = `
@font-face{font-family:'Bricolage Grotesque';src:url('${FONT}') format('woff2');font-weight:200 800;}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;}
body{background:#04050B;font-family:'Bricolage Grotesque',system-ui,sans-serif;color:#F2F4FA;
     overflow:hidden;position:relative;-webkit-font-smoothing:antialiased;}
.halo{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;}
.h-ciel{background:rgba(14,165,233,.20);}
.h-violet{background:rgba(168,85,247,.16);}
.h-indigo{background:rgba(99,102,241,.18);}
.grad-text{background:linear-gradient(120deg,#38BDF8 0%,#818CF8 52%,#C084FC 100%);
           -webkit-background-clip:text;background-clip:text;color:transparent;}
.kicker{font-weight:600;letter-spacing:.14em;text-transform:uppercase;
        color:rgba(255,255,255,.55);}
.chip{display:inline-flex;align-items:center;gap:.55em;font-weight:500;color:rgba(255,255,255,.78);}
.dot{width:.42em;height:.42em;border-radius:50%;background:linear-gradient(120deg,#0EA5E9,#A855F7);display:inline-block;}
.ecran{background:#0B0D16;border:1px solid rgba(255,255,255,.14);border-radius:22px;overflow:hidden;
       box-shadow:0 0 140px rgba(99,102,241,.38),0 30px 80px rgba(0,0,0,.6);}
.barre{display:flex;align-items:center;gap:10px;padding:16px 22px;background:#101322;
       border-bottom:1px solid rgba(255,255,255,.08);}
.barre i{width:13px;height:13px;border-radius:50%;display:block;}
.pill{margin-left:14px;background:rgba(255,255,255,.07);border-radius:99px;padding:6px 22px;
      font-size:19px;color:rgba(255,255,255,.6);font-family:system-ui;}
.ecran img{display:block;width:100%;}
.foot{position:absolute;left:0;right:0;display:flex;align-items:center;justify-content:space-between;}
.foot .site{font-weight:600;color:rgba(255,255,255,.85);}
.foot img{height:44px;display:block;}
`;

const halos = `
<div class="halo h-ciel"   style="width:700px;height:700px;top:-260px;left:-240px;"></div>
<div class="halo h-violet" style="width:640px;height:640px;bottom:-260px;right:-220px;"></div>`;

/* ─────────────────────────── Gabarits ─────────────────────────── */

function photoProfil() {
  return `<style>${BASE_CSS}</style>
  <div class="halo h-indigo" style="width:820px;height:820px;top:102px;left:102px;filter:blur(120px);"></div>
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
    <img src="${markData}" style="width:600px;height:600px;filter:drop-shadow(0 24px 70px rgba(99,102,241,.55));">
  </div>`;
}

function couverture() {
  return `<style>${BASE_CSS}</style>${halos}
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:38px;">
    <img src="${logoData}" style="height:118px;">
    <div style="font-size:66px;font-weight:700;letter-spacing:-.02em;text-align:center;line-height:1.12;">
      Tout votre commerce <span class="grad-text">dans un seul écran</span>.
    </div>
    <div style="display:flex;gap:34px;font-size:30px;">
      <span class="chip"><span class="dot"></span>Achats</span>
      <span class="chip"><span class="dot"></span>Stock</span>
      <span class="chip"><span class="dot"></span>Ventes</span>
      <span class="chip"><span class="dot"></span>Marges</span>
    </div>
    <div style="font-size:27px;color:rgba(255,255,255,.55);font-weight:500;">
      labflow-tn.com&nbsp;&nbsp;·&nbsp;&nbsp;WhatsApp +216 54 183 189&nbsp;&nbsp;·&nbsp;&nbsp;Conçu en Tunisie ${FLAG_TN}
    </div>
  </div>`;
}

function logoNuit() {
  return `<style>${BASE_CSS}</style>
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
    <img src="${logoData}" style="height:300px;">
  </div>`;
}

function logoBlanc() {
  return `<style>${BASE_CSS} body{background:transparent;}</style>
  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
    <img src="${logoData}" style="height:300px;">
  </div>`;
}

/** Carte 1080×1350 avec capture d'écran dans un « écran allumé ». */
function carteEcran({ kicker, titre, sub, img, posX = 'left' }) {
  const shot = b64(IMG(img), 'image/webp');
  return `<style>${BASE_CSS}</style>${halos}
  <div style="position:absolute;inset:0;padding:78px 72px 108px;display:flex;flex-direction:column;">
    <div class="kicker" style="font-size:27px;">${kicker}</div>
    <div style="font-size:63px;font-weight:700;letter-spacing:-.015em;line-height:1.1;margin:26px 0 ${sub ? '20px' : '48px'};">${titre}</div>
    ${sub ? `<div style="font-size:31px;line-height:1.42;color:rgba(255,255,255,.66);margin-bottom:44px;max-width:900px;">${sub}</div>` : ''}
    <div class="ecran" style="flex:1;display:flex;flex-direction:column;min-height:0;">
      <div class="barre">
        <i style="background:#FF5F57;"></i><i style="background:#FEBC2E;"></i><i style="background:#28C840;"></i>
        <span class="pill">app.labflow-tn.com</span>
      </div>
      <div style="flex:1;min-height:0;overflow:hidden;">
        <img src="${shot}" style="width:100%;height:100%;object-fit:cover;object-position:${posX} top;">
      </div>
    </div>
  </div>
  <div class="foot" style="bottom:34px;padding:0 72px;">
    <img src="${logoData}">
    <span class="site" style="font-size:28px;">labflow-tn.com</span>
  </div>`;
}

function carteLancement() {
  return `<style>${BASE_CSS}</style>${halos}
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:52px;padding:0 90px;">
    <img src="${markData}" style="width:250px;height:250px;filter:drop-shadow(0 20px 60px rgba(99,102,241,.5));">
    <img src="${logoData}" style="height:96px;">
    <div style="font-size:76px;font-weight:700;letter-spacing:-.02em;text-align:center;line-height:1.12;">
      Tout votre commerce<br><span class="grad-text">dans un seul écran</span>.
    </div>
    <div style="display:flex;gap:36px;font-size:33px;">
      <span class="chip"><span class="dot"></span>Achats</span>
      <span class="chip"><span class="dot"></span>Stock</span>
      <span class="chip"><span class="dot"></span>Ventes</span>
      <span class="chip"><span class="dot"></span>Marges</span>
    </div>
    <div style="font-size:30px;color:rgba(255,255,255,.55);">Conçu en Tunisie ${FLAG_TN}</div>
  </div>
  <div class="foot" style="bottom:40px;padding:0 80px;justify-content:center;">
    <span class="site" style="font-size:30px;">labflow-tn.com</span>
  </div>`;
}

function carteOffre() {
  return `<style>${BASE_CSS}</style>${halos}
  <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:46px;padding:0 90px;text-align:center;">
    <div style="font-size:120px;">🎁</div>
    <div style="font-size:86px;font-weight:700;letter-spacing:-.02em;line-height:1.1;">
      Votre premier mois<br>est <span class="grad-text">offert</span>.
    </div>
    <div style="font-size:34px;line-height:1.5;color:rgba(255,255,255,.68);max-width:820px;">
      Racontez-nous votre commerce. Un conseiller vous rappelle et vous
      repartez avec un compte prêt à l'emploi.
    </div>
    <div style="background:linear-gradient(120deg,#0B7BB8 0%,#4F51C8 52%,#8A3FD1 100%);border-radius:99px;
                padding:26px 64px;font-size:34px;font-weight:600;color:#fff;box-shadow:0 18px 60px rgba(99,102,241,.45);">
      labflow-tn.com → Demander un accès
    </div>
    <div style="font-size:27px;color:rgba(255,255,255,.5);">Réponse rapide, par un humain. Aucun paiement en ligne.</div>
  </div>
  <div class="foot" style="bottom:40px;padding:0 80px;justify-content:center;">
    <img src="${logoData}">
  </div>`;
}

function carteDonnees() {
  const tuile = (icone, titre, sub) => `
    <div style="background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.12);border-radius:26px;
                padding:44px 46px;display:flex;align-items:center;gap:36px;">
      <div style="font-size:64px;">${icone}</div>
      <div>
        <div style="font-size:38px;font-weight:700;">${titre}</div>
        <div style="font-size:29px;color:rgba(255,255,255,.62);margin-top:8px;line-height:1.35;">${sub}</div>
      </div>
    </div>`;
  return `<style>${BASE_CSS}</style>${halos}
  <div style="position:absolute;inset:0;padding:96px 84px;display:flex;flex-direction:column;">
    <div class="kicker" style="font-size:27px;">Vos données — qui voit quoi</div>
    <div style="font-size:66px;font-weight:700;letter-spacing:-.015em;line-height:1.12;margin:28px 0 22px;">
      Trois personnes, un système.<br><span class="grad-text">Chacune voit ce qui la regarde.</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:30px;margin-top:36px;">
      ${tuile('👤', 'Vous', 'Tout votre compte. Vous seul créez les accès des autres.')}
      ${tuile('🧑‍🍳', 'Votre gérant', 'Le point de vente ou le labo que vous lui ouvrez, rien d’autre.')}
      ${tuile('🏢', 'Votre client pro', 'Ses commandes, ses tarifs à lui. Jamais vos stocks.')}
    </div>
    <div style="margin-top:auto;font-size:30px;color:rgba(255,255,255,.66);line-height:1.45;">
      Et vos données restent exportables en Excel quand vous voulez —<br>elles vous appartiennent.
    </div>
  </div>
  <div class="foot" style="bottom:34px;padding:0 84px;">
    <img src="${logoData}">
    <span class="site" style="font-size:28px;">labflow-tn.com</span>
  </div>`;
}

/* ─────────────────────────── Rendus ─────────────────────────── */

const CARTES_ECRAN = [
  { name: 'post-ecran-dashboard', kicker: 'Le principe — une seule saisie', titre: 'Vous entrez l’achat. <span class="grad-text">Le reste se met à jour seul.</span>', sub: 'Le stock, le coût réel et la marge se recalculent au moment où vous enregistrez.', img: 'ecran-dashboard@2x.webp' },
  { name: 'post-ecran-recettes', kicker: 'Recettes & prix de revient', titre: 'Combien vous coûte <span class="grad-text">ce que vous fabriquez&nbsp;?</span>', sub: 'Composez la recette une fois. LabFlow additionne le coût réel de chaque ingrédient.', img: 'ecran-ft@2x.webp', posX: 'center' },
  { name: 'post-ecran-commandes', kicker: 'Vente aux professionnels', titre: 'Vos clients pros <span class="grad-text">commandent seuls.</span>', sub: 'Chaque client a son espace, à ses tarifs. Reçue → préparée → expédiée → livrée.', img: 'ecran-commandes@2x.webp' },
  { name: 'post-ecran-facture', kicker: 'Facturation aux normes tunisiennes', titre: 'La facture part. <span class="grad-text">Le timbre est déjà dessus.</span>', sub: 'TVA calculée, numérotation à la suite, timbre fiscal posé.', img: 'ecran-facture@2x.webp', posX: 'center' },
  { name: 'post-ecran-stock', kicker: 'Stock', titre: 'Le stock du jour, <span class="grad-text">compté et valorisé.</span>', sub: 'Quantités et coûts, article par article, catégorie par catégorie.', img: 'ecran-stock@2x.webp' },
  { name: 'post-ecran-ventes', kicker: 'Ventes', titre: 'Vos ventes, <span class="grad-text">canal par canal.</span>', sub: 'Chaque vente enregistrée nourrit la marge et déduit le stock.', img: 'ecran-ventes@2x.webp' },
  { name: 'post-ecran-migration', kicker: 'Migration — démarrage rapide', titre: 'Vous partez d’Excel&nbsp;? <span class="grad-text">LabFlow aussi.</span>', sub: 'Notre modèle Excel, quatre colonnes : jusqu’à 1 000 articles créés d’un coup.', img: 'ecran-import-succes@2x.webp' },
];

const RENDUS = [
  { file: '01-identite/photo-profil.png', w: 1024, h: 1024, html: photoProfil() },
  { file: '01-identite/couverture.png', w: 1640, h: 924, html: couverture() },
  { file: '01-identite/logo-nuit.png', w: 1600, h: 520, html: logoNuit() },
  { file: '01-identite/logo-blanc-transparent.png', w: 1600, h: 520, html: logoBlanc(), transparent: true },
  { file: '03-posts/post-lancement.png', w: 1080, h: 1350, html: carteLancement() },
  { file: '03-posts/post-offre-1er-mois.png', w: 1080, h: 1350, html: carteOffre() },
  { file: '03-posts/post-vos-donnees.png', w: 1080, h: 1350, html: carteDonnees() },
  ...CARTES_ECRAN.map(c => ({ file: `03-posts/${c.name}.png`, w: 1080, h: 1350, html: carteEcran(c) })),
];

async function renduImages() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  for (const r of RENDUS) {
    const out = path.join(KIT, r.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.setViewport({ width: r.w, height: r.h, deviceScaleFactor: 1 });
    await page.setContent(r.html, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(i => i.complete ? 0 : i.decode().catch(() => 0)));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    await page.screenshot({ path: out, omitBackground: !!r.transparent });
    console.log('✓', r.file);
  }
  await browser.close();
}

/* ─────────────── Captures brutes → PNG (upload direct) ─────────────── */
async function capturesPng() {
  const dir = path.join(KIT, '04-captures');
  fs.mkdirSync(dir, { recursive: true });
  const ecrans = ['ecran-dashboard', 'ecran-ft', 'ecran-commandes', 'ecran-facture',
    'ecran-stock', 'ecran-ventes', 'ecran-import-avant', 'ecran-import-succes'];
  for (const e of ecrans) {
    await sharp(IMG(`${e}@2x.webp`)).png().toFile(path.join(dir, `${e}.png`));
    console.log('✓ 04-captures/' + e + '.png');
  }
}

/* ─────────────────────────── Vidéo ─────────────────────────── */

function vttVersSrt() {
  const vtt = fs.readFileSync(path.join(SITE, 'assets', 'video', 'demo-60s-son.fr.vtt'), 'utf8');
  const blocs = vtt.split(/\r?\n\r?\n/).filter(b => b.includes('-->'));
  let n = 0;
  const srt = blocs.map(b => {
    const lignes = b.split(/\r?\n/).filter(l => !/^\d+$/.test(l.trim()));
    const ts = lignes.findIndex(l => l.includes('-->'));
    const temps = lignes[ts].replace(/\./g, ',').replace(/ --> /, ' --> ');
    const texte = lignes.slice(ts + 1).join('\n');
    n++;
    return `${n}\n${temps}\n${texte}`;
  }).join('\n\n') + '\n';
  const out = path.join(KIT, '02-video', 'demo-labflow-sous-titres.srt');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, srt, 'utf8');
  console.log('✓ 02-video/demo-labflow-sous-titres.srt (' + n + ' repères)');
}

function videoKit() {
  const ff = require('ffmpeg-static');
  const vdir = path.join(KIT, '02-video');
  fs.mkdirSync(vdir, { recursive: true });
  fs.copyFileSync(path.join(SITE, 'assets', 'video', 'demo-60s-son.mp4'),
    path.join(vdir, 'demo-labflow-1min19.mp4'));
  console.log('✓ 02-video/demo-labflow-1min19.mp4 (copie 1280×720)');

  // Reel 1080×1920 : vidéo centrée un peu haute, logo au-dessus, sous-titres incrustés dessous.
  // ffmpeg tourne avec cwd = 02-video pour référencer le .srt en RELATIF (zéro échappement de « C: »).
  const logo = path.join(KIT, '01-identite', 'logo-blanc-transparent.png');
  const args = ['-y',
    '-i', path.join(SITE, 'assets', 'video', 'demo-60s-son.mp4'),
    '-i', logo,
    '-filter_complex',
    `[0:v]scale=1080:608:flags=lanczos,pad=1080:1920:(ow-iw)/2:576:color=0x04050B,` +
    `subtitles=demo-labflow-sous-titres.srt:force_style='Fontsize=7,PrimaryColour=&H00FFFFFF,OutlineColour=&H66000000,BorderStyle=1,Outline=1,Shadow=0,MarginV=40,MarginL=30,MarginR=30'[v0];` +
    `[1:v]scale=430:-1[lg];[v0][lg]overlay=(W-w)/2:300[v]`,
    '-map', '[v]', '-map', '0:a',
    '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy', '-movflags', '+faststart',
    path.join(vdir, 'reel-demo-vertical.mp4')];
  try {
    execFileSync(ff, args, { stdio: 'pipe', cwd: vdir });
    console.log('✓ 02-video/reel-demo-vertical.mp4 (1080×1920, sous-titres incrustés)');
  } catch (e) {
    console.error('⚠ sous-titres incrustés indisponibles (' +
      e.stderr.toString().split('\n').filter(l => l.trim()).slice(-2).join(' | ') + ')');
    console.log('→ nouvel essai sans sous-titres…');
    const args2 = args.map(a => typeof a === 'string' ? a.replace(/,?subtitles='[^']*':force_style='[^']*'/, '') : a);
    execFileSync(ff, args2, { stdio: 'pipe' });
    console.log('✓ 02-video/reel-demo-vertical.mp4 (SANS sous-titres incrustés)');
  }
}

/* ─────────────────────────── Main ─────────────────────────── */
(async () => {
  fs.mkdirSync(path.join(KIT, '01-identite'), { recursive: true });
  fs.copyFileSync('C:\\Users\\CHAHDONj\\fiche-technique-frontend\\public\\logo.svg', path.join(KIT, '01-identite', 'logo-labflow.svg'));
  fs.copyFileSync(IMG('favicon.svg'), path.join(KIT, '01-identite', 'logo-icone.svg'));
  const onlyVideo = process.argv.includes('--only-video');
  if (!onlyVideo) {
    await renduImages();
    await capturesPng();
  }
  vttVersSrt();
  if (!process.argv.includes('--skip-video')) videoKit();
  console.log('\nKIT COMPLET →', KIT);
})().catch(e => { console.error(e); process.exit(1); });
