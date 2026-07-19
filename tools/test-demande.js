/**
 * Parcours E2E du formulaire demande-acces (local 8322 → API 3000).
 * Vérifie : masque tél, validation live, gating étape 1→2, compteur, envoi, redirection merci.
 */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });

  await page.goto('http://localhost:8322/demande-acces.html', { waitUntil: 'networkidle0' });

  // 1) bouton Continuer désactivé au départ
  let disabled = await page.$eval('#btn-continuer', (b) => b.disabled);
  console.log('continuer désactivé au départ :', disabled ? 'OK' : 'ÉCHEC');

  // 2) téléphone invalide → blur → erreur visible
  await page.type('#telephone', '12345678');
  await page.$eval('#nom', (e) => e.focus());
  await new Promise((r) => setTimeout(r, 200));
  const errVisible = await page.$eval('.f-row[data-champ="telephone"]', (r) => r.classList.contains('invalide'));
  console.log('tél 12345678 rejeté au blur :', errVisible ? 'OK' : 'ÉCHEC');

  // 3) correction en direct → l'erreur disparaît à la frappe + masque appliqué
  await page.$eval('#telephone', (e) => { e.value = ''; });
  await page.type('#telephone', '22345678');
  const telVal = await page.$eval('#telephone', (e) => e.value);
  const errGone = await page.$eval('.f-row[data-champ="telephone"]', (r) => !r.classList.contains('invalide') && r.classList.contains('valide'));
  console.log('masque tél « ' + telVal + ' » :', telVal === '22 345 678' ? 'OK' : 'ÉCHEC');
  console.log('erreur effacée à la frappe :', errGone ? 'OK' : 'ÉCHEC');

  // 4) nom + email valides → Continuer s'active
  await page.type('#nom', 'Test Refonte V2');
  await page.type('#email', 'm.khelil.prof+testv2@gmail.com');
  await new Promise((r) => setTimeout(r, 200));
  disabled = await page.$eval('#btn-continuer', (b) => b.disabled);
  console.log('continuer activé une fois valide :', !disabled ? 'OK' : 'ÉCHEC');

  // 5) étape 2
  await page.click('#btn-continuer');
  await new Promise((r) => setTimeout(r, 400));
  const step2Visible = await page.$eval('#step2', (s) => s.classList.contains('actif'));
  console.log('étape 2 affichée :', step2Visible ? 'OK' : 'ÉCHEC');

  await page.type('#ville', 'Tunis');
  await page.select('#type', 'patisserie_boulangerie');
  await page.type('#npv', '2');
  await page.evaluate(() => document.querySelector('#r-labo button[data-v="oui"]').click());
  await page.evaluate(() => document.querySelector('#r-b2b button[data-v="non"]').click());
  await page.type('#message', 'Test automatique de la refonte V2 — à ignorer.');
  const cpt = await page.$eval('#cpt', (e) => e.textContent);
  console.log('compteur message :', cpt === '45' ? 'OK (45)' : 'valeur ' + cpt);
  await page.click('#consent');

  // 6) attendre la fin de la garde anti-robot (3 s après chargement) puis envoyer
  await new Promise((r) => setTimeout(r, 3500));
  try {
    await Promise.all([
      page.click('#submit'),
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
    ]);
  } catch (e) {
    const errTxt = await page.$eval('#err', (el) => el.style.display !== 'none' ? el.textContent : '(pas de message)').catch(() => 'n/a');
    console.log('pas de redirection — message affiché :', errTxt);
  }
  const url = page.url();
  console.log('redirection merci :', /merci\.html$/.test(url) ? 'OK' : 'ÉCHEC → ' + url);

  console.log('erreurs console :', logs.length ? logs.join(' | ') : 'aucune');
  await browser.close();
})().catch((e) => { console.error('❌', e); process.exit(1); });
