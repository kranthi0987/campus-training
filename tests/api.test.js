import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

let app, base, cookie;

const call = async (path, { method = 'GET', body, token, asTrainer = true } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (asTrainer && cookie) headers.Cookie = cookie;
  if (token) headers['X-Participant-Token'] = token;
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data, res };
};

before(async () => {
  app = await createApp({ dbPath: ':memory:', publicUrl: 'http://quiz.test' });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(() => { app.server.close(); app.live.timers.forEach((t) => { clearTimeout(t.question); clearTimeout(t.session); }); });

test('the schedule is seeded with question banks and a slide deck', () => {
  assert.equal(app.seeded.sessions, 8);
  assert.ok(app.seeded.questions >= 160, `expected 20+ questions per session, got ${app.seeded.questions}`);
  assert.ok(app.decks.has('day18-integration-ai'));
});

test('trainer login: the first sign-in with the default password creates the admin; own password works after change', async () => {
  assert.equal((await call('/api/trainer/login', { method: 'POST', body: { email: 'kranthi@example.com', password: 'nope' } })).status, 401);
  const ok = await call('/api/trainer/login', { method: 'POST', body: { email: 'Kranthi@Example.com', password: 'Ferguson@2026', name: 'Kranthi' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.usingDefault, true);
  cookie = ok.res.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/api/trainer/me')).data.trainer.email, 'kranthi@example.com');
  assert.equal(ok.data.trainer.role, 'admin', 'the first account is the admin');
  assert.equal((await call('/api/trainer/login', { method: 'POST', body: { email: 'someone@example.com', password: 'Ferguson@2026' } })).status, 401, 'no open sign-up once an account exists');
  assert.equal((await call('/api/trainer/password', { method: 'POST', body: { current: 'Ferguson@2026', next: 'short' } })).status, 400);
  assert.equal((await call('/api/trainer/password', { method: 'POST', body: { current: 'Ferguson@2026', next: 'MyOwnPass!9' } })).status, 200);
  assert.equal((await call('/api/trainer/login', { method: 'POST', body: { email: 'kranthi@example.com', password: 'Ferguson@2026' } })).status, 401, 'default no longer works once changed');
  assert.equal((await call('/api/trainer/login', { method: 'POST', body: { email: 'kranthi@example.com', password: 'MyOwnPass!9' } })).status, 200);
});

test('trainer routes need the cookie', async () => {
  assert.equal((await call('/api/sessions', { asTrainer: false })).status, 401);
  assert.equal((await call('/host/1', { asTrainer: false })).status, 200, 'the page itself loads; the script redirects');
});

test('full run: edit questions, open lobby, join, answer, scoreboard, rating, export', async () => {
  const { data: { sessions } } = await call('/api/sessions');
  const s = sessions.find((x) => x.key === 'day18-integration-ai');
  assert.ok(s.hasSlides);
  assert.equal(s.questionCount, 26);

  // add one question by form and two by paste, then shorten the session so it runs fast
  const added = await call(`/api/sessions/${s.id}/questions`, { method: 'POST', body: { text: 'Extra question?', options: ['1', '2', '3', '4'], answer: 3, complexity: 'easy', seconds: 5 } });
  assert.equal(added.status, 201);
  const bulk = await call(`/api/sessions/${s.id}/questions/bulk`, { method: 'POST', body: { text: 'Paste 1?\nA) x\n*B) y\nC) z\nD) w\n\nPaste 2?\n*A) x\nB) y\nC) z\nD) w\ncomplexity: hard' } });
  assert.equal(bulk.status, 201);
  assert.equal(bulk.data.added, 2);
  const bad = await call(`/api/sessions/${s.id}/questions/bulk`, { method: 'POST', body: { text: 'Broken?\nA) x\nB) y' } });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.errors.length);

  const detail = await call(`/api/sessions/${s.id}`);
  const q1 = detail.data.questions[0];
  const edited = await call(`/api/questions/${q1.id}`, { method: 'PUT', body: { ...q1, text: 'Edited: ' + q1.text, seconds: 5 } });
  assert.equal(edited.status, 200);
  assert.match(edited.data.question.text, /^Edited: /);
  assert.equal((await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { timeLimitMin: 2, easyS: 5, mediumS: 5, hardS: 5 } })).status, 200);

  // lobby + QR + join
  assert.equal((await call(`/api/sessions/${s.id}/lobby`, { method: 'POST' })).status, 200);
  const qr = await call(`/api/sessions/${s.id}/qr.svg`);
  assert.equal(qr.status, 200);
  assert.match(qr.data, /<svg/);
  const byCode = await call(`/api/session-by-code?code=${s.joinCode.toLowerCase()}`, { asTrainer: false });
  assert.equal(byCode.data.session.status, 'lobby');
  assert.equal((await call('/api/join', { method: 'POST', body: { code: s.joinCode, email: 'grace@example.com' }, asTrainer: false })).status, 403, 'not on the participant list yet');
  assert.equal((await call('/api/roster', { method: 'POST', body: { text: 'Grace, grace@example.com\nMarcus <marcus@example.com>' } })).data.added, 2);
  assert.equal((await call('/api/roster/lookup?email=GRACE@example.com', { asTrainer: false })).data.name, 'Grace');
  const grace = (await call('/api/join', { method: 'POST', body: { code: s.joinCode, email: 'grace@example.com' }, asTrainer: false })).data;
  const marcus = (await call('/api/join', { method: 'POST', body: { code: s.joinCode, email: 'marcus@example.com' }, asTrainer: false })).data;
  assert.ok(grace.token && marcus.token);
  assert.equal(grace.name, 'Grace', 'name comes from the participant list');
  assert.equal((await call('/api/join', { method: 'POST', body: { code: s.joinCode, email: 'not-an-email' }, asTrainer: false })).status, 400);
  // this session reveals after each question
  assert.equal((await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { reveal: 'each' } })).status, 200);

  // start + answer
  assert.equal((await call(`/api/sessions/${s.id}/start`, { method: 'POST' })).status, 200);
  const st = (await call('/api/play/state', { token: grace.token, asTrainer: false })).data.state;
  assert.equal(st.session.status, 'live');
  assert.equal(st.question.index, 0);
  assert.equal(st.question.answer, undefined);
  const correct = st.question.id === q1.id ? q1.answer : null;
  assert.equal(correct, q1.answer, 'first question is the edited one');
  assert.equal((await call('/api/play/answer', { method: 'POST', body: { questionId: q1.id, choice: q1.answer }, token: grace.token, asTrainer: false })).status, 200);
  assert.equal((await call('/api/play/answer', { method: 'POST', body: { questionId: q1.id, choice: (q1.answer + 1) % 4 }, token: marcus.token, asTrainer: false })).status, 200);
  assert.equal((await call('/api/play/answer', { method: 'POST', body: { questionId: q1.id, choice: 0 }, token: marcus.token, asTrainer: false })).status, 409);

  const host = (await call(`/api/sessions/${s.id}/state`)).data.state;
  assert.equal(host.participants.filter((p) => p.answered).length, 2);
  assert.equal((await call(`/api/sessions/${s.id}/close`, { method: 'POST' })).status, 200);
  const closed = (await call('/api/play/state', { token: grace.token, asTrainer: false })).data.state;
  assert.equal(closed.question.closed, true);
  assert.equal(closed.me.answer.correct, true);
  assert.equal(closed.me.score, 100);

  // end early, scoreboard, rating, csv
  assert.equal((await call(`/api/sessions/${s.id}/end`, { method: 'POST' })).status, 200);
  const ended = (await call('/api/play/state', { token: grace.token, asTrainer: false })).data.state;
  assert.equal(ended.session.status, 'ended');
  assert.equal(ended.me.rank, 1);
  assert.equal(ended.scoreboard[1].name, 'Marcus');
  const rating = await call('/api/play/rating', { method: 'POST', body: { ratings: s.trainers.map((t) => ({ trainer: t, stars: 5 })), comment: 'Clear and fast' }, token: grace.token, asTrainer: false });
  assert.equal(rating.status, 200);
  const hostEnd = (await call(`/api/sessions/${s.id}/state`)).data.state;
  assert.equal(hostEnd.ratings.trainers[0].average, 5);
  assert.equal(hostEnd.ratings.comments[0].comment, 'Clear and fast');
  const csv = await call(`/api/sessions/${s.id}/results.csv`);
  assert.match(csv.data, /"1","Grace","grace@example.com","100"/);

  // slides after the quiz
  const slide = await call(`/api/sessions/${s.id}/slide`, { method: 'POST', body: { index: 0 } });
  assert.equal(slide.status, 200);
  assert.equal((await call('/api/play/state', { token: grace.token, asTrainer: false })).data.state.slide.index, 0);
  const deck = await call(`/api/sessions/${s.id}/deck`);
  assert.equal(deck.data.deck.slides.length, 26, '25 content slides plus the agenda');

  // reset
  assert.equal((await call(`/api/sessions/${s.id}/reset`, { method: 'POST' })).status, 200);
  assert.equal((await call('/api/play/state', { token: grace.token, asTrainer: false })).status, 401, 'old participant tokens die with the reset');
});

test('pages and static files are served with clean routes', async () => {
  for (const p of ['/', '/join?code=ABC123', '/play', '/trainer', '/host/1', '/present/1', '/styles.css', '/app.js']) {
    const r = await fetch(base + p);
    assert.equal(r.status, 200, p);
  }
  assert.equal((await fetch(base + '/nope.html')).status, 404);
  assert.equal((await fetch(base + '/api/nope')).status, 404);
});
