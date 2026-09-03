// Entry point: serves the pages and the API on the LAN.
import http from 'node:http';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { openDb } from './db.js';
import { Auth, DEFAULT_PASSWORD } from './auth.js';
import { Live, LiveError } from './live.js';
import { seedIfEmpty, loadSlideDecks } from './seed/index.js';
import { createApi } from './api.js';
import { HttpError, sendJson } from './http.js';
import { createStatic } from './static.js';

export function lanAddress() {
  const candidates = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) candidates.push({ name, address: i.address });
    }
  }
  // Prefer the usual home/office ranges and Wi-Fi adapters over virtual ones.
  candidates.sort((a, b) => score(b) - score(a));
  return candidates[0]?.address || '127.0.0.1';
  function score(c) {
    let s = 0;
    if (/^192\.168\./.test(c.address)) s += 3;
    if (/^10\./.test(c.address)) s += 2;
    if (/wi-?fi|wlan|ethernet|eth/i.test(c.name)) s += 2;
    if (/vEthernet|virtual|vmware|docker|wsl|hyper-v/i.test(c.name)) s -= 5;
    return s;
  }
}

export async function createApp({ dbPath, publicUrl } = {}) {
  const db = openDb(dbPath);
  const seeded = await seedIfEmpty(db, { log: (m) => console.log('  ' + m) });
  const decks = await loadSlideDecks();
  const auth = new Auth(db);
  const live = new Live(db, { decks });
  const api = createApi({ db, live, auth, decks, publicUrl: publicUrl || '' });
  const serveStatic = createStatic();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local');
    try {
      const hit = api.match(req.method, url.pathname);
      if (hit) {
        await hit.handler(req, res, hit.params, url);
        return;
      }
      if (url.pathname.startsWith('/api/')) throw new HttpError(404, 'Not found');
      await serveStatic(req, res, url);
    } catch (err) {
      if (err instanceof HttpError || err instanceof LiveError) {
        if (!res.headersSent) sendJson(res, err.status, { error: err.message, ...(err.errors ? { errors: err.errors } : {}) });
        else res.end();
        return;
      }
      console.error(err);
      if (!res.headersSent) sendJson(res, 500, { error: 'Something went wrong on the server' });
      else res.end();
    }
  });

  return { server, db, live, auth, decks, seeded, setPublicUrl: (u) => { api.publicUrl = u; } };
}

// pathToFileURL handles both Windows drive paths and Linux absolute paths (a hand-built
// `file:///${path}` gets four slashes on Linux and never matches, so nothing would start).
const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || '0.0.0.0';
  const lan = lanAddress();
  const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://${lan}:${port}`;
  console.log('Ferguson Training quiz starting…');
  const app = await createApp({ publicUrl });
  if (app.seeded.seeded) console.log(`Seeded ${app.seeded.sessions} sessions with ${app.seeded.questions} questions.`);
  app.server.listen(port, host, () => {
    console.log('');
    console.log(`  Interns join at:   ${publicUrl}`);
    console.log(`  Trainer sign-in:   ${publicUrl}/trainer   (any email + default password "${DEFAULT_PASSWORD}")`);
    console.log(`  On this laptop:    http://localhost:${port}`);
    console.log('');
    console.log('  Both devices must be on the same Wi-Fi. If phones cannot connect, allow Node through Windows Firewall.');
  });
}
