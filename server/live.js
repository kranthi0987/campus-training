// The session engine: lifecycle, timers, joins, answers, ratings, and the snapshot every
// client renders from. All state lives in SQLite; timers live in memory and are re-armed
// on startup so a server restart mid-quiz recovers.
import { randomBytes } from 'node:crypto';
import { rowToSession, rowToQuestion } from './db.js';
import { normalizeCode } from './seed/index.js';

export const POINTS_CORRECT = 100;
export const POINTS_WRONG = 0;
const ANSWER_GRACE_MS = 1500; // network slack after the clock hits zero

export class LiveError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export class Live {
  constructor(db, { decks = new Map(), now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    this.db = db;
    this.decks = decks;
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.timers = new Map(); // sessionId -> { question, session }
    this.subs = new Map(); // sessionId -> Set<{ participantId, fn }>
    this.resumeTimers();
  }

  // ---- reads -------------------------------------------------------------

  session(id) {
    return rowToSession(this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id));
  }

  mustSession(id) {
    const s = this.session(id);
    if (!s) throw new LiveError(404, 'Session not found');
    return s;
  }

  sessionByCode(code) {
    const c = normalizeCode(code);
    if (!c) return null;
    return rowToSession(this.db.prepare('SELECT * FROM sessions WHERE join_code = ?').get(c));
  }

  questions(sessionId) {
    return this.db.prepare('SELECT * FROM questions WHERE session_id = ? ORDER BY position, id').all(sessionId).map(rowToQuestion);
  }

  questionAt(sessionId, index) {
    if (index < 0) return null;
    return this.questions(sessionId)[index] || null;
  }

  participant(token) {
    const r = this.db.prepare('SELECT * FROM participants WHERE token = ?').get(String(token || ''));
    return r ? { id: r.id, sessionId: r.session_id, token: r.token, name: r.name, email: r.email, joinedAt: r.joined_at, score: r.score } : null;
  }

  mustParticipant(token) {
    const p = this.participant(token);
    if (!p) throw new LiveError(401, 'Join the session first');
    return p;
  }

  // ---- roster (who may join) ---------------------------------------------

  roster() {
    return this.db.prepare('SELECT email, name FROM roster ORDER BY name').all();
  }

  rosterEntry(emailRaw) {
    const email = String(emailRaw || '').trim().toLowerCase();
    return this.db.prepare('SELECT email, name FROM roster WHERE email = ?').get(email) || null;
  }

  addToRoster(entries) {
    const stmt = this.db.prepare('INSERT INTO roster (email, name, created_at) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name');
    let added = 0;
    for (const e of entries) {
      const email = String(e.email || '').trim().toLowerCase();
      const name = String(e.name || '').trim().slice(0, 60);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LiveError(400, `Not a valid email: ${e.email}`);
      if (name.length < 2) throw new LiveError(400, `Name missing for ${email}`);
      stmt.run(email, name, this.now());
      this.db.prepare('UPDATE participants SET name = ? WHERE email = ?').run(name, email);
      added++;
    }
    return { added };
  }

  removeFromRoster(emailRaw) {
    const email = String(emailRaw || '').trim().toLowerCase();
    const { changes } = this.db.prepare('DELETE FROM roster WHERE email = ?').run(email);
    return { removed: changes };
  }

  /** The deck to present: the seeded slides, or a content page built from the session's subtopics. */
  deckForSession(s) {
    const real = s.slidesKey ? this.decks.get(s.slidesKey) : null;
    if (real) return applyCheckpoints(real, s.checkpoints);
    const topics = String(s.subtopics || '').split(',').map((t) => t.trim()).filter(Boolean);
    return {
      key: `session-${s.id}`, title: s.title, synthetic: true,
      sections: [{
        id: 'agenda', title: 'Today',
        slides: [{
          title: 'What we cover today',
          bullets: topics.length ? topics : ['Trainer-led session'],
          agenda: (topics.length ? topics : ['Trainer-led session']).map((t) => ({ id: t, title: t, count: 0, first: [] })),
          note: `Modules for ${s.title}${s.trainers.length ? ', led by ' + s.trainers.join(' and ') : ''}. Walk through each one, then open the quiz from the host screen.`,
        }],
      }],
    };
  }

