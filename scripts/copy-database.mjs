// Copies everything from one Postgres database to another, ids included: trainer accounts,
// sessions (codes, settings, checkpoints), questions, participants, answers, ratings, roster.
// Use it when the free Render database expires and a new one takes its place.
//   node scripts/copy-database.mjs <source url> <destination url> [--force]
// Refuses to touch a destination that already holds sessions unless --force empties it first.
import { openDb, TABLES, ID_TABLES } from '../server/db.js';

const [sourceUrl, destUrl, flag] = process.argv.slice(2);
if (!sourceUrl || !destUrl) { console.error('usage: node scripts/copy-database.mjs <source url> <destination url> [--force]'); process.exit(1); }
const src = await openDb({ url: sourceUrl });
const dst = await openDb({ url: destUrl });
try {
  const existing = (await dst.get('SELECT COUNT(*) AS n FROM sessions')).n;
  if (existing > 0 && flag !== '--force') {
    console.error(`The destination already holds ${existing} sessions. Re-run with --force to replace everything.`);
    process.exit(1);
  }
  await dst.transaction(async (tx) => {
    if (existing > 0) await tx.exec(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY`);
    for (const table of TABLES) {
      const rows = await src.all(`SELECT * FROM ${table}`);
      if (rows.length) {
        const cols = Object.keys(rows[0]);
        const BATCH = 50;
        for (let at = 0; at < rows.length; at += BATCH) {
          const chunk = rows.slice(at, at + BATCH);
          const values = chunk.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ');
          await tx.run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES ${values}${ID_TABLES.includes(table) ? ' RETURNING id' : ''}`, ...chunk.flatMap((row) => cols.map((c) => row[c])));
        }
      }
      console.log(`${table}: ${rows.length} rows`);
    }
    for (const table of ID_TABLES) {
      await tx.exec(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`);
    }
  });
  console.log('Destination now holds:', JSON.stringify(await dst.get('SELECT (SELECT COUNT(*) FROM sessions) AS sessions, (SELECT COUNT(*) FROM questions) AS questions, (SELECT COUNT(*) FROM trainers) AS trainers, (SELECT COUNT(*) FROM participants) AS participants')));
} finally {
  await src.close();
  await dst.close();
}
