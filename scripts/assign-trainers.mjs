// Creates trainer accounts (default password, role trainer) for every email listed in
// server/seed/schedule.js `trainerEmails`, assigns them to their sessions and refreshes the
// session trainer names, in an existing database. Safe to re-run: existing accounts, roles and
// passwords are left alone. Usage: DATABASE_URL=... node scripts/assign-trainers.mjs
import { openDb } from '../server/db.js';
import { Auth, DEFAULT_PASSWORD } from '../server/auth.js';
import schedule from '../server/seed/schedule.js';

/** "ravi.chabria@ferguson.com" -> "Ravi Chabria"; a few known names spelled the way the trainers use them. */
const KNOWN = {
  'mahesh.j@ferguson.com': 'Mahesh J', 'dushantha.sb@ferguson.com': 'Dushantha', 'prakash.ubs@ferguson.com': 'Prakash U B S',
  'kaushik.kaushik@ferguson.com': 'Kaushik', 'arpitha.jh@ferguson.com': 'Arpitha', 'tharunkumar.kumart@ferguson.com': 'Tharun Kumar',
};
const nameFor = (email) => KNOWN[email] || email.split('@')[0].split(/[._]/).map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');

const db = await openDb();
try {
  const auth = new Auth(db);
  let created = 0;
  for (const s of schedule) {
    const emails = (s.trainerEmails || []).map((e) => e.toLowerCase());
    for (const email of emails) {
      if (await auth.get(email)) continue;
      await auth.create({ email, name: nameFor(email), role: 'trainer', password: DEFAULT_PASSWORD });
      created++;
      console.log(`created ${email} (${nameFor(email)})`);
    }
    const row = await db.get('SELECT id, trainer_emails, trainers FROM sessions WHERE key = ?', s.key);
    if (!row) continue;
    const merged = [...new Set([...JSON.parse(row.trainer_emails || '[]'), ...emails])];
    await db.run('UPDATE sessions SET trainer_emails = ?, trainers = ? WHERE id = ?', JSON.stringify(merged), JSON.stringify(s.trainers), row.id);
    console.log(`${s.key}: ${s.trainers.join(', ')} · ${merged.join(', ') || 'no accounts'}`);
  }
  console.log(`${created} account${created === 1 ? '' : 's'} created`);
} finally { await db.close(); }