  participants(sessionId) {
    return this.db.prepare('SELECT * FROM participants WHERE session_id = ? ORDER BY joined_at, id').all(sessionId)
      .map((r) => ({ id: r.id, name: r.name, email: r.email, joinedAt: r.joined_at, score: r.score }));
  }

  scoreboard(sessionId) {
    const rows = this.db.prepare(
      `SELECT p.id, p.name, p.email, p.score, p.joined_at,
              COALESCE(SUM(a.correct), 0) AS correct, COUNT(a.question_id) AS answered
         FROM participants p LEFT JOIN answers a ON a.participant_id = p.id
        WHERE p.session_id = ?
        GROUP BY p.id
        ORDER BY p.score DESC, correct DESC, p.joined_at ASC, p.id ASC`,
    ).all(sessionId);
    let rank = 0, prevScore = null;
    return rows.map((r, i) => {
      if (r.score !== prevScore) { rank = i + 1; prevScore = r.score; }
      return { rank, id: r.id, name: r.name, email: r.email, score: r.score, correct: Number(r.correct), answered: r.answered };
    });
  }

  tally(questionId) {
    const counts = [0, 0, 0, 0];
    for (const r of this.db.prepare('SELECT choice, COUNT(*) AS n FROM answers WHERE question_id = ? GROUP BY choice').all(questionId)) {
      if (r.choice >= 0 && r.choice < 4) counts[r.choice] = r.n;
    }
    return counts;
  }

  ratingSummary(sessionId) {
    const s = this.mustSession(sessionId);
    const byTrainer = this.db.prepare(
      'SELECT trainer, AVG(stars) AS avg, COUNT(*) AS n FROM ratings WHERE session_id = ? GROUP BY trainer',
    ).all(sessionId);
    const comments = this.db.prepare(
      `SELECT DISTINCT r.participant_id, p.name, r.comment FROM ratings r JOIN participants p ON p.id = r.participant_id
        WHERE r.session_id = ? AND r.comment IS NOT NULL AND r.comment <> '' ORDER BY r.created_at`,
    ).all(sessionId).map((r) => ({ name: r.name, comment: r.comment }));
    return {
      trainers: s.trainers.map((t) => {
        const row = byTrainer.find((b) => b.trainer === t);
        return { trainer: t, average: row ? Math.round(row.avg * 10) / 10 : null, count: row ? row.n : 0 };
      }),
      comments,
    };
  }

  // ---- snapshot ----------------------------------------------------------

