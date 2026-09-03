import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { Live, LiveError, POINTS_CORRECT } from '../server/live.js';
import { insertQuestions } from '../server/seed/index.js';

// Deterministic clock + timers so the state machine can be driven by hand.
function harness() {
  const db = openDb(':memory:');
  let now = 1_000_000;
  const timers = [];
  const live = new Live(db, {
    now: () => now,
    setTimer: (fn, ms) => { const t = { fn, at: now + ms, cleared: false }; timers.push(t); return t; },
    clearTimer: (t) => { if (t) t.cleared = true; },
  });
  const fire = () => {
    // Fire every due timer, earliest first.
    for (;;) {
      const due = timers.filter((t) => !t.cleared && !t.fired && t.at <= now).sort((a, b) => a.at - b.at)[0];
      if (!due) return;
      due.fired = true;
      due.fn();
    }
  };
  const advance = (ms) => { now += ms; fire(); };
  db.prepare(`INSERT INTO sessions (key, title, trainers, join_code, time_limit_min, easy_s, medium_s, hard_s, reveal) VALUES ('t', 'Test', '["Ada","Bob"]', 'ABC123', 1, 10, 20, 30, 'each')`).run();
  for (const [n, e] of [['Grace', 'grace@x.com'], ['Grace S', 'g@x.com'], ['Marcus', 'm@x.com']]) db.prepare('INSERT INTO roster (email, name, created_at) VALUES (?, ?, 0)').run(e, n);
  const sessionId = Number(db.prepare("SELECT id FROM sessions WHERE key = 't'").get().id);
  insertQuestions(db, sessionId, [
    { text: 'Q1', options: ['a', 'b', 'c', 'd'], answer: 0, complexity: 'easy' },
    { text: 'Q2', options: ['a', 'b', 'c', 'd'], answer: 1, complexity: 'hard', seconds: 5 },
    { text: 'Q3', options: ['a', 'b', 'c', 'd'], answer: 2, complexity: 'medium' },
  ]);
  return { db, live, sessionId, advance, nowMs: () => now };
}

let h;
beforeEach(() => { h = harness(); });

test('interns cannot join a draft session, can join once the lobby opens, and rejoin by email', () => {
  assert.throws(() => h.live.join('abc-123', 'grace@x.com'), (e) => e instanceof LiveError && e.status === 409);
  h.live.openLobby(h.sessionId);
  const first = h.live.join('abc 123', 'grace@x.com');
  const again = h.live.join('ABC123', 'GRACE@x.com');
  assert.equal(first.token, again.token);
  assert.equal(h.live.participants(h.sessionId).length, 1);
  assert.equal(h.live.participants(h.sessionId)[0].name, 'Grace', 'name comes from the roster');
  assert.throws(() => h.live.join('ABC123', 'stranger@x.com'), (e) => e instanceof LiveError && e.status === 403);
});

test('correct answers score 100, wrong answers 0, and each intern answers once', () => {
  h.live.openLobby(h.sessionId);
  const g = h.live.join('ABC123', 'g@x.com');
  const m = h.live.join('ABC123', 'm@x.com');
  h.live.startQuiz(h.sessionId);
  const snap = h.live.snapshot(h.sessionId, { host: true });
  assert.equal(snap.session.status, 'live');
  assert.equal(snap.question.index, 0);
  assert.equal(snap.question.seconds, 10, 'easy default');
  assert.equal(snap.question.answer, undefined, 'answer hidden while open');

  h.live.answer(g.token, snap.question.id, 0);
  h.live.answer(m.token, snap.question.id, 3);
  assert.throws(() => h.live.answer(g.token, snap.question.id, 1), /already answered/);
  assert.throws(() => h.live.answer(m.token, snap.question.id, 9), /Pick one of the four/);

  const board = h.live.scoreboard(h.sessionId);
  assert.equal(board[0].name, 'Grace S'); assert.equal(board[0].score, POINTS_CORRECT); assert.equal(board[0].rank, 1);
  assert.equal(board[1].name, 'Marcus'); assert.equal(board[1].score, 0); assert.equal(board[1].rank, 2);
});

