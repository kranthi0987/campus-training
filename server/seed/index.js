// First-run seeding: sessions from the schedule, question banks and slide decks from
// server/seed/questions and server/seed/slides. Runs only when the sessions table is empty,
// so trainer edits in the database are never overwritten.
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import schedule from './schedule.js';
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
    const diagramsFile = path.join(dir, `${key}.diagrams.js`);
    const diagrams = existsSync(diagramsFile) ? (await import(pathToFileURL(diagramsFile).href)).default : {};
    decks.set(key, prepareDeck(deck, diagrams, slideImages(key)));
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
  if (!sections.some((s) => s.id === 'agenda')) {
    sections.unshift({
      id: 'agenda',
      title: 'Today',
      slides: [{
        title: 'What we cover today',
        bullets: sections.map((s) => s.title),
        agenda: sections.map((s) => ({ id: s.id, title: s.title, count: s.slides.length, first: s.slides.map((x) => x.title).slice(0, 3) })),
        note: 'Walk the agenda top to bottom and say what the interns will be able to do by the end: call and design a REST API, read a SOAP contract, explain what the gateway protects, follow an event through Kafka, validate a token, and use AI tools without trusting them blindly.',
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

export async function seedIfEmpty(db, { log = () => {} } = {}) {
  const rosterCount = await seedRosterIfEmpty(db, { log });
  const { n } = (await db.get('SELECT COUNT(*) AS n FROM sessions'));
  if (n > 0) return { seeded: false, rosterCount };
  let questions = 0;
  for (const s of schedule) {
    const code = await uniqueJoinCode(db);
    const { lastInsertRowid } = await db.run(
      `INSERT INTO sessions (key, day_no, date, week, module, title, subtopics, trainers, trainer_emails, join_code, slides_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s.key, s.dayNo, s.date, s.week, s.module, s.title, s.subtopics, JSON.stringify(s.trainers), JSON.stringify(s.trainerEmails || []), code, s.slidesKey || null,
    );
    const bank = await loadQuestionBank(s.key);
    await insertQuestions(db, Number(lastInsertRowid), bank);
    questions += bank.length;
    log(`seeded ${s.key}: ${bank.length} questions, code ${code}`);
  }
  return { seeded: true, sessions: schedule.length, questions, rosterCount };
}
