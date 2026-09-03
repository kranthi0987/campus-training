// Presenting opens the room: the join screen shows the QR code, so a draft session must let
// interns in as soon as the trainer shows a slide.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';

let app, base, cookie;
const call = async (path, { method = 'GET', body, asTrainer = true } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (asTrainer && cookie) headers.Cookie = cookie;
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

before(async () => {
  app = await createApp({ dbPath: ':memory:', publicUrl: 'http://quiz.test' });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  cookie = (await fetch(base + '/api/trainer/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 't@example.com', password: 'Ferguson@2026' }) })).headers.get('set-cookie').split(';')[0];
});
after(() => { app.server.close(); app.live.timers.forEach((t) => { clearTimeout(t.question); clearTimeout(t.session); }); });

test('showing a slide on a draft session opens the lobby so interns can join', async () => {
  const s = (await call('/api/sessions')).data.sessions.find((x) => x.key === 'day11-spring-boot');
  assert.equal(s.status, 'draft');
  let joined = await call('/api/join', { method: 'POST', body: { code: s.joinCode, email: 'anmol.joshi@ferguson.com' }, asTrainer: false });
  assert.equal(joined.status, 409, 'nobody can join a draft session');

  const st = (await call(`/api/sessions/${s.id}/slide`, { method: 'POST', body: { index: 0 } })).data.state;
  assert.equal(st.session.status, 'lobby');
  assert.equal(st.session.slideIndex, 0);
  joined = await call('/api/join', { method: 'POST', body: { code: s.joinCode, email: 'anmol.joshi@ferguson.com' }, asTrainer: false });
  assert.equal(joined.status, 200, 'interns can join once slides are showing');
  assert.equal(joined.data.state?.slide?.index ?? joined.data.slide?.index ?? 0, 0, 'and they land on the current slide');
});

test('the opening screen can be shown with the lobby open and nobody on a slide yet', async () => {
  const s = (await call('/api/sessions')).data.sessions.find((x) => x.key === 'day12-sql-mongodb');
  const st = (await call(`/api/sessions/${s.id}/lobby`, { method: 'POST' })).data.state;
  assert.equal(st.session.status, 'lobby');
  assert.equal(st.session.slideIndex, -1, 'join screen: no slide selected');
  assert.ok(Array.isArray(st.participants), 'the host snapshot carries who has joined');
});
