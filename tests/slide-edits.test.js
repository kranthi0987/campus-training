// Per-session slide edits: a trainer changes a slide's text, removes it, brings it back; the
// deck file is never touched and checkpoints follow the slides.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.js';
import { checkpointsAfterHide, checkpointsAfterRestore } from '../server/live.js';

let app, base;
const cookies = {};
const call = async (path, { method = 'GET', body, as = 'admin' } = {}) => {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (as && cookies[as]) headers.Cookie = cookies[as];
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, data: type.includes('json') ? await res.json() : await res.text(), res };
};
const login = async (as, email) => {
  const r = await call('/api/trainer/login', { method: 'POST', body: { email, password: 'Ferguson@2026', name: as }, as: null });
  if (r.status === 200) cookies[as] = r.res.headers.get('set-cookie').split(';')[0];
  return r;
};

let s;
before(async () => {
  app = await createApp({ test: true, publicUrl: 'http://quiz.test' });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  assert.equal((await login('admin', 'admin@example.com')).status, 200);
  assert.equal((await call('/api/trainers', { method: 'POST', body: { email: 'kranthi.kumar@ferguson.com', name: 'Kranthi Kumar' } })).status, 201);
  assert.equal((await login('kranthi', 'kranthi.kumar@ferguson.com')).status, 200);
  s = (await call('/api/sessions', { as: 'kranthi' })).data.sessions.find((x) => x.key === 'day18-integration');
  assert.ok(s, 'the owner sees their part');
});
after(async () => { await app.close(); });

const deck = async (as = 'kranthi') => (await call(`/api/sessions/${s.id}/deck`, { as })).data.deck;

test('checkpoint remapping around a hidden slide', () => {
  assert.deepEqual(checkpointsAfterHide({ 2: [1], 5: [2, 3], 7: [4] }, 5, 9), { 2: [1], 4: [2, 3], 6: [4] }, 'the hidden slide\'s questions move to the slide before it');
  assert.deepEqual(checkpointsAfterHide({ 0: [1], 3: [2] }, 0, 5), { 0: [1], 2: [2] }, 'hiding the first slide keeps its questions on the new first slide');
  assert.deepEqual(checkpointsAfterRestore({ 2: [1], 4: [2] }, 3), { 2: [1], 5: [2] });
  assert.equal(checkpointsAfterHide(null, 1, 3), null);
});

