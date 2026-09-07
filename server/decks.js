// Uploaded slide decks: a .pptx or a PDF a trainer attaches to a session. Everything lives in
// Postgres (the host's disk is wiped on every deploy): the deck in the app's own shape, the
// PDF bytes, and the pictures pulled out of a .pptx.
import { parsePptx, mimeOf } from './pptx.js';

export const MAX_UPLOAD = 40 * 1024 * 1024;
export const KINDS = ['pptx', 'pdf'];

/** Reads the whole request body as a Buffer, refusing anything over `limit`. */
export function readRaw(req, limit = MAX_UPLOAD) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error(`File too large: the limit is ${Math.round(limit / 1024 / 1024)} MB`), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** 'pptx' or 'pdf' from the file name, then the content type, then the first bytes; null otherwise. */
export function kindOf(filename, contentType, buf) {
  const ext = String(filename || '').toLowerCase().split('.').pop();
  if (ext === 'pptx') return 'pptx';
  if (ext === 'pdf') return 'pdf';
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('presentationml')) return 'pptx';
  if (ct.includes('application/pdf')) return 'pdf';
  if (buf && buf.length > 4) {
    if (buf.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
    if (buf[0] === 0x50 && buf[1] === 0x4b) return 'pptx';
  }
  return null;
}

/**
 * Page count of a PDF by counting page objects. Object streams hide those from a byte scan, so
 * the browser's count (pdf.js) is preferred when the upload carries one; this is the fallback.
 */
export function countPdfPages(buf) {
  const s = buf.toString('latin1');
  const n = (s.match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
  if (n) return n;
  // /Count on the page tree root, when the objects are packed away.
  let best = 0;
  for (const m of s.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g)) best = Math.max(best, Number(m[1]));
  for (const m of s.matchAll(/\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g)) best = Math.max(best, Number(m[1]));
  return best;
}

const cleanTitle = (t, i) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) || `Page ${i + 1}`;

/** The deck for a PDF: one page per slide, shown as a picture, no bullet build. */
export function pdfDeck(title, pages, titles = []) {
  return {
    title,
    sections: [{ id: 'pages', title, slides: Array.from({ length: pages }, (_, i) => ({ title: cleanTitle(titles[i], i), bullets: [], note: '', build: false, pdfPage: i + 1 })) }],
  };
}

/** A parsed .pptx as the deck to store: an agenda slide in front when it has real sections. */
export function pptxDeck(parsed) {
  const sections = parsed.sections.map((sec) => ({ id: sec.id, title: sec.title, slides: sec.slides.map((sl) => ({ title: sl.title, bullets: sl.bullets, note: sl.note, pictures: sl.pictures })) }));
  if (sections.length > 1 && !sections.some((s) => s.id === 'agenda')) {
    sections.unshift({
      id: 'agenda', title: 'Today',
      slides: [{
        title: 'What we cover today',
        bullets: sections.map((s) => s.title),
        agenda: sections.map((s) => ({ id: s.id, title: s.title, count: s.slides.length, first: s.slides.map((x) => x.title).slice(0, 3) })),
        note: 'Walk the agenda top to bottom, then start with the first section.',
      }],
    });
  }
  return { title: parsed.title, sections };
}

export class DeckStore {
  constructor(db) { this.db = db; }

  /** Summary for the trainer page (no bytes, no slides), or null when nothing is uploaded. */
  async info(sessionId) {
    const r = await this.db.get('SELECT kind, filename, size, pages, uploaded_by, uploaded_at FROM session_decks WHERE session_id = ?', sessionId);
    return r ? { kind: r.kind, filename: r.filename, size: r.size, pages: r.pages, uploadedBy: r.uploaded_by, uploadedAt: r.uploaded_at } : null;
  }

  /** The stored deck with media names turned into URLs, or null. */
  async deck(sessionId) {
    const r = await this.db.get('SELECT kind, filename, pages, deck, uploaded_at FROM session_decks WHERE session_id = ?', sessionId);
    if (!r) return null;
    const stored = JSON.parse(r.deck);
    const v = r.uploaded_at;
    return {
      key: `upload-${sessionId}`, title: stored.title, kind: r.kind, filename: r.filename, uploadedAt: v,
      file: r.kind === 'pdf' ? `/api/sessions/${sessionId}/deck/file?v=${v}` : null,
      sections: stored.sections.map((sec) => ({
        ...sec,
        slides: sec.slides.map((sl) => (sl.pictures?.length ? { ...sl, pictures: sl.pictures.map((n) => `/api/sessions/${sessionId}/deck/media/${encodeURIComponent(n)}?v=${v}`) } : sl)),
      })),
    };
  }