  snapshot(sessionId, { participantId = null, host = false } = {}) {
    const s = this.mustSession(sessionId);
    const qs = this.questions(sessionId);
    const now = this.now();
    const out = {
      serverNow: now,
      session: {
        id: s.id, key: s.key, dayNo: s.dayNo, date: s.date, module: s.module, title: s.title, subtopics: s.subtopics,
        trainers: s.trainers, timeLimitMin: s.timeLimitMin, joinCode: s.joinCode, status: s.status,
        startedAt: s.startedAt, endsAt: s.endsAt, endedAt: s.endedAt, reveal: s.reveal,
        blockEnd: s.blockEnd, askedCount: s.currentIndex + 1, pendingBlock: s.status === 'live' ? 0 : this.pendingBlock(s),
        questionCount: qs.length, participantCount: this.db.prepare('SELECT COUNT(*) AS n FROM participants WHERE session_id = ?').get(sessionId).n,
        slideIndex: s.slideIndex, slideStep: s.slideStep, slidesKey: s.slidesKey,
      },
      question: null,
      slide: null,
      deck: null,
    };

    // reveal = 'each': answers show after every question. reveal = 'end' (default): nothing
    // is revealed during the quiz, not even running scores; everything shows at the end.
    const revealEach = s.reveal === 'each';
    const hideScores = !revealEach && s.status !== 'ended';
    const q = s.status === 'live' ? qs[s.currentIndex] : null;
    if (q) {
      const answered = this.db.prepare('SELECT COUNT(*) AS n FROM answers WHERE question_id = ?').get(q.id).n;
      out.question = {
        index: s.currentIndex, id: q.id, text: q.text, code: q.code || null, options: q.options, complexity: q.complexity,
        seconds: this.secondsFor(s, q), startedAt: s.questionStartedAt, endsAt: s.questionEndsAt,
        closed: s.questionClosed, answeredCount: answered,
      };
      if (s.questionClosed && revealEach) {
        out.question.answer = q.answer;
        out.question.explanation = q.explanation;
        out.question.tally = this.tally(q.id);
      }
    }

    const deck = this.deckForSession(s);
    if (deck) {
      const flat = flattenDeck(deck);
      out.deck = { title: deck.title, total: flat.length, synthetic: !!deck.synthetic, sections: deck.sections.map((sec) => ({ id: sec.id, title: sec.title, count: sec.slides.length })) };
      if (s.slideIndex >= 0 && s.slideIndex < flat.length) {
        const sl = flat[s.slideIndex];
        out.slide = {
          index: s.slideIndex, total: flat.length, step: Math.min(s.slideStep, stepsOf(sl)), steps: stepsOf(sl),
          sectionId: sl.sectionId, sectionTitle: sl.sectionTitle, title: sl.title, bullets: sl.bullets,
          code: sl.code || null, diagram: sl.diagram || null, agenda: sl.agenda || null, askAfter: sl.askAfter || 0,
          image: sl.image || null,
        };
        if (host) out.slide.note = sl.note || '';
      }
    }

    if (host) {
      const answeredIds = q ? new Set(this.db.prepare('SELECT participant_id FROM answers WHERE question_id = ?').all(q.id).map((r) => r.participant_id)) : new Set();
      out.participants = this.participants(sessionId).map((p) => ({ id: p.id, name: p.name, score: hideScores ? null : p.score, answered: answeredIds.has(p.id) }));
    }

    if (s.status === 'ended') {
      out.scoreboard = this.scoreboard(sessionId);
      if (host) {
        out.ratings = this.ratingSummary(sessionId);
        out.review = this.review(sessionId);
      }
    }

    if (participantId) {
      const p = this.db.prepare('SELECT * FROM participants WHERE id = ?').get(participantId);
      if (p) {
        const me = { id: p.id, name: p.name, email: p.email, score: hideScores ? null : p.score, answer: null, rated: false, rank: null };
        if (q) {
          const a = this.db.prepare('SELECT choice, correct, points FROM answers WHERE participant_id = ? AND question_id = ?').get(p.id, q.id);
          if (a) me.answer = revealEach ? { choice: a.choice, correct: !!a.correct, points: a.points } : { choice: a.choice };
        }
        if (s.status === 'ended') {
          const row = (out.scoreboard || this.scoreboard(sessionId)).find((r) => r.id === p.id);
          me.rank = row ? row.rank : null;
          me.rated = !!this.db.prepare('SELECT 1 FROM ratings WHERE session_id = ? AND participant_id = ?').get(sessionId, p.id);
          me.review = this.review(sessionId, p.id);
        }
        out.me = me;
      }
    }
    return out;
  }

  /** Every question with its correct answer; per participant it carries their choice, for the host the tally. */
  review(sessionId, participantId = null) {
    const qs = this.questions(sessionId);
    const mine = participantId
      ? new Map(this.db.prepare('SELECT question_id, choice, correct FROM answers WHERE participant_id = ?').all(participantId).map((a) => [a.question_id, a]))
      : null;
    const s = this.session(sessionId);
    const asked = s.status === 'ended' && s.currentIndex >= 0 ? s.currentIndex + 1 : qs.length;
    return qs.slice(0, asked).map((q, i) => {
      const row = { index: i, id: q.id, text: q.text, code: q.code || null, options: q.options, answer: q.answer, explanation: q.explanation, complexity: q.complexity };
      if (mine) {
        const a = mine.get(q.id);
        row.choice = a ? a.choice : null;
        row.correct = a ? !!a.correct : false;
      } else {
        row.tally = this.tally(q.id);
        row.answered = row.tally.reduce((x, y) => x + y, 0);
        row.correctCount = row.tally[q.answer] || 0;
      }
      return row;
    });
  }

