// One-off move of everything in a SQLite file into the Postgres database at DATABASE_URL:
// trainer accounts, sessions (with codes, settings and checkpoints), questions, participants,
// answers, ratings and the roster, keeping every id. Refuses to touch a Postgres database that
// already holds sessions unless --force is given, which empties it first.
//   DATABASE_URL=<external connection string> node scripts/migrate-sqlite-to-postgres.mjs data/daily-quiz.sqlite [--force]
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../server/db.js';

const [file = 'data/daily-quiz.sqlite', flag] = process.argv.slice(2);
if (!process.env.DATABASE_URL) { console.error('Set DATABASE_URL to the Postgres connection string.'); process.exit(1); }
const TABLES = ['trainers', 'trainer_tokens', 'sessions', 'questions', 'participants', 'answers', 'ratings', 'roster', 'meta'];
const ID_TABLES = ['sessions', 'questions', 'participants'];

const src = new DatabaseSync(file, { readOnly: true });
const dst = await openDb({ url: process.env.DATABASE_URL });
if (dst.dialect !== 'postgres') { console.error('DATABASE_URL must point at Postgres.'); process.exit(1); }
try {
  const existing = (await dst.get('SELECT COUNT(*) AS n FROM sessions')).n;
  if (existing > 0 && flag !== '--force') {
    console.error(`Postgres already holds ${existing} sessions. Re-run with --force to replace everything.`);
    process.exit(1);
  }
  await dst.transaction(async (tx) => {
    if (existing > 0) await tx.exec(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY`);
    for (const table of TABLES) {
      const rows = src.prepare(`SELECT * FROM ${table}`).all();
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
    await tx.exec('DROP TABLE IF EXISTS quiz_snapshots');
  });
  const check = await dst.get('SELECT (SELECT COUNT(*) FROM sessions) AS sessions, (SELECT COUNT(*) FROM questions) AS questions, (SELECT COUNT(*) FROM trainers) AS trainers, (SELECT COUNT(*) FROM participants) AS participants');
  console.log('Postgres now holds:', JSON.stringify(check));
} finally {
  src.close();
  await dst.close();
}
