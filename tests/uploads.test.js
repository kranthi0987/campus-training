// Uploaded slides (.pptx parsed into slides, PDF shown page by page) and session ownership:
// trainers own what they create, add co-trainers, replace slides and delete the session.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApp } from '../server/index.js';
import { parsePptx, readZip } from '../server/pptx.js';
import { countPdfPages, kindOf } from '../server/decks.js';
import { zipStore } from '../server/zip.js';

const SPRING = 'ppts/Srpingboot Backend Engineering.pptx';

/** A tiny valid PDF with `n` blank pages (objects written out, so the page count is scannable). */
function tinyPdf(n) {
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>'];
  const kids = Array.from({ length: n }, (_, i) => `${3 + i} 0 R`).join(' ');
  objs.push(`<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  for (let i = 0; i < n; i++) objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] >>');
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// ---- parsing, no server -----------------------------------------------------------------

test('readZip handles stored entries (our own writer) and deflated ones (PowerPoint)', () => {
  const stored = readZip(zipStore([{ name: 'a/b.txt', data: 'hello' }, { name: 'c.txt', data: Buffer.from([1, 2, 3]) }]));
  assert.equal(stored.get('a/b.txt').toString(), 'hello');
  assert.deepEqual([...stored.get('c.txt')], [1, 2, 3]);
  const real = readZip(readFileSync(SPRING));
  assert.ok(real.has('ppt/presentation.xml'));
  assert.ok(real.get('ppt/presentation.xml').toString('utf8').startsWith('<?xml'));
});

test('parsePptx reads titles, bullets, notes, pictures and keeps slide order', () => {
  const deck = parsePptx(readFileSync(SPRING), { filename: 'Springboot.pptx' });
  const flat = deck.sections.flatMap((s) => s.slides);
  assert.equal(flat.length, 27);
  assert.equal(deck.sections.length, 1, 'a single "Default Section" is not a real section');
  assert.equal(flat[0].title, 'Spring Boot');
  assert.equal(flat[1].title, 'Agenda');
  assert.ok(flat[1].bullets.some((b) => /ReST API Development/.test(b)));
  const withPic = flat.find((s) => s.title === 'Standard Web Application Architecture');
  assert.equal(withPic.pictures.length, 1);
  assert.ok(deck.media.some((m) => m.name === withPic.pictures[0] && m.mime.startsWith('image/') && m.data.length > 100));
  const withNote = flat.find((s) => s.title === 'Understanding Project Structure & Layer');
  assert.ok(withNote.note.length > 20, 'speaker notes are carried over');
  for (const sl of flat) { assert.ok(sl.title.trim()); assert.ok(Array.isArray(sl.bullets)); }
});

test('parsePptx builds slides from a hand-made file: placeholders, entities, notes, sections', () => {
  const x = (body) => `<?xml version="1.0"?>${body}`;
  const files = [
    { name: 'ppt/presentation.xml', data: x(`<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst>
      <p:extLst><p:ext><p14:sectionLst><p14:section name="Intro"><p14:sldIdLst><p14:sldId id="256"/></p14:sldIdLst></p14:section><p14:section name="Deep &amp; Wide"><p14:sldIdLst><p14:sldId id="257"/></p14:sldIdLst></p14:section></p14:sectionLst></p:ext></p:extLst></p:presentation>`) },
    { name: 'ppt/_rels/presentation.xml.rels', data: x(`<Relationships><Relationship Id="rId2" Type="http://x/slide" Target="slides/slide1.xml"/><Relationship Id="rId3" Type="http://x/slide" Target="slides/slide2.xml"/></Relationships>`) },
    { name: 'ppt/slides/slide1.xml', data: x(`<p:sld><p:cSld><p:spTree>
      <p:sp><p:nvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Tom &amp; Jerry</a:t></a:r></a:p></p:txBody></p:sp>
      <p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>First </a:t></a:r><a:r><a:t>point</a:t></a:r></a:p><a:p><a:endParaRPr/></a:p><a:p><a:r><a:t>Second</a:t></a:r><a:br/><a:r><a:t>line</a:t></a:r></a:p></p:txBody></p:sp>
      <p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:fld type="slidenum"><a:t>1</a:t></a:fld></a:p></p:txBody></p:sp>
      </p:spTree></p:cSld></p:sld>`) },
    { name: 'ppt/slides/_rels/slide1.xml.rels', data: x(`<Relationships><Relationship Id="rId1" Type="http://x/notesSlide" Target="../notesSlides/notesSlide1.xml"/></Relationships>`) },
    { name: 'ppt/notesSlides/notesSlide1.xml', data: x(`<p:notes><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr></p:sp><p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Say this.</a:t></a:r></a:p><a:p><a:r><a:t>Then that.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`) },
    { name: 'ppt/slides/slide2.xml', data: x(`<p:sld><p:cSld><p:spTree>
      <p:sp><p:txBody><a:p><a:r><a:t>No placeholder here</a:t></a:r></a:p><a:p><a:r><a:t>becomes a bullet</a:t></a:r></a:p></p:txBody></p:sp>
      <p:graphicFrame><a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>Col A</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>Col B</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></p:graphicFrame>
      <p:pic><p:blipFill><a:blip r:embed="rId5"/></p:blipFill></p:pic>
      <p:pic><p:blipFill><a:blip r:embed="rId6"/></p:blipFill></p:pic>
      </p:spTree></p:cSld></p:sld>`) },
    { name: 'ppt/slides/_rels/slide2.xml.rels', data: x(`<Relationships><Relationship Id="rId5" Type="http://x/image" Target="../media/image1.png"/><Relationship Id="rId6" Type="http://x/image" Target="../media/image2.emf"/></Relationships>`) },
    { name: 'ppt/media/image1.png', data: Buffer.from('89504e470d0a1a0a', 'hex') },
    { name: 'ppt/media/image2.emf', data: Buffer.from('0100', 'hex') },
    { name: 'docProps/core.xml', data: x(`<cp:coreProperties><dc:title>Hand made</dc:title></cp:coreProperties>`) },
  ];
  const deck = parsePptx(zipStore(files), { filename: 'x.pptx' });
  assert.equal(deck.title, 'Hand made');
  assert.deepEqual(deck.sections.map((s) => s.title), ['Intro', 'Deep & Wide']);
  const [a, b] = deck.sections.map((s) => s.slides[0]);
  assert.equal(a.title, 'Tom & Jerry');
  assert.deepEqual(a.bullets, ['First point', 'Second\nline'], 'runs join, empty paragraphs drop, slide numbers are skipped');
  assert.equal(a.note, 'Say this. Then that.');
  assert.equal(b.title, 'No placeholder here', 'first paragraph stands in for a missing title placeholder');
  assert.deepEqual(b.bullets, ['becomes a bullet', 'Col A | Col B']);
  assert.deepEqual(b.pictures, ['image1.png'], 'emf is not something a browser can show');
  assert.equal(deck.media.length, 1);
});

test('PDF page counting and file kind detection', () => {
  assert.equal(countPdfPages(tinyPdf(7)), 7);
  assert.equal(kindOf('Deck.PPTX', '', null), 'pptx');
  assert.equal(kindOf('deck.pdf', '', null), 'pdf');
  assert.equal(kindOf('', 'application/pdf', null), 'pdf');
  assert.equal(kindOf('', 'application/octet-stream', tinyPdf(1)), 'pdf');
  assert.equal(kindOf('', '', Buffer.from('PKrest')), 'pptx');
  assert.equal(kindOf('notes.txt', 'text/plain', Buffer.from('hello')), null);
});

// ---- through the API ----------------------------------------------------------------------

let app, base;
const cookies = {};
const call = async (path, { method = 'GET', body, as = 'admin', raw, headers: extra = {} } = {}) => {
  const headers = { ...extra };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (as && cookies[as]) headers.Cookie = cookies[as];
  const res = await fetch(base + path, { method, headers, body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body) });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : type.startsWith('text/') ? await res.text() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, res };
};
const login = async (as, email, password = 'Ferguson@2026') => {
  const r = await call('/api/trainer/login', { method: 'POST', body: { email, password, name: as }, as: null });
  if (r.status === 200) cookies[as] = r.res.headers.get('set-cookie').split(';')[0];
  return r;
};
const upload = (id, file, { as = 'owner', filename, headers = {} } = {}) => call(`/api/sessions/${id}/deck`, { method: 'POST', as, raw: file, headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(filename), ...headers } });

before(async () => {
  app = await createApp({ test: true, publicUrl: 'http://quiz.test' });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${app.server.address().port}`;
  assert.equal((await login('admin', 'admin@example.com')).status, 200);
  for (const [as, name] of [['owner', 'Olive Owner'], ['other', 'Otto Other'], ['co', 'Cora Co']]) {
    assert.equal((await call('/api/trainers', { method: 'POST', body: { email: `${as}@example.com`, name } })).status, 201);
    assert.equal((await login(as, `${as}@example.com`)).status, 200);
  }
});
after(async () => { await app.close(); });

