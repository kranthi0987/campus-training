// Quiz blocks inside a presentation: a slide's askAfter runs the next N questions, then returns to the slides.
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
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const post = (p, body) => call(p, { method: 'POST', body });

before(async () => {
  app = await createApp({ dbPath: ':memory:', publicUrl: 'http://quiz.test' });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  cookie = (await fetch(base + '/api/trainer/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 't@example.com', password: 'Ferguson@2026' }) })).headers.get('set-cookie').split(';')[0];
});
after(() => { app.server.close(); app.live.timers.forEach((t) => { clearTimeout(t.question); clearTimeout(t.session); }); });

test('the Python deck carries the 15 document questions and five checkpoints of three', async () => {
  const s = (await call('/api/sessions')).data.sessions.find((x) => x.key === 'day09-python');
  assert.equal(s.questionCount, 15);
  assert.ok(s.hasSlides);
  const { deck } = (await call(`/api/sessions/${s.id}/deck`)).data;
  assert.equal(deck.slides.length, 16, 'one slide per pptx slide, no auto agenda added');
  const checkpoints = deck.slides.map((sl, i) => [i + 1, sl.askAfter || 0]).filter(([, n]) => n);
  assert.deepEqual(checkpoints, [[7, 3], [8, 3], [9, 3], [10, 3], [11, 3]]);
  const qs = (await call(`/api/sessions/${s.id}`)).data.questions;
  assert.match(qs[1].code, /b\.append\(4\)/, 'code snippets travel with the question');
  assert.equal(qs[9].text.includes('auto-waiting'), true, 'Playwright questions sit after slide 10');
  assert.equal(qs[12].text.includes('pathlib'), true, 'file questions sit after slide 11');
});

test('advancing past a checkpoint slide runs a three-question block, then returns to the next slide', async () => {
  const s = (await call('/api/sessions')).data.sessions.find((x) => x.key === 'day09-python');
  await post(`/api/sessions/${s.id}`, {}); // no-op
  await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { easyS: 5, mediumS: 5, hardS: 5 } });
  await post(`/api/sessions/${s.id}/lobby`);
  const anmol = (await post('/api/join', { code: s.joinCode, email: 'anmol.joshi@ferguson.com' })).data;
  assert.ok(anmol.token, 'seeded participant can join');

  // Slide 7 (index 6) fully revealed, then one more advance starts the block.
  let st = (await post(`/api/sessions/${s.id}/slide`, { index: 6, step: 'all' })).data.state;
  assert.equal(st.session.pendingBlock, 3);
  st = (await post(`/api/sessions/${s.id}/advance`, { dir: 1 })).data.state;
  assert.equal(st.session.status, 'live');
  assert.equal(st.session.blockEnd, 2);
  assert.equal(st.question.index, 0);
  assert.equal(st.session.endsAt, null, 'no session clock for a block');

  // Answer Q1 correctly (bool("False") is True = option B), then close + next through the block.
  await call('/api/play/answer', { method: 'POST', body: { questionId: st.question.id, choice: 1 }, token: anmol.token, asTrainer: false });
  for (let k = 0; k < 3; k++) {
    st = (await post(`/api/sessions/${s.id}/next`)).data.state; // close
    assert.equal(st.question?.closed ?? true, true);
    st = (await post(`/api/sessions/${s.id}/next`)).data.state; // advance
  }
  assert.equal(st.session.status, 'lobby', 'back to the slides after the block');
  assert.equal(st.session.slideIndex, 7, 'on the slide after the checkpoint');
  assert.equal(st.session.slideStep, 0);
  assert.equal(st.session.askedCount, 3);
  assert.equal(st.session.blockEnd, null);
  const mine = (await call('/api/play/state', { token: anmol.token, asTrainer: false })).data.state;
  assert.equal(mine.slide.index, 7, 'phones follow back to the slide');
  assert.equal(mine.me.score, null, 'scores stay hidden between blocks');

  // Skipping ahead: the next checkpoint asks the next three questions regardless of which slide.
  st = (await post(`/api/sessions/${s.id}/slide`, { index: 7, step: 'all' })).data.state;
  st = (await post(`/api/sessions/${s.id}/advance`, { dir: 1 })).data.state;
  assert.equal(st.question.index, 3);
  assert.equal(st.session.blockEnd, 5);
  await post(`/api/sessions/${s.id}/end`);
  const host = (await call(`/api/sessions/${s.id}/state`)).data.state;
  assert.equal(host.session.status, 'ended');
  assert.equal(host.review.length, 4, 'review covers only what was asked');
  assert.equal(host.scoreboard[0].score, 100);
  await post(`/api/sessions/${s.id}/reset`);
});

