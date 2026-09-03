# Daily Quiz — design spec (2026-09-02)

## Purpose

A web app the trainer runs on their laptop during Ferguson Training. Interns open it on
their laptops or phones over the room Wi‑Fi, join the day's session, answer timed
questions, see a scoreboard, and rate the trainer. One route also lets the trainer
present slides (for now only the 17‑Sep Integration / AI module) and mirrors the
current slide to every joined device.

## Constraints

- Runs from one command on the trainer laptop: `npm install`, `npm start`. Node 24.
- Reachable on the LAN (binds 0.0.0.0; prints and QR‑encodes the LAN URL).
- Single dependency (`qrcode`); storage is Node's built‑in SQLite (`node:sqlite`).
- Works on phone browsers. No build step; plain ES modules in the browser.
- Visual language: the "Daily Quiz" design canvas (warm paper for trainer screens, deep
  ink with amber accent for projector and phone screens).

## Roles and routes

| Route | Who | Purpose |
|---|---|---|
| `/` and `/join?code=…` | intern | Enter code (prefilled from QR), name, email |
| `/play` | intern | Waiting room → live questions → result → final rank → trainer rating |
| `/trainer` | trainer | Sign in (email + password; default `Ferguson@2026`), session list from the schedule, session builder |
| `/host/:id` | trainer (projector) | Lobby with QR + code + joined list, live question with tally, final scoreboard with ratings |
| `/present/:id` | trainer (projector) | Slide deck for the session; arrow keys / buttons; current slide is broadcast |

Trainer auth: any email plus the default password signs in on first use (open trainer
sign‑up, suitable for a training room). A trainer may set their own password; it is
stored hashed (scrypt). Trainer sessions are cookie based.

## Scoring and timing (fixed)

- Correct answer = 100 points, wrong or no answer = 0.
- Every question has a complexity: easy, medium, hard. Each session has default seconds
  per complexity (20 / 40 / 60) and a question may override its seconds.
- Each session has a time limit in minutes (default 40). The clock starts with question 1;
  when it runs out the server ends the quiz and shows the scoreboard.

## Session lifecycle (server owned)

`draft → lobby → live → ended`, plus a `presenting` flag usable in `lobby` or `ended`.

- **lobby**: joins accepted; host shows QR, code, roster.
- **live**: server holds `currentIndex`, `questionEndsAt`, `questionClosed`. When the
  question's seconds expire the server closes it (answers rejected), reveals the correct
  option and per‑option tally, and waits for the trainer to press Next. After the last
  question, Next → `ended`.
- **ended**: interns see rank + points and a 1–5 star rating per trainer named on the
  session, with an optional comment. Host scoreboard shows averages once ratings exist.
- Trainer can reset a session to `draft` (clears participants, answers, ratings).

Live updates go trainer→server by POST and server→clients by Server‑Sent Events.
Clients compute remaining time from `questionEndsAt` (server timestamp) to survive
reconnects. Interns re‑join the same session by email; the participant token lives in
`localStorage`.

## Data

SQLite tables: `trainers`, `sessions`, `questions`, `participants`, `answers`,
`ratings`, `slides` are not a table (slide decks are code under `server/seed/slides`).
Sessions and questions are seeded from `server/seed/schedule.js` and
`server/seed/questions/*.js` on first run only; later edits live in the database.

Question bank per session: 24 questions (8 easy, 10 medium, 6 hard), four options,
one correct, short explanation shown after the question closes. The trainer can add,
edit, delete, and paste several questions at once (one block per question).

## Testing

`node --test` covers scoring, the session state machine (start, answer, close,
next, end, time‑limit end), the bulk‑question parser, and an HTTP smoke test that
signs in, opens a lobby, joins, starts, answers, and reads the scoreboard.