let mine; // the session the owner creates

test('a trainer owns the session they create and only they (or an admin) see it', async () => {
  const made = await call('/api/sessions', { method: 'POST', as: 'owner', body: { title: 'Owner special', subtopics: 'A, B', trainerEmails: ['co@example.com'] } });
  assert.equal(made.status, 201);
  mine = made.data.session;
  assert.equal(mine.ownerEmail, 'owner@example.com');
  assert.equal(mine.canManage, true);
  assert.deepEqual(mine.trainerEmails, ['owner@example.com', 'co@example.com'], 'the owner is always on their own session, plus the co-trainer they picked');
  assert.equal(mine.slidesFrom, null);
  assert.equal(mine.upload, null);
  assert.equal((await call(`/api/sessions/${mine.id}`, { as: 'other' })).status, 403);
  const asCo = await call(`/api/sessions/${mine.id}`, { as: 'co' });
  assert.equal(asCo.status, 200);
  assert.equal(asCo.data.session.canManage, false, 'a co-trainer hosts but does not manage');
  assert.equal((await call(`/api/sessions/${mine.id}`, { as: 'admin' })).data.session.canManage, true);
  const listed = (await call('/api/sessions', { as: 'owner' })).data.sessions;
  assert.ok(listed.some((s) => s.id === mine.id && s.canManage === true && s.ownerEmail === 'owner@example.com'));
  const seeded = listed.find((s) => s.key === 'day11-spring-boot');
  assert.equal(seeded, undefined, 'seeded sessions are not the owner\'s');
});