  /**
   * Stores an upload for the session, replacing any earlier one. Returns the summary.
   * `pages` (from the browser) and `titles` apply to PDFs only.
   */
  async put(sessionId, { buf, filename, contentType, uploadedBy = null, pages = 0, titles = [] }) {
    const kind = kindOf(filename, contentType, buf);
    if (!kind) throw Object.assign(new Error('Upload a PowerPoint (.pptx) or a PDF file'), { status: 400 });
    if (!buf?.length) throw Object.assign(new Error('The file is empty'), { status: 400 });
    const name = String(filename || (kind === 'pdf' ? 'slides.pdf' : 'slides.pptx')).replace(/[\\/]/g, ' ').trim().slice(0, 200);
    let deck, media = [], file = null, count;
    if (kind === 'pptx') {
      let parsed;
      try { parsed = parsePptx(buf, { filename: name }); } catch (e) { throw Object.assign(new Error(e.message), { status: 400 }); }
      deck = pptxDeck(parsed);
      media = parsed.media;
      count = parsed.sections.reduce((a, s) => a + s.slides.length, 0);
    } else {
      if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw Object.assign(new Error('Not a PDF file'), { status: 400 });
      count = Number(pages) > 0 ? Math.min(Number(pages) | 0, 2000) : countPdfPages(buf);
      if (!count) throw Object.assign(new Error('Could not count the pages of this PDF. Export it again from PowerPoint (File > Save As > PDF) and retry.'), { status: 400 });
      deck = pdfDeck(name.replace(/\.pdf$/i, ''), count, Array.isArray(titles) ? titles : []);
      file = buf;
    }
    const now = Date.now();
    await this.db.transaction(async (tx) => {
      await tx.run('DELETE FROM deck_media WHERE session_id = ?', sessionId);
      await tx.run('DELETE FROM session_decks WHERE session_id = ?', sessionId);
      await tx.run('INSERT INTO session_decks (session_id, kind, filename, size, pages, deck, file, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        sessionId, kind, name, buf.length, count, JSON.stringify(deck), file, uploadedBy, now);
      for (const m of media) await tx.run('INSERT INTO deck_media (session_id, name, mime, data) VALUES (?, ?, ?, ?)', sessionId, m.name, m.mime, m.data);
    });
    return this.info(sessionId);
  }

  /** Renames the pages of a PDF deck (the side nav shows them); ignored for a .pptx. */
  async setTitles(sessionId, titles) {
    const r = await this.db.get('SELECT kind, deck FROM session_decks WHERE session_id = ?', sessionId);
    if (!r) throw Object.assign(new Error('No uploaded slides for this session'), { status: 404 });
    if (r.kind !== 'pdf') return this.info(sessionId);
    const stored = JSON.parse(r.deck);
    const list = Array.isArray(titles) ? titles : [];
    stored.sections[0].slides.forEach((sl, i) => { sl.title = cleanTitle(list[i], i); });
    await this.db.run('UPDATE session_decks SET deck = ? WHERE session_id = ?', JSON.stringify(stored), sessionId);
    return this.info(sessionId);
  }

  async remove(sessionId) {
    await this.db.transaction(async (tx) => {
      await tx.run('DELETE FROM deck_media WHERE session_id = ?', sessionId);
      await tx.run('DELETE FROM session_decks WHERE session_id = ?', sessionId);
    });
  }

  async file(sessionId) {
    const r = await this.db.get('SELECT kind, filename, file, uploaded_at FROM session_decks WHERE session_id = ?', sessionId);
    return r && r.kind === 'pdf' && r.file ? { data: r.file, filename: r.filename, mime: 'application/pdf', version: r.uploaded_at } : null;
  }

  async media(sessionId, name) {
    const r = await this.db.get('SELECT mime, data FROM deck_media WHERE session_id = ? AND name = ?', sessionId, String(name || ''));
    return r ? { data: r.data, mime: r.mime || mimeOf(name) || 'application/octet-stream' } : null;
  }
}
