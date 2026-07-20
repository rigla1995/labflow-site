/**
 * Récupère une VRAIE fiche technique au format Excel depuis l'application
 * (mille-feuille du compte de démonstration) → assets/files/fiche-technique-exemple.xlsx
 *
 * Elle sert à la fois de troisième export filmé dans la vidéo et de fichier de
 * preuve téléchargeable sur le site.
 */
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:3000';
const CLIENT = { email: 'demo@dar-yasmine.tn', password: 'DemoVitrine2026!' };
const DST = path.join(__dirname, '..', '..', 'assets', 'files', 'fiche-technique-exemple.xlsx');

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
