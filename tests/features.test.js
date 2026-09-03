// Slide builds, agenda + diagrams, dashboard, data removal and certificates.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';
import { prepareDeck } from '../server/seed/index.js';
import { certificateSvg, certificateFilename } from '../server/certificate.js';

test('prepareDeck prepends an agenda slide and attaches diagrams by section/index', () => {
  const deck = prepareDeck({ key: 'd', title: 'Deck', sections: [{ id: 'a', title: 'A', slides: [{ title: 'A1', bullets: ['x'] }, { title: 'A2', bullets: ['y'] }] }] }, { 'a/1': { type: 'sequence', nodes: [], steps: [] } });
  assert.equal(deck.sections[0].id, 'agenda');
  assert.deepEqual(deck.sections[0].slides[0].bullets, ['A']);
  assert.equal(deck.sections[0].slides[0].agenda[0].count, 2);
  assert.equal(deck.sections[1].slides[1].diagram.type, 'sequence');
  assert.equal(deck.sections[1].slides[0].diagram, undefined);
  assert.equal(prepareDeck(deck).sections.filter((s) => s.id === 'agenda').length, 1, 'agenda is not added twice');
});

test('certificate SVG carries the programme, name, session and score, with no logo or id', () => {
  const c = { name: 'Grace <Hopper>', email: 'g@x.com', sessionTitle: 'Python & Automation', module: 'Programming', date: '2026-09-03', trainers: ['Ada'], score: 900, correct: 9, questionCount: 12, rank: 2, participants: 18, issuedOn: '3 September 2026' };
  const svg = certificateSvg(c);
  assert.match(svg, /^<svg /);
  assert.match(svg, /Campus Training/);
  assert.match(svg, /Grace &lt;Hopper&gt;/);
  assert.match(svg, /900/);
  assert.match(svg, /2 of 18/);
  assert.doesNotMatch(svg, /<path /, 'no brand logo');
  assert.doesNotMatch(svg, /CERTIFICATE ID|DQ-/, 'no certificate id');
  assert.equal(certificateFilename(c), 'certificate-grace-hopper-python-automation.svg');
});

let app, base, cookie;
const call = async (path, { method = 'GET', body, token, asTrainer = true } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (asTrainer && cookie) headers.Cookie = cookie;
  if (token) headers['X-Participant-Token'] = token;
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, data: type.includes('json') ? await res.json() : await res.text(), res };
};

before(async () => {
  app = await createApp({ dbPath: ':memory:', publicUrl: 'http://quiz.test' });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  const login = await call('/api/trainer/login', { method: 'POST', body: { email: 't@example.com', password: 'Ferguson@2026' } });
  cookie = login.res.headers.get('set-cookie').split(';')[0];
});
after(() => { app.server.close(); app.live.timers.forEach((t) => { clearTimeout(t.question); clearTimeout(t.session); }); });

test('presentation builds bullet by bullet, then moves to the next slide; back returns to the previous slide fully shown', async () => {
  const { data: { sessions } } = await call('/api/sessions');
  const s = sessions.find((x) => x.key === 'day18-integration-ai');
  const deck = (await call(`/api/sessions/${s.id}/deck`)).data.deck;
  assert.equal(deck.sections[0].id, 'agenda');
  assert.ok(deck.slides.some((sl) => sl.diagram), 'diagrams attached');

  let st = (await call(`/api/sessions/${s.id}/advance`, { method: 'POST', body: { dir: 1 } })).data.state;
  assert.equal(st.slide.index, 0); assert.equal(st.slide.step, 0); assert.ok(st.slide.agenda);
  const n = st.slide.steps;
  for (let i = 0; i < n; i++) st = (await call(`/api/sessions/${s.id}/advance`, { method: 'POST', body: { dir: 1 } })).data.state;
  assert.equal(st.slide.step, n);
  st = (await call(`/api/sessions/${s.id}/advance`, { method: 'POST', body: { dir: 1 } })).data.state;
  assert.equal(st.slide.index, 1); assert.equal(st.slide.step, 0);
  st = (await call(`/api/sessions/${s.id}/advance`, { method: 'POST', body: { dir: -1 } })).data.state;
  assert.equal(st.slide.index, 0); assert.equal(st.slide.step, n, 'previous slide fully revealed');
  st = (await call(`/api/sessions/${s.id}/slide`, { method: 'POST', body: { index: 2, step: 'all' } })).data.state;
  assert.equal(st.slide.index, 2); assert.equal(st.slide.step, st.slide.steps);
  assert.equal(st.slide.note !== undefined, true, 'host snapshot has notes');
  await call(`/api/sessions/${s.id}/slide`, { method: 'POST', body: { index: null } });
});

