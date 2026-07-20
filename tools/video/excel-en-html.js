/**
 * Rend un export Excel de LabFlow en page HTML fidèle, pour pouvoir le FILMER.
 *
 * On ne peut pas ouvrir Excel dans un navigateur : on relit donc le vrai fichier
 * .xlsx avec exceljs et on reproduit exactement ce qu'il contient — bandeau de
 * marque, en-têtes, valeurs — aux couleurs de la charte (src/services/excelBrandService.js).
 * Rien n'est inventé : chaque cellule affichée sort du fichier.
 *
 *   node tools/video/excel-en-html.js
 * → tools/video/excel/<nom>.html
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('C:/Users/CHAHDONj/fiche-technique-backend/node_modules/exceljs');

const FILES = path.join(__dirname, '..', '..', 'assets', 'files');
const OUT = path.join(__dirname, 'excel');

// Charte Excel LabFlow (excelBrandService.js)
const C = {
  deep: '#1E1B4B', deepSub: '#C7CCE8', indigo: '#4338CA', indigoSoft: '#EEF2FF',
  ink: '#1E293B', muted: '#64748B', faint: '#94A3B8', hair: '#E2E8F0', panel: '#F8FAFC',
};

const texte = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.result !== undefined) return String(v.result);
    if (v instanceof Date) return v.toLocaleDateString('fr-FR');
    return String(v.text || '');
  }
  return String(v);
};
// Les nombres bruts d'Excel (1.37495) se lisent mal : on arrondit à l'affichage,
// exactement comme le fait Excel avec le format de cellule appliqué à l'export.
const cellule = (v) => {
  const t = texte(v);
  const n = Number(t);
  if (t !== '' && Number.isFinite(n) && /^-?\d+\.\d{4,}$/.test(t)) return n.toFixed(3);
  return t;
};

async function rendre(fichier, titreOnglet, maxLignes = 17) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(FILES, fichier));
  const ws = wb.worksheets[0];

  const ligne = (n) => {
    const out = [];
    ws.getRow(n).eachCell({ includeEmpty: false }, (c) => out.push(cellule(c.value)));
    return out;
  };
  // Les 4 premières lignes sont fusionnées : une seule valeur utile par ligne
  const titre = ligne(1)[0] || '';
  const entite = ligne(2)[0] || '';
  const meta = ligne(4)[0] || '';
  const entetes = ligne(6);
  const donnees = [];
  for (let r = 7; r <= Math.min(6 + maxLignes, ws.rowCount); r++) {
    const l = ligne(r);
    if (l.length) donnees.push(l);
  }
  const totalLignes = ws.rowCount - 6;

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${titre}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1440px; height:810px; background:#0d1020; display:grid; place-items:center;
         font-family:Calibri,'Segoe UI',system-ui,sans-serif; overflow:hidden; }
  .classeur { width:1330px; background:#fff; border-radius:10px; overflow:hidden;
              box-shadow:0 30px 80px rgba(0,0,0,.55); }
  /* Barre de titre de tableur, pour qu'on reconnaisse un fichier Excel */
  .barre { height:34px; background:#F3F2F1; border-bottom:1px solid #E1DFDD; display:flex;
           align-items:center; gap:9px; padding:0 14px; font-size:12px; color:#605E5C; }
  .barre .pastille { width:11px; height:11px; border-radius:50%; }
  .bandeau { background:${C.deep}; padding:17px 26px; }
  .bandeau .t { color:#fff; font-size:20px; font-weight:700; letter-spacing:-0.01em; }
  .bandeau .s { color:${C.deepSub}; font-size:13px; margin-top:3px; }
  .meta { padding:8px 26px; color:${C.muted}; font-size:11.5px; font-style:italic;
          background:${C.panel}; border-bottom:1px solid ${C.hair}; }
  table { width:100%; border-collapse:collapse; font-size:11.5px; }
  th { background:${C.indigo}; color:#fff; font-weight:700; text-align:left;
       padding:8px 10px; white-space:nowrap; font-size:11px; }
  td { padding:6px 10px; border-bottom:1px solid ${C.hair}; color:${C.ink}; white-space:nowrap;
       max-width:230px; overflow:hidden; text-overflow:ellipsis; }
  tr:nth-child(even) td { background:${C.panel}; }
  td.num { text-align:right; font-variant-numeric:tabular-nums; }
  .pied { display:flex; justify-content:space-between; align-items:center;
          padding:9px 26px; background:${C.indigoSoft}; color:#312E81;
          font-size:11.5px; font-weight:700; }
  .onglet { display:inline-block; background:#fff; border:1px solid ${C.hair}; border-top:2px solid ${C.indigo};
            border-radius:0 0 5px 5px; padding:4px 14px; font-size:11px; color:${C.ink}; font-weight:600; }
</style></head>
<body>
  <div class="classeur">
    <div class="barre">
      <span class="pastille" style="background:#FF5F57"></span>
      <span class="pastille" style="background:#FEBC2E"></span>
      <span class="pastille" style="background:#28C840"></span>
      <span style="margin-left:8px">${fichier}</span>
    </div>
    <div class="bandeau">
      <div class="t">${titre}</div>
      <div class="s">${entite}</div>
    </div>
    <div class="meta">${meta}</div>
    <table>
      <thead><tr>${entetes.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>
        ${donnees.map((l) => `<tr>${l.map((v) => {
          const num = /^-?[\d\s.,]+$/.test(v) && v.trim() !== '';
          return `<td class="${num ? 'num' : ''}">${v}</td>`;
        }).join('')}</tr>`).join('\n        ')}
      </tbody>
    </table>
    <div class="pied">
      <span>${totalLignes} enregistrement${totalLignes > 1 ? 's' : ''} dans le fichier</span>
      <span class="onglet">${titreOnglet || ws.name}</span>
    </div>
  </div>
</body></html>`;

  const dst = path.join(OUT, fichier.replace(/\.xlsx$/, '') + '.html');
  fs.writeFileSync(dst, html);
  console.log(`📄 ${path.basename(dst)} — ${donnees.length} lignes affichées sur ${totalLignes}`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await rendre('export-excel-exemple.xlsx');
  await rendre('export-transferts-exemple.xlsx');
  const ft = path.join(FILES, 'fiche-technique-exemple.xlsx');
  if (fs.existsSync(ft)) await rendre('fiche-technique-exemple.xlsx');
  else console.log('ℹ️  fiche-technique-exemple.xlsx absent — lancer d\'abord recuperer-ft-excel.js');
})().catch((e) => { console.error('❌', e); process.exit(1); });
