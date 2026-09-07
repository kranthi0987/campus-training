# Slides upload and session ownership

Date: 2026-09-07. Status: approved in chat and implemented (uncommitted).

## Goal

1. A trainer uploads a PowerPoint (.pptx) or a PDF for a session and it becomes the deck the
   Present screen shows, without anyone editing code or running the PowerShell export.
2. Trainers own the sessions they create: they add co-trainers, upload slides and delete the
   session. Admins keep full access. The seeded schedule sessions stay admin-managed.

## Constraints

- Render free tier: Linux, no PowerPoint or LibreOffice, ephemeral disk. Everything uploaded
  goes into Postgres (free plan, 1 GB) so it survives deploys.
- No new npm dependencies: the .pptx is read with a small zip reader beside `server/zip.js`
  and regex-level XML extraction; PDFs are rendered in the browser with pdf.js from cdnjs.

## Storage

```
session_decks (session_id PK, kind 'pptx'|'pdf', filename, size, pages, deck JSON,
               file BYTEA (pdf only), uploaded_by, uploaded_at)
deck_media    (session_id, name, mime, data BYTEA, PK(session_id, name))   -- pictures from a .pptx
sessions.owner_email TEXT                                                   -- creator; NULL = seeded
```

`deck` is the app's own deck shape (`sections[].slides[]` with `title`, `bullets`, `note`) so the
existing engine (bullet builds, notes, checkpoints, agenda) runs unchanged. A .pptx slide also
carries `pictures: [media names]`; a PDF page carries `pdfPage: n` and `build: false`.

## Server

- `server/pptx.js`: `readZip(buffer)` (stored + deflate entries) and `parsePptx(buffer)` ->
  `{ title, sections, media }`. Slide order from `presentation.xml`; sections from its
  `p14:sectionLst` when present, else one section. Per slide: title placeholder (else first
  paragraph), body paragraphs as bullets (tables as one bullet per row), speaker notes from the
  notes slide, browser-renderable pictures (png, jpg, gif, webp, svg, bmp) via the slide's rels.
- `server/pdf.js`: `countPages(buffer)` by scanning `/Type /Page` objects; the browser count
  from pdf.js takes precedence when the upload sends it.
- Routes (all behind the usual `requireSession` check):
  - `POST   /api/sessions/:id/deck` raw body (40 MB cap), `X-Filename`, optional `X-Pages`.
    Refused while the quiz is live. Replaces any earlier upload, clears checkpoints and the slide
    position, broadcasts.
  - `PUT    /api/sessions/:id/deck/titles` `{ titles: [] }` names PDF pages for the side nav.
  - `DELETE /api/sessions/:id/deck` back to the seeded deck or the content page.
  - `GET    /api/sessions/:id/deck/file` the PDF; `GET .../deck/media/:name` a picture. These two
    also accept a participant token (`?token=`) of the same session, because interns' phones
    mirror the current slide.
- `Live` caches the uploaded deck per session (snapshots call `deckForSession` on every
  broadcast); upload and delete invalidate it. `deckForSession` prefers the upload, then the
  seeded deck, then the synthetic content page.
- Ownership: `owner_email` set on create. `sessionAllows` also admits the owner. Admin or owner
  may set `trainerEmails`, delete the session (`DELETE /api/sessions/:id`, 409 while live), and
  see `canManage: true` on session summaries. `GET /api/trainers/directory` gives any signed-in
  trainer the name+email list for the co-trainer picker.

## Client

- Trainer session page: a Slides card showing the current source (upload, seeded deck or none),
  a file input for .pptx/.pdf, Upload and Remove. For a PDF the page loads pdf.js to count pages
  and pull each page's first text line as its title. The header gains Delete session for owners
  and admins. The co-trainer picker shows for admins and owners.
- Present page: `pictures` render beside the bullets; `pdfPage` renders into a canvas with pdf.js
  (lazy-loaded), sized to the slide area and cached so state updates do not blink. The phone
  page does the same at phone width, fetching with its participant token.

## Tests

`tests/uploads.test.js`: parse a real deck from `ppts/`, upload it, check slides, notes,
pictures and media route; upload a PDF, check page count and titles; remove restores the seeded
deck; ownership: owner and admin can delete and assign, another trainer cannot; a live session
refuses upload and delete.