test('dashboard, participant removal, clear-all and certificates', async () => {
  const { data: { sessions } } = await call('/api/sessions');
  const s = sessions.find((x) => x.key === 'day09-python');
  await call(`/api/sessions/${s.id}`, { method: 'PUT', body: { easyS: 5, mediumS: 5, hardS: 5 } });
  await call(`/api/sessions/${s.id}/lobby`, { method: 'POST' });
  await call('/api/roster', { method: 'POST', body: { entries: [{ name: 'Grace', email: 'grace@example.com' }, { name: 'Test User', email: 'test@example.com' }] } });
  const grace = (await call('/api/join', { method: 'POST', body: { code: s.joinCode, email: 'grace@example.com' }, asTrainer: false })).data;
  const tester = (await call('/api/join', { method: 'POST', body: { code: s.joinCode, email: 'test@example.com' }, asTrainer: false })).data;
  await call(`/api/sessions/${s.id}/start`, { method: 'POST' });
  const q = (await call(`/api/sessions/${s.id}/state`)).data.state.question;
  const correct = (await call(`/api/sessions/${s.id}`)).data.questions[0].answer;
  await call('/api/play/answer', { method: 'POST', body: { questionId: q.id, choice: correct }, token: grace.token, asTrainer: false });

  // no certificate before the end
  assert.equal((await call('/api/play/certificate', { token: grace.token, asTrainer: false })).status, 409);
  await call(`/api/sessions/${s.id}/end`, { method: 'POST' });

  const dash = (await call('/api/dashboard')).data;
  const g = dash.interns.find((i) => i.email === 'grace@example.com');
  assert.equal(g.total, 100);
  assert.equal(g.sessions[s.id].score, 100);
  assert.equal(dash.sessions.find((x) => x.id === s.id).participantCount, 2);
  assert.ok(dash.interns.length >= 12, 'the seeded participant list shows on the scorecards before anyone joins');
  assert.equal(g.weeks['Week-3'], 100, 'weekly points');
  assert.equal(g.rank, 1);
  assert.ok(dash.weeks.includes('Week-3') && dash.weeks.includes('Week-4'));

  const cert = (await call('/api/play/certificate', { token: grace.token, asTrainer: false })).data.certificate;
  assert.equal(cert.name, 'Grace'); assert.equal(cert.score, 100); assert.equal(cert.rank, 1); assert.equal(cert.certId, undefined); assert.match(cert.filename, /^certificate-grace-/);
  const svg = await call(`/api/play/certificate.svg?token=${grace.token}`, { asTrainer: false });
  assert.equal(svg.status, 200); assert.match(svg.data, /<svg/); assert.match(svg.res.headers.get('content-disposition'), /attachment/);
  assert.equal((await call(`/api/participants/${g.sessions[s.id].participantId}/certificate.svg`)).status, 200);

  // remove the test user only
  assert.equal((await call(`/api/participants/${tester.participantId}`, { method: 'DELETE' })).status, 200);
  assert.equal((await call('/api/play/state', { token: tester.token, asTrainer: false })).status, 401);
  assert.equal((await call('/api/dashboard')).data.interns.filter((i) => i.attended).length, 1);
  assert.equal((await call('/api/interns?email=grace@example.com', { method: 'DELETE' })).data.removed, 1);
  assert.equal((await call('/api/dashboard')).data.interns.filter((i) => i.attended).length, 0);
  assert.equal((await call('/api/roster?email=test@example.com', { method: 'DELETE' })).data.removed, 1);
  assert.equal((await call('/api/roster/lookup?email=test@example.com', { asTrainer: false })).status, 404);

  // clear everything needs the confirmation word
  assert.equal((await call('/api/admin/clear-data', { method: 'POST', body: {} })).status, 400);
  const out = (await call('/api/admin/clear-data', { method: 'POST', body: { confirm: 'CLEAR' } })).data;
  assert.equal(out.sessionsReset, 8);
  assert.equal((await call(`/api/sessions/${s.id}`)).data.session.status, 'draft');
  assert.equal((await call(`/api/sessions/${s.id}`)).data.questions.length, 15, 'questions are kept');
});
