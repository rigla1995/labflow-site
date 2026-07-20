// Aperçu PNG des rendus Excel (contrôle avant tournage) → tools/preview/
const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const b = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 810 });
  for (const f of ['export-excel-exemple', 'export-transferts-exemple', 'fiche-technique-exemple']) {
    const url = 'file:///' + path.join(__dirname, 'excel', f + '.html').replace(/\\/g, '/');
    await p.goto(url, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 300));
    await p.screenshot({ path: path.join(__dirname, '..', 'preview', `excel-${f}.png`) });
  }
  console.log('✅ aperçus Excel → tools/preview/excel-*.png');
  await b.close();
})().catch((e) => { console.error('❌', e); process.exit(1); });