test('the owner sets co-trainers; a co-trainer cannot', async () => {
  const dir = await call('/api/trainers/directory', { as: 'owner' });
  assert.equal(dir.status, 200);
  assert.ok(dir.data.trainers.some((t) => t.email === 'other@example.com' && t.name === 'Otto Other'));
  const put = await call(`/api/sessions/${mine.id}`, { method: 'PUT', as: 'owner', body: { trainerEmails: ['other@example.com'] } });
  assert.equal(put.status, 200);
  assert.deepEqual(put.data.session.trainerEmails, ['owner@example.com', 'other@example.com'], 'the owner cannot drop themselves');
  assert.equal((await call(`/api/sessions/${mine.id}`, { as: 'co' })).status, 403, 'co lost access');
  const sneaky = await call(`/api/sessions/${mine.id}`, { method: 'PUT', as: 'other', body: { trainerEmails: ['other@example.com'] } });
  assert.equal(sneaky.status, 200);
  assert.deepEqual(sneaky.data.session.trainerEmails, ['owner@example.com', 'other@example.com'], 'a non-owner\'s trainerEmails is ignored');
});

test('uploading a .pptx turns it into the session\'s slides, with pictures served from the database', async () => {
  const up = await upload(mine.id, readFileSync(SPRING), { filename: 'Srpingboot Backend Engineering.pptx' });
  assert.equal(up.status, 201, JSON.stringify(up.data));
  assert.equal(up.data.upload.kind, 'pptx');
  assert.equal(up.data.upload.pages, 27);
  assert.equal(up.data.upload.uploadedBy, 'owner@example.com');
  assert.equal(up.data.session.slidesFrom, 'upload');
  assert.equal(up.data.session.hasSlides, true);
  const deck = (await call(`/api/sessions/${mine.id}/deck`, { as: 'other' })).data.deck;
  assert.equal(deck.kind, 'pptx');
  assert.equal(deck.slides.length, 27);
  assert.equal(deck.slides[0].title, 'Spring Boot');
  const pic = deck.slides.find((s) => s.pictures?.length);
  assert.ok(pic, 'a slide carries a picture URL');
  assert.match(pic.pictures[0], new RegExp(`^/api/sessions/${mine.id}/deck/media/`));
  const img = await call(pic.pictures[0], { as: 'other' });
  assert.equal(img.status, 200);
  assert.match(img.res.headers.get('content-type'), /^image\//);
  assert.ok(img.data.length > 100);
  assert.equal((await call(pic.pictures[0], { as: 'co' })).status, 403, 'pictures are as private as the session');
  const { state } = (await call(`/api/sessions/${mine.id}/state`, { as: 'owner' })).data;
  assert.equal(state.deck.total, 27);
  assert.equal(state.deck.kind, 'pptx');

  // An intern's phone mirrors the slide, pictures included, using its participant token.
  assert.equal((await call(`/api/sessions/${mine.id}/lobby`, { method: 'POST', as: 'owner' })).status, 200);
  const joined = await call('/api/join', { method: 'POST', as: null, body: { code: mine.joinCode, email: 'anmol.joshi@ferguson.com' } });
  assert.equal(joined.status, 200, JSON.stringify(joined.data));
  const token = joined.data.token;
  assert.equal((await call(pic.pictures[0], { as: null })).status, 401);
  assert.equal((await call(`${pic.pictures[0]}&token=${encodeURIComponent(token)}`, { as: null })).status, 200);
  const other = (await call('/api/sessions')).data.sessions.find((x) => x.key === 'day09-python');
  assert.equal((await call(`/api/sessions/${other.id}/deck/media/x.png?token=${encodeURIComponent(token)}`, { as: null })).status, 401, 'a token only opens its own session');
  assert.equal((await call(`/api/sessions/${mine.id}/slide`, { method: 'POST', as: 'owner', body: { index: 5 } })).status, 200);
  const phone = (await call(`/api/play/state?token=${encodeURIComponent(token)}`, { as: null })).data;
  assert.equal(phone.state.slide.index, 5);
  assert.ok(Array.isArray(phone.state.slide.pictures));
  assert.equal(phone.state.deck.kind, 'pptx');
  assert.equal((await call(`/api/sessions/${mine.id}/slide`, { method: 'POST', as: 'owner', body: { index: null } })).status, 200);
});

test('checkpoints work on the uploaded deck and are cleared by the next upload', async () => {
  const q = await call(`/api/sessions/${mine.id}/questions`, { method: 'POST', as: 'owner', body: { text: 'Which one?', options: ['a', 'b', 'c', 'd'], answer: 0 } });
  assert.equal(q.status, 201, JSON.stringify(q.data));
  const qid = q.data.questions[0].id;
  const cp = await call(`/api/sessions/${mine.id}`, { method: 'PUT', as: 'owner', body: { checkpoints: { 3: [qid] } } });
  assert.equal(cp.status, 200, JSON.stringify(cp.data));
  assert.deepEqual(cp.data.session.checkpoints, { 3: [qid] });
  assert.equal((await call(`/api/sessions/${mine.id}/deck`, { as: 'owner' })).data.deck.slides[3].askAfter, 1);
  const bad = await call(`/api/sessions/${mine.id}`, { method: 'PUT', as: 'owner', body: { checkpoints: { 40: [qid] } } });
  assert.equal(bad.status, 400, 'slide 41 is past the 27 uploaded slides');

  const pdf = await upload(mine.id, tinyPdf(3), { filename: 'export.pdf' });
  assert.equal(pdf.status, 201, JSON.stringify(pdf.data));
  assert.equal(pdf.data.session.checkpoints, null);
  assert.equal(pdf.data.upload.kind, 'pdf');
  assert.equal(pdf.data.upload.pages, 3);
});

test('a PDF shows page by page; the browser may name the pages; the file streams back', async () => {
  let deck = (await call(`/api/sessions/${mine.id}/deck`, { as: 'owner' })).data.deck;
  assert.equal(deck.kind, 'pdf');
  assert.equal(deck.slides.length, 3);
  assert.deepEqual(deck.slides.map((s) => s.pdfPage), [1, 2, 3]);
  assert.ok(deck.slides.every((s) => s.build === false && s.bullets.length === 0));
  assert.equal(deck.slides[1].title, 'Page 2');
  assert.match(deck.file, new RegExp(`^/api/sessions/${mine.id}/deck/file`));
  const file = await call(deck.file, { as: 'owner' });
  assert.equal(file.status, 200);
  assert.equal(file.res.headers.get('content-type'), 'application/pdf');
  assert.equal(file.data.length, tinyPdf(3).length);
  const again = await fetch(base + deck.file, { headers: { Cookie: cookies.owner, 'If-None-Match': file.res.headers.get('etag') } });
  assert.equal(again.status, 304);

  const named = await call(`/api/sessions/${mine.id}/deck/titles`, { method: 'PUT', as: 'owner', body: { titles: ['Welcome', '  ', 'Wrap up'] } });
  assert.equal(named.status, 200);
  deck = (await call(`/api/sessions/${mine.id}/deck`, { as: 'owner' })).data.deck;
  assert.deepEqual(deck.slides.map((s) => s.title), ['Welcome', 'Page 2', 'Wrap up']);

  // The browser's page count wins over the byte scan, and page titles can ride along.
  const titled = await upload(mine.id, tinyPdf(2), { filename: 'two.pdf', headers: { 'X-Pages': '2', 'X-Page-Titles': Buffer.from(JSON.stringify(['One', 'Two'])).toString('base64') } });
  assert.equal(titled.status, 201);
  deck = (await call(`/api/sessions/${mine.id}/deck`, { as: 'owner' })).data.deck;
  assert.deepEqual(deck.slides.map((s) => s.title), ['One', 'Two']);
});

test('bad uploads are refused with a clear message', async () => {
  const txt = await upload(mine.id, Buffer.from('just text'), { filename: 'notes.txt' });
  assert.equal(txt.status, 400);
  assert.match(txt.data.error, /PowerPoint|PDF/);
  const fake = await upload(mine.id, Buffer.from('not really a zip'), { filename: 'deck.pptx' });
  assert.equal(fake.status, 400);
  assert.match(fake.data.error, /Not a PowerPoint file/);
  const empty = await upload(mine.id, Buffer.alloc(0), { filename: 'deck.pdf' });
  assert.equal(empty.status, 400);
  assert.equal((await upload(mine.id, tinyPdf(1), { filename: 'x.pdf', as: 'co' })).status, 403);
  assert.equal((await call(`/api/sessions/${mine.id}/deck`, { as: 'owner' })).data.deck.slides.length, 2, 'the last good upload stays');
});

test('removing the upload restores the seeded deck, or the content page when there is none', async () => {
  const gone = await call(`/api/sessions/${mine.id}/deck`, { method: 'DELETE', as: 'other' });
  assert.equal(gone.status, 200, 'any trainer on the session may change its slides');
  assert.equal(gone.data.session.slidesFrom, null);
  assert.equal(gone.data.session.upload, null);
  const deck = (await call(`/api/sessions/${mine.id}/deck`, { as: 'owner' })).data.deck;
  assert.equal(deck.synthetic, true);
  assert.equal(deck.kind, 'content');

  const seeded = (await call('/api/sessions')).data.sessions.find((s) => s.key === 'day11-spring-boot');
  assert.equal(seeded.slidesFrom, 'seed');
  assert.equal(seeded.ownerEmail, null);
  const up = await upload(seeded.id, tinyPdf(2), { filename: 'over.pdf', as: 'admin' });
  assert.equal(up.status, 201);
  assert.equal(up.data.session.slidesFrom, 'upload');
  assert.equal((await call(`/api/sessions/${seeded.id}/deck`)).data.deck.slides.length, 2, 'the upload replaces the seeded deck');
  const back = await call(`/api/sessions/${seeded.id}/deck`, { method: 'DELETE' });
  assert.equal(back.data.session.slidesFrom, 'seed');
  assert.equal((await call(`/api/sessions/${seeded.id}/deck`)).data.deck.slides.length, 27);
});

test('slides cannot change and the session cannot go while its quiz is running', async () => {
  assert.equal((await call(`/api/sessions/${mine.id}/lobby`, { method: 'POST', as: 'owner' })).status, 200);
  assert.equal((await call(`/api/sessions/${mine.id}/start`, { method: 'POST', as: 'owner' })).status, 200);
  assert.equal((await upload(mine.id, tinyPdf(1), { filename: 'x.pdf' })).status, 409);
  assert.equal((await call(`/api/sessions/${mine.id}/deck`, { method: 'DELETE', as: 'owner' })).status, 409);
  assert.equal((await call(`/api/sessions/${mine.id}`, { method: 'DELETE', as: 'owner' })).status, 409);
  assert.equal((await call(`/api/sessions/${mine.id}/end`, { method: 'POST', as: 'owner' })).status, 200);
});

test('only the owner or an admin deletes a session, and everything goes with it', async () => {
  assert.equal((await upload(mine.id, tinyPdf(1), { filename: 'x.pdf', as: 'owner' })).status, 201);
  assert.equal((await call(`/api/sessions/${mine.id}`, { method: 'DELETE', as: 'other' })).status, 403);
  assert.equal((await call(`/api/sessions/${mine.id}`, { method: 'DELETE', as: 'co' })).status, 403);
  const del = await call(`/api/sessions/${mine.id}`, { method: 'DELETE', as: 'owner' });
  assert.equal(del.status, 200);
  assert.equal((await call(`/api/sessions/${mine.id}`, { as: 'owner' })).status, 404);
  assert.equal((await app.db.get('SELECT COUNT(*) AS n FROM questions WHERE session_id = ?', mine.id)).n, 0);
  assert.equal((await app.db.get('SELECT COUNT(*) AS n FROM session_decks WHERE session_id = ?', mine.id)).n, 0);
  assert.equal((await app.db.get('SELECT COUNT(*) AS n FROM participants WHERE session_id = ?', mine.id)).n, 0);

  const theirs = (await call('/api/sessions', { method: 'POST', as: 'other', body: { title: 'Otto only' } })).data.session;
  assert.equal(theirs.ownerEmail, 'other@example.com');
  assert.equal((await call(`/api/sessions/${theirs.id}`, { method: 'DELETE', as: 'owner' })).status, 403);
  assert.equal((await call(`/api/sessions/${theirs.id}`, { method: 'DELETE', as: 'admin' })).status, 200);
});
