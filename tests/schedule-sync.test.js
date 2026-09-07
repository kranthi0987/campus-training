// The schedule splits multi-trainer days into one session per trainer. An existing database
// is brought up to date at startup: missing parts are added, owners filled in, retired
// day sessions removed unless someone already joined them.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDb } from '../server/db.js';
import { seedIfEmpty, syncSchedule, loadSlideDecks, loadQuestionBank } from '../server/seed/index.js';
import schedule, { retired } from '../server/seed/schedule.js';

let db;
before(async () => { db = await openTestDb(); });
after(async () => { await db.close(); });

test('every part has its own bank, deck (when scheduled) and owner; retired keys are not scheduled', async () => {
  const decks = await loadSlideDecks();
  const keys = new Set(schedule.map((s) => s.key));
  assert.equal(keys.size, schedule.length, 'keys are unique');
  for (const key of retired) assert.ok(!keys.has(key), `${key} is retired`);
  for (const s of schedule) {
    assert.ok((await loadQuestionBank(s.key)).length >= 3, `${s.key} has a bank`);
    if (s.slidesKey) assert.ok(decks.has(s.slidesKey), `${s.key} deck ${s.slidesKey}`);
    if (s.parts) { assert.ok(s.owner, `${s.key}: a part has an owner`); assert.ok(s.trainerEmails.includes(s.owner), `${s.key}: the owner can host it`); }
  }
  // Parts of one day cover its trainers separately.
  const day12 = schedule.filter((s) => s.dayNo === 12);
  assert.deepEqual(day12.map((s) => s.title), ['SQL (Azure SQL)', 'MongoDB']);
  assert.notEqual(day12[0].owner, day12[1].owner);
});

test('part decks carry the right slice of the day pictures and diagrams', async () => {
  const decks = await loadSlideDecks();
  const sql = decks.get('day12-sql').sections.flatMap((s) => s.slides);
  const mongo = decks.get('day12-mongodb').sections.flatMap((s) => s.slides);
  assert.equal(sql.length + mongo.length, decks.get('day12-sql-mongodb').sections.flatMap((s) => s.slides).length);
  assert.equal(sql[0].image, '/decks/day12-sql-mongodb/slide-01.png');
  assert.equal(sql[sql.length - 1].image, '/decks/day12-sql-mongodb/slide-31.png');
  assert.equal(mongo[0].image, '/decks/day12-sql-mongodb/slide-32.png');
  assert.equal(mongo[0].title, 'MongoDB Training', 'no synthetic agenda in front of a part that opens with its own title slide');
  assert.ok(sql.every((sl) => sl.image) && mongo.every((sl) => sl.image));
  const agenda = sql.find((sl) => Array.isArray(sl.agenda));
  assert.ok(agenda && agenda.agenda.every((a) => !a.id.startsWith('mongo')), 'the SQL agenda lists SQL sections only');
  const integ = decks.get('day18-integration').sections.flatMap((s) => s.slides);
  const ai = decks.get('day18-ai').sections.flatMap((s) => s.slides);
  assert.equal(integ[0].title, 'What we cover today');
  assert.ok(integ.some((sl) => sl.diagram) && ai.some((sl) => sl.diagram), 'diagrams follow their sections into the parts');
  assert.match(integ[0].note, /REST API/);
  assert.match(ai[0].note, /Copilot/);
});

test('syncSchedule adds missing parts, fills owners, and retires empty day sessions but keeps joined ones', async () => {
  const seeded = await seedIfEmpty(db);
  assert.equal(seeded.seeded, true);
  assert.equal(seeded.sessions, schedule.length);

  // Pretend this database predates the split: two retired day sessions, one already joined,
  // and the day 16 session without an owner; the day 12 parts do not exist yet.
  const old = async (key, participants) => {
    const { lastInsertRowid } = await db.run("INSERT INTO sessions (key, day_no, date, title, join_code, status) VALUES (?, 12, '2026-09-08', ?, ?, 'draft')", key, key, key.slice(0, 6).toUpperCase());
    await db.run("INSERT INTO questions (session_id, position, text, options, answer) VALUES (?, 0, 'old?', '[\"a\",\"b\",\"c\",\"d\"]', 0)", lastInsertRowid);
    for (let i = 0; i < participants; i++) await db.run('INSERT INTO participants (session_id, token, name, email, joined_at) VALUES (?, ?, ?, ?, 1)', lastInsertRowid, `${key}-${i}`, `P${i}`, `${key}${i}@x.com`);
    return Number(lastInsertRowid);
  };
  const emptyOld = await old('day12-sql-mongodb', 0);
  const joinedOld = await old('day13-frontend', 2);
  const uploadedOld = await old('day14-devops-etl', 0);
  await db.run("INSERT INTO session_decks (session_id, kind, filename, size, pages, deck, uploaded_at) VALUES (?, 'pdf', 'mine.pdf', 10, 1, '{\"title\":\"x\",\"sections\":[]}', 1)", uploadedOld);
  await db.run("DELETE FROM questions WHERE session_id IN (SELECT id FROM sessions WHERE key IN ('day12-sql', 'day12-mongodb'))");
  await db.run("DELETE FROM sessions WHERE key IN ('day12-sql', 'day12-mongodb')");
  await db.run("UPDATE sessions SET owner_email = NULL WHERE key = 'day16-cloud'");

  const out = await syncSchedule(db);
  assert.deepEqual(out.added, ['day12-sql', 'day12-mongodb']);
  assert.deepEqual(out.owned, ['day16-cloud']);
  assert.deepEqual(out.removed, ['day12-sql-mongodb']);
  assert.deepEqual(out.kept, ['day13-frontend', 'day14-devops-etl'], 'joined or uploaded-to sessions stay');
  assert.ok(await db.get('SELECT 1 AS x FROM session_decks WHERE session_id = ?', uploadedOld), 'the upload survives');

  const sql = await db.get("SELECT * FROM sessions WHERE key = 'day12-sql'");
  assert.equal(sql.owner_email, 'dushantha.sb@ferguson.com');
  assert.equal(sql.slides_key, 'day12-sql');
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM questions WHERE session_id = ?', sql.id)).n, 12);
  assert.equal((await db.get("SELECT owner_email FROM sessions WHERE key = 'day16-cloud'")).owner_email, 'ashutosh.singh@ferguson.com');
  assert.equal(await db.get('SELECT 1 AS x FROM sessions WHERE id = ?', emptyOld), null, 'the empty day session is gone');
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM questions WHERE session_id = ?', emptyOld)).n, 0);
  assert.ok(await db.get('SELECT 1 AS x FROM sessions WHERE id = ?', joinedOld), 'a day session with participants stays');

  // Running again changes nothing.
  const again = await syncSchedule(db);
  assert.deepEqual(again, { added: [], owned: [], removed: [], kept: ['day13-frontend', 'day14-devops-etl'] });
  assert.equal((await db.get('SELECT COUNT(*) AS n FROM sessions')).n, schedule.length + 2);
});
