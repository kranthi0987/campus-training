// Trainer sign-in tokens are signed with a secret, so they survive a server restart (a new Auth
// over the same database) and die with a password change, account removal or a different secret.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Auth, DEFAULT_PASSWORD } from '../server/auth.js';

const fresh = async (secret = 'unit-test-secret') => {
  const db = await openDb(':memory:');
  return { db, auth: new Auth(db, { secret }) };
};

test('a token issued before a restart is still accepted afterwards with the same secret', async () => {
  const { db, auth } = await fresh();
  await auth.create({ email: 'admin@example.com', name: 'Admin', role: 'admin', password: DEFAULT_PASSWORD });
  const token = await auth.issueToken('admin@example.com');
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'payload.signature');
  assert.equal((await auth.trainerForToken(token))?.email, 'admin@example.com');
  assert.equal((await auth.trainerForToken(token))?.role, 'admin');

  const restarted = new Auth(db, { secret: 'unit-test-secret' });
  assert.equal((await restarted.trainerForToken(token))?.email, 'admin@example.com', 'survives a new Auth instance');
  assert.equal(await new Auth(db, { secret: 'another-secret' }).trainerForToken(token), null, 'not with a different secret');
  await db.close();
});

test('tampering, password changes and removal invalidate a token', async () => {
  const { db, auth } = await fresh();
  await auth.create({ email: 'a@example.com', name: 'A', role: 'admin', password: DEFAULT_PASSWORD });
  await auth.create({ email: 't@example.com', name: 'T', role: 'trainer', password: DEFAULT_PASSWORD });
  const token = await auth.issueToken('t@example.com');
  const [payload, sig] = token.split('.');
  assert.equal(await auth.trainerForToken(`${payload}x.${sig}`), null, 'changed payload');
  assert.equal(await auth.trainerForToken(`${payload}.${sig.slice(1)}${sig[0]}`), null, 'changed signature');
  assert.equal(await auth.trainerForToken('nonsense'), null, 'legacy lookup finds nothing');

  await auth.update('t@example.com', { role: 'admin' });
  assert.equal((await auth.trainerForToken(token))?.role, 'admin', 'role changes show up immediately');
  await auth.update('t@example.com', { password: 'NewPassw0rd!' });
  assert.equal(await auth.trainerForToken(token), null, 'password change');
  const again = await auth.issueToken('t@example.com');
  assert.equal((await auth.trainerForToken(again))?.email, 't@example.com');
  await auth.remove('t@example.com');
  assert.equal(await auth.trainerForToken(again), null, 'removed account');
  await db.close();
});

test('without an explicit secret each Auth gets its own random one', async () => {
  const db = await openDb(':memory:');
  const a = new Auth(db), b = new Auth(db);
  await a.create({ email: 'x@example.com', name: 'X', role: 'admin', password: DEFAULT_PASSWORD });
  const token = await a.issueToken('x@example.com');
  assert.ok(await a.trainerForToken(token));
  assert.equal(await b.trainerForToken(token), null);
  await db.close();
});
