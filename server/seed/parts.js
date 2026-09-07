// A trainer's part of a day deck: the day's sections that belong to this trainer, with the
// exported pictures of the day deck (public/decks/<day key>/) shifted to start at the part's
// first slide. Used by the per-part files under server/seed/slides.
export function sliceDeck(full, { key, title, sections: ids, agenda = true, agendaNote = null }) {
  const keep = new Set(ids);
  let offset = -1, flat = 0, seen = 0;
  const sections = [];
  for (const sec of full.sections) {
    if (keep.has(sec.id)) {
      if (offset < 0) offset = flat;
      if (flat !== offset + seen) throw new Error(`${key}: sections must be consecutive in ${full.key} (${sec.id} is not)`);
      seen += sec.slides.length;
      sections.push({
        ...sec,
        // The day's agenda slide lists every section of the day; keep this part's only.
        slides: sec.slides.map((sl) => (Array.isArray(sl.agenda) ? { ...sl, agenda: sl.agenda.filter((a) => keep.has(a.id)), bullets: sl.agenda.filter((a) => keep.has(a.id)).map((a) => a.title) } : sl)),
      });
    }
    flat += sec.slides.length;
  }
  if (sections.length !== ids.length) throw new Error(`${key}: unknown section in ${ids.join(', ')}`);
  return { key, title, sections, pictures: { dir: full.key, offset }, agenda, agendaNote };
}