test('after blocks, Start quiz from the host runs only the remaining questions', async () => {
  const s = (await call('/api/sessions')).data.sessions.find((x) => x.key === 'day09-python');
  await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { easyS: 5, mediumS: 5, hardS: 5 } });
  await post(`/api/sessions/${s.id}/lobby`);
  await post(`/api/sessions/${s.id}/slide`, { index: 6, step: 'all' });
  await post(`/api/sessions/${s.id}/advance`, { dir: 1 });
  for (let k = 0; k < 6; k++) await post(`/api/sessions/${s.id}/next`);
  let st = (await post(`/api/sessions/${s.id}/start`)).data.state;
  assert.equal(st.session.status, 'live');
  assert.equal(st.question.index, 3, 'continues from the first unasked question');
  assert.ok(st.session.endsAt > 0, 'a full run has the session clock');
  await post(`/api/sessions/${s.id}/end`);
  const ended = (await call(`/api/sessions/${s.id}/state`)).data.state;
  assert.equal(ended.review.length, 4);
  assert.equal((await post(`/api/sessions/${s.id}/reset`)).status, 200);
});

test('a trainer can place their own checkpoints per session, and go back to the deck defaults', async () => {
  const s = (await call('/api/sessions')).data.sessions.find((x) => x.key === 'day14-devops-etl');
  assert.ok(s.hasSlides);
  assert.equal(s.checkpoints, null, 'deck defaults until the trainer sets some');
  let { deck } = (await call(`/api/sessions/${s.id}/deck`)).data;
  assert.equal(deck.slides.filter((sl) => sl.askAfter).length, 0, 'the DevOps deck ships without checkpoints');

  // Two questions after slide 4 (index 3), four after slide 17 (index 16); zeros are dropped.
  let r = await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { checkpoints: { 3: 2, 16: 4, 20: 0 } } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.session.checkpoints, { 3: 2, 16: 4 });
  ({ deck } = (await call(`/api/sessions/${s.id}/deck`)).data);
  assert.deepEqual(deck.slides.map((sl, i) => [i, sl.askAfter || 0]).filter(([, n]) => n), [[3, 2], [16, 4]]);

  // Other settings leave the checkpoints alone.
  r = await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { reveal: 'each' } });
  assert.deepEqual(r.data.session.checkpoints, { 3: 2, 16: 4 });

  // The engine runs the block from the trainer's checkpoint.
  await post(`/api/sessions/${s.id}/lobby`);
  let st = (await post(`/api/sessions/${s.id}/slide`, { index: 3, step: 'all' })).data.state;
  assert.equal(st.session.pendingBlock, 2);
  assert.equal(st.slide.askAfter, 2);
  st = (await post(`/api/sessions/${s.id}/advance`, { dir: 1 })).data.state;
  assert.equal(st.session.status, 'live');
  assert.equal(st.session.blockEnd, 1);
  await post(`/api/sessions/${s.id}/reset`);

  // Validation: unknown slide, too many questions, wrong shape.
  assert.equal((await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { checkpoints: { 99: 1 } } })).status, 400);
  assert.equal((await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { checkpoints: { 1: 500 } } })).status, 400);
  assert.equal((await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { checkpoints: [1, 2] } })).status, 400);
  assert.deepEqual((await call(`/api/sessions/${s.id}`)).data.session.checkpoints, { 3: 2, 16: 4 }, 'rejected updates change nothing');

  // null = back to the deck as authored.
  r = await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { checkpoints: null } });
  assert.equal(r.data.session.checkpoints, null);
  ({ deck } = (await call(`/api/sessions/${s.id}/deck`)).data);
  assert.equal(deck.slides.filter((sl) => sl.askAfter).length, 0);
});

test('a custom checkpoint map overrides the Python deck\'s authored ones wholesale', async () => {
  const s = (await call('/api/sessions')).data.sessions.find((x) => x.key === 'day09-python');
  const r = await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { checkpoints: { 12: 15 } } });
  assert.equal(r.status, 200);
  const { deck } = (await call(`/api/sessions/${s.id}/deck`)).data;
  assert.deepEqual(deck.slides.map((sl, i) => [i, sl.askAfter || 0]).filter(([, n]) => n), [[12, 15]], 'authored slides 7-11 no longer ask');
  await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { checkpoints: null } });
});
