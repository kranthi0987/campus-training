// The durable store: changes are snapshotted to the store, and a fresh instance (empty local
// disk) restores the snapshot before opening the database, so accounts, participants and
// scores outlive the instance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/index.js';
import { MemoryStore, restoreSnapshot, startSnapshots } from '../server/persist.js';
import { openDb } from '../server/db.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const boot = async (dbPath, store) => {
  const app = await createApp({ dbPath, store, snapshotMs: 40, secret: 'persist-test' });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const call = (p, body) => fetch(base + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const stop = async () => { app.persist?.stop(); app.live.timers.forEach((t) => { clearTimeout(t.question); clearTimeout(t.session); }); await new Promise((r) => app.server.close(r)); app.db.close(); };
  return { app, call, stop };
};

test('changes reach the store and a new instance starts from them', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quiz-persist-'));
  const dbPath = path.join(dir, 'q.sqlite');
  const store = new MemoryStore();
  try {
    const one = await boot(dbPath, store);
    assert.equal(store.data, null, 'nothing saved before any change');
    const login = await one.call('/api/trainer/login', { email: 'admin@example.com', password: 'Ferguson@2026', name: 'Admin' });
    assert.equal(login.status, 200);
    await sleep(250);
    assert.ok(store.saves >= 1, 'the new account was snapshotted');
    const savesAfterLogin = store.saves;
    await sleep(150);
    assert.equal(store.saves, savesAfterLogin, 'no snapshot without changes');

    // A participant joins and answers: their score must survive the instance.
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const sessions = (await (await fetch(`http://127.0.0.1:${one.app.server.address().port}/api/sessions`, { headers: { Cookie: cookie } })).json()).sessions;
    const s = sessions.find((x) => x.key === 'day11-spring-boot');
    await fetch(`http://127.0.0.1:${one.app.server.address().port}/api/sessions/${s.id}/lobby`, { method: 'POST', headers: { Cookie: cookie } });
    const joined = await (await one.call('/api/join', { code: s.joinCode, email: 'anmol.joshi@ferguson.com' })).json();
    assert.ok(joined.token);
    assert.equal(await one.app.persist.flush(), true, 'flush snapshots pending changes');
    assert.equal(await one.app.persist.flush(), false, 'and reports nothing to do right after');
    await one.stop();

    rmSync(dbPath, { force: true });
    assert.ok(!existsSync(dbPath), 'the local disk is gone, as after a redeploy');
    const two = await boot(dbPath, store);
    const again = await two.call('/api/trainer/login', { email: 'admin@example.com', password: 'Ferguson@2026' });
    assert.equal(again.status, 200, 'the account restored from the snapshot');
    const state = await (await fetch(`http://127.0.0.1:${two.app.server.address().port}/api/play/state`, { headers: { 'X-Participant-Token': joined.token } })).json();
    assert.equal(state.state?.me?.name, 'Anmol Joshi', 'the participant restored too');
    assert.equal(two.app.seeded.seeded, false, 'restored databases are not re-seeded');
    await two.stop();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('restoreSnapshot and startSnapshots handle the edge cases', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quiz-persist-'));
  try {
    const store = new MemoryStore();
    assert.equal(await restoreSnapshot(store, path.join(dir, 'none.sqlite')), false, 'empty store: nothing restored');
    assert.equal(await restoreSnapshot(store, ':memory:'), false);
    const db = openDb(path.join(dir, 'a.sqlite'));
    const snaps = startSnapshots(db, path.join(dir, 'a.sqlite'), store, { intervalMs: 60_000 });
    assert.equal(snaps.pendingChanges, false);
    db.prepare("INSERT INTO roster (email, name, created_at) VALUES ('x@example.com', 'X', 1)").run();
    assert.equal(snaps.pendingChanges, true);
    assert.equal(await snaps.flush(), true);
    assert.equal(snaps.pendingChanges, false);
    snaps.stop();
    db.close();
    // A store that fails keeps the changes pending so the next tick retries.
    const broken = { async load() { return null; }, async save() { throw new Error('network down'); } };
    const db2 = openDb(path.join(dir, 'b.sqlite'));
    const logs = [];
    const s2 = startSnapshots(db2, path.join(dir, 'b.sqlite'), broken, { intervalMs: 60_000, log: (m) => logs.push(m) });
    db2.prepare("INSERT INTO roster (email, name, created_at) VALUES ('y@example.com', 'Y', 1)").run();
    assert.equal(await s2.flush(), false);
    assert.equal(s2.pendingChanges, true);
    assert.ok(logs.some((m) => m.includes('network down')));
    s2.stop();
    db2.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('PostgresStore keeps one row up to date and picks TLS only for external Render hosts', async () => {
  const { PostgresStore } = await import('../server/persist.js');
  const queries = [];
  let row = null;
  const pool = {
    async query(sql, params) {
      queries.push(sql.split(' ').slice(0, 3).join(' '));
      if (sql.startsWith('CREATE TABLE')) return { rows: [] };
      if (sql.startsWith('SELECT')) return { rows: row ? [row] : [] };
      if (sql.startsWith('INSERT')) { row = { data: params[0], saved_at: new Date() }; return { rows: [] }; }
      if (sql.startsWith('DELETE')) { row = null; return { rows: [] }; }
      throw new Error('unexpected ' + sql);
    },
    async end() { queries.push('END'); },
  };
  const store = new PostgresStore('postgres://u:p@dpg-internal/db', { pool });
  assert.equal(await store.load(), null);
  await store.save(Buffer.from('one'));
  await store.save(Buffer.from('two'));
  assert.equal((await store.load()).data.toString(), 'two', 'the single row is replaced, not appended');
  await store.clear();
  assert.equal(await store.load(), null);
  await store.close();
  assert.equal(queries.filter((q) => q.startsWith('CREATE TABLE')).length, 1, 'the table is ensured once');
  assert.equal(queries.at(-1), 'END');
  assert.equal(PostgresStore.sslFor('postgres://u:p@dpg-abc-a/db'), undefined, 'internal Render URL: no TLS');
  assert.deepEqual(PostgresStore.sslFor('postgres://u:p@dpg-abc-a.oregon-postgres.render.com/db'), { rejectUnauthorized: false }, 'external URL: TLS');
});

test('a store that cannot be reached at boot stops the start instead of risking the snapshot', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quiz-persist-'));
  try {
    const down = { async load() { throw new Error('connection refused'); }, async save() {}, async close() {} };
    const logs = [];
    await assert.rejects(restoreSnapshot(down, path.join(dir, 'x.sqlite'), { log: (m) => logs.push(m) }), /connection refused/);
    assert.ok(logs.some((m) => m.includes('refusing to start')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
