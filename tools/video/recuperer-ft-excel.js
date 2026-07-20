/**
 * ⛔ NEUTRALISÉ — NE PAS RELANCER EN L'ÉTAT (décision client D5, 20/07/2026).
 *
 * Ce script récupérait une fiche technique Excel depuis l'application
 * (mille-feuille du compte de démonstration) vers
 * assets/files/fiche-technique-exemple.xlsx.
 *
 * Le fichier produit est FAUX : 5 ingrédients sur 9 y ressortent à 0 dinar
 * (12 cellules <v>0</v> dans xl/worksheets/sheet1.xml), parce que le compte de
 * démonstration n'a pas de prix sur ces articles. D5 ordonne de ne l'exposer
 * nulle part — il a été retiré du dépôt (`git rm`), la section preuve est
 * passée à 3 tuiles, et le plan qui le filmait a été coupé du montage
 * (tools/video/recouper.js).
 *
 * Le laisser exécutable, c'était garantir sa réapparition à la prochaine
 * régénération d'actifs. Pour le remettre en service il faut D'ABORD valoriser
 * les articles manquants sur le compte Dar Yasmine, PUIS retirer la garde
 * ci-dessous et vérifier le fichier obtenu cellule par cellule.
 *
 * La sortie est en outre redirigée hors de assets/ : même relancé de force, le
 * script ne peut plus republier le fichier sur le site.
 */
const fs = require('fs');
const path = require('path');

if (!process.env.LABFLOW_FT_EXCEL_VERIFIEE) {
  console.error('⛔ Script neutralisé (D5) : le fichier produit contient des lignes à 0 DT.');
  console.error('   Corriger les prix sur le compte de démonstration, puis relancer avec');
  console.error('   LABFLOW_FT_EXCEL_VERIFIEE=1 — et vérifier le résultat cellule par cellule.');
  process.exit(1);
}

const API = 'http://localhost:3000';
const CLIENT = { email: 'demo@dar-yasmine.tn', password: 'DemoVitrine2026!' };
// Sortie HORS de assets/ : le Dockerfile embarque `assets` en entier, écrire
// là remettrait le fichier en ligne à /assets/files/…
const DST = path.join(__dirname, 'check', 'fiche-technique-exemple.xlsx');

(async () => {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(CLIENT),
  });
  const { token } = await r.json();
  const h = { Authorization: `Bearer ${token}` };

  // Le mille-feuille : produit composé fabriqué au labo, avec sous-recettes
  const prods = await (await fetch(`${API}/api/produits`, { headers: h })).json();
  const liste = Array.isArray(prods) ? prods : (prods.produits || []);
  const mf = (Array.isArray(liste) ? liste : []).find((p) => /Mille-feuille/i.test(p.name));
  if (!mf) throw new Error('Mille-feuille introuvable dans le compte de démonstration');

  const labos = await (await fetch(`${API}/api/labo`, { headers: h })).json();
  const laboId = (labos.labos || labos)[0].id;

  // Même appel que le bouton « Générer Excel » de la fiche technique
  const url = `${API}/api/produits/${mf.id}/export?laboId=${laboId}&pricingMethod=dp`;
  const res = await fetch(url, { headers: h });
  if (!res.ok) throw new Error(`export ${res.status} — ${(await res.text()).slice(0, 160)}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(DST, buf);
  console.log(`📊 fiche-technique-exemple.xlsx — ${Math.round(buf.length / 1024)} Ko (${mf.name})`);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