  secondsFor(s, q) {
    if (q.seconds) return q.seconds;
    return { easy: s.easyS, medium: s.mediumS, hard: s.hardS }[q.complexity] || s.mediumS;
  }

  // ---- subscriptions -----------------------------------------------------

  subscribe(sessionId, fn, { participantId = null, host = false } = {}) {
    if (!this.subs.has(sessionId)) this.subs.set(sessionId, new Set());
    const sub = { participantId, host, fn };
    this.subs.get(sessionId).add(sub);
    return () => this.subs.get(sessionId)?.delete(sub);
  }

  broadcast(sessionId) {
    const set = this.subs.get(sessionId);
    if (!set || !set.size) return;
    for (const sub of set) {
      try { sub.fn(this.snapshot(sessionId, { participantId: sub.participantId, host: sub.host })); } catch { /* dropped client */ }
    }
  }

  // ---- lifecycle ---------------------------------------------------------

  openLobby(id) {
    const s = this.mustSession(id);
    if (s.status === 'ended') throw new LiveError(409, 'Session already ended. Reset it to run again.');
    if (s.status === 'live') throw new LiveError(409, 'Quiz is already running');
    this.db.prepare("UPDATE sessions SET status = 'lobby', slide_index = -1 WHERE id = ?").run(id);
    this.broadcast(id);
    return this.snapshot(id, { host: true });
  }

  /** Runs every question not yet asked, with the session time limit. */
  startQuiz(id) {
    const s = this.mustSession(id);
    if (s.status === 'live') throw new LiveError(409, 'Quiz is already running');
    if (s.status === 'ended') throw new LiveError(409, 'Session already ended. Reset it to run again.');
    const qs = this.questions(id);
    if (!qs.length) throw new LiveError(409, 'Add at least one question first');
    const from = s.currentIndex + 1;
    if (from >= qs.length) throw new LiveError(409, 'Every question has been asked. End the session from the host screen.');
    const now = this.now();
    this.db.prepare("UPDATE sessions SET status = 'live', started_at = COALESCE(started_at, ?), ends_at = ?, ended_at = NULL, slide_index = -1, block_end = NULL WHERE id = ?")
      .run(now, now + s.timeLimitMin * 60_000, id);
    this.startQuestion(id, from);
    this.armSessionTimer(this.session(id));
    this.broadcast(id);
    return this.snapshot(id, { host: true });
  }

  /**
   * Runs a block of questions in the middle of a presentation (a slide's askAfter checkpoint).
   * The block has no session clock; when its last question closes, Next returns to the slides.
   */
  startBlock(id, count) {
    const s = this.mustSession(id);
    if (s.status === 'live') throw new LiveError(409, 'Quiz is already running');
    if (s.status === 'ended') throw new LiveError(409, 'Session already ended');
    const qs = this.questions(id);
    const from = s.currentIndex + 1;
    if (from >= qs.length) return this.snapshot(id, { host: true });
    const to = Math.min(qs.length - 1, from + Math.max(1, count | 0) - 1);
    this.db.prepare("UPDATE sessions SET status = 'live', started_at = COALESCE(started_at, ?), ends_at = NULL, block_end = ? WHERE id = ?").run(this.now(), to, id);
    this.startQuestion(id, from);
    this.broadcast(id);
    return this.snapshot(id, { host: true });
  }

  /** How many questions a checkpoint on the current slide would ask (0 = none, or none left). */
  pendingBlock(s) {
    const deck = this.deckForSession(s);
    if (!deck || s.slideIndex < 0) return 0;
    const sl = flattenDeck(deck)[s.slideIndex];
    const n = sl?.askAfter | 0;
    if (!n) return 0;
    const left = this.questions(s.id).length - (s.currentIndex + 1);
    return Math.max(0, Math.min(n, left));
  }

