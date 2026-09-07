// First-run seeding: sessions from the schedule, question banks and slide decks from
// server/seed/questions and server/seed/slides. Runs only when the sessions table is empty,
// so trainer edits in the database are never overwritten.
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import schedule, { retired } from './schedule.js';
import roster from './roster.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newJoinCode() {
  const bytes = randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return s;
}

export function normalizeCode(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export async function loadQuestionBank(key) {
  const file = path.join(here, 'questions', `${key}.js`);
  if (!existsSync(file)) return [];
  return (await import(pathToFileURL(file).href)).default;
}

export async function loadSlideDecks() {
  const dir = path.join(here, 'slides');
  if (!existsSync(dir)) return new Map();
  const decks = new Map();
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.js') && !f.endsWith('.diagrams.js'))) {
    const deck = (await import(pathToFileURL(path.join(dir, f)).href)).default;
    const key = deck.key || f.replace(/\.js$/, '');
    // A trainer's part of a day deck borrows the day's diagrams and pictures (see parts.js).
    const source = deck.pictures?.dir || key;
    const diagramsFile = path.join(dir, `${source}.diagrams.js`);
    const diagrams = existsSync(diagramsFile) ? (await import(pathToFileURL(diagramsFile).href)).default : {};
    const count = (deck.sections || []).reduce((a, sec) => a + (sec.slides || []).length, 0);
    const images = deck.pictures
      ? slideImages(source).filter((im) => im.index >= deck.pictures.offset && im.index < deck.pictures.offset + count).map((im) => ({ index: im.index - deck.pictures.offset, url: im.url }))
      : slideImages(key);
    decks.set(key, prepareDeck(deck, diagrams, images));
  }
  return decks;
}

/** Exported slide pictures under public/decks/<key>/slide-NN.png, in slide order (NN = 1-based flat index). */
export function slideImages(key) {
  const dir = path.join(here, '..', '..', 'public', 'decks', key);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^slide-\d+\.(png|jpe?g|webp)$/i.test(f)).sort()
    .map((f) => ({ index: parseInt(f.match(/\d+/)[0], 10) - 1, url: `/decks/${key}/${f}` }));
}

/**
 * Attaches diagrams and exported slide pictures to their slides and prepends an agenda slide
 * so the deck opens with "what we cover today". A slide with a picture shows the picture as the
 * slide itself (no point-by-point build); its bullets become the trainer's talking points.
 */
export function prepareDeck(deck, diagrams = {}, images = []) {
  const imageAt = new Map(images.map((im) => [im.index, im.url]));
  let flat = 0;
  const sections = (deck.sections || []).map((sec) => ({
    ...sec,
    slides: (sec.slides || []).map((sl, i) => {
      let out = diagrams[`${sec.id}/${i}`] ? { ...sl, diagram: diagrams[`${sec.id}/${i}`] } : sl;
      if (imageAt.has(flat)) out = { ...out, image: imageAt.get(flat), build: false };
      flat++;
      return out;
    }),
  }));
  if (deck.agenda !== false && !sections.some((s) => s.id === 'agenda')) {
    sections.unshift({
      id: 'agenda',
      title: 'Today',
      slides: [{
        title: 'What we cover today',
        bullets: sections.map((s) => s.title),
        agenda: sections.map((s) => ({ id: s.id, title: s.title, count: s.slides.length, first: s.slides.map((x) => x.title).slice(0, 3) })),
        note: deck.agendaNote || 'Walk the agenda top to bottom and say what the interns will be able to do by the end of the session.',
      }],
    });
  }
  return { ...deck, sections };
}

/** Inserts in batches of rows per statement: one round trip per batch matters on a remote database. */
export async function insertQuestions(db, sessionId, list, startPosition = 0) {
  const BATCH = 40;
  for (let at = 0; at < list.length; at += BATCH) {
    const chunk = list.slice(at, at + BATCH);
    const values = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const params = chunk.flatMap((q, i) => [sessionId, startPosition + at + i, q.text, JSON.stringify(q.options), q.answer, q.complexity || 'medium', q.seconds ?? null, q.explanation || '', q.code || null]);
    await db.run(`INSERT INTO questions (session_id, position, text, options, answer, complexity, seconds, explanation, code) VALUES ${values}`, ...params);
  }
}

