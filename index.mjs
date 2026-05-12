import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.webmanifest') return 'application/manifest+json; charset=utf-8';
  return 'application/octet-stream';
}

export default function handler(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(__dirname, pathname));

  if (!filePath.startsWith(__dirname)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  res.setHeader('Content-Type', mimeType(filePath));
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(filePath).pipe(res);
}
