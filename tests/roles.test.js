// Admin vs trainer roles: account management, session scoping, certificates.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

let app, base;
const cookies = {};

const call = async (path, { method = 'GET', body, as = 'admin' } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (as && cookies[as]) headers.Cookie = cookies[as];
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : type.includes('zip') ? Buffer.from(await res.arrayBuffer()) : await res.text();
  return { status: res.status, data, res };
};
const login = async (as, email, password) => {
  const r = await call('/api/trainer/login', { method: 'POST', body: { email, password, name: as }, as: null });
  if (r.status === 200) cookies[as] = r.res.headers.get('set-cookie').split(';')[0];
  return r;
};

before(async () => {
  app = await createApp({ dbPath: ':memory:', publicUrl: 'http://quiz.test' });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(() => { app.server.close(); app.live.timers.forEach((t) => { clearTimeout(t.question); clearTimeout(t.session); }); });

test('the first account is the admin; later accounts come from the admin', async () => {
  assert.equal((await call('/api/info', { as: null })).data.setupNeeded, true);
  const first = await login('admin', 'admin@example.com', 'Ferguson@2026');
  assert.equal(first.status, 200);
  assert.equal(first.data.trainer.role, 'admin');
  assert.equal((await call('/api/info', { as: null })).data.setupNeeded, false);
  assert.equal((await login('nobody', 'nobody@example.com', 'Ferguson@2026')).status, 401, 'no open sign-up once an account exists');

  const made = await call('/api/trainers', { method: 'POST', body: { email: 'Sub@Example.com', name: 'Subachandran G', role: 'trainer' } });
  assert.equal(made.status, 201);
  assert.equal(made.data.usingDefault, true);
  assert.equal(made.data.trainer.email, 'sub@example.com');
  assert.equal(made.data.trainer.matchedSessionIds.length, 1, 'matched to the Python session by name');
  assert.equal((await call('/api/trainers', { method: 'POST', body: { email: 'sub@example.com', name: 'Dup' } })).status, 409);
  assert.equal((await call('/api/trainers', { method: 'POST', body: { email: 'x@example.com', name: 'X', password: 'short' } })).status, 400);
  assert.equal((await call('/api/trainers', { method: 'POST', body: { email: 'x@example.com', name: 'X', role: 'boss' } })).status, 400);

  const sub = await login('sub', 'sub@example.com', 'Ferguson@2026');
  assert.equal(sub.status, 200);
  assert.equal(sub.data.trainer.role, 'trainer');
  assert.equal((await call('/api/trainers')).data.trainers.length, 2);
});

test('a trainer only sees and touches their own sessions', async () => {
  const mine = (await call('/api/sessions', { as: 'sub' })).data.sessions;
  assert.deepEqual(mine.map((s) => s.key), ['day09-python']);
  const all = (await call('/api/sessions')).data.sessions;
  assert.equal(all.length, 8, 'the admin sees everything');
  const other = all.find((s) => s.key === 'day11-spring-boot');

  assert.equal((await call(`/api/sessions/${other.id}`, { as: 'sub' })).status, 403);
  assert.equal((await call(`/api/sessions/${other.id}`, { method: 'PUT', body: { title: 'Hijack' }, as: 'sub' })).status, 403);
  assert.equal((await call(`/api/sessions/${other.id}/lobby`, { method: 'POST', as: 'sub' })).status, 403);
  assert.equal((await call(`/api/sessions/${other.id}/questions`, { method: 'POST', body: {}, as: 'sub' })).status, 403);
  assert.equal((await call(`/api/sessions/${other.id}/state`, { as: 'sub' })).status, 403);
  assert.equal((await call(`/api/sessions/${other.id}/deck`, { as: 'sub' })).status, 403);
  assert.equal((await call(`/api/sessions/${other.id}/results.csv`, { as: 'sub' })).status, 403);
  const q = (await call(`/api/sessions/${other.id}`)).data.questions[0];
  assert.equal((await call(`/api/questions/${q.id}`, { method: 'DELETE', as: 'sub' })).status, 403);
  assert.equal((await call(`/api/questions/${q.id}`, { method: 'PUT', body: q, as: 'sub' })).status, 403);
  for (const p of ['/api/dashboard', '/api/trainers']) assert.equal((await call(p, { as: 'sub' })).status, 403, p);
  assert.equal((await call('/api/admin/clear-data', { method: 'POST', body: { confirm: 'CLEAR' }, as: 'sub' })).status, 403);
  assert.equal((await call('/api/interns?email=x@example.com', { method: 'DELETE', as: 'sub' })).status, 403);
  assert.equal((await call('/api/roster', { method: 'POST', body: { text: 'A, a@example.com' }, as: 'sub' })).status, 403);
  assert.equal((await call('/api/roster', { as: 'sub' })).status, 200, 'trainers may read the participant list');

  // the admin assigns another session explicitly
  const upd = await call('/api/trainers/sub@example.com', { method: 'PUT', body: { sessionIds: [other.id] } });
  assert.equal(upd.status, 200);
  assert.deepEqual(upd.data.trainer.sessionIds, [other.id]);
  assert.deepEqual((await call('/api/sessions', { as: 'sub' })).data.sessions.map((s) => s.key).sort(), ['day09-python', 'day11-spring-boot']);
  assert.equal((await call(`/api/sessions/${other.id}`, { as: 'sub' })).status, 200);
  assert.equal((await call(`/api/sessions/${other.id}/state`, { as: 'sub' })).status, 200);

  // a session the trainer creates is theirs
  const made = await call('/api/sessions', { method: 'POST', body: { title: 'Extra quiz' }, as: 'sub' });
  assert.equal(made.status, 201);
  assert.deepEqual(made.data.session.trainerEmails, ['sub@example.com']);
  assert.ok((await call('/api/sessions', { as: 'sub' })).data.sessions.some((s) => s.id === made.data.session.id));

  // a trainer cannot hand a session to someone else; an admin can
  const put = await call(`/api/sessions/${made.data.session.id}`, { method: 'PUT', body: { trainerEmails: [] }, as: 'sub' });
  assert.deepEqual(put.data.session.trainerEmails, ['sub@example.com']);
  const adminPut = await call(`/api/sessions/${made.data.session.id}`, { method: 'PUT', body: { trainerEmails: ['nobody@example.com', 'sub@example.com'] } });
  assert.deepEqual(adminPut.data.session.trainerEmails, ['sub@example.com'], 'unknown accounts are dropped');
});

test('admin and the session trainer can issue certificates; others cannot', async () => {
  const s = (await call('/api/sessions')).data.sessions.find((x) => x.key === 'day09-python');
  await call('/api/roster', { method: 'POST', body: { entries: [{ name: 'Grace', email: 'grace@example.com' }] } });
  await call(`/api/sessions/${s.id}/lobby`, { method: 'POST' });
  const grace = (await call('/api/join', { method: 'POST', body: { code: s.joinCode, email: 'grace@example.com' }, as: null })).data;
  await call(`/api/sessions/${s.id}/start`, { method: 'POST' });
  assert.equal((await call(`/api/sessions/${s.id}/certificates`)).status, 409, 'not before the end');
  await call(`/api/sessions/${s.id}/end`, { method: 'POST' });

  const list = (await call(`/api/sessions/${s.id}/certificates`)).data;
  assert.equal(list.session.id, s.id);
  assert.equal(list.certificates.length, 1);
  assert.equal(list.certificates[0].participantId, grace.participantId);
  assert.equal(list.certificates[0].rank, 1);
  assert.match(list.certificates[0].filename, /^certificate-grace-/);

  const one = await call(`/api/participants/${grace.participantId}/certificate`, { as: 'sub' });
  assert.equal(one.status, 200, 'the session trainer may issue it');
  assert.equal(one.data.certificate.name, 'Grace');
  assert.equal((await call(`/api/participants/${grace.participantId}/certificate.svg`, { as: 'sub' })).status, 200);

  const zip = await call(`/api/sessions/${s.id}/certificates.zip`);
  assert.equal(zip.status, 200);
  assert.equal(zip.res.headers.get('content-type'), 'application/zip');
  assert.equal(zip.data.subarray(0, 4).toString('latin1'), 'PK');
  assert.ok(zip.data.includes(Buffer.from('certificate-grace-python.svg')));
  assert.ok(zip.data.includes(Buffer.from('Campus Training')));

  // another trainer with no access to this session
  await call('/api/trainers', { method: 'POST', body: { email: 'other@example.com', name: 'Other' } });
  await login('other', 'other@example.com', 'Ferguson@2026');
  assert.equal((await call(`/api/participants/${grace.participantId}/certificate`, { as: 'other' })).status, 403);
  assert.equal((await call(`/api/sessions/${s.id}/certificates`, { as: 'other' })).status, 403);
  assert.equal((await call(`/api/sessions/${s.id}/certificates.zip`, { as: 'other' })).status, 403);
  assert.equal((await call(`/api/participants/${grace.participantId}`, { method: 'DELETE', as: 'other' })).status, 403);
});

test('account guards: no self-removal, keep one admin, removal revokes access', async () => {
  assert.equal((await call('/api/trainers/admin@example.com', { method: 'DELETE' })).status, 400);
  assert.equal((await call('/api/trainers/admin@example.com', { method: 'PUT', body: { role: 'trainer' } })).status, 400);

  const promote = await call('/api/trainers/other@example.com', { method: 'PUT', body: { role: 'admin', name: 'Other Admin', password: 'NewPass!123' } });
  assert.equal(promote.status, 200);
  assert.equal(promote.data.trainer.role, 'admin');
  assert.equal(promote.data.trainer.name, 'Other Admin');
  assert.equal((await call('/api/trainer/me', { as: 'other' })).status, 401, 'a password reset signs the account out');
  assert.equal((await login('other', 'other@example.com', 'Ferguson@2026')).status, 401);
  assert.equal((await login('other', 'other@example.com', 'NewPass!123')).status, 200);
  assert.equal((await call('/api/sessions', { as: 'other' })).data.sessions.length, 9, 'admins see every session');
  assert.equal((await call('/api/dashboard', { as: 'other' })).status, 200);

  assert.equal((await call('/api/trainers/other@example.com', { method: 'PUT', body: { role: 'trainer' } })).status, 200, 'demoting is fine while another admin remains');
  assert.equal((await call('/api/trainers/sub@example.com', { method: 'DELETE' })).status, 200);
  assert.equal((await call('/api/trainer/me', { as: 'sub' })).status, 401);
  assert.equal((await call('/api/trainers/sub@example.com', { method: 'DELETE' })).status, 404);
  const s = (await call('/api/sessions')).data.sessions.find((x) => x.key === 'day11-spring-boot');
  assert.ok(!s.trainerEmails.includes('sub@example.com'), 'removed from the sessions it was assigned to');
  assert.ok(s.trainerEmails.length >= 1, 'the seeded assignments from the schedule stay');
});
