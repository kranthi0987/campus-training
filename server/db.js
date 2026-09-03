// Storage: Postgres, reached through DATABASE_URL, behind a small async interface
// (get / all / run / exec / transaction). Queries are written with "?" placeholders and
// translated here; INSERTs into the id tables hand back the new id as `lastInsertRowid`.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS trainers (
  email TEXT PRIMARY KEY,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'trainer',
  password_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS trainer_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
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
  question_started_at BIGINT,
  question_ends_at BIGINT,
  question_closed INTEGER NOT NULL DEFAULT 0,
  started_at BIGINT,
  ends_at BIGINT,
  ended_at BIGINT,
  slide_index INTEGER NOT NULL DEFAULT -1,
  slide_step INTEGER NOT NULL DEFAULT 0,
  reveal TEXT NOT NULL DEFAULT 'end',
  block_end INTEGER,
  trainer_emails TEXT NOT NULL DEFAULT '[]',
  checkpoints TEXT
);
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
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
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  joined_at BIGINT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  UNIQUE(session_id, email)
);
CREATE TABLE IF NOT EXISTS answers (
  participant_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  choice INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  points INTEGER NOT NULL,
  answered_at BIGINT NOT NULL,
  PRIMARY KEY (participant_id, question_id)
);
CREATE TABLE IF NOT EXISTS ratings (
  session_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  trainer TEXT NOT NULL,
  stars INTEGER NOT NULL,
  comment TEXT,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (session_id, participant_id, trainer)
);
CREATE TABLE IF NOT EXISTS roster (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
`;

/** Tables whose INSERT should hand back the new id (run() -> lastInsertRowid). */
export const ID_TABLES = ['sessions', 'questions', 'participants'];
export const TABLES = ['trainers', 'trainer_tokens', 'sessions', 'questions', 'participants', 'answers', 'ratings', 'roster', 'meta'];

/** "?" placeholders become $1..$n; INSERTs into id tables return the new id. */
function toPostgres(sql) {
  let n = 0;
  let out = sql.replace(/\?/g, () => `$${++n}`);
  const m = /^\s*INSERT\s+INTO\s+(\w+)/i.exec(out);
  if (m && ID_TABLES.includes(m[1].toLowerCase()) && !/RETURNING/i.test(out)) out = `${out.replace(/;?\s*$/, '')} RETURNING id`;
  return out;
}

export class PostgresDb {
  /** `pool` is a pg.Pool (or, inside a transaction, a checked-out client). */
  constructor(pool, { schema = null, owner = null } = {}) {
    this.pool = pool;
    this.schema = schema;
    this.owner = owner; // the PostgresDb that owns the pool, when this is a transaction handle
    this.dialect = 'postgres';
  }

  async query(sql, params = []) {
    const text = toPostgres(sql);
    try {
      return await this.pool.query(text, params);
    } catch (err) {
      // A connection that died between queries (idle proxies, network blips) fails once; reads are
      // safe to run again on a fresh connection from the pool. Writes are not retried.
      if (!this.owner && /^\s*SELECT/i.test(text) && /terminated|ECONNRESET|EPIPE|ETIMEDOUT/i.test(String(err.message))) {
        return await this.pool.query(text, params);
      }
      throw err;
    }
  }

  async get(sql, ...params) { const { rows } = await this.query(sql, params); return rows[0] ?? null; }
  async all(sql, ...params) { return (await this.query(sql, params)).rows; }
  async run(sql, ...params) {
    const r = await this.query(sql, params);
    return { changes: r.rowCount ?? 0, lastInsertRowid: r.rows?.[0]?.id ?? 0 };
  }
  async exec(sql) { await this.pool.query(sql); }

  /** fn runs inside BEGIN/COMMIT on one connection; any throw rolls back. */
  async transaction(fn) {
    if (this.owner) return fn(this); // already inside one
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const out = await fn(new PostgresDb(client, { schema: this.schema, owner: this }));
      await client.query('COMMIT');
      return out;
    } catch (err) { await client.query('ROLLBACK').catch(() => {}); throw err; } finally { client.release(); }
  }

  async columns(table) {
    const { rows } = await this.pool.query(
      'SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1', [table],
    );
    return rows.map((r) => r.column_name);
  }

  async close() {
    if (this.owner) return;
    if (this.schema) await this.pool.query(`DROP SCHEMA IF EXISTS ${this.schema} CASCADE`).catch(() => {});
    await this.pool.end();
  }
}

/** Render's external hostnames need TLS; internal ones (no domain) do not offer it. */
export function sslFor(url) { return /render\.com/i.test(url) ? { rejectUnauthorized: false } : undefined; }

/**
 * Opens the database at `url` (default DATABASE_URL), creates missing tables and columns.
 * `schema` puts everything in a separate Postgres schema, which close() drops: used by tests.
 */
export async function openDb({ url = process.env.DATABASE_URL, schema = null } = {}) {
  if (!url) throw new Error('DATABASE_URL is not set: point it at the Postgres database (see README).');
  const { default: pg } = await import('pg');
  // COUNT/SUM come back as int8 and AVG as numeric: strings by default, numbers here.
  pg.types.setTypeParser(20, (v) => Number(v));
  pg.types.setTypeParser(1700, (v) => Number(v));
  const pool = new pg.Pool({
    connectionString: url, ssl: sslFor(url), max: 5, keepAlive: true, keepAliveInitialDelayMillis: 10_000, idleTimeoutMillis: 30_000,
    ...(schema ? { options: `-c search_path=${schema}` } : {}),
  });
  pool.on('error', (err) => console.error('  database: idle connection error:', err.message));
  if (schema) await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  const db = new PostgresDb(pool, { schema });
  await db.exec(SCHEMA);
  await migrate(db);
  return db;
}

/**
 * A throwaway schema for a test run, on TEST_DATABASE_URL or DATABASE_URL. close() drops it;
 * schemas older than half an hour are leftovers of interrupted runs and are dropped on the way in.
 */
export async function openTestDb() {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('Tests need TEST_DATABASE_URL (or DATABASE_URL) pointing at a Postgres database.');
  const db = await openDb({ url, schema: `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` });
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const { nspname } of await db.all("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'test_%'")) {
    const stamp = Number(nspname.split('_')[1]);
    if (stamp && stamp < cutoff) await db.exec(`DROP SCHEMA IF EXISTS ${nspname} CASCADE`).catch(() => {});
  }
  return db;
}

/** Adds columns introduced after the first release to databases created earlier. */
export async function migrate(db) {
  const add = async (table, column, ddl) => {
    if (!(await db.columns(table)).includes(column)) await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  };
  await add('sessions', 'slide_step', 'INTEGER NOT NULL DEFAULT 0');
  await add('sessions', 'reveal', "TEXT NOT NULL DEFAULT 'end'");
  await add('sessions', 'block_end', 'INTEGER');
  await add('sessions', 'trainer_emails', "TEXT NOT NULL DEFAULT '[]'");
  // Per-session quiz checkpoints: JSON {"<slide index>": [question ids]}; NULL = the deck's own askAfter values.
  await add('sessions', 'checkpoints', 'TEXT');
  await add('trainers', 'role', "TEXT NOT NULL DEFAULT 'trainer'");
  await add('questions', 'code', 'TEXT');
  // Roles arrived after the first release: the earliest account becomes the admin.
  if (!(await db.get("SELECT 1 AS x FROM trainers WHERE role = 'admin'"))) {
    const first = await db.get('SELECT email FROM trainers ORDER BY created_at, email LIMIT 1');
    if (first) await db.run("UPDATE trainers SET role = 'admin' WHERE email = ?", first.email);
  }
}

// ---- row helpers ----------------------------------------------------------------------------

/**
 * Quiz checkpoints as stored: {"<slide index>": [question ids]}. An earlier release stored
 * counts ({"3": 2}); those entries are dropped so clients only ever see lists.
 */
export function parseCheckpoints(raw) {
  if (!raw) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const out = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (Array.isArray(v) && v.length) out[k] = v.map(Number).filter(Number.isInteger);
  }
  return out;
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
    checkpoints: parseCheckpoints(r.checkpoints),
  };
}

export function rowToQuestion(r) {
  if (!r) return null;
  return {
    id: r.id, sessionId: r.session_id, position: r.position, text: r.text, options: JSON.parse(r.options),
    answer: r.answer, complexity: r.complexity, seconds: r.seconds, explanation: r.explanation || '', code: r.code || '',
  };
}
