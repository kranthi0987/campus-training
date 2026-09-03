// The session engine: lifecycle, timers, joins, answers, ratings, and the snapshot every
// client renders from. All state lives in Postgres; timers live in memory and are re-armed
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
    /** Resolves once timers for sessions that were live at startup are re-armed. */
    this.ready = this.resumeTimers();
  }

  // ---- reads -------------------------------------------------------------

  async session(id) {
    return rowToSession((await this.db.get('SELECT * FROM sessions WHERE id = ?', id)));
  }

  async mustSession(id) {
    const s = await this.session(id);
    if (!s) throw new LiveError(404, 'Session not found');
    return s;
  }

  async sessionByCode(code) {
    const c = normalizeCode(code);
    if (!c) return null;
    return rowToSession((await this.db.get('SELECT * FROM sessions WHERE join_code = ?', c)));
  }

  /** The questions as the trainer lists them (position order): what the builder shows and numbers by. */
  async listQuestions(sessionId) {
    return (await this.db.all('SELECT * FROM questions WHERE session_id = ? ORDER BY position, id', sessionId)).map(rowToQuestion);
  }

  /**
   * The questions in the order they are asked. With per-session checkpoints the questions picked
   * for each slide come first, slide by slide, then everything unassigned in list order; the
   * engine only ever walks this order, so "question 3 of 24" means the third one asked.
   */
  async questions(sessionId, session = null) {
    const list = await this.listQuestions(sessionId);
    const s = session || await this.session(sessionId);
    const cps = await this.effectiveCheckpoints(s, list);
    if (!cps) return list;
    const byId = new Map(list.map((q) => [q.id, q]));
    const picked = Object.keys(cps).map(Number).sort((a, b) => a - b).flatMap((slide) => cps[slide].map((id) => byId.get(id)));
    const pickedIds = new Set(picked.map((q) => q.id));
    return [...picked, ...list.filter((q) => !pickedIds.has(q.id))];
  }

  /** The session's checkpoints ({"<slide index>": [question ids]}) minus questions that no longer exist; null = none set. */
  async effectiveCheckpoints(s, list = null) {
    if (!s || !s.checkpoints || typeof s.checkpoints !== 'object') return null;
    const ids = new Set((list || await this.listQuestions(s.id)).map((q) => q.id));
    const out = {};
    for (const [slide, picks] of Object.entries(s.checkpoints)) {
      const kept = (Array.isArray(picks) ? picks : []).map(Number).filter((id) => ids.has(id));
      if (kept.length) out[slide] = kept;
    }
    return out;
  }

  async questionAt(sessionId, index) {
    if (index < 0) return null;
    return (await this.questions(sessionId))[index] || null;
  }

  async participant(token) {
    const r = (await this.db.get('SELECT * FROM participants WHERE token = ?', String(token || '')));
    return r ? { id: r.id, sessionId: r.session_id, token: r.token, name: r.name, email: r.email, joinedAt: r.joined_at, score: r.score } : null;
  }

  async mustParticipant(token) {
    const p = await this.participant(token);
    if (!p) throw new LiveError(401, 'Join the session first');
    return p;
  }

  // ---- roster (who may join) ---------------------------------------------

  async roster() {
    return (await this.db.all('SELECT email, name FROM roster ORDER BY name'));
  }

  async rosterEntry(emailRaw) {
    const email = String(emailRaw || '').trim().toLowerCase();
    return (await this.db.get('SELECT email, name FROM roster WHERE email = ?', email)) || null;
  }

  async addToRoster(entries) {
    const clean = [];
    for (const e of entries) {
      const email = String(e.email || '').trim().toLowerCase();
      const name = String(e.name || '').trim().slice(0, 60);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LiveError(400, `Not a valid email: ${e.email}`);
      if (name.length < 2) throw new LiveError(400, `Name missing for ${email}`);
      clean.push({ email, name });
    }
    for (const { email, name } of clean) {
      await this.db.run('INSERT INTO roster (email, name, created_at) VALUES (?, ?, ?) ON CONFLICT (email) DO UPDATE SET name = excluded.name', email, name, this.now());
      await this.db.run('UPDATE participants SET name = ? WHERE email = ?', name, email);
    }
    return { added: clean.length };
  }

  async removeFromRoster(emailRaw) {
    const email = String(emailRaw || '').trim().toLowerCase();
    const { changes } = (await this.db.run('DELETE FROM roster WHERE email = ?', email));
    return { removed: changes };
  }

  /** The deck to present: the seeded slides, or a content page built from the session's subtopics. */
  async deckForSession(s) {
    const real = s.slidesKey ? this.decks.get(s.slidesKey) : null;
    if (real) return applyCheckpoints(real, await this.effectiveCheckpoints(s));
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

  async participants(sessionId) {
    return (await this.db.all('SELECT * FROM participants WHERE session_id = ? ORDER BY joined_at, id', sessionId))
      .map((r) => ({ id: r.id, name: r.name, email: r.email, joinedAt: r.joined_at, score: r.score }));
  }

  async scoreboard(sessionId) {
    const rows = (await this.db.all(`SELECT p.id, p.name, p.email, p.score, p.joined_at,
              COALESCE(SUM(a.correct), 0) AS correct, COUNT(a.question_id) AS answered
         FROM participants p LEFT JOIN answers a ON a.participant_id = p.id
        WHERE p.session_id = ?
        GROUP BY p.id
        ORDER BY p.score DESC, correct DESC, p.joined_at ASC, p.id ASC`, sessionId));
    let rank = 0, prevScore = null;
    return rows.map((r, i) => {
      if (r.score !== prevScore) { rank = i + 1; prevScore = r.score; }
      return { rank, id: r.id, name: r.name, email: r.email, score: r.score, correct: Number(r.correct), answered: r.answered };
    });
  }

  async tally(questionId) {
    const counts = [0, 0, 0, 0];
    for (const r of (await this.db.all('SELECT choice, COUNT(*) AS n FROM answers WHERE question_id = ? GROUP BY choice', questionId))) {
      if (r.choice >= 0 && r.choice < 4) counts[r.choice] = r.n;
    }
    return counts;
  }

  async ratingSummary(sessionId) {
    const s = await this.mustSession(sessionId);
    const byTrainer = (await this.db.all('SELECT trainer, AVG(stars) AS avg, COUNT(*) AS n FROM ratings WHERE session_id = ? GROUP BY trainer', sessionId));
    const comments = (await this.db.all(
      `SELECT r.participant_id, p.name, r.comment, MIN(r.created_at) AS first_at
         FROM ratings r JOIN participants p ON p.id = r.participant_id
        WHERE r.session_id = ? AND r.comment IS NOT NULL AND r.comment <> ''
        GROUP BY r.participant_id, p.name, r.comment ORDER BY first_at`,
      sessionId,
    )).map((r) => ({ name: r.name, comment: r.comment }));
    return {
      trainers: s.trainers.map((t) => {
        const row = byTrainer.find((b) => b.trainer === t);
        return { trainer: t, average: row ? Math.round(row.avg * 10) / 10 : null, count: row ? row.n : 0 };
      }),
      comments,
    };
  }

  // ---- snapshot ----------------------------------------------------------

  async snapshot(sessionId, { participantId = null, host = false } = {}) {
    const s = await this.mustSession(sessionId);
    const qs = await this.questions(sessionId);
    const now = this.now();
    const out = {
      serverNow: now,
      session: {
        id: s.id, key: s.key, dayNo: s.dayNo, date: s.date, module: s.module, title: s.title, subtopics: s.subtopics,
        trainers: s.trainers, timeLimitMin: s.timeLimitMin, joinCode: s.joinCode, status: s.status,
        startedAt: s.startedAt, endsAt: s.endsAt, endedAt: s.endedAt, reveal: s.reveal,
        blockEnd: s.blockEnd, askedCount: s.currentIndex + 1, pendingBlock: s.status === 'live' ? 0 : await this.pendingBlock(s),
        questionCount: qs.length, participantCount: (await this.db.get('SELECT COUNT(*) AS n FROM participants WHERE session_id = ?', sessionId)).n,
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
      const answered = (await this.db.get('SELECT COUNT(*) AS n FROM answers WHERE question_id = ?', q.id)).n;
      out.question = {
        index: s.currentIndex, id: q.id, text: q.text, code: q.code || null, options: q.options, complexity: q.complexity,
        seconds: this.secondsFor(s, q), startedAt: s.questionStartedAt, endsAt: s.questionEndsAt,
        closed: s.questionClosed, answeredCount: answered,
      };
      if (s.questionClosed && revealEach) {
        out.question.answer = q.answer;
        out.question.explanation = q.explanation;
        out.question.tally = await this.tally(q.id);
      }
    }

    const deck = await this.deckForSession(s);
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
      const answeredIds = q ? new Set((await this.db.all('SELECT participant_id FROM answers WHERE question_id = ?', q.id)).map((r) => r.participant_id)) : new Set();
      out.participants = (await this.participants(sessionId)).map((p) => ({ id: p.id, name: p.name, score: hideScores ? null : p.score, answered: answeredIds.has(p.id) }));
    }

    if (s.status === 'ended') {
      out.scoreboard = await this.scoreboard(sessionId);
      if (host) {
        out.ratings = await this.ratingSummary(sessionId);
        out.review = await this.review(sessionId);
      }
    }

    if (participantId) {
      const p = (await this.db.get('SELECT * FROM participants WHERE id = ?', participantId));
      if (p) {
        const me = { id: p.id, name: p.name, email: p.email, score: hideScores ? null : p.score, answer: null, rated: false, rank: null };
        if (q) {
          const a = (await this.db.get('SELECT choice, correct, points FROM answers WHERE participant_id = ? AND question_id = ?', p.id, q.id));
          if (a) me.answer = revealEach ? { choice: a.choice, correct: !!a.correct, points: a.points } : { choice: a.choice };
        }
        if (s.status === 'ended') {
          const row = (out.scoreboard || await this.scoreboard(sessionId)).find((r) => r.id === p.id);
          me.rank = row ? row.rank : null;
          me.rated = !!(await this.db.get('SELECT 1 FROM ratings WHERE session_id = ? AND participant_id = ?', sessionId, p.id));
          me.review = await this.review(sessionId, p.id);
        }
        out.me = me;
      }
    }
    return out;
  }

  /** Every question with its correct answer; per participant it carries their choice, for the host the tally. */
  async review(sessionId, participantId = null) {
    const qs = await this.questions(sessionId);
    const mine = participantId
      ? new Map((await this.db.all('SELECT question_id, choice, correct FROM answers WHERE participant_id = ?', participantId)).map((a) => [a.question_id, a]))
      : null;
    const s = await this.session(sessionId);
    const asked = s.status === 'ended' && s.currentIndex >= 0 ? s.currentIndex + 1 : qs.length;
    const out = [];
    for (const [i, q] of qs.slice(0, asked).entries()) {
      const row = { index: i, id: q.id, text: q.text, code: q.code || null, options: q.options, answer: q.answer, explanation: q.explanation, complexity: q.complexity };
      if (mine) {
        const a = mine.get(q.id);
        row.choice = a ? a.choice : null;
        row.correct = a ? !!a.correct : false;
      } else {
        row.tally = await this.tally(q.id);
        row.answered = row.tally.reduce((x, y) => x + y, 0);
        row.correctCount = row.tally[q.answer] || 0;
      }
      out.push(row);
    }
    return out;
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

  async broadcast(sessionId) {
    const set = this.subs.get(sessionId);
    if (!set || !set.size) return;
    for (const sub of set) {
      try { sub.fn(await this.snapshot(sessionId, { participantId: sub.participantId, host: sub.host })); } catch { /* dropped client */ }
    }
  }

  // ---- lifecycle ---------------------------------------------------------

  async openLobby(id) {
    const s = await this.mustSession(id);
    if (s.status === 'ended') throw new LiveError(409, 'Session already ended. Reset it to run again.');
    if (s.status === 'live') throw new LiveError(409, 'Quiz is already running');
    (await this.db.run("UPDATE sessions SET status = 'lobby', slide_index = -1 WHERE id = ?", id));
    await this.broadcast(id);
    return await this.snapshot(id, { host: true });
  }

  /** Runs every question not yet asked, with the session time limit. */
  async startQuiz(id) {
    const s = await this.mustSession(id);
    if (s.status === 'live') throw new LiveError(409, 'Quiz is already running');
    if (s.status === 'ended') throw new LiveError(409, 'Session already ended. Reset it to run again.');
    const qs = await this.questions(id);
    if (!qs.length) throw new LiveError(409, 'Add at least one question first');
    const from = s.currentIndex + 1;
    if (from >= qs.length) throw new LiveError(409, 'Every question has been asked. End the session from the host screen.');
    const now = this.now();
    (await this.db.run("UPDATE sessions SET status = 'live', started_at = COALESCE(started_at, ?), ends_at = ?, ended_at = NULL, slide_index = -1, block_end = NULL WHERE id = ?", now, now + s.timeLimitMin * 60_000, id));
    await this.startQuestion(id, from);
    await this.armSessionTimer(await this.session(id));
    await this.broadcast(id);
    return await this.snapshot(id, { host: true });
  }

  /**
   * Runs a block of questions in the middle of a presentation (a slide's askAfter checkpoint).
   * The block has no session clock; when its last question closes, Next returns to the slides.
   */
  async startBlock(id, count) {
    const s = await this.mustSession(id);
    if (s.status === 'live') throw new LiveError(409, 'Quiz is already running');
    if (s.status === 'ended') throw new LiveError(409, 'Session already ended');
    const qs = await this.questions(id);
    const from = s.currentIndex + 1;
    if (from >= qs.length) return await this.snapshot(id, { host: true });
    const to = Math.min(qs.length - 1, from + Math.max(1, count | 0) - 1);
    (await this.db.run("UPDATE sessions SET status = 'live', started_at = COALESCE(started_at, ?), ends_at = NULL, block_end = ? WHERE id = ?", this.now(), to, id));
    await this.startQuestion(id, from);
    await this.broadcast(id);
    return await this.snapshot(id, { host: true });
  }

  /** How many questions a checkpoint on the current slide would ask (0 = none, or none left). */
  async pendingBlock(s) {
    const deck = await this.deckForSession(s);
    if (!deck || s.slideIndex < 0) return 0;
    const sl = flattenDeck(deck)[s.slideIndex];
    const n = sl?.askAfter | 0;
    if (!n) return 0;
    const left = (await this.questions(s.id)).length - (s.currentIndex + 1);
    return Math.max(0, Math.min(n, left));
  }

  async startQuestion(id, index) {
    const s = await this.mustSession(id);
    const q = await this.questionAt(id, index);
    if (!q) throw new LiveError(409, 'No such question');
    const now = this.now();
    const seconds = this.secondsFor(s, q);
    (await this.db.run('UPDATE sessions SET current_index = ?, question_started_at = ?, question_ends_at = ?, question_closed = 0 WHERE id = ?', index, now, now + seconds * 1000, id));
    await this.armQuestionTimer(await this.session(id));
  }

  async closeQuestion(id) {
    const s = await this.mustSession(id);
    if (s.status !== 'live' || s.questionClosed) return await this.snapshot(id, { host: true });
    (await this.db.run('UPDATE sessions SET question_closed = 1 WHERE id = ?', id));
    this.clearQuestionTimer(id);
    await this.broadcast(id);
    return await this.snapshot(id, { host: true });
  }

  async next(id) {
    const s = await this.mustSession(id);
    if (s.status !== 'live') throw new LiveError(409, 'Quiz is not running');
    if (!s.questionClosed) return await this.closeQuestion(id);
    const count = (await this.questions(id)).length;
    if (s.currentIndex + 1 >= count) return await this.endQuiz(id);
    if (s.blockEnd !== null && s.currentIndex >= s.blockEnd) {
      // End of a mid-presentation block: back to the slides, on the slide after the checkpoint.
      this.clearTimers(id);
      const total = flattenDeck(await this.deckForSession(s)).length;
      const nextSlide = Math.min(total - 1, s.slideIndex + 1);
      (await this.db.run("UPDATE sessions SET status = 'lobby', block_end = NULL, slide_index = ?, slide_step = 0, question_closed = 1 WHERE id = ?", nextSlide, id));
      await this.broadcast(id);
      return await this.snapshot(id, { host: true });
    }
    await this.startQuestion(id, s.currentIndex + 1);
    await this.broadcast(id);
    return await this.snapshot(id, { host: true });
  }

  async endQuiz(id) {
    const s = await this.mustSession(id);
    if (s.status === 'ended') return await this.snapshot(id, { host: true });
    (await this.db.run("UPDATE sessions SET status = 'ended', ended_at = ?, question_closed = 1 WHERE id = ?", this.now(), id));
    this.clearTimers(id);
    await this.broadcast(id);
    return await this.snapshot(id, { host: true });
  }

  async reset(id) {
    await this.mustSession(id);
    this.clearTimers(id);
    (await this.db.run('DELETE FROM answers WHERE participant_id IN (SELECT id FROM participants WHERE session_id = ?)', id));
    (await this.db.run('DELETE FROM ratings WHERE session_id = ?', id));
    (await this.db.run('DELETE FROM participants WHERE session_id = ?', id));
    (await this.db.run(`UPDATE sessions SET status = 'draft', current_index = -1, question_started_at = NULL, question_ends_at = NULL,
      question_closed = 0, started_at = NULL, ends_at = NULL, ended_at = NULL, slide_index = -1, slide_step = 0, block_end = NULL WHERE id = ?`, id));
    await this.broadcast(id);
    return await this.snapshot(id, { host: true });
  }

  async deckFor(s) {
    const deck = await this.deckForSession(s);
    if (!deck) throw new LiveError(404, 'No content for this session');
    if (s.status === 'live') throw new LiveError(409, 'Finish the quiz before presenting');
    return flattenDeck(deck);
  }

  /** Jumps to a slide. step = how many bullets are revealed (0 = title and diagram only). */
  async setSlide(id, index, step = 0) {
    const s = await this.mustSession(id);
    const flat = await this.deckFor(s);
    const next = index === null || index === undefined ? -1 : Math.max(0, Math.min(flat.length - 1, Number(index) | 0));
    const max = next >= 0 ? stepsOf(flat[next]) : 0;
    const st = step === 'all' ? max : Math.max(0, Math.min(max, Number(step) | 0));
    // Showing slides opens the room: interns can only join a session in the lobby.
    if (s.status === 'draft') (await this.db.run("UPDATE sessions SET status = 'lobby' WHERE id = ?", id));
    (await this.db.run('UPDATE sessions SET slide_index = ?, slide_step = ? WHERE id = ?', next, st, id));
    await this.broadcast(id);
    return await this.snapshot(id, { host: true });
  }

  /** Forward reveals the next bullet, then moves to the next slide; back returns to the previous slide fully revealed. */
  async advanceSlide(id, dir) {
    const s = await this.mustSession(id);
    const flat = await this.deckFor(s);
    const i = s.slideIndex, st = s.slideStep;
    if (dir > 0) {
      if (i < 0) return await this.setSlide(id, 0, 0);
      if (st < stepsOf(flat[i])) return await this.setSlide(id, i, st + 1);
      const block = await this.pendingBlock(s);
      if (block) return await this.startBlock(id, block);
      if (i < flat.length - 1) return await this.setSlide(id, i + 1, 0);
      return await this.snapshot(id, { host: true });
    }
    if (i <= 0) return await this.setSlide(id, 0, 0);
    if (st > 0 && st < stepsOf(flat[i])) return await this.setSlide(id, i, 0);
    return await this.setSlide(id, i - 1, 'all');
  }

  // ---- housekeeping (trainer) --------------------------------------------

  async removeParticipant(participantId) {
    const p = (await this.db.get('SELECT * FROM participants WHERE id = ?', Number(participantId)));
    if (!p) throw new LiveError(404, 'Participant not found');
    (await this.db.run('DELETE FROM answers WHERE participant_id = ?', p.id));
    (await this.db.run('DELETE FROM ratings WHERE participant_id = ?', p.id));
    (await this.db.run('DELETE FROM participants WHERE id = ?', p.id));
    await this.broadcast(p.session_id);
    return { removed: 1 };
  }

  /** Removes one intern (by email) from every session. */
  async removeIntern(emailRaw) {
    const email = String(emailRaw || '').trim().toLowerCase();
    const rows = (await this.db.all('SELECT id FROM participants WHERE email = ?', email));
    for (const r of rows) await this.removeParticipant(r.id);
    return { removed: rows.length };
  }

  /** Wipes every participant, answer and rating, and returns every session to draft. */
  async clearAllData() {
    const ids = (await this.db.all('SELECT id FROM sessions')).map((r) => r.id);
    const before = (await this.db.get('SELECT COUNT(*) AS n FROM participants')).n;
    for (const id of ids) await this.reset(id);
    return { participantsRemoved: before, sessionsReset: ids.length };
  }

  /** Points per intern per session, for the trainer dashboard. */
  async dashboard() {
    const sessions = (await this.db.all(`SELECT s.*, (SELECT COUNT(*) FROM questions q WHERE q.session_id = s.id) AS question_count,
              (SELECT COUNT(*) FROM participants p WHERE p.session_id = s.id) AS participant_count,
              (SELECT AVG(p.score) FROM participants p WHERE p.session_id = s.id) AS avg_score
         FROM sessions s ORDER BY s.date, s.day_no, s.id`,)).map((r) => ({ ...rowToSession(r), questionCount: r.question_count, participantCount: r.participant_count, avgScore: r.avg_score === null ? null : Math.round(r.avg_score) }));
    const rows = (await this.db.all(`SELECT p.id, p.session_id, p.email, p.name, p.score, p.joined_at,
              COALESCE(SUM(a.correct), 0) AS correct, COUNT(a.question_id) AS answered
         FROM participants p LEFT JOIN answers a ON a.participant_id = p.id
        GROUP BY p.id ORDER BY p.joined_at`,));
    const weekOf = new Map(sessions.map((s) => [s.id, s.week || 'Unscheduled']));
    const weeks = [...new Set(sessions.map((s) => s.week || 'Unscheduled'))];
    const interns = new Map();
    for (const r of await this.roster()) interns.set(r.email, { email: r.email, name: r.name, onRoster: true, total: 0, attended: 0, sessions: {}, weeks: {} });
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
  async certificate(participantId) {
    const p = (await this.db.get('SELECT * FROM participants WHERE id = ?', Number(participantId)));
    if (!p) throw new LiveError(404, 'Participant not found');
    const s = await this.mustSession(p.session_id);
    if (s.status !== 'ended') throw new LiveError(409, 'Certificates are issued when the session has finished');
    const board = await this.scoreboard(s.id);
    const me = board.find((r) => r.id === p.id);
    const issuedOn = new Date(s.endedAt || this.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    return {
      participantId: p.id, name: p.name, email: p.email,
      sessionId: s.id, sessionTitle: s.title, module: s.module, date: s.date, trainers: s.trainers,
      score: p.score, correct: me?.correct ?? 0, questionCount: (await this.questions(s.id)).length,
      rank: me?.rank ?? board.length, participants: board.length, issuedOn,
    };
  }

  // ---- participants ------------------------------------------------------

  /** Interns join with their email only; the name comes from the roster. */
  async join(code, emailRaw) {
    const s = await this.sessionByCode(code);
    if (!s) throw new LiveError(404, 'No session with that code');
    if (s.status === 'draft') throw new LiveError(409, 'The trainer has not opened this session yet');
    if (s.status === 'ended') throw new LiveError(409, 'This session has finished');
    const email = String(emailRaw || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LiveError(400, 'Please enter a valid email');
    const entry = await this.rosterEntry(email);
    if (!entry) throw new LiveError(403, 'This email is not on the participant list. Ask your trainer to add you.');
    const name = entry.name;
    let row = (await this.db.get('SELECT * FROM participants WHERE session_id = ? AND email = ?', s.id, email));
    if (row) {
      (await this.db.run('UPDATE participants SET name = ? WHERE id = ?', name, row.id));
      row = { ...row, name };
    } else {
      const token = randomBytes(18).toString('hex');
      const { lastInsertRowid } = (await this.db.run('INSERT INTO participants (session_id, token, name, email, joined_at) VALUES (?, ?, ?, ?, ?)', s.id, token, name, email, this.now()));
      row = (await this.db.get('SELECT * FROM participants WHERE id = ?', Number(lastInsertRowid)));
    }
    await this.broadcast(s.id);
    return { token: row.token, participantId: row.id, sessionId: s.id, name: row.name };
  }

  async answer(token, questionId, choiceRaw) {
    const p = await this.mustParticipant(token);
    const s = await this.mustSession(p.sessionId);
    if (s.status !== 'live') throw new LiveError(409, 'The quiz is not running');
    const q = await this.questionAt(s.id, s.currentIndex);
    if (!q || q.id !== Number(questionId)) throw new LiveError(409, 'That question is no longer open');
    if (s.questionClosed || this.now() > s.questionEndsAt + ANSWER_GRACE_MS) throw new LiveError(409, 'Time is up for this question');
    const choice = Number(choiceRaw);
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) throw new LiveError(400, 'Pick one of the four options');
    const correct = choice === q.answer;
    const points = correct ? POINTS_CORRECT : POINTS_WRONG;
    // The primary key decides who was first: a second tap from the same phone inserts nothing.
    const { changes } = await this.db.run(
      'INSERT INTO answers (participant_id, question_id, choice, correct, points, answered_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (participant_id, question_id) DO NOTHING',
      p.id, q.id, choice, correct ? 1 : 0, points, this.now(),
    );
    if (!changes) throw new LiveError(409, 'You already answered this question');
    await this.db.run('UPDATE participants SET score = score + ? WHERE id = ?', points, p.id);
    await this.broadcast(s.id);
    return { accepted: true, choice };
  }

  async rate(token, ratings, commentRaw) {
    const p = await this.mustParticipant(token);
    const s = await this.mustSession(p.sessionId);
    if (s.status !== 'ended') throw new LiveError(409, 'Ratings open when the session ends');
    if (!Array.isArray(ratings) || !ratings.length) throw new LiveError(400, 'Rate at least one trainer');
    const comment = String(commentRaw || '').trim().slice(0, 500) || null;
    for (const r of ratings) {
      const stars = Number(r.stars);
      if (!s.trainers.includes(r.trainer)) throw new LiveError(400, `Unknown trainer: ${r.trainer}`);
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new LiveError(400, 'Stars must be 1 to 5');
    }
    for (const r of ratings) {
      await this.db.run(
        `INSERT INTO ratings (session_id, participant_id, trainer, stars, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (session_id, participant_id, trainer) DO UPDATE SET stars = excluded.stars, comment = excluded.comment`,
        s.id, p.id, r.trainer, Number(r.stars), comment, this.now(),
      );
    }
    await this.broadcast(s.id);
    return { saved: true };
  }

  async resultsCsv(sessionId) {
    const s = await this.mustSession(sessionId);
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['rank', 'name', 'email', 'points', 'correct', 'answered', 'questions'].map(esc).join(',')];
    const count = (await this.questions(sessionId)).length;
    for (const r of await this.scoreboard(sessionId)) lines.push([r.rank, r.name, r.email, r.score, r.correct, r.answered, count].map(esc).join(','));
    lines.push('');
    lines.push(['trainer', 'average_stars', 'ratings'].map(esc).join(','));
    for (const t of (await this.ratingSummary(sessionId)).trainers) lines.push([t.trainer, t.average ?? '', t.count].map(esc).join(','));
    return { filename: `${s.key || 'session-' + s.id}-results.csv`, csv: lines.join('\n') };
  }

  // ---- timers ------------------------------------------------------------

  async armQuestionTimer(s) {
    this.clearQuestionTimer(s.id);
    if (s.status !== 'live' || s.questionClosed || !s.questionEndsAt) return;
    const t = this.timers.get(s.id) || {};
    t.question = this.setTimer(() => this.closeQuestion(s.id).catch(() => { /* session gone */ }), Math.max(0, s.questionEndsAt - this.now()));
    this.timers.set(s.id, t);
  }

  async armSessionTimer(s) {
    const t = this.timers.get(s.id) || {};
    if (t.session) this.clearTimer(t.session);
    if (s.status !== 'live' || !s.endsAt) return;
    t.session = this.setTimer(() => this.endQuiz(s.id).catch(() => { /* session gone */ }), Math.max(0, s.endsAt - this.now()));
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

  async resumeTimers() {
    for (const r of (await this.db.all("SELECT * FROM sessions WHERE status = 'live'"))) {
      const s = rowToSession(r);
      await this.armQuestionTimer(s);
      await this.armSessionTimer(s);
    }
  }
}

/** Number of build steps on a slide: one per bullet, none when the slide is a picture. */
export function stepsOf(sl) {
  return sl && sl.build !== false ? (sl.bullets || []).length : 0;
}

/**
 * A session's own checkpoints ({"<flat slide index>": [question ids]}) replace the deck's askAfter
 * values wholesale: each listed slide asks as many questions as it has picks. null keeps the deck
 * as authored.
 */
export function applyCheckpoints(deck, checkpoints) {
  if (!checkpoints || typeof checkpoints !== 'object') return deck;
  let flat = 0;
  return {
    ...deck,
    sections: (deck.sections || []).map((sec) => ({
      ...sec,
      slides: (sec.slides || []).map((sl) => {
        const picks = checkpoints[flat++];
        const n = Array.isArray(picks) ? picks.length : 0;
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
