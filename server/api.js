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

export async function createApi({ db, live, auth, decks, publicUrl }) {
  const r = new Router();

  const userOf = async (req) => {
    return await auth.trainerForToken(parseCookies(req)[COOKIE]);
  };
  const requireTrainer = async (req) => {
    const t = await userOf(req);
    if (!t) throw new HttpError(401, 'Sign in as a trainer');
    return t;
  };
  const requireAdmin = async (req) => {
    const t = await requireTrainer(req);
    if (t.role !== 'admin') throw new HttpError(403, 'Only an admin can do this');
    return t;
  };
  /** Signed in and allowed to open this session: admins always, trainers only for their own. */
  const requireSession = async (req, id) => {
    const user = await requireTrainer(req);
    const session = await live.mustSession(id);
    if (!sessionAllows(session, user)) throw new HttpError(403, 'This session is assigned to another trainer');
    return { user, session };
  };
  const requireParticipant = async (req, participantId) => {
    const p = (await db.get('SELECT * FROM participants WHERE id = ?', Number(participantId)));
    if (!p) throw new HttpError(404, 'Participant not found');
    return { ...(await requireSession(req, p.session_id)), participant: p };
  };
  const participantToken = (req, url) => req.headers['x-participant-token'] || url.searchParams.get('token') || '';
  const sessionId = (params) => {
    const id = Number(params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, 'Bad session id');
    return id;
  };
  /** Keeps only emails that belong to existing accounts. */
  const cleanEmails = async (list) => {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const e of list.map(normalizeEmail)) if (e && !out.includes(e) && await auth.get(e)) out.push(e);
    return out;
  };
  const sessionSummary = (row) => ({ ...rowToSession(row), questionCount: row.question_count, participantCount: row.participant_count, hasSlides: !!(row.slides_key && decks.has(row.slides_key)) });
  const allSessions = async () => (await db.all(`SELECT s.*, (SELECT COUNT(*) FROM questions q WHERE q.session_id = s.id) AS question_count,
            (SELECT COUNT(*) FROM participants p WHERE p.session_id = s.id) AS participant_count
       FROM sessions s ORDER BY s.date, s.day_no, s.id`,)).map(sessionSummary);

  // ---- info ---------------------------------------------------------------
  r.get('/api/info', async (req, res) => sendJson(res, 200, { publicUrl, setupNeeded: (await auth.count()) === 0 }));

  // ---- trainer auth -------------------------------------------------------
  r.post('/api/trainer/login', async (req, res) => {
    const body = await readBody(req);
    const trainer = await auth.login(body.email, body.password, String(body.name || '').trim().slice(0, 60));
    if (!trainer) throw new HttpError(401, await auth.count() === 0 ? 'Email or password is wrong' : 'Email or password is wrong. New here? Ask the admin to add you.');
    const token = await auth.issueToken(trainer.email);
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);
    sendJson(res, 200, { trainer: { email: trainer.email, name: trainer.name, role: trainer.role }, usingDefault: trainer.usingDefault });
  });

  r.post('/api/trainer/logout', async (req, res) => {
    await auth.revoke(parseCookies(req)[COOKIE]);
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
    sendJson(res, 200, { ok: true });
  });

  r.get('/api/trainer/me', async (req, res) => sendJson(res, 200, { trainer: await requireTrainer(req) }));

  r.post('/api/trainer/password', async (req, res) => {
    const t = await requireTrainer(req);
    const body = await readBody(req);
    if (!await auth.changePassword(t.email, body.current, body.next)) throw new HttpError(400, 'Current password is wrong or the new one is shorter than 8 characters');
    // A new password invalidates every existing token; keep this browser signed in with a fresh one.
    res.setHeader('Set-Cookie', `${COOKIE}=${await auth.issueToken(t.email)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);
    sendJson(res, 200, { ok: true });
  });

  // ---- trainer accounts (admin) -------------------------------------------
  const setSessionsFor = async (email, sessionIds) => {
    if (!Array.isArray(sessionIds)) return;
    const wanted = new Set(sessionIds.map(Number).filter(Number.isInteger));
    for (const row of await db.all('SELECT id, trainer_emails FROM sessions')) {
      const cur = JSON.parse(row.trainer_emails || '[]');
      const next = wanted.has(row.id) ? [...new Set([...cur, email])] : cur.filter((e) => e !== email);
      if (next.length !== cur.length) await db.run('UPDATE sessions SET trainer_emails = ? WHERE id = ?', JSON.stringify(next), row.id);
    }
  };
  const trainerList = async () => {
    const sessions = (await db.all('SELECT * FROM sessions ORDER BY date, day_no, id')).map(rowToSession);
    return (await auth.list()).map((t) => ({
      ...t,
      sessionIds: sessions.filter((s) => s.trainerEmails.includes(t.email)).map((s) => s.id),
      matchedSessionIds: t.role === 'admin' ? [] : sessions.filter((s) => !s.trainerEmails.includes(t.email) && sessionAllows(s, t)).map((s) => s.id),
    }));
  };

  r.get('/api/trainers', async (req, res) => { await requireAdmin(req); sendJson(res, 200, { trainers: await trainerList() }); });

  r.post('/api/trainers', async (req, res) => {
    await requireAdmin(req);
    const b = await readBody(req);
    const created = await auth.create({ email: b.email, name: b.name, role: b.role || 'trainer', password: b.password });
    await setSessionsFor(created.email, b.sessionIds);
    sendJson(res, 201, { trainer: (await trainerList()).find((t) => t.email === created.email), usingDefault: created.usingDefault });
  });

  r.put('/api/trainers/:email', async (req, res, params) => {
    const me = await requireAdmin(req);
    const b = await readBody(req);
    const email = normalizeEmail(params.email);
    if (email === me.email && b.role !== undefined && b.role !== 'admin') throw new HttpError(400, 'You cannot remove your own admin role');
    const updated = await auth.update(email, { name: b.name, role: b.role, password: b.password });
    await setSessionsFor(updated.email, b.sessionIds);
    sendJson(res, 200, { trainer: (await trainerList()).find((t) => t.email === updated.email) });
  });

  r.delete('/api/trainers/:email', async (req, res, params) => {
    const me = await requireAdmin(req);
    const email = normalizeEmail(params.email);
    if (email === me.email) throw new HttpError(400, 'You cannot remove your own account');
    const out = await auth.remove(email);
    await setSessionsFor(email, []);
    sendJson(res, 200, out);
  });

  // ---- sessions -----------------------------------------------------------
  r.get('/api/sessions', async (req, res) => {
    const user = await requireTrainer(req);
    sendJson(res, 200, { sessions: (await allSessions()).filter((s) => sessionAllows(s, user)) });
  });

  // ---- roster: everyone signed in may read it, only admins change it ------
  r.get('/api/roster', async (req, res) => { await requireTrainer(req); sendJson(res, 200, { roster: await live.roster() }); });
  r.post('/api/roster', async (req, res) => {
    await requireAdmin(req);
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
    sendJson(res, 200, { ...(await live.addToRoster(entries)), roster: await live.roster() });
  });
  r.delete('/api/roster', async (req, res, params, url) => {
    await requireAdmin(req);
    sendJson(res, 200, { ...(await live.removeFromRoster(url.searchParams.get('email'))), roster: await live.roster() });
  });

  r.post('/api/sessions', async (req, res) => {
    const user = await requireTrainer(req);
    const b = await readBody(req);
    const title = String(b.title || '').trim();
    if (!title) throw new HttpError(400, 'Title is required');
    const trainers = Array.isArray(b.trainers) ? b.trainers.map((t) => String(t).trim()).filter(Boolean) : [];
    // A trainer's own session is assigned to them; an admin picks the accounts.
    const trainerEmails = user.role === 'admin' ? await cleanEmails(b.trainerEmails) : [user.email];
    const { lastInsertRowid } = (await db.run('INSERT INTO sessions (day_no, date, module, title, subtopics, trainers, join_code, trainer_emails) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', b.dayNo ?? null, String(b.date || '').slice(0, 10) || null, String(b.module || '').trim() || null, title, String(b.subtopics || '').trim(), JSON.stringify(trainers), await uniqueJoinCode(db), JSON.stringify(trainerEmails)));
    sendJson(res, 201, { session: await live.session(Number(lastInsertRowid)) });
  });

  r.get('/api/sessions/:id', async (req, res, params) => {
    const id = sessionId(params);
    const { session: s } = await requireSession(req, id);
    sendJson(res, 200, { session: { ...s, hasSlides: !!(s.slidesKey && decks.has(s.slidesKey)) }, questions: await live.listQuestions(id) });
  });

  r.put('/api/sessions/:id', async (req, res, params) => {
    const id = sessionId(params);
    const { user, session: s } = await requireSession(req, id);
    const b = await readBody(req);
    const num = (v, lo, hi, cur) => {
      if (v === undefined) return cur;
      const n = Number(v);
      if (!Number.isInteger(n) || n < lo || n > hi) throw new HttpError(400, `Value ${v} must be between ${lo} and ${hi}`);
      return n;
    };
    const trainers = b.trainers === undefined ? s.trainers : (Array.isArray(b.trainers) ? b.trainers.map((t) => String(t).trim()).filter(Boolean) : s.trainers);
    const trainerEmails = user.role === 'admin' && b.trainerEmails !== undefined ? await cleanEmails(b.trainerEmails) : s.trainerEmails;
    const reveal = b.reveal === undefined ? s.reveal : String(b.reveal);
    if (!['end', 'each'].includes(reveal)) throw new HttpError(400, 'reveal must be "end" or "each"');
    // Quiz checkpoints: {"<slide index>": [question ids to ask after that slide]}; null returns to the deck's own.
    let checkpoints = s.checkpoints;
    if (b.checkpoints !== undefined) {
      if (b.checkpoints === null) checkpoints = null;
      else {
        if (typeof b.checkpoints !== 'object' || Array.isArray(b.checkpoints)) throw new HttpError(400, 'checkpoints must be an object of slide index to question ids, or null');
        const slides = flattenDeck(await live.deckForSession({ ...s, checkpoints: null })).length;
        const list = await live.listQuestions(id);
        const numberOf = new Map(list.map((q, i) => [q.id, i + 1]));
        const used = new Map();
        checkpoints = {};
        for (const [k, v] of Object.entries(b.checkpoints)) {
          const slide = Number(k);
          if (!Number.isInteger(slide) || slide < 0 || slide >= slides) throw new HttpError(400, `No slide ${k} in this deck (it has ${slides})`);
          if (!Array.isArray(v)) throw new HttpError(400, `Slide ${slide + 1}: expected a list of question ids`);
          const picks = [];
          for (const raw of v) {
            const qid = Number(raw);
            if (!numberOf.has(qid)) throw new HttpError(400, `Slide ${slide + 1}: question ${raw} is not in this session`);
            if (used.has(qid)) throw new HttpError(400, `Question ${numberOf.get(qid)} is listed for slide ${used.get(qid) + 1} and slide ${slide + 1}; a question can follow only one slide`);
            used.set(qid, slide);
            picks.push(qid);
          }
          if (picks.length) checkpoints[slide] = picks;
        }
      }
    }
    (await db.run(`UPDATE sessions SET title = ?, date = ?, module = ?, subtopics = ?, trainers = ?, trainer_emails = ?, time_limit_min = ?, easy_s = ?, medium_s = ?, hard_s = ?, reveal = ?, checkpoints = ? WHERE id = ?`, String(b.title ?? s.title).trim() || s.title, b.date === undefined ? s.date : String(b.date).slice(0, 10), b.module === undefined ? s.module : String(b.module).trim(),
      b.subtopics === undefined ? s.subtopics : String(b.subtopics).trim(), JSON.stringify(trainers), JSON.stringify(trainerEmails),
      num(b.timeLimitMin, 1, 600, s.timeLimitMin), num(b.easyS, 5, 600, s.easyS), num(b.mediumS, 5, 600, s.mediumS), num(b.hardS, 5, 600, s.hardS), reveal,
      checkpoints === null ? null : JSON.stringify(checkpoints), id,));
    await live.broadcast(id);
    sendJson(res, 200, { session: await live.session(id) });
  });

  r.post('/api/sessions/:id/code', async (req, res, params) => {
    const id = sessionId(params);
    await requireSession(req, id);
    (await db.run('UPDATE sessions SET join_code = ? WHERE id = ?', await uniqueJoinCode(db), id));
    await live.broadcast(id);
    sendJson(res, 200, { session: await live.session(id) });
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
  const nextPosition = async (id) => ((await db.get('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM questions WHERE session_id = ?', id)).p);

  r.post('/api/sessions/:id/questions', async (req, res, params) => {
    const id = sessionId(params);
    await requireSession(req, id);
    const q = cleanQuestion(await readBody(req));
    await insertQuestions(db, id, [q], await nextPosition(id));
    await live.broadcast(id);
    sendJson(res, 201, { questions: await live.listQuestions(id) });
  });

  r.post('/api/sessions/:id/questions/bulk', async (req, res, params) => {
    const id = sessionId(params);
    await requireSession(req, id);
    const { questions, errors } = parseBulk((await readBody(req)).text);
    if (errors.length) return sendJson(res, 400, { error: 'Some blocks could not be read', errors });
    await insertQuestions(db, id, questions, await nextPosition(id));
    await live.broadcast(id);
    sendJson(res, 201, { added: questions.length, questions: await live.listQuestions(id) });
  });

  r.post('/api/sessions/:id/questions/reorder', async (req, res, params) => {
    const id = sessionId(params);
    await requireSession(req, id);
    const ids = (await readBody(req)).ids;
    if (!Array.isArray(ids)) throw new HttpError(400, 'ids must be an array');
    await db.transaction(async (tx) => {
      for (const [i, qid] of ids.entries()) await tx.run('UPDATE questions SET position = ? WHERE id = ? AND session_id = ?', i, Number(qid), id);
    });
    sendJson(res, 200, { questions: await live.listQuestions(id) });
  });

  r.put('/api/questions/:id', async (req, res, params) => {
    const qid = Number(params.id);
    const row = (await db.get('SELECT * FROM questions WHERE id = ?', qid));
    if (!row) throw new HttpError(404, 'Question not found');
    await requireSession(req, row.session_id);
    const q = cleanQuestion(await readBody(req));
    (await db.run('UPDATE questions SET text = ?, options = ?, answer = ?, complexity = ?, seconds = ?, explanation = ?, code = ? WHERE id = ?', q.text, JSON.stringify(q.options), q.answer, q.complexity, q.seconds, q.explanation, q.code, qid));
    await live.broadcast(row.session_id);
    sendJson(res, 200, { question: rowToQuestion((await db.get('SELECT * FROM questions WHERE id = ?', qid))) });
  });

  r.delete('/api/questions/:id', async (req, res, params) => {
    const qid = Number(params.id);
    const row = (await db.get('SELECT * FROM questions WHERE id = ?', qid));
    if (!row) throw new HttpError(404, 'Question not found');
    const { session: s } = await requireSession(req, row.session_id);
    if (s.status === 'live') throw new HttpError(409, 'Cannot delete questions while the quiz is running');
    (await db.run('DELETE FROM questions WHERE id = ?', qid));
    (await db.run('DELETE FROM answers WHERE question_id = ?', qid));
    sendJson(res, 200, { questions: await live.listQuestions(row.session_id) });
  });

  // ---- lifecycle ----------------------------------------------------------
  const action = (name, fn) => r.post(`/api/sessions/:id/${name}`, async (req, res, params) => {
    const id = sessionId(params);
    await requireSession(req, id);
    const body = await readBody(req);
    sendJson(res, 200, { state: await fn(id, body) });
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
  r.get('/api/dashboard', async (req, res) => { await requireAdmin(req); sendJson(res, 200, await live.dashboard()); });
  r.delete('/api/participants/:id', async (req, res, params) => { await requireParticipant(req, params.id); sendJson(res, 200, await live.removeParticipant(params.id)); });
  r.delete('/api/interns', async (req, res, params, url) => { await requireAdmin(req); sendJson(res, 200, await live.removeIntern(url.searchParams.get('email'))); });
  r.post('/api/admin/clear-data', async (req, res) => {
    await requireAdmin(req);
    const b = await readBody(req);
    if (b.confirm !== 'CLEAR') throw new HttpError(400, 'Send { "confirm": "CLEAR" } to wipe all participant data');
    sendJson(res, 200, await live.clearAllData());
  });

  // ---- certificates (admin, or the session's trainer) ---------------------
  const withFile = (c) => ({ ...c, filename: certificateFilename(c) });
  const sessionCertificates = async (s) => {
    if (s.status !== 'ended') throw new HttpError(409, 'Certificates are issued when the session has finished');
    const out = [];
    for (const row of await live.scoreboard(s.id)) out.push(withFile(await live.certificate(row.id)));
    return out;
  };
  const slug = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  r.get('/api/participants/:id/certificate', async (req, res, params) => {
    await requireParticipant(req, params.id);
    sendJson(res, 200, { certificate: withFile(await live.certificate(params.id)) });
  });
  r.get('/api/participants/:id/certificate.svg', async (req, res, params) => {
    await requireParticipant(req, params.id);
    const c = await live.certificate(params.id);
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${certificateFilename(c)}"` });
    res.end(certificateSvg(c));
  });
  r.get('/api/sessions/:id/certificates', async (req, res, params) => {
    const { session: s } = await requireSession(req, sessionId(params));
    const list = (await sessionCertificates(s)).map((c) => ({
      participantId: c.participantId, name: c.name, email: c.email, score: c.score, correct: c.correct,
      questionCount: c.questionCount, rank: c.rank, participants: c.participants, filename: c.filename,
    }));
    sendJson(res, 200, { session: { id: s.id, title: s.title, date: s.date, module: s.module, status: s.status }, certificates: list });
  });
  r.get('/api/sessions/:id/certificates.zip', async (req, res, params) => {
    const { session: s } = await requireSession(req, sessionId(params));
    const files = (await sessionCertificates(s)).map((c) => ({ name: c.filename, data: certificateSvg(c) }));
    const zip = zipStore(files);
    res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': zip.length, 'Content-Disposition': `attachment; filename="certificates-${slug(s.title) || s.id}.zip"` });
    res.end(zip);
  });

  r.get('/api/sessions/:id/state', async (req, res, params) => {
    const id = sessionId(params);
    await requireSession(req, id);
    sendJson(res, 200, { state: await live.snapshot(id, { host: true }) });
  });

  r.get('/api/sessions/:id/events', async (req, res, params) => {
    const id = sessionId(params);
    await requireSession(req, id);
    const sse = openSse(req, res);
    sse.send('state', await live.snapshot(id, { host: true }));
    const off = live.subscribe(id, (snap) => sse.send('state', snap), { host: true });
    req.on('close', () => { off(); sse.close(); });
  });

  r.get('/api/sessions/:id/deck', async (req, res, params) => {
    const { session: s } = await requireSession(req, sessionId(params));
    const deck = await live.deckForSession(s);
    sendJson(res, 200, { deck: { key: deck.key, title: deck.title, synthetic: !!deck.synthetic, sections: deck.sections, slides: flattenDeck(deck) } });
  });

  r.get('/api/sessions/:id/results.csv', async (req, res, params) => {
    const id = sessionId(params);
    await requireSession(req, id);
    const { filename, csv } = await live.resultsCsv(id);
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
    res.end(csv);
  });

  r.get('/api/sessions/:id/qr.svg', async (req, res, params) => {
    const { session: s } = await requireSession(req, sessionId(params));
    const url = `${publicUrl}/join?code=${s.joinCode}`;
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f1626', light: '#fffdf9' } });
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(svg);
  });

  // ---- interns ------------------------------------------------------------
  r.get('/api/session-by-code', async (req, res, params, url) => {
    const s = await live.sessionByCode(url.searchParams.get('code'));
    if (!s) throw new HttpError(404, 'No session with that code');
    sendJson(res, 200, { session: { id: s.id, title: s.title, module: s.module, date: s.date, status: s.status, trainers: s.trainers } });
  });

  // Lets the join page greet a known intern by name before they tap Join.
  r.get('/api/roster/lookup', async (req, res, params, url) => {
    const entry = await live.rosterEntry(url.searchParams.get('email'));
    if (!entry) throw new HttpError(404, 'This email is not on the participant list');
    sendJson(res, 200, { name: entry.name });
  });

  r.post('/api/join', async (req, res) => {
    const b = await readBody(req);
    sendJson(res, 200, await live.join(b.code, b.email));
  });

  r.get('/api/play/state', async (req, res, params, url) => {
    const p = await live.mustParticipant(participantToken(req, url));
    sendJson(res, 200, { state: await live.snapshot(p.sessionId, { participantId: p.id }) });
  });

  r.get('/api/play/events', async (req, res, params, url) => {
    const p = await live.mustParticipant(participantToken(req, url));
    const sse = openSse(req, res);
    sse.send('state', await live.snapshot(p.sessionId, { participantId: p.id }));
    const off = live.subscribe(p.sessionId, (snap) => sse.send('state', snap), { participantId: p.id });
    req.on('close', () => { off(); sse.close(); });
  });

  r.post('/api/play/answer', async (req, res, params, url) => {
    const b = await readBody(req);
    sendJson(res, 200, await live.answer(participantToken(req, url), b.questionId, b.choice));
  });

  r.get('/api/play/certificate', async (req, res, params, url) => {
    const p = await live.mustParticipant(participantToken(req, url));
    sendJson(res, 200, { certificate: withFile(await live.certificate(p.id)) });
  });

  r.get('/api/play/certificate.svg', async (req, res, params, url) => {
    const p = await live.mustParticipant(participantToken(req, url));
    const c = await live.certificate(p.id);
    res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Content-Disposition': `attachment; filename="${certificateFilename(c)}"` });
    res.end(certificateSvg(c));
  });

  r.post('/api/play/rating', async (req, res, params, url) => {
    const b = await readBody(req);
    sendJson(res, 200, await live.rate(participantToken(req, url), b.ratings, b.comment));
  });

  return r;
}
