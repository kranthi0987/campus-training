// Reads a PowerPoint file (.pptx) into the app's deck shape: sections, slides with a title,
// bullets, speaker notes and the pictures placed on the slide. No PowerPoint is needed, so it
// runs on the Linux host: a .pptx is a zip of XML parts, read here with node:zlib only.
import { inflateRawSync } from 'node:zlib';

// ---- zip ----------------------------------------------------------------------------------

/** All entries of a zip file as Map<name, Buffer> (stored and deflated entries; no zip64). */
export function readZip(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw new Error('Not a zip file');
  // End of central directory: search back from the end (a comment may follow it).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const out = new Map();
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error('Corrupt zip: bad central directory');
    const method = buf.readUInt16LE(at + 10);
    const csize = buf.readUInt32LE(at + 20);
    const usize = buf.readUInt32LE(at + 24);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen);
    at += 46 + nameLen + extraLen + commentLen;
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('Corrupt zip: bad local header');
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataAt, dataAt + csize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) {
      const data = inflateRawSync(raw);
      if (usize && data.length !== usize) throw new Error(`Corrupt zip: ${name} inflated to ${data.length} bytes, expected ${usize}`);
      out.set(name, data);
    } else throw new Error(`Unsupported zip compression (${method}) for ${name}`);
  }
  return out;
}

// ---- xml bits -----------------------------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function decodeXml(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(code) ? String.fromCodePoint(code) : m; }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const attr = (tag, name) => { const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag); return m ? decodeXml(m[1]) : null; };

/** Text of one <a:p> paragraph: runs joined, line breaks kept, fields (slide numbers, dates) skipped. */
function paragraphText(p) {
  let s = '';
  const re = /<a:(t|br|fld)\b([^>]*?)(\/>|>([\s\S]*?)<\/a:\1>)/g;
  let m;
  while ((m = re.exec(p))) {
    if (m[1] === 'br') s += '\n';
    else if (m[1] === 't') s += decodeXml(m[4] || '');
    // a:fld: a field such as the slide number; leave it out.
  }
  return s.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

const paragraphs = (xml) => [...xml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)].map((m) => paragraphText(m[1])).filter(Boolean);

/** Relationship id -> target part name, resolved against the part's folder. */
function readRels(zip, partName) {
  const dir = partName.slice(0, partName.lastIndexOf('/') + 1);
  const base = partName.slice(dir.length);
  const xml = zip.get(`${dir}_rels/${base}.rels`);
  const out = new Map();
  if (!xml) return out;
  for (const m of xml.toString('utf8').matchAll(/<Relationship\b[^>]*\/?>/g)) {
    const id = attr(m[0], 'Id'), target = attr(m[0], 'Target'), type = attr(m[0], 'Type') || '';
    if (!id || !target || /TargetMode="External"/.test(m[0])) continue;
    out.set(id, { target: resolvePath(dir, target), type: type.slice(type.lastIndexOf('/') + 1) });
  }
  return out;
}

function resolvePath(dir, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = (dir + target).split('/');
  const out = [];
  for (const p of parts) { if (p === '..') out.pop(); else if (p && p !== '.') out.push(p); }
  return out.join('/');
}

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' };
export const mimeOf = (name) => MIME[String(name).toLowerCase().split('.').pop()] || null;

// ---- deck ---------------------------------------------------------------------------------

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';

/**
 * A .pptx as { title, sections: [{ id, title, slides: [{ title, bullets, note, pictures }] }],
 * media: [{ name, mime, data }] }. `pictures` are media names; the media list holds each
 * browser-renderable picture once. `title` comes from docProps or the file name passed in.
 */