  startQuestion(id, index) {
    const s = this.mustSession(id);
    const q = this.questionAt(id, index);
    if (!q) throw new LiveError(409, 'No such question');
    const now = this.now();
    const seconds = this.secondsFor(s, q);
    this.db.prepare('UPDATE sessions SET current_index = ?, question_started_at = ?, question_ends_at = ?, question_closed = 0 WHERE id = ?')
      .run(index, now, now + seconds * 1000, id);
    this.armQuestionTimer(this.session(id));
  }

  closeQuestion(id) {
    const s = this.mustSession(id);
    if (s.status !== 'live' || s.questionClosed) return this.snapshot(id, { host: true });
    this.db.prepare('UPDATE sessions SET question_closed = 1 WHERE id = ?').run(id);
    this.clearQuestionTimer(id);
    this.broadcast(id);
    return this.snapshot(id, { host: true });
  }

  next(id) {
    const s = this.mustSession(id);
    if (s.status !== 'live') throw new LiveError(409, 'Quiz is not running');
    if (!s.questionClosed) return this.closeQuestion(id);
    const count = this.questions(id).length;
    if (s.currentIndex + 1 >= count) return this.endQuiz(id);
    if (s.blockEnd !== null && s.currentIndex >= s.blockEnd) {
      // End of a mid-presentation block: back to the slides, on the slide after the checkpoint.
      this.clearTimers(id);
      const total = flattenDeck(this.deckForSession(s)).length;
      const nextSlide = Math.min(total - 1, s.slideIndex + 1);
      this.db.prepare("UPDATE sessions SET status = 'lobby', block_end = NULL, slide_index = ?, slide_step = 0, question_closed = 1 WHERE id = ?").run(nextSlide, id);
      this.broadcast(id);
      return this.snapshot(id, { host: true });
    }
    this.startQuestion(id, s.currentIndex + 1);
    this.broadcast(id);
    return this.snapshot(id, { host: true });
  }

  endQuiz(id) {
    const s = this.mustSession(id);
    if (s.status === 'ended') return this.snapshot(id, { host: true });
    this.db.prepare("UPDATE sessions SET status = 'ended', ended_at = ?, question_closed = 1 WHERE id = ?").run(this.now(), id);
    this.clearTimers(id);
    this.broadcast(id);
    return this.snapshot(id, { host: true });
  }

  reset(id) {
    this.mustSession(id);
    this.clearTimers(id);
    this.db.prepare('DELETE FROM answers WHERE participant_id IN (SELECT id FROM participants WHERE session_id = ?)').run(id);
    this.db.prepare('DELETE FROM ratings WHERE session_id = ?').run(id);
    this.db.prepare('DELETE FROM participants WHERE session_id = ?').run(id);
    this.db.prepare(`UPDATE sessions SET status = 'draft', current_index = -1, question_started_at = NULL, question_ends_at = NULL,
      question_closed = 0, started_at = NULL, ends_at = NULL, ended_at = NULL, slide_index = -1, slide_step = 0, block_end = NULL WHERE id = ?`).run(id);
    this.broadcast(id);
    return this.snapshot(id, { host: true });
  }

  deckFor(s) {
    const deck = this.deckForSession(s);
    if (!deck) throw new LiveError(404, 'No content for this session');
    if (s.status === 'live') throw new LiveError(409, 'Finish the quiz before presenting');
    return flattenDeck(deck);
  }

  /** Jumps to a slide. step = how many bullets are revealed (0 = title and diagram only). */
  setSlide(id, index, step = 0) {
    const s = this.mustSession(id);
    const flat = this.deckFor(s);
    const next = index === null || index === undefined ? -1 : Math.max(0, Math.min(flat.length - 1, Number(index) | 0));
    const max = next >= 0 ? stepsOf(flat[next]) : 0;
    const st = step === 'all' ? max : Math.max(0, Math.min(max, Number(step) | 0));
    this.db.prepare('UPDATE sessions SET slide_index = ?, slide_step = ? WHERE id = ?').run(next, st, id);
    this.broadcast(id);
    return this.snapshot(id, { host: true });
  }

