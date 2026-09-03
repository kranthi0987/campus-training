// With reveal = 'end' (the default) nothing is revealed during the quiz; the review comes at the end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Live } from '../server/live.js';
import { insertQuestions } from '../server/seed/index.js';

async function setup(reveal) {
  const db = await openDb(':memory:');
  const live = new Live(db, { now: () => 5_000_000, setTimer: () => ({}), clearTimer: () => {} });
  await live.ready;
  await db.run(`INSERT INTO sessions (key, title, trainers, join_code, week, reveal) VALUES ('t', 'Test', '["Ada"]', 'ABC123', 'Week-3', ?)`, reveal);
  const id = Number((await db.get("SELECT id FROM sessions WHERE key = 't'")).id);
  await insertQuestions(db, id, [
    { text: 'Q1', options: ['a', 'b', 'c', 'd'], answer: 0, complexity: 'easy', explanation: 'because' },
    { text: 'Q2', options: ['a', 'b', 'c', 'd'], answer: 1, complexity: 'easy' },
  ]);
  await db.run("INSERT INTO roster (email, name, created_at) VALUES ('g@x.com', 'Grace', 0)");
  await live.openLobby(id);
  const g = await live.join('ABC123', 'g@x.com');
  await live.startQuiz(id);
  return { db, live, id, g };
}

test('reveal at the end: no answer, tally, correctness or running score leaks during the quiz', async () => {
  const { db, live, id, g } = await setup('end');
  const q = (await live.snapshot(id)).question;
  await live.answer(g.token, q.id, 0);
  let mine = await live.snapshot(id, { participantId: g.participantId });
  assert.equal(mine.me.score, null, 'score hidden while live');
  assert.deepEqual(mine.me.answer, { choice: 0 }, 'only the choice is echoed back');
  await live.closeQuestion(id);
  mine = await live.snapshot(id, { participantId: g.participantId });
  assert.equal(mine.question.closed, true);
  assert.equal(mine.question.answer, undefined);
  assert.equal(mine.question.tally, undefined);
  assert.equal(mine.question.explanation, undefined);
  const host = await live.snapshot(id, { host: true });
  assert.equal(host.question.answer, undefined, 'projector does not show it either');
  assert.equal(host.participants[0].score, null);
  assert.equal(host.participants[0].answered, true);

  await live.next(id); // Q2 open
  await live.answer(g.token, (await live.snapshot(id)).question.id, 3);
  await live.endQuiz(id);
  mine = await live.snapshot(id, { participantId: g.participantId });
  assert.equal(mine.me.score, 100);
  assert.equal(mine.me.rank, 1);
  assert.equal(mine.me.review.length, 2);
  assert.deepEqual(mine.me.review.map((r) => [r.answer, r.choice, r.correct]), [[0, 0, true], [1, 3, false]]);
  assert.equal(mine.me.review[0].explanation, 'because');
  const hostEnd = await live.snapshot(id, { host: true });
  assert.equal(hostEnd.review[0].correctCount, 1);
  assert.equal(hostEnd.review[1].correctCount, 0);
  assert.deepEqual(hostEnd.review[1].tally, [0, 0, 0, 1]);
  await db.close();
});

test('reveal after each question still works when a trainer switches it on', async () => {
  const { db, live, id, g } = await setup('each');
  const q = (await live.snapshot(id)).question;
  await live.answer(g.token, q.id, 0);
  await live.closeQuestion(id);
  const mine = await live.snapshot(id, { participantId: g.participantId });
  assert.equal(mine.question.answer, 0);
  assert.deepEqual(mine.question.tally, [1, 0, 0, 0]);
  assert.equal(mine.me.answer.correct, true);
  assert.equal(mine.me.score, 100);
  await db.close();
});

test('sessions without a slide deck get a content page built from their subtopics', async () => {
  const db = await openDb(':memory:');
  const live = new Live(db, { now: () => 1, setTimer: () => ({}), clearTimer: () => {} });
  await live.ready;
  await db.run(`INSERT INTO sessions (key, title, trainers, join_code, subtopics) VALUES ('p', 'Python', '["Ada"]', 'PY1234', 'Syntax, OOP, JSON Processing')`);
  const id = Number((await db.get("SELECT id FROM sessions WHERE key = 'p'")).id);
  const snap = await live.setSlide(id, 0, 'all');
  assert.equal(snap.deck.synthetic, true);
  assert.equal(snap.slide.title, 'What we cover today');
  assert.deepEqual(snap.slide.bullets, ['Syntax', 'OOP', 'JSON Processing']);
  assert.equal(snap.slide.step, 3);
  await db.close();
});