test('the question closes when its timer expires; late answers are rejected; next advances', () => {
  h.live.openLobby(h.sessionId);
  const g = h.live.join('ABC123', 'g@x.com');
  h.live.startQuiz(h.sessionId);
  let q = h.live.snapshot(h.sessionId).question;
  h.advance(10_000 + 1);
  q = h.live.snapshot(h.sessionId, { host: true }).question;
  assert.equal(q.closed, true);
  assert.equal(q.answer, 0, 'answer revealed once closed');
  assert.deepEqual(q.tally, [0, 0, 0, 0]);
  assert.throws(() => h.live.answer(g.token, q.id, 0), /Time is up/);

  h.live.next(h.sessionId);
  q = h.live.snapshot(h.sessionId).question;
  assert.equal(q.index, 1);
  assert.equal(q.seconds, 5, 'per-question override wins over the hard default');

  // Next on an open question closes it first, then advances.
  h.live.next(h.sessionId);
  assert.equal(h.live.snapshot(h.sessionId).question.closed, true);
  h.live.next(h.sessionId);
  assert.equal(h.live.snapshot(h.sessionId).question.index, 2);
  h.live.next(h.sessionId); // close Q3
  h.live.next(h.sessionId); // past the last question -> ended
  const end = h.live.snapshot(h.sessionId, { participantId: g.participantId });
  assert.equal(end.session.status, 'ended');
  assert.equal(end.question, null);
  assert.equal(end.me.rank, 1);
  assert.ok(Array.isArray(end.scoreboard));
});

test('the session time limit ends the quiz on its own', () => {
  h.live.openLobby(h.sessionId);
  h.live.startQuiz(h.sessionId);
  h.advance(60_000); // 1-minute limit
  assert.equal(h.live.session(h.sessionId).status, 'ended');
  assert.throws(() => h.live.next(h.sessionId), /not running/);
});

test('ratings are per trainer, 1 to 5, only after the session ends', () => {
  h.live.openLobby(h.sessionId);
  const g = h.live.join('ABC123', 'g@x.com');
  const m = h.live.join('ABC123', 'm@x.com');
  h.live.startQuiz(h.sessionId);
  assert.throws(() => h.live.rate(g.token, [{ trainer: 'Ada', stars: 5 }]), /open when the session ends/);
  h.live.endQuiz(h.sessionId);
  assert.throws(() => h.live.rate(g.token, [{ trainer: 'Ada', stars: 6 }]), /1 to 5/);
  assert.throws(() => h.live.rate(g.token, [{ trainer: 'Nobody', stars: 3 }]), /Unknown trainer/);
  h.live.rate(g.token, [{ trainer: 'Ada', stars: 5 }, { trainer: 'Bob', stars: 4 }], 'Great pace');
  h.live.rate(m.token, [{ trainer: 'Ada', stars: 4 }, { trainer: 'Bob', stars: 4 }]);
  const summary = h.live.ratingSummary(h.sessionId);
  assert.deepEqual(summary.trainers, [{ trainer: 'Ada', average: 4.5, count: 2 }, { trainer: 'Bob', average: 4, count: 2 }]);
  assert.deepEqual(summary.comments, [{ name: 'Grace S', comment: 'Great pace' }]);
  assert.equal(h.live.snapshot(h.sessionId, { participantId: g.participantId }).me.rated, true);
  const csv = h.live.resultsCsv(h.sessionId).csv;
  assert.match(csv, /"Ada","4.5","2"/);
});

test('reset clears participants and returns the session to draft', () => {
  h.live.openLobby(h.sessionId);
  h.live.join('ABC123', 'g@x.com');
  h.live.startQuiz(h.sessionId);
  h.live.reset(h.sessionId);
  const s = h.live.session(h.sessionId);
  assert.equal(s.status, 'draft');
  assert.equal(s.currentIndex, -1);
  assert.equal(h.live.participants(h.sessionId).length, 0);
});

test('slides are broadcast by index and blocked while the quiz is live', () => {
  const decks = new Map([['d', { key: 'd', title: 'Deck', sections: [{ id: 's', title: 'S', slides: [{ title: 'One', bullets: ['a'] }, { title: 'Two', bullets: ['b'], note: 'say this' }] }] }]]);
  h.db.prepare("UPDATE sessions SET slides_key = 'd' WHERE id = ?").run(h.sessionId);
  const live = new Live(h.db, { decks, now: () => h.nowMs(), setTimer: () => ({}), clearTimer: () => {} });
  live.setSlide(h.sessionId, 1);
  const host = live.snapshot(h.sessionId, { host: true });
  assert.equal(host.slide.title, 'Two');
  assert.equal(host.slide.note, 'say this');
  assert.equal(live.snapshot(h.sessionId).slide.note, undefined, 'notes stay with the trainer');
  live.setSlide(h.sessionId, 99);
  assert.equal(live.snapshot(h.sessionId).slide.index, 1, 'clamped');
  live.setSlide(h.sessionId, null);
  assert.equal(live.snapshot(h.sessionId).slide, null);
  live.openLobby(h.sessionId);
  live.startQuiz(h.sessionId);
  assert.throws(() => live.setSlide(h.sessionId, 0), /Finish the quiz/);
});
