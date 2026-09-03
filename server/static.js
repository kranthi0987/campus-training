// Serves files under public/ and maps the app's clean routes to their pages.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError } from './http.js';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

const PAGES = [
  [/^\/$/, 'index.html'],
  [/^\/join$/, 'index.html'],
  [/^\/play$/, 'play.html'],
  [/^\/certificate$/, 'certificate.html'],
  [/^\/trainer$/, 'trainer.html'],
  [/^\/host\/\d+$/, 'host.html'],
  [/^\/present\/\d+$/, 'present.html'],
];

export function createStatic() {
  return async function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
    let file = null;
    for (const [re, page] of PAGES) if (re.test(url.pathname)) { file = page; break; }
    if (!file) {
      const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
      const abs = path.join(PUBLIC, rel);
      if (!abs.startsWith(PUBLIC)) throw new HttpError(403, 'Forbidden');
      file = rel;
    }
    const abs = path.join(PUBLIC, file);
    let data;
    try { data = await readFile(abs); } catch { throw new HttpError(404, 'Not found'); }
    const type = TYPES[path.extname(abs)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': type.startsWith('text/html') ? 'no-store' : 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  };
}
