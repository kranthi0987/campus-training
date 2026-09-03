// Work with the durable database snapshot in Render Postgres from your laptop.
//   DATABASE_URL=<external connection string> node scripts/snapshot.mjs download backup.sqlite
//   DATABASE_URL=... node scripts/snapshot.mjs upload data/daily-quiz.sqlite   # next boot starts from this file
//   DATABASE_URL=... node scripts/snapshot.mjs reset                            # next boot starts from the committed file
// The external connection string is on the database page in the Render dashboard.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { DatabaseSync, backup } from 'node:sqlite';
import { PostgresStore } from '../server/persist.js';

/** A consistent copy of a SQLite file even while a server has it open (WAL pages included). */
async function bytesOf(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  const tmp = `${file}.upload`;
  try { await backup(db, tmp); return readFileSync(tmp); } finally { db.close(); rmSync(tmp, { force: true }); }
}

const [cmd, file] = process.argv.slice(2);
if (!process.env.DATABASE_URL) { console.error('Set DATABASE_URL to the database\'s external connection string.'); process.exit(1); }
const store = new PostgresStore(process.env.DATABASE_URL);
try {
  if (cmd === 'download') {
    if (!file) throw new Error('usage: download <file>');
    const snap = await store.load();
    if (!snap) { console.log('No snapshot stored yet.'); process.exit(0); }
    writeFileSync(file, snap.data);
    console.log(`Wrote ${snap.data.length} bytes saved ${new Date(snap.savedAt).toISOString()} to ${file}`);
  } else if (cmd === 'upload') {
    if (!file) throw new Error('usage: upload <file>');
    const buf = await bytesOf(file);
    await store.save(buf);
    console.log(`Stored ${buf.length} bytes from ${file}; the next boot starts from it.`);
  } else if (cmd === 'reset') {
    await store.clear();
    console.log('Snapshot removed; the next boot starts from the committed database file.');
  } else {
    console.log('usage: node scripts/snapshot.mjs download <file> | upload <file> | reset');
  }
} finally { await store.close(); }
