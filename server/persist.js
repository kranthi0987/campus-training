// Durable copy of the SQLite database for hosts with an ephemeral disk (Render's free tier
// loses local files on every deploy, restart and idle spin-down).
//
// The app keeps working on its local SQLite file; this module restores the latest snapshot of
// that file from a store (Render Postgres via DATABASE_URL) before the database is opened, and
// after every batch of changes writes a fresh snapshot back. The whole file is a few hundred
// kilobytes, so a snapshot every few seconds while a quiz runs is cheap, and nothing in the
// engine has to know about Postgres.
import { backup } from 'node:sqlite';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** In-memory store, for tests and as the reference for what a store must provide. */
export class MemoryStore {
  constructor() { this.data = null; this.savedAt = null; this.saves = 0; }
  async load() { return this.data ? { data: this.data, savedAt: this.savedAt } : null; }
  async save(buf) { this.data = Buffer.from(buf); this.savedAt = new Date(); this.saves++; }
  async clear() { this.data = null; this.savedAt = null; }
  async close() {}
}

/** One row in a Postgres table holds the latest snapshot. */
export class PostgresStore {
  /** `pool` lets tests inject a fake; normally a pg.Pool is created from the URL on first use. */
  constructor(url, { pool = null } = {}) { this.url = url; this.pool = pool; this.ready = false; }

  /** Render's external hostnames need TLS; internal ones (no domain) do not offer it. */
  static sslFor(url) { return /render\.com/i.test(url) ? { rejectUnauthorized: false } : undefined; }

  async client() {
    if (!this.pool) {
      const { default: pg } = await import('pg');
      this.pool = new pg.Pool({ connectionString: this.url, ssl: PostgresStore.sslFor(this.url), max: 2 });
    }
    if (!this.ready) {
      await this.pool.query('CREATE TABLE IF NOT EXISTS quiz_snapshots (id INTEGER PRIMARY KEY, data BYTEA NOT NULL, saved_at TIMESTAMPTZ NOT NULL)');
      this.ready = true;
    }
    return this.pool;
  }

  async load() {
    const { rows } = await (await this.client()).query('SELECT data, saved_at FROM quiz_snapshots WHERE id = 1');
    return rows[0] ? { data: rows[0].data, savedAt: rows[0].saved_at } : null;
  }

  async save(buf) {
    await (await this.client()).query(
      'INSERT INTO quiz_snapshots (id, data, saved_at) VALUES (1, $1, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, saved_at = EXCLUDED.saved_at',
      [buf],
    );
  }

  async clear() { await (await this.client()).query('DELETE FROM quiz_snapshots WHERE id = 1'); }

  async close() { await this.pool?.end(); this.pool = null; }
}

export function storeFromEnv(env = process.env) {
  return env.DATABASE_URL ? new PostgresStore(env.DATABASE_URL) : null;
}

/** Before the database is opened: put the latest snapshot in place of the local file. Returns true when one was restored. */
export async function restoreSnapshot(store, dbPath, { log = () => {} } = {}) {
  if (!store || !dbPath || dbPath === ':memory:') return false;
  let snap;
  try { snap = await store.load(); } catch (err) {
    // Starting from the local file now and snapshotting it later would overwrite the real data.
    log(`durable store: cannot read DATABASE_URL (${err.message}); refusing to start so the stored snapshot is not overwritten`);
    throw err;
  }
  if (!snap) { log('durable store: no snapshot yet, starting from the local database file'); return false; }
  const abs = path.resolve(dbPath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, snap.data);
  for (const ext of ['-wal', '-shm']) rmSync(abs + ext, { force: true });
  log(`durable store: restored the snapshot saved ${new Date(snap.savedAt).toISOString()} (${snap.data.length} bytes)`);
  return true;
}

/**
 * After the database is opened: every `intervalMs`, if rows changed since the last snapshot,
 * copy the database (SQLite's online backup, so it is consistent) and hand the bytes to the
 * store. `flush()` does it immediately and resolves when the store has it, for shutdown.
 */
export function startSnapshots(db, dbPath, store, { intervalMs = 3000, log = () => {} } = {}) {
  const changes = () => db.prepare('SELECT total_changes() AS n').get().n;
  const tmp = `${path.resolve(dbPath)}.snapshot`;
  let saved = changes();
  let running = null;
  let failures = 0;

  const snapshot = async () => {
    const n = changes();
    rmSync(tmp, { force: true });
    await backup(db, tmp);
    const buf = readFileSync(tmp);
    rmSync(tmp, { force: true });
    await store.save(buf);
    saved = n;
  };

  const flush = async () => {
    if (running) await running.catch(() => {});
    if (changes() === saved) return false;
    running = snapshot().then(
      () => { failures = 0; return true; },
      (err) => { failures++; if (failures <= 3 || failures % 20 === 0) log(`durable store: snapshot failed (${failures}): ${err.message}`); return false; },
    );
    try { return await running; } finally { running = null; }
  };

  const timer = setInterval(() => { flush(); }, intervalMs);
  timer.unref?.();
  log(`durable store: snapshots every ${Math.round(intervalMs / 1000)} s after changes`);
  return { flush, stop: () => clearInterval(timer), get pendingChanges() { return changes() !== saved; } };
}
