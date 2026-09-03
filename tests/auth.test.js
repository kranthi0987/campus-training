// Trainer sign-in tokens are signed with a secret, so they survive a server restart (a new Auth
// over the same database) and die with a password change, account removal or a different secret.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Auth, DEFAULT_PASSWORD } from '../server/auth.js';

const fresh = (secret = 'unit-test-secret') => {
  const db = openDb(':memory:');
  return { db, auth: new Auth(db, { secret }) };
};

test('a token issued before a restart is still accepted afterwards with the same secret', () => {
  const { db, auth } = fresh();
  auth.create({ email: 'admin@example.com', name: 'Admin', role: 'admin', password: DEFAULT_PASSWORD });
  const token = auth.issueToken('admin@example.com');
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'payload.signature');
  assert.equal(auth.trainerForToken(token)?.email, 'admin@example.com');
  assert.equal(auth.trainerForToken(token)?.role, 'admin');

  const restarted = new Auth(db, { secret: 'unit-test-secret' });
  assert.equal(restarted.trainerForToken(token)?.email, 'admin@example.com', 'survives a new Auth instance');
  assert.equal(new Auth(db, { secret: 'another-secret' }).trainerForToken(token), null, 'not with a different secret');
});

test('tampering, password changes and removal invalidate a token', () => {
  const { auth } = fresh();
  auth.create({ email: 'a@example.com', name: 'A', role: 'admin', password: DEFAULT_PASSWORD });
  auth.create({ email: 't@example.com', name: 'T', role: 'trainer', password: DEFAULT_PASSWORD });
  const token = auth.issueToken('t@example.com');
  const [payload, sig] = token.split('.');
  assert.equal(auth.trainerForToken(`${payload}x.${sig}`), null, 'changed payload');
  assert.equal(auth.trainerForToken(`${payload}.${sig.slice(1)}${sig[0]}`), null, 'changed signature');
  assert.equal(auth.trainerForToken('nonsense'), null, 'legacy lookup finds nothing');

  auth.update('t@example.com', { role: 'admin' });
  assert.equal(auth.trainerForToken(token)?.role, 'admin', 'role changes show up immediately');
  auth.update('t@example.com', { password: 'NewPassw0rd!' });
  assert.equal(auth.trainerForToken(token), null, 'password change');
  const again = auth.issueToken('t@example.com');
  assert.equal(auth.trainerForToken(again)?.email, 't@example.com');
  auth.remove('t@example.com');
  assert.equal(auth.trainerForToken(again), null, 'removed account');
});

test('without an explicit secret each Auth gets its own random one', () => {
  const db = openDb(':memory:');
  const a = new Auth(db), b = new Auth(db);
  a.create({ email: 'x@example.com', name: 'X', role: 'admin', password: DEFAULT_PASSWORD });
  const token = a.issueToken('x@example.com');
  assert.ok(a.trainerForToken(token));
  assert.equal(b.trainerForToken(token), null);
});