export function parsePptx(buf, { filename = 'Slides' } = {}) {
  let zip;
  try { zip = readZip(buf); } catch (e) { throw new Error(`Not a PowerPoint file: ${e.message}`); }
  const presXml = zip.get('ppt/presentation.xml')?.toString('utf8');
  if (!presXml) throw new Error('Not a PowerPoint file: ppt/presentation.xml is missing');
  const presRels = readRels(zip, 'ppt/presentation.xml');

  // Slide order, and which section each slide id belongs to.
  const slideIds = [...presXml.matchAll(/<p:sldId\b[^>]*\/?>/g)].map((m) => ({ id: attr(m[0], 'id'), rId: attr(m[0], 'r:id') }));
  const sectionOf = new Map();
  const sectionList = [];
  for (const sec of presXml.matchAll(/<p14:section\b([^>]*)>([\s\S]*?)<\/p14:section>/g)) {
    const name = attr(`<x ${sec[1]}>`, 'name') || `Section ${sectionList.length + 1}`;
    sectionList.push(name);
    for (const s of sec[2].matchAll(/<p14:sldId\b[^>]*\/?>/g)) sectionOf.set(attr(s[0], 'id'), name);
  }

  const media = new Map(); // media name -> { name, mime, data }
  const slides = [];
  for (const { id, rId } of slideIds) {
    const part = presRels.get(rId)?.target;
    const xml = part && zip.get(part)?.toString('utf8');
    if (!xml) continue;
    const rels = readRels(zip, part);
    const slide = readSlide(xml, slides.length + 1);

    // Speaker notes: the notes slide's body placeholder (its other shapes repeat the slide).
    const notesPart = [...rels.values()].find((r) => r.type === 'notesSlide')?.target;
    const notesXml = notesPart && zip.get(notesPart)?.toString('utf8');
    if (notesXml) {
      const body = shapes(notesXml).filter((sp) => placeholderType(sp) === 'body');
      slide.note = body.flatMap((sp) => paragraphs(sp)).join(' ').trim();
    }

    // Pictures: <p:pic> blips, resolved through the slide's relationships to ppt/media/*.
    const pictures = [];
    for (const pic of xml.matchAll(/<p:pic\b[\s\S]*?<\/p:pic>/g)) {
      const embed = /<a:blip\b[^>]*\sr:embed="([^"]+)"/.exec(pic[0])?.[1];
      const target = embed && rels.get(embed)?.target;
      if (!target) continue;
      const name = target.slice(target.lastIndexOf('/') + 1);
      const mime = mimeOf(name);
      const data = zip.get(target);
      if (!mime || !data) continue; // emf/wmf/tiff: browsers cannot show them
      if (!media.has(name)) media.set(name, { name, mime, data });
      if (!pictures.includes(name)) pictures.push(name);
    }
    slide.pictures = pictures;
    slide.section = sectionOf.get(id) || null;
    slides.push(slide);
  }
  if (!slides.length) throw new Error('The PowerPoint file has no slides');

  // Sections: PowerPoint's own when the deck has them, otherwise one section for the whole deck.
  const deckTitle = docTitle(zip) || filename.replace(/\.pptx$/i, '').trim() || 'Slides';
  const sections = [];
  const ids = new Set();
  for (const sl of slides) {
    const name = sl.section || (sectionList.length ? 'Slides' : deckTitle);
    let sec = sections[sections.length - 1];
    if (!sec || sec.title !== name) {
      let id = slug(name);
      for (let n = 2; ids.has(id); n++) id = `${slug(name)}-${n}`;
      ids.add(id);
      sec = { id, title: name, slides: [] };
      sections.push(sec);
    }
    const { section, ...rest } = sl;
    sec.slides.push(rest);
  }
  return { title: deckTitle, sections, media: [...media.values()] };
}

/** <p:sp> shapes (also inside groups), in document order. */
const shapes = (xml) => [...xml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)].map((m) => m[0]);
const placeholderType = (sp) => { const m = /<p:ph\b([^>]*)\/?>/.exec(sp); return m ? (attr(`<x ${m[1]}>`, 'type') || 'body') : null; };

function readSlide(xml, number) {
  let title = '';
  const bullets = [];
  const spTree = /<p:spTree\b[\s\S]*<\/p:spTree>/.exec(xml)?.[0] || xml;
  // Shapes and tables in document order; slide numbers, dates and footers are chrome, not content.
  for (const m of spTree.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>|<a:tbl\b[\s\S]*?<\/a:tbl>/g)) {
    const node = m[0];
    if (node.startsWith('<a:tbl')) {
      for (const row of node.matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g)) {
        const cells = [...row[0].matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g)].map((c) => paragraphs(c[0]).join(' ')).filter(Boolean);
        if (cells.length) bullets.push(cells.join(' | '));
      }
      continue;
    }
    const ph = placeholderType(node);
    if (ph === 'sldNum' || ph === 'dt' || ph === 'ftr') continue;
    const texts = paragraphs(node);
    if (!texts.length) continue;
    if (!title && (ph === 'title' || ph === 'ctrTitle')) { title = texts.join(' '); continue; }
    bullets.push(...texts);
  }
  if (!title && bullets.length) title = bullets.shift();
  if (!title) title = `Slide ${number}`;
  return { title: title.replace(/\s*\n\s*/g, ' ').slice(0, 200), bullets: bullets.map((b) => b.slice(0, 600)), note: '' };
}

function docTitle(zip) {
  const core = zip.get('docProps/core.xml')?.toString('utf8');
  const m = core && /<dc:title>([\s\S]*?)<\/dc:title>/.exec(core);
  return m ? decodeXml(m[1]).trim() : '';
}
