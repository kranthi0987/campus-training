// With reveal = 'end' (the default) nothing is revealed during the quiz; the review comes at the end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Live } from '../server/live.js';
import { insertQuestions } from '../server/seed/index.js';

function setup(reveal) {
  const db = openDb(':memory:');
  const live = new Live(db, { now: () => 5_000_000, setTimer: () => ({}), clearTimer: () => {} });
  db.prepare(`INSERT INTO sessions (key, title, trainers, join_code, week, reveal) VALUES ('t', 'Test', '["Ada"]', 'ABC123', 'Week-3', ?)`).run(reveal);
  const id = Number(db.prepare("SELECT id FROM sessions WHERE key = 't'").get().id);
  insertQuestions(db, id, [
    { text: 'Q1', options: ['a', 'b', 'c', 'd'], answer: 0, complexity: 'easy', explanation: 'because' },
    { text: 'Q2', options: ['a', 'b', 'c', 'd'], answer: 1, complexity: 'easy' },
  ]);
  db.prepare("INSERT INTO roster (email, name, created_at) VALUES ('g@x.com', 'Grace', 0)").run();
  live.openLobby(id);
  const g = live.join('ABC123', 'g@x.com');
  live.startQuiz(id);
  return { db, live, id, g };
}

test('reveal at the end: no answer, tally, correctness or running score leaks during the quiz', () => {
  const { live, id, g } = setup('end');
  const q = live.snapshot(id).question;
  live.answer(g.token, q.id, 0);
  let mine = live.snapshot(id, { participantId: g.participantId });
  assert.equal(mine.me.score, null, 'score hidden while live');
  assert.deepEqual(mine.me.answer, { choice: 0 }, 'only the choice is echoed back');
  live.closeQuestion(id);
  mine = live.snapshot(id, { participantId: g.participantId });
  assert.equal(mine.question.closed, true);
  assert.equal(mine.question.answer, undefined);
  assert.equal(mine.question.tally, undefined);
  assert.equal(mine.question.explanation, undefined);
  const host = live.snapshot(id, { host: true });
  assert.equal(host.question.answer, undefined, 'projector does not show it either');
  assert.equal(host.participants[0].score, null);
  assert.equal(host.participants[0].answered, true);

  live.next(id); // Q2 open
  live.answer(g.token, live.snapshot(id).question.id, 3);
  live.endQuiz(id);
  mine = live.snapshot(id, { participantId: g.participantId });
  assert.equal(mine.me.score, 100);
  assert.equal(mine.me.rank, 1);
  assert.equal(mine.me.review.length, 2);
  assert.deepEqual(mine.me.review.map((r) => [r.answer, r.choice, r.correct]), [[0, 0, true], [1, 3, false]]);
  assert.equal(mine.me.review[0].explanation, 'because');
  const hostEnd = live.snapshot(id, { host: true });
  assert.equal(hostEnd.review[0].correctCount, 1);
  assert.equal(hostEnd.review[1].correctCount, 0);
  assert.deepEqual(hostEnd.review[1].tally, [0, 0, 0, 1]);
});

test('reveal after each question still works when a trainer switches it on', () => {
  const { live, id, g } = setup('each');
  const q = live.snapshot(id).question;
  live.answer(g.token, q.id, 0);
  live.closeQuestion(id);
  const mine = live.snapshot(id, { participantId: g.participantId });
  assert.equal(mine.question.answer, 0);
  assert.deepEqual(mine.question.tally, [1, 0, 0, 0]);
  assert.equal(mine.me.answer.correct, true);
  assert.equal(mine.me.score, 100);
});

test('sessions without a slide deck get a content page built from their subtopics', () => {
  const db = openDb(':memory:');
  const live = new Live(db, { now: () => 1, setTimer: () => ({}), clearTimer: () => {} });
  db.prepare(`INSERT INTO sessions (key, title, trainers, join_code, subtopics) VALUES ('p', 'Python', '["Ada"]', 'PY1234', 'Syntax, OOP, JSON Processing')`).run();
  const id = Number(db.prepare("SELECT id FROM sessions WHERE key = 'p'").get().id);
  const snap = live.setSlide(id, 0, 'all');
  assert.equal(snap.deck.synthetic, true);
  assert.equal(snap.slide.title, 'What we cover today');
  assert.deepEqual(snap.slide.bullets, ['Syntax', 'OOP', 'JSON Processing']);
  assert.equal(snap.slide.step, 3);
});