  /** Forward reveals the next bullet, then moves to the next slide; back returns to the previous slide fully revealed. */
  advanceSlide(id, dir) {
    const s = this.mustSession(id);
    const flat = this.deckFor(s);
    const i = s.slideIndex, st = s.slideStep;
    if (dir > 0) {
      if (i < 0) return this.setSlide(id, 0, 0);
      if (st < stepsOf(flat[i])) return this.setSlide(id, i, st + 1);
      const block = this.pendingBlock(s);
      if (block) return this.startBlock(id, block);
      if (i < flat.length - 1) return this.setSlide(id, i + 1, 0);
      return this.snapshot(id, { host: true });
    }
    if (i <= 0) return this.setSlide(id, 0, 0);
    if (st > 0 && st < stepsOf(flat[i])) return this.setSlide(id, i, 0);
    return this.setSlide(id, i - 1, 'all');
  }

  // ---- housekeeping (trainer) --------------------------------------------

  removeParticipant(participantId) {
    const p = this.db.prepare('SELECT * FROM participants WHERE id = ?').get(Number(participantId));
    if (!p) throw new LiveError(404, 'Participant not found');
    this.db.prepare('DELETE FROM answers WHERE participant_id = ?').run(p.id);
    this.db.prepare('DELETE FROM ratings WHERE participant_id = ?').run(p.id);
    this.db.prepare('DELETE FROM participants WHERE id = ?').run(p.id);
    this.broadcast(p.session_id);
    return { removed: 1 };
  }

  /** Removes one intern (by email) from every session. */
  removeIntern(emailRaw) {
    const email = String(emailRaw || '').trim().toLowerCase();
    const rows = this.db.prepare('SELECT id FROM participants WHERE email = ?').all(email);
    for (const r of rows) this.removeParticipant(r.id);
    return { removed: rows.length };
  }

  /** Wipes every participant, answer and rating, and returns every session to draft. */
  clearAllData() {
    const ids = this.db.prepare('SELECT id FROM sessions').all().map((r) => r.id);
    const before = this.db.prepare('SELECT COUNT(*) AS n FROM participants').get().n;
    for (const id of ids) this.reset(id);
    return { participantsRemoved: before, sessionsReset: ids.length };
  }

