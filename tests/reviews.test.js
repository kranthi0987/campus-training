// Reviews (who rated which trainer how much) and scorecards scoped to a trainer's own sessions.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

let app, base;
const cookies = {};
const call = async (path, { method = 'GET', body, as = 'admin', token } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (as && cookies[as]) headers.Cookie = cookies[as];
  if (token) headers['X-Participant-Token'] = token;
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, data: type.includes('json') ? await res.json() : await res.text(), res };
};
const login = async (as, email) => {
  const r = await call('/api/trainer/login', { method: 'POST', body: { email, password: 'Ferguson@2026', name: as }, as: null });
  if (r.status === 200) cookies[as] = r.res.headers.get('set-cookie').split(';')[0];
  return r;
};

let python, spring;
before(async () => {
  app = await createApp({ test: true, publicUrl: 'http://quiz.test' });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  assert.equal((await login('admin', 'admin@example.com')).status, 200);
  // Matched by name to the Python session (its trainers include "Subachandran G").
  assert.equal((await call('/api/trainers', { method: 'POST', body: { email: 'sub@example.com', name: 'Subachandran G' } })).status, 201);
  assert.equal((await login('sub', 'sub@example.com')).status, 200);
  const sessions = (await call('/api/sessions')).data.sessions;
  python = sessions.find((s) => s.key === 'day09-python');
  spring = sessions.find((s) => s.key === 'day11-spring-boot');
});
after(async () => { await app.close(); });

/** Runs a session to its end with two interns and lets them rate. */
async function runAndRate(s, ratingsByIntern) {
  await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { reveal: 'each' } });
  assert.equal((await call(`/api/sessions/${s.id}/lobby`, { method: 'POST' })).status, 200);
  const tokens = {};
  for (const email of Object.keys(ratingsByIntern)) {
    const j = await call('/api/join', { method: 'POST', as: null, body: { code: s.joinCode, email } });
    assert.equal(j.status, 200, JSON.stringify(j.data));
    tokens[email] = j.data.token;
  }
  assert.equal((await call(`/api/sessions/${s.id}/start`, { method: 'POST' })).status, 200);
  assert.equal((await call(`/api/sessions/${s.id}/end`, { method: 'POST' })).status, 200);
  for (const [email, { stars, comment }] of Object.entries(ratingsByIntern)) {
    const r = await call('/api/play/rating', { method: 'POST', as: null, token: tokens[email], body: { ratings: s.trainers.map((t, i) => ({ trainer: t, stars: stars[i] })), comment } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
}

test('the host sees who has rated so far, with stars per trainer and the comment', async () => {
  await runAndRate(python, {
    'anmol.joshi@ferguson.com': { stars: [5, 4], comment: 'Great pace' },
    'saifi.ali@ferguson.com': { stars: [3, 5], comment: '' },
  });
  const { state } = (await call(`/api/sessions/${python.id}/state`)).data;
  assert.equal(state.session.status, 'ended');
  assert.equal(state.ratings.participantCount, 2);
  assert.equal(state.ratings.rows.length, 2);
  const anmol = state.ratings.rows.find((r) => r.email === 'anmol.joshi@ferguson.com');
  assert.deepEqual(anmol.stars, { [python.trainers[0]]: 5, [python.trainers[1]]: 4 });
  assert.equal(anmol.comment, 'Great pace');
  assert.deepEqual(state.ratings.trainers.map((t) => t.average), [4, 4.5]);
});

test('reviews: admins see every trainer and session; trainers have no reviews page', async () => {
  await runAndRate(spring, { 'charan.g@ferguson.com': { stars: [2, 4], comment: 'More demos please' } });

  const all = (await call('/api/reviews')).data;
  assert.equal(all.scoped, false);
  assert.ok(all.sessions.some((x) => x.id === python.id) && all.sessions.some((x) => x.id === spring.id));
  const sub = all.trainers.find((t) => t.trainer === 'Subachandran G');
  assert.equal(sub.average, 4);
  assert.equal(sub.count, 2);
  assert.equal(sub.sessions, 1);
  const suhail = all.trainers.find((t) => t.trainer === 'Syed Suhail');
  assert.equal(suhail.average, 2);
  const springRow = all.sessions.find((x) => x.id === spring.id);
  assert.equal(springRow.ratedCount, 1);
  assert.equal(springRow.rows[0].name, 'Charan G');
  assert.equal(springRow.rows[0].comment, 'More demos please');
  const untouched = all.sessions.find((x) => x.key === 'day12-sql');
  assert.equal(untouched.ratedCount, 0);
  assert.deepEqual(untouched.trainers.map((t) => t.average), [null]);

  assert.equal((await call('/api/reviews', { as: 'sub' })).status, 403, 'ratings are for admins; trainers see their own on the host screen');
});

test('scorecards for a trainer cover only their sessions; admins keep everything', async () => {
  const full = (await call('/api/dashboard')).data;
  assert.equal(full.scoped, false);
  assert.ok(full.sessions.length >= 14);
  const charan = full.interns.find((i) => i.email === 'charan.g@ferguson.com');
  assert.ok(charan.sessions[spring.id], 'the admin sees the Spring Boot attendance');

  const mine = (await call('/api/dashboard', { as: 'sub' })).data;
  assert.equal(mine.scoped, true);
  assert.deepEqual(mine.sessions.map((s) => s.key), ['day09-python']);
  const charanMine = mine.interns.find((i) => i.email === 'charan.g@ferguson.com');
  assert.equal(charanMine.attended, 0, 'attendance in another trainer\'s session is not counted');
  assert.equal(charanMine.sessions[spring.id], undefined);
  const anmol = mine.interns.find((i) => i.email === 'anmol.joshi@ferguson.com');
  assert.equal(anmol.attended, 1);
  assert.equal((await call('/api/admin/clear-data', { method: 'POST', as: 'sub', body: { confirm: 'CLEAR' } })).status, 403, 'clearing stays admin-only');
});
