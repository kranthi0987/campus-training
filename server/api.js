// REST + SSE API. Trainer routes need the trainer cookie; play routes need a participant token.
// Admins reach every session; trainers only the sessions assigned to them (see access.js).
import QRCode from 'qrcode';
import { Router, HttpError, sendJson, readBody, parseCookies, openSse } from './http.js';
import { COOKIE, normalizeEmail } from './auth.js';
import { parseBulk } from './bulk.js';
import { insertQuestions, uniqueJoinCode } from './seed/index.js';
import { rowToQuestion, rowToSession } from './db.js';
import { flattenDeck } from './live.js';
import { certificateSvg, certificateFilename } from './certificate.js';
import { sessionAllows } from './access.js';
import { zipStore } from './zip.js';

const COMPLEXITY = new Set(['easy', 'medium', 'hard']);

export function createApi({ db, live, auth, decks, publicUrl }) {
  const r = new Router();

  const userOf = (req) => auth.trainerForToken(parseCookies(req)[COOKIE]);
  const requireTrainer = (req) => {
    const t = userOf(req);
    if (!t) throw new HttpError(401, 'Sign in as a trainer');
    return t;
  };
  const requireAdmin = (req) => {
    const t = requireTrainer(req);
    if (t.role !== 'admin') throw new HttpError(403, 'Only an admin can do this');
    return t;
  };
  /** Signed in and allowed to open this session: admins always, trainers only for their own. */
  const requireSession = (req, id) => {
    const user = requireTrainer(req);
    const session = live.mustSession(id);
    if (!sessionAllows(session, user)) throw new HttpError(403, 'This session is assigned to another trainer');
    return { user, session };
  };
  const requireParticipant = (req, participantId) => {
    const p = db.prepare('SELECT * FROM participants WHERE id = ?').get(Number(participantId));
    if (!p) throw new HttpError(404, 'Participant not found');
    return { ...requireSession(req, p.session_id), participant: p };
  };
  const participantToken = (req, url) => req.headers['x-participant-token'] || url.searchParams.get('token') || '';
  const sessionId = (params) => {
    const id = Number(params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Bad session id');
    return id;
  };
  /** Keeps only emails that belong to existing accounts. */
  const cleanEmails = (list) => {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const e of list.map(normalizeEmail)) if (e && !out.includes(e) && auth.get(e)) out.push(e);
    return out;
  };
  const sessionSummary = (row) => ({ ...rowToSession(row), questionCount: row.question_count, participantCount: row.participant_count, hasSlides: !!(row.slides_key && decks.has(row.slides_key)) });
  const allSessions = () => db.prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM questions q WHERE q.session_id = s.id) AS question_count,
            (SELECT COUNT(*) FROM participants p WHERE p.session_id = s.id) AS participant_count
       FROM sessions s ORDER BY s.date, s.day_no, s.id`,
  ).all().map(sessionSummary);

  // ---- info ---------------------------------------------------------------
  r.get('/api/info', (req, res) => sendJson(res, 200, { publicUrl, setupNeeded: auth.count() === 0 }));

  // ---- trainer auth -------------------------------------------------------
  r.post('/api/trainer/login', async (req, res) => {
    const body = await readBody(req);
    const trainer = auth.login(body.email, body.password, String(body.name || '').trim().slice(0, 60));
    if (!trainer) throw new HttpError(401, auth.count() === 0 ? 'Email or password is wrong' : 'Email or password is wrong. New here? Ask the admin to add you.');
    const token = auth.issueToken(trainer.email);
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);
    sendJson(res, 200, { trainer: { email: trainer.email, name: trainer.name, role: trainer.role }, usingDefault: trainer.usingDefault });
  });

  r.post('/api/trainer/logout', (req, res) => {
    auth.revoke(parseCookies(req)[COOKIE]);
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
    sendJson(res, 200, { ok: true });
  });

  r.get('/api/trainer/me', (req, res) => sendJson(res, 200, { trainer: requireTrainer(req) }));

  r.post('/api/trainer/password', async (req, res) => {
    const t = requireTrainer(req);
    const body = await readBody(req);
    if (!auth.changePassword(t.email, body.current, body.next)) throw new HttpError(400, 'Current password is wrong or the new one is shorter than 8 characters');
    sendJson(res, 200, { ok: true });
  });

  // ---- trainer accounts (admin) -------------------------------------------
  const setSessionsFor = (email, sessionIds) => {
    if (!Array.isArray(sessionIds)) return;
    const wanted = new Set(sessionIds.map(Number).filter(Number.isInteger));
    const upd = db.prepare('UPDATE sessions SET trainer_emails = ? WHERE id = ?');
    for (const row of db.prepare('SELECT id, trainer_emails FROM sessions').all()) {
      const cur = JSON.parse(row.trainer_emails || '[]');
      const next = wanted.has(row.id) ? [...new Set([...cur, email])] : cur.filter((e) => e !== email);
      if (next.length !== cur.length) upd.run(JSON.stringify(next), row.id);
    }
  };
  const trainerList = () => {
    const sessions = db.prepare('SELECT * FROM sessions ORDER BY date, day_no, id').all().map(rowToSession);
    return auth.list().map((t) => ({
      ...t,
      sessionIds: sessions.filter((s) => s.trainerEmails.includes(t.email)).map((s) => s.id),
      matchedSessionIds: t.role === 'admin' ? [] : sessions.filter((s) => !s.trainerEmails.includes(t.email) && sessionAllows(s, t)).map((s) => s.id),
    }));
  };

  r.get('/api/trainers', (req, res) => { requireAdmin(req); sendJson(res, 200, { trainers: trainerList() }); });

  r.post('/api/trainers', async (req, res) => {
    requireAdmin(req);
    const b = await readBody(req);
    const created = auth.create({ email: b.email, name: b.name, role: b.role || 'trainer', password: b.password });
    setSessionsFor(created.email, b.sessionIds);
    sendJson(res, 201, { trainer: trainerList().find((t) => t.email === created.email), usingDefault: created.usingDefault });
  });

  r.put('/api/trainers/:email', async (req, res, params) => {
    const me = requireAdmin(req);
    const b = await readBody(req);
    const email = normalizeEmail(params.email);
    if (email === me.email && b.role !== undefined && b.role !== 'admin') throw new HttpError(400, 'You cannot remove your own admin role');
    const updated = auth.update(email, { name: b.name, role: b.role, password: b.password });
    setSessionsFor(updated.email, b.sessionIds);
    sendJson(res, 200, { trainer: trainerList().find((t) => t.email === updated.email) });
  });

  r.delete('/api/trainers/:email', (req, res, params) => {
    const me = requireAdmin(req);
    const email = normalizeEmail(params.email);
    if (email === me.email) throw new HttpError(400, 'You cannot remove your own account');
    const out = auth.remove(email);
    setSessionsFor(email, []);
    sendJson(res, 200, out);
  });

  // ---- sessions -----------------------------------------------------------
  r.get('/api/sessions', (req, res) => {
    const user = requireTrainer(req);
    sendJson(res, 200, { sessions: allSessions().filter((s) => sessionAllows(s, user)) });
  });

  // ---- roster: everyone signed in may read it, only admins change it ------
  r.get('/api/roster', (req, res) => { requireTrainer(req); sendJson(res, 200, { roster: live.roster() }); });
  r.post('/api/roster', async (req, res) => {
    requireAdmin(req);
    const b = await readBody(req);
    let entries = Array.isArray(b.entries) ? b.entries : [];
    if (typeof b.text === 'string') {
      // One person per line: "Name, email" or "Name <email>" or "email Name" or tab-separated.
      for (const line of b.text.split(/\r?\n/)) {
        const m = line.match(/([^\s@<>,;\t]+@[^\s@<>,;\t]+)/);
        if (!m) continue;
        const name = line.replace(m[1], '').replace(/[<>,;\t]+/g, ' ').trim();
        entries.push({ name, email: m[1] });
      }
    }
    if (!entries.length) throw new HttpError(400, 'No participants found. Use one "Name, email" per line.');
    sendJson(res, 200, { ...live.addToRoster(entries), roster: live.roster() });
  });
  r.delete('/api/roster', (req, res, params, url) => {
    requireAdmin(req);
    sendJson(res, 200, { ...live.removeFromRoster(url.searchParams.get('email')), roster: live.roster() });
  });

  r.post('/api/sessions', async (req, res) => {
    const user = requireTrainer(req);
    const b = await readBody(req);
    const title = String(b.title || '').trim();
    if (!title) throw new HttpError(400, 'Title is required');
    const trainers = Array.isArray(b.trainers) ? b.trainers.map((t) => String(t).trim()).filter(Boolean) : [];
    // A trainer's own session is assigned to them; an admin picks the accounts.
    const trainerEmails = user.role === 'admin' ? cleanEmails(b.trainerEmails) : [user.email];
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO sessions (day_no, date, module, title, subtopics, trainers, join_code, trainer_emails) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(b.dayNo ?? null, String(b.date || '').slice(0, 10) || null, String(b.module || '').trim() || null, title, String(b.subtopics || '').trim(), JSON.stringify(trainers), uniqueJoinCode(db), JSON.stringify(trainerEmails));
    sendJson(res, 201, { session: live.session(Number(lastInsertRowid)) });
  });

  r.get('/api/sessions/:id', (req, res, params) => {
    const id = sessionId(params);
    const { session: s } = requireSession(req, id);
    sendJson(res, 200, { session: { ...s, hasSlides: !!(s.slidesKey && decks.has(s.slidesKey)) }, questions: live.questions(id) });
  });

  r.put('/api/sessions/:id', async (req, res, params) => {
    const id = sessionId(params);
    const { user, session: s } = requireSession(req, id);
    const b = await readBody(req);
    const num = (v, lo, hi, cur) => {
      if (v === undefined) return cur;
      const n = Number(v);
      if (!Number.isInteger(n) || n < lo || n > hi) throw new HttpError(400, `Value ${v} must be between ${lo} and ${hi}`);
      return n;
    };
    const trainers = b.trainers === undefined ? s.trainers : (Array.isArray(b.trainers) ? b.trainers.map((t) => String(t).trim()).filter(Boolean) : s.trainers);
    const trainerEmails = user.role === 'admin' && b.trainerEmails !== undefined ? cleanEmails(b.trainerEmails) : s.trainerEmails;
    const reveal = b.reveal === undefined ? s.reveal : String(b.reveal);
    if (!['end', 'each'].includes(reveal)) throw new HttpError(400, 'reveal must be "end" or "each"');
    db.prepare(
      `UPDATE sessions SET title = ?, date = ?, module = ?, subtopics = ?, trainers = ?, trainer_emails = ?, time_limit_min = ?, easy_s = ?, medium_s = ?, hard_s = ?, reveal = ? WHERE id = ?`,
    ).run(
      String(b.title ?? s.title).trim() || s.title, b.date === undefined ? s.date : String(b.date).slice(0, 10), b.module === undefined ? s.module : String(b.module).trim(),
      b.subtopics === undefined ? s.subtopics : String(b.subtopics).trim(), JSON.stringify(trainers), JSON.stringify(trainerEmails),
      num(b.timeLimitMin, 1, 600, s.timeLimitMin), num(b.easyS, 5, 600, s.easyS), num(b.mediumS, 5, 600, s.mediumS), num(b.hardS, 5, 600, s.hardS), reveal, id,
    );
    live.broadcast(id);
    sendJson(res, 200, { session: live.session(id) });
  });

  r.post('/api/sessions/:id/code', (req, res, params) => {
    const id = sessionId(params);
    requireSession(req, id);
    db.prepare('UPDATE sessions SET join_code = ? WHERE id = ?').run(uniqueJoinCode(db), id);
    live.broadcast(id);
    sendJson(res, 200, { session: live.session(id) });
  });

  // ---- questions ----------------------------------------------------------
  const cleanQuestion = (b) => {
    const text = String(b.text || '').trim();
    const options = Array.isArray(b.options) ? b.options.map((o) => String(o ?? '').trim()) : [];
    const answer = Number(b.answer);
    const complexity = String(b.complexity || 'medium').toLowerCase();
    const seconds = b.seconds === null || b.seconds === undefined || b.seconds === '' ? null : Number(b.seconds);
    if (text.length < 3) throw new HttpError(400, 'Question text is required');
    if (options.length !== 4 || options.some((o) => !o)) throw new HttpError(400, 'Provide four non-empty options');
    if (!Number.isInteger(answer) || answer < 0 || answer > 3) throw new HttpError(400, 'Mark which option is correct');
    if (!COMPLEXITY.has(complexity)) throw new HttpError(400, 'Complexity must be easy, medium or hard');
    if (seconds !== null && (!Number.isInteger(seconds) || seconds < 5 || seconds > 600)) throw new HttpError(400, 'Seconds must be 5–600');
    return { text, options, answer, complexity, seconds, explanation: String(b.explanation || '').trim().slice(0, 500), code: String(b.code || '').replace(/\s+$/, '').slice(0, 2000) || null };
  };
  const nextPosition = (id) => (db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM questions WHERE session_id = ?').get(id).p);

  r.post('/api/sessions/:id/questions', async (req, res, params) => {
    const id = sessionId(params);
    requireSession(req, id);
    const q = cleanQuestion(await readBody(req));
    insertQuestions(db, id, [q], nextPosition(id));
    live.broadcast(id);
    sendJson(res, 201, { questions: live.questions(id) });
  });

  r.post('/api/sessions/:id/questions/bulk', async (req, res, params) => {
    const id = sessionId(params);
    requireSession(req, id);
    const { questions, errors } = parseBulk((await readBody(req)).text);
    if (errors.length) return sendJson(res, 400, { error: 'Some blocks could not be read', errors });
    insertQuestions(db, id, questions, nextPosition(id));
    live.broadcast(id);
    sendJson(res, 201, { added: questions.length, questions: live.questions(id) });
  });

  r.post('/api/sessions/:id/questions/reorder', async (req, res, params) => {
    const id = sessionId(params);
    requireSession(req, id);
    const ids = (await readBody(req)).ids;
    if (!Array.isArray(ids)) throw new HttpError(400, 'ids must be an array');
    const stmt = db.prepare('UPDATE questions SET position = ? WHERE id = ? AND session_id = ?');
    ids.forEach((qid, i) => stmt.run(i, Number(qid), id));
    sendJson(res, 200, { questions: live.questions(id) });
  });

  r.put('/api/questions/:id', async (req, res, params) => {
    const qid = Number(params.id);
    const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(qid);
    if (!row) throw new HttpError(404, 'Question not found');
    requireSession(req, row.session_id);
    const q = cleanQuestion(await readBody(req));
    db.prepare('UPDATE questions SET text = ?, options = ?, answer = ?, complexity = ?, seconds = ?, explanation = ?, code = ? WHERE id = ?')
      .run(q.text, JSON.stringify(q.options), q.answer, q.complexity, q.seconds, q.explanation, q.code, qid);
    live.broadcast(row.session_id);
    sendJson(res, 200, { question: rowToQuestion(db.prepare('SELECT * FROM questions WHERE id = ?').get(qid)) });
  });

  r.delete('/api/questions/:id', (req, res, params) => {
    const qid = Number(params.id);
    const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(qid);
    if (!row) throw new HttpError(404, 'Question not found');
    const { session: s } = requireSession(req, row.session_id);
    if (s.status === 'live') throw new HttpError(409, 'Cannot delete questions while the quiz is running');
    db.prepare('DELETE FROM questions WHERE id = ?').run(qid);
    db.prepare('DELETE FROM answers WHERE question_id = ?').run(qid);
    sendJson(res, 200, { questions: live.questions(row.session_id) });
  });

  // ---- lifecycle ----------------------------------------------------------
  const action = (name, fn) => r.post(`/api/sessions/:id/${name}`, async (req, res, params) => {
    const id = sessionId(params);
    requireSession(req, id);
    const body = await readBody(req);
    sendJson(res, 200, { state: fn(id, body) });
  });
  action('lobby', (id) => live.openLobby(id));
  action('start', (id) => live.startQuiz(id));
  action('close', (id) => live.closeQuestion(id));
  action('next', (id) => live.next(id));
  action('end', (id) => live.endQuiz(id));
  action('reset', (id) => live.reset(id));
  action('slide', (id, b) => live.setSlide(id, b.index === null || b.index === undefined ? null : Number(b.index), b.step ?? 0));
  action('advance', (id, b) => live.advanceSlide(id, Number(b.dir) < 0 ? -1 : 1));

  // ---- scorecards + housekeeping (admin) ----------------------------------
  r.get('/api/dashboard', (req, res) => { requireAdmin(req); sendJson(res, 200, live.dashboard()); });
  r.delete('/api/participants/:id', (req, res, params) => { requireParticipant(req, params.id); sendJson(res, 200, live.removeParticipant(params.id)); });
  r.delete('/api/interns', (req, res, params, url) => { requireAdmin(req); sendJson(res, 200, live.removeIntern(url.searchParams.get('email'))); });
  r.post('/api/admin/clear-data', async (req, res) => {
    requireAdmin(req);
    const b = await readBody(req);
    if (b.confirm !== 'CLEAR') throw new HttpError(400, 'Send { "confirm": "CLEAR" } to wipe all participant data');
    sendJson(res, 200, live.clearAllData());
  });

  // ---- certificates (admin, or the session's trainer) ---------------------
  const withFile = (c) => ({ ...c, filename: certificateFilename(c) });
  const sessionCertificates = (s) => {
    if (s.status !== 'ended') throw new HttpError(409, 'Certificates are issued when the session has finished');
    return live.scoreboard(s.id).map((row) => withFile(live.certificate(row.id)));
  };
  const slug = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  r.get('/api/participants/:id/certificate', (req, res, params) => {
    requireParticipant(req, params.id);
    sendJson(res, 200, { certificate: withFile(live.certificate(params.id)) });
  });
  r.get('/api/participants/:id/certificate.svg', (req, res, params) => {
    requireParticipant(req, params.id);
    const c = live.certificate(params.id);
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${certificateFilename(c)}"` });
    res.end(certificateSvg(c));
  });
  r.get('/api/sessions/:id/certificates', (req, res, params) => {
    const { session: s } = requireSession(req, sessionId(params));
    const list = sessionCertificates(s).map((c) => ({
      participantId: c.participantId, name: c.name, email: c.email, score: c.score, correct: c.correct,
      questionCount: c.questionCount, rank: c.rank, participants: c.participants, filename: c.filename,
    }));
    sendJson(res, 200, { session: { id: s.id, title: s.title, date: s.date, module: s.module, status: s.status }, certificates: list });
  });
  r.get('/api/sessions/:id/certificates.zip', (req, res, params) => {
    const { session: s } = requireSession(req, sessionId(params));
    const files = sessionCertificates(s).map((c) => ({ name: c.filename, data: certificateSvg(c) }));
    const zip = zipStore(files);
    res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': zip.length, 'Content-Disposition': `attachment; filename="certificates-${slug(s.title) || s.id}.zip"` });
    res.end(zip);
  });

  r.get('/api/sessions/:id/state', (req, res, params) => {
    const id = sessionId(params);
    requireSession(req, id);
    sendJson(res, 200, { state: live.snapshot(id, { host: true }) });
  });

  r.get('/api/sessions/:id/events', (req, res, params) => {
    const id = sessionId(params);
    requireSession(req, id);
    const sse = openSse(req, res);
    sse.send('state', live.snapshot(id, { host: true }));
    const off = live.subscribe(id, (snap) => sse.send('state', snap), { host: true });
    req.on('close', () => { off(); sse.close(); });
  });

  r.get('/api/sessions/:id/deck', (req, res, params) => {
    const { session: s } = requireSession(req, sessionId(params));
    const deck = live.deckForSession(s);
    sendJson(res, 200, { deck: { key: deck.key, title: deck.title, synthetic: !!deck.synthetic, sections: deck.sections, slides: flattenDeck(deck) } });
  });

  r.get('/api/sessions/:id/results.csv', (req, res, params) => {
    const id = sessionId(params);
    requireSession(req, id);
    const { filename, csv } = live.resultsCsv(id);
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
    res.end(csv);
  });

  r.get('/api/sessions/:id/qr.svg', async (req, res, params) => {
    const { session: s } = requireSession(req, sessionId(params));
    const url = `${publicUrl}/join?code=${s.joinCode}`;
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f1626', light: '#fffdf9' } });
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(svg);
  });

  // ---- interns ------------------------------------------------------------
  r.get('/api/session-by-code', (req, res, params, url) => {
    const s = live.sessionByCode(url.searchParams.get('code'));
    if (!s) throw new HttpError(404, 'No session with that code');
    sendJson(res, 200, { session: { id: s.id, title: s.title, module: s.module, date: s.date, status: s.status, trainers: s.trainers } });
  });

  // Lets the join page greet a known intern by name before they tap Join.
  r.get('/api/roster/lookup', (req, res, params, url) => {
    const entry = live.rosterEntry(url.searchParams.get('email'));
    if (!entry) throw new HttpError(404, 'This email is not on the participant list');
    sendJson(res, 200, { name: entry.name });
  });

  r.post('/api/join', async (req, res) => {
    const b = await readBody(req);
    sendJson(res, 200, live.join(b.code, b.email));
  });

  r.get('/api/play/state', (req, res, params, url) => {
    const p = live.mustParticipant(participantToken(req, url));
    sendJson(res, 200, { state: live.snapshot(p.sessionId, { participantId: p.id }) });
  });

  r.get('/api/play/events', (req, res, params, url) => {
    const p = live.mustParticipant(participantToken(req, url));
    const sse = openSse(req, res);
    sse.send('state', live.snapshot(p.sessionId, { participantId: p.id }));
    const off = live.subscribe(p.sessionId, (snap) => sse.send('state', snap), { participantId: p.id });
    req.on('close', () => { off(); sse.close(); });
  });

  r.post('/api/play/answer', async (req, res, params, url) => {
    const b = await readBody(req);
    sendJson(res, 200, live.answer(participantToken(req, url), b.questionId, b.choice));
  });

  r.get('/api/play/certificate', (req, res, params, url) => {
    const p = live.mustParticipant(participantToken(req, url));
    sendJson(res, 200, { certificate: withFile(live.certificate(p.id)) });
  });

  r.get('/api/play/certificate.svg', (req, res, params, url) => {
    const p = live.mustParticipant(participantToken(req, url));
    const c = live.certificate(p.id);
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${certificateFilename(c)}"` });
    res.end(certificateSvg(c));
  });

  r.post('/api/play/rating', async (req, res, params, url) => {
    const b = await readBody(req);
    sendJson(res, 200, live.rate(participantToken(req, url), b.ratings, b.comment));
  });

  return r;
}