  /** Points per intern per session, for the trainer dashboard. */
  dashboard() {
    const sessions = this.db.prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM questions q WHERE q.session_id = s.id) AS question_count,
              (SELECT COUNT(*) FROM participants p WHERE p.session_id = s.id) AS participant_count,
              (SELECT AVG(p.score) FROM participants p WHERE p.session_id = s.id) AS avg_score
         FROM sessions s ORDER BY s.date, s.day_no, s.id`,
    ).all().map((r) => ({ ...rowToSession(r), questionCount: r.question_count, participantCount: r.participant_count, avgScore: r.avg_score === null ? null : Math.round(r.avg_score) }));
    const rows = this.db.prepare(
      `SELECT p.id, p.session_id, p.email, p.name, p.score, p.joined_at,
              COALESCE(SUM(a.correct), 0) AS correct, COUNT(a.question_id) AS answered
         FROM participants p LEFT JOIN answers a ON a.participant_id = p.id
        GROUP BY p.id ORDER BY p.joined_at`,
    ).all();
    const weekOf = new Map(sessions.map((s) => [s.id, s.week || 'Unscheduled']));
    const weeks = [...new Set(sessions.map((s) => s.week || 'Unscheduled'))];
    const interns = new Map();
    for (const r of this.roster()) interns.set(r.email, { email: r.email, name: r.name, onRoster: true, total: 0, attended: 0, sessions: {}, weeks: {} });
    for (const r of rows) {
      if (!interns.has(r.email)) interns.set(r.email, { email: r.email, name: r.name, onRoster: false, total: 0, attended: 0, sessions: {}, weeks: {} });
      const it = interns.get(r.email);
      it.total += r.score;
      it.attended += 1;
      it.sessions[r.session_id] = { participantId: r.id, score: r.score, correct: Number(r.correct), answered: r.answered };
      const w = weekOf.get(r.session_id) || 'Unscheduled';
      it.weeks[w] = (it.weeks[w] || 0) + r.score;
    }
    const list = [...interns.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    let rank = 0, prev = null;
    list.forEach((it, i) => { if (it.total !== prev) { rank = i + 1; prev = it.total; } it.rank = rank; });
    return { sessions, weeks, interns: list };
  }

  /** Certificate data for a participant of a finished session. */
  certificate(participantId) {
    const p = this.db.prepare('SELECT * FROM participants WHERE id = ?').get(Number(participantId));
    if (!p) throw new LiveError(404, 'Participant not found');
    const s = this.mustSession(p.session_id);
    if (s.status !== 'ended') throw new LiveError(409, 'Certificates are issued when the session has finished');
    const board = this.scoreboard(s.id);
    const me = board.find((r) => r.id === p.id);
    const issuedOn = new Date(s.endedAt || this.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return {
      participantId: p.id, name: p.name, email: p.email,
      sessionId: s.id, sessionTitle: s.title, module: s.module, date: s.date, trainers: s.trainers,
      score: p.score, correct: me?.correct ?? 0, questionCount: this.questions(s.id).length,
      rank: me?.rank ?? board.length, participants: board.length, issuedOn,
    };
  }

  // ---- participants ------------------------------------------------------

  /** Interns join with their email only; the name comes from the roster. */
  join(code, emailRaw) {
    const s = this.sessionByCode(code);
    if (!s) throw new LiveError(404, 'No session with that code');
    if (s.status === 'draft') throw new LiveError(409, 'The trainer has not opened this session yet');
    if (s.status === 'ended') throw new LiveError(409, 'This session has finished');
    const email = String(emailRaw || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LiveError(400, 'Please enter a valid email');
    const entry = this.rosterEntry(email);
    if (!entry) throw new LiveError(403, 'This email is not on the participant list. Ask your trainer to add you.');
    const name = entry.name;
    let row = this.db.prepare('SELECT * FROM participants WHERE session_id = ? AND email = ?').get(s.id, email);
    if (row) {
      this.db.prepare('UPDATE participants SET name = ? WHERE id = ?').run(name, row.id);
      row = { ...row, name };
    } else {
      const token = randomBytes(18).toString('hex');
      const { lastInsertRowid } = this.db.prepare('INSERT INTO participants (session_id, token, name, email, joined_at) VALUES (?, ?, ?, ?, ?)')
        .run(s.id, token, name, email, this.now());
      row = this.db.prepare('SELECT * FROM participants WHERE id = ?').get(Number(lastInsertRowid));
    }
    this.broadcast(s.id);
    return { token: row.token, participantId: row.id, sessionId: s.id, name: row.name };
  }

  answer(token, questionId, choiceRaw) {
    const p = this.mustParticipant(token);
    const s = this.mustSession(p.sessionId);
    if (s.status !== 'live') throw new LiveError(409, 'The quiz is not running');
    const q = this.questionAt(s.id, s.currentIndex);
    if (!q || q.id !== Number(questionId)) throw new LiveError(409, 'That question is no longer open');
    if (s.questionClosed || this.now() > s.questionEndsAt + ANSWER_GRACE_MS) throw new LiveError(409, 'Time is up for this question');
    const choice = Number(choiceRaw);
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) throw new LiveError(400, 'Pick one of the four options');
    if (this.db.prepare('SELECT 1 FROM answers WHERE participant_id = ? AND question_id = ?').get(p.id, q.id)) {
      throw new LiveError(409, 'You already answered this question');
    }
    const correct = choice === q.answer;
    const points = correct ? POINTS_CORRECT : POINTS_WRONG;
    this.db.prepare('INSERT INTO answers (participant_id, question_id, choice, correct, points, answered_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(p.id, q.id, choice, correct ? 1 : 0, points, this.now());
    this.db.prepare('UPDATE participants SET score = score + ? WHERE id = ?').run(points, p.id);
    this.broadcast(s.id);
    return { accepted: true, choice };
  }

  rate(token, ratings, commentRaw) {
    const p = this.mustParticipant(token);
    const s = this.mustSession(p.sessionId);
    if (s.status !== 'ended') throw new LiveError(409, 'Ratings open when the session ends');
    if (!Array.isArray(ratings) || !ratings.length) throw new LiveError(400, 'Rate at least one trainer');
    const comment = String(commentRaw || '').trim().slice(0, 500) || null;
    const upsert = this.db.prepare(
      `INSERT INTO ratings (session_id, participant_id, trainer, stars, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, participant_id, trainer) DO UPDATE SET stars = excluded.stars, comment = excluded.comment`,
    );
    for (const r of ratings) {
      const stars = Number(r.stars);
      if (!s.trainers.includes(r.trainer)) throw new LiveError(400, `Unknown trainer: ${r.trainer}`);
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new LiveError(400, 'Stars must be 1 to 5');
      upsert.run(s.id, p.id, r.trainer, stars, comment, this.now());
    }
    this.broadcast(s.id);
    return { saved: true };
  }

  resultsCsv(sessionId) {
    const s = this.mustSession(sessionId);
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['rank', 'name', 'email', 'points', 'correct', 'answered', 'questions'].map(esc).join(',')];
    const count = this.questions(sessionId).length;
    for (const r of this.scoreboard(sessionId)) lines.push([r.rank, r.name, r.email, r.score, r.correct, r.answered, count].map(esc).join(','));
    lines.push('');
    lines.push(['trainer', 'average_stars', 'ratings'].map(esc).join(','));
    for (const t of this.ratingSummary(sessionId).trainers) lines.push([t.trainer, t.average ?? '', t.count].map(esc).join(','));
    return { filename: `${s.key || 'session-' + s.id}-results.csv`, csv: lines.join('\n') };
  }

  // ---- timers ------------------------------------------------------------

  armQuestionTimer(s) {
    this.clearQuestionTimer(s.id);
    if (s.status !== 'live' || s.questionClosed || !s.questionEndsAt) return;
    const t = this.timers.get(s.id) || {};
    t.question = this.setTimer(() => { try { this.closeQuestion(s.id); } catch { /* session gone */ } }, Math.max(0, s.questionEndsAt - this.now()));
    this.timers.set(s.id, t);
  }

  armSessionTimer(s) {
    const t = this.timers.get(s.id) || {};
    if (t.session) this.clearTimer(t.session);
    if (s.status !== 'live' || !s.endsAt) return;
    t.session = this.setTimer(() => { try { this.endQuiz(s.id); } catch { /* session gone */ } }, Math.max(0, s.endsAt - this.now()));
    this.timers.set(s.id, t);
  }

  clearQuestionTimer(id) {
    const t = this.timers.get(id);
    if (t?.question) { this.clearTimer(t.question); t.question = null; }
  }

  clearTimers(id) {
    const t = this.timers.get(id);
    if (!t) return;
    if (t.question) this.clearTimer(t.question);
    if (t.session) this.clearTimer(t.session);
    this.timers.delete(id);
  }

  resumeTimers() {
    for (const r of this.db.prepare("SELECT * FROM sessions WHERE status = 'live'").all()) {
      const s = rowToSession(r);
      this.armQuestionTimer(s);
      this.armSessionTimer(s);
    }
  }
}

/** Number of build steps on a slide: one per bullet, none when the slide is a picture. */
export function stepsOf(sl) {
  return sl && sl.build !== false ? (sl.bullets || []).length : 0;
}

/**
 * A session's own checkpoints ({"<flat slide index>": questions}) replace the deck's askAfter values
 * wholesale; null keeps the deck as authored.
 */
export function applyCheckpoints(deck, checkpoints) {
  if (!checkpoints || typeof checkpoints !== 'object') return deck;
  let flat = 0;
  return {
    ...deck,
    sections: (deck.sections || []).map((sec) => ({
      ...sec,
      slides: (sec.slides || []).map((sl) => {
        const n = Number(checkpoints[flat++]) || 0;
        const { askAfter, ...rest } = sl;
        return n > 0 ? { ...rest, askAfter: n } : rest;
      }),
    })),
  };
}

export function flattenDeck(deck) {
  const out = [];
  for (const sec of deck.sections || []) {
    for (const sl of sec.slides || []) out.push({ ...sl, sectionId: sec.id, sectionTitle: sec.title });
  }
  return out;
}
