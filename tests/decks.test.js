// Every deck under server/seed/slides must line up with its exported pictures under
// public/decks/<key>/: the flat slide count equals the picture count, so slide N always
// shows picture N, and every scheduled slidesKey points at a deck that exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSlideDecks, slideImages } from '../server/seed/index.js';
import schedule from '../server/seed/schedule.js';

test('decks with exported pictures have one picture per slide', async () => {
  const decks = await loadSlideDecks();
  assert.ok(decks.size >= 1);
  for (const [key, deck] of decks) {
    const images = slideImages(key);
    if (!images.length) continue;
    const flat = deck.sections.flatMap((s) => s.slides);
    assert.equal(flat.length, images.length, `${key}: ${flat.length} slides vs ${images.length} pictures`);
    assert.ok(flat.every((sl) => sl.image && sl.build === false), `${key}: every slide shows its picture`);
    assert.ok(deck.sections.some((s) => s.id === 'agenda'), `${key}: deck brings its own agenda slide`);
    for (const sl of flat) {
      assert.ok(sl.title && sl.title.trim(), `${key}: slide without a title`);
      assert.ok(Array.isArray(sl.bullets), `${key}: "${sl.title}" has no bullets array`);
    }
  }
});

test('every scheduled slidesKey has a deck', async () => {
  const decks = await loadSlideDecks();
  for (const s of schedule) if (s.slidesKey) assert.ok(decks.has(s.slidesKey), `${s.key} -> ${s.slidesKey}`);
});

// Diagrams are drawn in the browser (public/diagrams.js), so the shape is checked here: a known
// type, and every node index a step or edge refers to exists.
const DIAGRAM_TYPES = new Set(['sequence', 'flow', 'log', 'token', 'timeline']);
test('every diagram in the seeded decks is well formed', async () => {
  const decks = await loadSlideDecks();
  let seen = 0;
  for (const [key, deck] of decks) {
    for (const sl of deck.sections.flatMap((s) => s.slides)) {
      const d = sl.diagram;
      if (!d) continue;
      seen++;
      const where = `${key}: "${sl.title}"`;
      assert.ok(DIAGRAM_TYPES.has(d.type), `${where}: unknown diagram type ${d.type}`);
      if (d.type === 'sequence' || d.type === 'flow') {
        assert.ok(Array.isArray(d.nodes) && d.nodes.length >= 2 && d.nodes.every((n) => n.label), `${where}: nodes`);
        const refs = d.type === 'sequence' ? d.steps : (d.edges || []);
        assert.ok(refs.length >= 1, `${where}: no steps`);
        for (const r of refs) assert.ok(Number.isInteger(r.from) && Number.isInteger(r.to) && d.nodes[r.from] && d.nodes[r.to], `${where}: step points outside the nodes`);
      }
      if (d.type === 'log') {
        assert.ok(d.partitions.length >= 1 && d.partitions.every((p) => p.label && p.records.length >= 1), `${where}: partitions`);
        if (d.cursor) assert.ok(d.partitions[d.cursor.partition], `${where}: cursor partition`);
      }
      if (d.type === 'token') assert.ok(d.parts.length >= 2 && d.parts.every((p) => p.label && p.raw && p.lines.length), `${where}: parts`);
      if (d.type === 'timeline') assert.ok(d.items.length >= 2 && d.items.every((it) => it.when && it.title), `${where}: items`);
    }
  }
  assert.ok(seen >= 10, `expected the day-18 diagrams, saw ${seen}`);
});

test('the integration part opens with the trainer and closes with the wrap-up', async () => {
  const decks = await loadSlideDecks();
  const deck = decks.get('day18-integration');
  const ids = deck.sections.map((s) => s.id);
  assert.deepEqual(ids, ['agenda', 'about', 'big-picture', 'rest', 'soap', 'apigee', 'kafka', 'oauth-jwt', 'wrap']);
  const flat = deck.sections.flatMap((s) => s.slides);
  assert.match(flat[1].title, /Kranthi Kumar/);
  assert.equal(flat[1].diagram?.type, 'timeline');
  assert.equal(flat[flat.length - 1].diagram?.type, 'flow', 'the closing slide shows the order journey again');
  const types = new Set(flat.map((sl) => sl.diagram?.type).filter(Boolean));
  assert.deepEqual([...types].sort(), ['flow', 'log', 'sequence', 'timeline', 'token']);
});
