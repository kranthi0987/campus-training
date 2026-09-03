// SQLite storage using Node's built-in driver. One connection per process.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS trainers (
  email TEXT PRIMARY KEY,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'trainer',
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS trainer_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE,
  day_no INTEGER,
  date TEXT,
  week TEXT,
  module TEXT,
  title TEXT NOT NULL,
  subtopics TEXT,
  trainers TEXT NOT NULL DEFAULT '[]',
  time_limit_min INTEGER NOT NULL DEFAULT 40,
  easy_s INTEGER NOT NULL DEFAULT 20,
  medium_s INTEGER NOT NULL DEFAULT 40,
  hard_s INTEGER NOT NULL DEFAULT 60,
  join_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  slides_key TEXT,
  current_index INTEGER NOT NULL DEFAULT -1,
  question_started_at INTEGER,
  question_ends_at INTEGER,
  question_closed INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER,
  ends_at INTEGER,
  ended_at INTEGER,
  slide_index INTEGER NOT NULL DEFAULT -1,
  slide_step INTEGER NOT NULL DEFAULT 0,
  reveal TEXT NOT NULL DEFAULT 'end',
  block_end INTEGER,
  trainer_emails TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  text TEXT NOT NULL,
  options TEXT NOT NULL,
  answer INTEGER NOT NULL,
  complexity TEXT NOT NULL DEFAULT 'medium',
  seconds INTEGER,
  explanation TEXT,
  code TEXT
);
CREATE INDEX IF NOT EXISTS questions_session ON questions(session_id, position);
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  UNIQUE(session_id, email)
);
CREATE TABLE IF NOT EXISTS answers (
  participant_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  choice INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  points INTEGER NOT NULL,
  answered_at INTEGER NOT NULL,
  PRIMARY KEY (participant_id, question_id)
);
CREATE TABLE IF NOT EXISTS ratings (
  session_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  trainer TEXT NOT NULL,
  stars INTEGER NOT NULL,
  comment TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, participant_id, trainer)
);
CREATE TABLE IF NOT EXISTS roster (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
`;

export function openDb(file = process.env.DB_PATH || 'data/daily-quiz.sqlite') {
  if (file !== ':memory:') mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

/** Adds columns introduced after the first release to databases created earlier. */
function migrate(db) {
  const cols = db.prepare('PRAGMA table_info(sessions)').all().map((c) => c.name);
  if (!cols.includes('slide_step')) db.exec('ALTER TABLE sessions ADD COLUMN slide_step INTEGER NOT NULL DEFAULT 0');
  if (!cols.includes('reveal')) db.exec("ALTER TABLE sessions ADD COLUMN reveal TEXT NOT NULL DEFAULT 'end'");
  if (!cols.includes('block_end')) db.exec('ALTER TABLE sessions ADD COLUMN block_end INTEGER');
  if (!cols.includes('trainer_emails')) db.exec("ALTER TABLE sessions ADD COLUMN trainer_emails TEXT NOT NULL DEFAULT '[]'");
  // Per-session quiz checkpoints: JSON {"<slide index>": questions}; NULL = the deck's own askAfter values.
  if (!cols.includes('checkpoints')) db.exec('ALTER TABLE sessions ADD COLUMN checkpoints TEXT');
  const tcols = db.prepare('PRAGMA table_info(trainers)').all().map((c) => c.name);
  if (!tcols.includes('role')) db.exec("ALTER TABLE trainers ADD COLUMN role TEXT NOT NULL DEFAULT 'trainer'");
  // Roles arrived after the first release: the earliest account becomes the admin.
  if (!db.prepare("SELECT 1 FROM trainers WHERE role = 'admin'").get()) {
    const first = db.prepare('SELECT email FROM trainers ORDER BY created_at, email LIMIT 1').get();
    if (first) db.prepare("UPDATE trainers SET role = 'admin' WHERE email = ?").run(first.email);
  }
  const qcols = db.prepare('PRAGMA table_info(questions)').all().map((c) => c.name);
  if (!qcols.includes('code')) db.exec('ALTER TABLE questions ADD COLUMN code TEXT');
}

/** Row helpers that keep JSON columns tidy. */
export function rowToSession(r) {
  if (!r) return null;
  return {
    id: r.id, key: r.key, dayNo: r.day_no, date: r.date, week: r.week, module: r.module, title: r.title,
    subtopics: r.subtopics || '', trainers: JSON.parse(r.trainers || '[]'), trainerEmails: JSON.parse(r.trainer_emails || '[]'),
    timeLimitMin: r.time_limit_min, easyS: r.easy_s, mediumS: r.medium_s, hardS: r.hard_s,
    joinCode: r.join_code, status: r.status, slidesKey: r.slides_key,
    currentIndex: r.current_index, questionStartedAt: r.question_started_at, questionEndsAt: r.question_ends_at,
    questionClosed: !!r.question_closed, startedAt: r.started_at, endsAt: r.ends_at, endedAt: r.ended_at,
    slideIndex: r.slide_index, slideStep: r.slide_step ?? 0, reveal: r.reveal || 'end',
    blockEnd: r.block_end ?? null,
    checkpoints: r.checkpoints ? JSON.parse(r.checkpoints) : null,
  };
}

export function rowToQuestion(r) {
  if (!r) return null;
  return {
    id: r.id, sessionId: r.session_id, position: r.position, text: r.text,
    options: JSON.parse(r.options), answer: r.answer, complexity: r.complexity,
    seconds: r.seconds, explanation: r.explanation || '', code: r.code || '',
  };
}