test('editing a slide changes its title, points and notes for this session only', async () => {
  const before = await deck();
  const target = before.slides[2];
  assert.ok(target.baseIndex === 2 && !target.edited);
  const r = await call(`/api/sessions/${s.id}/slides/${target.baseIndex}`, { method: 'PUT', as: 'kranthi', body: { title: 'REST, the Ferguson way', bullets: ['One', ' Two ', ''], note: 'Say it slowly.' } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const after = await deck();
  assert.equal(after.slides.length, before.slides.length);
  assert.equal(after.slides[2].title, 'REST, the Ferguson way');
  assert.deepEqual(after.slides[2].bullets, ['One', 'Two']);
  assert.equal(after.slides[2].note, 'Say it slowly.');
  assert.equal(after.slides[2].edited, true);
  assert.ok(after.slides[2].diagram === target.diagram, 'the diagram stays');
  assert.notEqual(after.rev, before.rev, 'the deck revision changes so open Present screens reload');
  assert.equal(app.decks.get('day18-integration').sections.flatMap((x) => x.slides)[2].title, target.title, 'the seeded deck is untouched');
  const bad = await call(`/api/sessions/${s.id}/slides/2`, { method: 'PUT', as: 'kranthi', body: { title: '   ' } });
  assert.equal(bad.status, 400);
  const nope = await call(`/api/sessions/${s.id}/slides/99`, { method: 'PUT', as: 'kranthi', body: { title: 'x' } });
  assert.equal(nope.status, 404);
  const reset = await call(`/api/sessions/${s.id}/slides/2`, { method: 'PUT', as: 'kranthi', body: { reset: true } });
  assert.equal(reset.status, 200);
  assert.equal((await deck()).slides[2].title, target.title);
  assert.equal((await deck()).slides[2].edited, undefined);
});

test('removing a slide drops it from the presented deck, shifts checkpoints, and restore brings it back', async () => {
  const before = await deck();
  const n = before.slides.length;
  const qs = (await call(`/api/sessions/${s.id}`, { as: 'kranthi' })).data.questions;
  const cp = await call(`/api/sessions/${s.id}`, { method: 'PUT', as: 'kranthi', body: { checkpoints: { 3: [qs[0].id], 5: [qs[1].id] } } });
  assert.equal(cp.status, 200);
  // Hide slide 3 (presented index 3): its question moves to slide 2, the one on 5 moves to 4.
  const gone = before.slides[3];
  const r = await call(`/api/sessions/${s.id}/slides/${gone.baseIndex}`, { method: 'PUT', as: 'kranthi', body: { hidden: true } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.session.checkpoints, { 2: [qs[0].id], 4: [qs[1].id] });
  const after = await deck();
  assert.equal(after.slides.length, n - 1);
  assert.ok(!after.slides.some((sl) => sl.baseIndex === gone.baseIndex));
  assert.deepEqual(after.hidden, [{ baseIndex: gone.baseIndex, title: gone.title, sectionTitle: gone.sectionTitle }]);
  assert.equal(after.slides[2].askAfter, 1);
  assert.equal(after.slides[4].askAfter, 1);
  const state = (await call(`/api/sessions/${s.id}/state`, { as: 'kranthi' })).data.state;
  assert.equal(state.deck.total, n - 1);

  const back = await call(`/api/sessions/${s.id}/slides/${gone.baseIndex}`, { method: 'PUT', as: 'kranthi', body: { hidden: false } });
  assert.equal(back.status, 200);
  assert.deepEqual(back.data.session.checkpoints, { 2: [qs[0].id], 5: [qs[1].id] }, 'later checkpoints move back down; the merged one stays where it landed');
  const restored = await deck();
  assert.equal(restored.slides.length, n);
  assert.equal(restored.slides[3].baseIndex, gone.baseIndex);
  assert.deepEqual(restored.hidden, []);
});

test('the presented slide position follows removals; edits are refused while the quiz runs; uploads clear them', async () => {
  const d = await deck();
  const last = d.slides[d.slides.length - 1];
  assert.equal((await call(`/api/sessions/${s.id}/slide`, { method: 'POST', as: 'kranthi', body: { index: d.slides.length - 1 } })).status, 200);
  const r = await call(`/api/sessions/${s.id}/slides/${last.baseIndex}`, { method: 'PUT', as: 'kranthi', body: { hidden: true } });
  assert.equal(r.status, 200);
  assert.equal(r.data.session.slideIndex, d.slides.length - 2, 'the trainer is moved onto the new last slide');
  assert.equal((await call(`/api/sessions/${s.id}/slides/${last.baseIndex}`, { method: 'PUT', as: 'kranthi', body: { hidden: false } })).status, 200);

  assert.equal((await call(`/api/sessions/${s.id}/slides/0`, { method: 'PUT', as: 'admin', body: { note: 'admin note' } })).status, 200, 'admins may edit too');
  assert.equal((await call(`/api/sessions/${s.id}/start`, { method: 'POST', as: 'kranthi' })).status, 200);
  assert.equal((await call(`/api/sessions/${s.id}/slides/0`, { method: 'PUT', as: 'kranthi', body: { hidden: true } })).status, 409);
  assert.equal((await call(`/api/sessions/${s.id}/end`, { method: 'POST', as: 'kranthi' })).status, 200);
  assert.equal((await call(`/api/sessions/${s.id}/reset`, { method: 'POST', as: 'kranthi' })).status, 200);
  assert.equal((await deck()).slides[0].note, 'admin note', 'a reset keeps slide edits');

  const pdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n3 0 obj << /Type /Page /Parent 2 0 R >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF', 'latin1');
  const up = await fetch(`${base}/api/sessions/${s.id}/deck`, { method: 'POST', headers: { Cookie: cookies.kranthi, 'Content-Type': 'application/pdf', 'X-Filename': 'x.pdf' }, body: pdf });
  assert.equal(up.status, 201);
  const fresh = (await call(`/api/sessions/${s.id}`, { as: 'kranthi' })).data.session;
  assert.deepEqual(fresh.slideEdits, { hidden: [], edits: {} }, 'a new file starts clean');
  assert.equal((await deck()).slides.length, 1);
  assert.equal((await call(`/api/sessions/${s.id}/deck`, { method: 'DELETE', as: 'kranthi' })).status, 200);
  assert.equal((await deck()).slides.length, d.slides.length, 'back to the seeded deck, unedited');
});
