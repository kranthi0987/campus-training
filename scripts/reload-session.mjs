// Replaces one session's questions with its bank file and re-links its slide deck, keeping the
// session row, its code and settings. Use after editing server/seed/questions/<key>.js.
// Usage: node scripts/reload-session.mjs <session key>   (stop the server first)
// Needs DATABASE_URL.
import { openDb } from '../server/db.js';
import { loadQuestionBank, insertQuestions } from '../server/seed/index.js';
import schedule from '../server/seed/schedule.js';

const key = process.argv[2];
if (!key) { console.error('Usage: node scripts/reload-session.mjs <session key>'); process.exit(1); }
const db = await openDb();
try {
  const row = await db.get('SELECT id, status FROM sessions WHERE key = ?', key);
  if (!row) { console.error(`No session with key ${key}`); process.exit(1); }
  if (row.status === 'live') { console.error('Session is live; end or reset it first.'); process.exit(1); }
  const bank = await loadQuestionBank(key);
  if (!bank.length) { console.error(`No question bank at server/seed/questions/${key}.js`); process.exit(1); }
  const entry = schedule.find((s) => s.key === key);
  const before = (await db.get('SELECT COUNT(*) AS n FROM questions WHERE session_id = ?', row.id)).n;
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE session_id = ?)', row.id);
    await tx.run('DELETE FROM questions WHERE session_id = ?', row.id);
    await insertQuestions(tx, row.id, bank);
    await tx.run('UPDATE sessions SET slides_key = ?, current_index = -1, question_closed = 0, block_end = NULL WHERE id = ?', entry?.slidesKey || null, row.id);
  });
  console.log(`${key}: replaced ${before} questions with ${bank.length}; slides: ${entry?.slidesKey || 'none'}`);
} finally { await db.close(); }