export async function uniqueJoinCode(db) {
  for (;;) {
    const code = newJoinCode();
    if (!(await db.get('SELECT 1 FROM sessions WHERE join_code = ?', code))) return code;
  }
}

export async function seedRosterIfEmpty(db, { log = () => {} } = {}) {
  const { n } = (await db.get('SELECT COUNT(*) AS n FROM roster'));
  if (n > 0) return 0;
  for (const r of roster) await db.run('INSERT INTO roster (email, name, created_at) VALUES (?, ?, ?)', r.email.toLowerCase(), r.name, Date.now());
  log(`seeded roster: ${roster.length} participants`);
  return roster.length;
}

/** Inserts one schedule entry with its question bank; returns the question count. */
async function insertScheduled(db, s) {
  const code = await uniqueJoinCode(db);
  const { lastInsertRowid } = await db.run(
    `INSERT INTO sessions (key, day_no, date, week, module, title, subtopics, trainers, trainer_emails, owner_email, join_code, slides_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    s.key, s.dayNo, s.date, s.week, s.module, s.title, s.subtopics, JSON.stringify(s.trainers), JSON.stringify(s.trainerEmails || []), s.owner || null, code, s.slidesKey || null,
  );
  const bank = await loadQuestionBank(s.key);
  await insertQuestions(db, Number(lastInsertRowid), bank);
  return { count: bank.length, code };
}

export async function seedIfEmpty(db, { log = () => {} } = {}) {
  const rosterCount = await seedRosterIfEmpty(db, { log });
  const { n } = (await db.get('SELECT COUNT(*) AS n FROM sessions'));
  if (n > 0) return { seeded: false, rosterCount };
  let questions = 0;
  for (const s of schedule) {
    const { count, code } = await insertScheduled(db, s);
    questions += count;
    log(`seeded ${s.key}: ${count} questions, code ${code}`);
  }
  return { seeded: true, sessions: schedule.length, questions, rosterCount };
}

/**
 * Brings an existing database up to date with the schedule, on every start: adds schedule
 * entries that are missing (a day split into per-trainer parts, a new session), fills in the
 * owner of a scheduled session that has none, and removes retired entries nobody has joined
 * or put anything into (an upload, slide edits, checkpoints keep them).
 * Sessions trainers already edited are otherwise never touched.
 */
export async function syncSchedule(db, { log = () => {} } = {}) {
  const out = { added: [], owned: [], removed: [], kept: [] };
  const rows = await db.all('SELECT id, key, owner_email, checkpoints, slide_edits FROM sessions WHERE key IS NOT NULL');
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const s of schedule) {
    const row = byKey.get(s.key);
    if (!row) {
      const { count, code } = await insertScheduled(db, s);
      out.added.push(s.key);
      log(`added ${s.key}: ${count} questions, code ${code}`);
    } else if (!row.owner_email && s.owner) {
      await db.run('UPDATE sessions SET owner_email = ? WHERE id = ?', s.owner, row.id);
      out.owned.push(s.key);
    }
  }
  for (const key of retired) {
    const row = byKey.get(key);
    if (!row) continue;
    // Anything a trainer put into the session (participants, an uploaded deck, slide edits,
    // checkpoints) keeps it: the parts sit beside it and nothing is lost.
    const { n } = await db.get('SELECT COUNT(*) AS n FROM participants WHERE session_id = ?', row.id);
    const upload = await db.get('SELECT filename FROM session_decks WHERE session_id = ?', row.id);
    const reason = n > 0 ? `${n} participants joined it` : upload ? `it holds the uploaded file ${upload.filename}` : row.slide_edits ? 'it has slide edits' : row.checkpoints ? 'it has checkpoints' : null;
    if (reason) { out.kept.push(key); log(`kept retired ${key}: ${reason}`); continue; }
    await db.transaction(async (tx) => {
      await tx.run('DELETE FROM questions WHERE session_id = ?', row.id);
      await tx.run('DELETE FROM deck_media WHERE session_id = ?', row.id);
      await tx.run('DELETE FROM session_decks WHERE session_id = ?', row.id);
      await tx.run('DELETE FROM sessions WHERE id = ?', row.id);
    });
    out.removed.push(key);
    log(`removed ${key}: replaced by per-trainer sessions`);
  }
  return out;
}
