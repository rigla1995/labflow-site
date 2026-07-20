/* Mini serveur statique local pour prévisualiser le site (node tools/serve.js). */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  // Sans ces types, le navigateur refuse de lire les vidéos (nginx, lui, les
  // connaît déjà via mime.types — ce correctif ne concerne que l'aperçu local).
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p.replace(/^\/+/, ''));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const taille = fs.statSync(file).size;

  // Requêtes partielles : indispensables pour se déplacer dans une vidéo
  const range = req.headers.range;
  if (range && /^bytes=/.test(range)) {
    const [d, f] = range.replace('bytes=', '').split('-');
    const debut = parseInt(d, 10) || 0;
    const fin = f ? parseInt(f, 10) : taille - 1;
    res.writeHead(206, {
      'Content-Type': type,
      'Content-Range': `bytes ${debut}-${fin}/${taille}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': fin - debut + 1,
    });
    fs.createReadStream(file, { start: debut, end: fin }).pipe(res);
    return;
  }

  res.writeHead(200, { 'Content-Type': type, 'Content-Length': taille, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(file).pipe(res);
}).listen(8322, () => console.log('site on http://localhost:8322'));
