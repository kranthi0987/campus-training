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
