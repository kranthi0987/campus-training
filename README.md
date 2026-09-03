# Daily Quiz — Ferguson Training

A quiz the trainer hosts from their laptop. Interns join from their own laptop or phone over
the room Wi‑Fi, answer timed questions, see the scoreboard, and rate the trainer. One route
also lets the trainer present slides and mirrors the current slide to every intern's device.

## Run it

Requirements: Node 22.5 or newer (Node 24 recommended). Nothing else to install on the interns' side.

```bash
npm install
npm start
```

The console prints the address to share, for example:

```
  Interns join at:   http://192.168.0.184:3000
  Trainer sign-in:   http://192.168.0.184:3000/trainer   (first sign-in with the default password "Ferguson@2026" creates the admin)
```

Everyone must be on the same Wi‑Fi. If phones cannot open the page, allow Node through
Windows Firewall (private networks) or run once as administrator:

```powershell
netsh advfirewall firewall add rule name="Daily Quiz" dir=in action=allow protocol=TCP localport=3000
```

Optional environment variables: `PORT` (default 3000), `PUBLIC_URL` (the address encoded in
the QR code, if auto-detection picks the wrong network adapter), `DB_PATH` (default
`data/daily-quiz.sqlite`), `DEFAULT_TRAINER_PASSWORD` (default `Ferguson@2026`).

## Running a session

1. **Admin** opens `/trainer`. The very first sign-in with the default password creates
   the admin account. The admin adds everyone else on the *Trainers* page, choosing a role:
   **Admin** sees and manages everything (all sessions, participants, scorecards, trainer
   accounts, certificates); **Trainer** only sees the sessions assigned to them, either
   ticked on the Trainers page or matched by name against the session's trainer list.
   Everyone changes their password from the top bar.
2. Pick the day's session. The eight quiz sessions from the schedule (3 Sep to 17 Sep)
   are pre-loaded with 24–26 questions each. Review, edit, add, or paste several questions;
   set the session time limit and the default seconds per complexity (easy 20, medium 40,
   hard 60); a question can override its own seconds.
3. **Participants.** Only people on the participant list (`/trainer` → Participants) can
   join. Ten interns are pre-loaded from `server/seed/roster.js`; add more by pasting
   `Name, email` lines. Interns join with their email only; their name comes from the list.
4. **Content first, then quiz.** *Host* opens the projector screen with the QR code, join
   code and live roster. *Show content* (or *Present slides* on 17 Sep) walks through the
   modules covered; the last slide hands over to the quiz.
5. **Start quiz.** Each question runs on its own clock. By default nothing is revealed
   during the quiz, not even running scores; when a question closes the phones just
   confirm the answer was locked in. (Per session, *Show correct answers* can be switched
   to *After each question*.) The session clock ends the quiz automatically when the
   time limit runs out.
6. **Scoreboard and review.** Correct = 100 points, wrong = 0. At the end interns see
   their rank, every question with the correct answer and their own choice, and rate each
   trainer 1–5 stars. The host screen shows the podium, the table, ratings and an answer
   review with how many got each question right. *Export results* downloads a CSV.
   *Reset session* clears it to run again.
7. **Quiz checkpoints inside a presentation** (3 Sep, Python): the deck from
   "Tech Refresher – Python & Automation.pptx" is in `server/seed/slides/day09-python.js`
   and the 15 questions from "Python & Automation Quiz 1.docx" in
   `server/seed/questions/day09-python.js`. Slides 7–11 each carry `askAfter: 3`: when the
   trainer moves past the last point of such a slide, the projector switches to the next
   three questions (the interns' phones too), and after the third question *Back to slides*
   returns to the following slide. Questions are consumed in order, so the blocks are
   Q1–3, Q4–6, Q7–9, Q10–12 (Playwright) and Q13–15 (files). Any questions left over can be
   run from the host screen, and *Show scoreboard* ends the session. To load a changed
   bank into an existing database: stop the server and run
   `node scripts/reload-session.mjs day09-python`.
   The slides themselves are shown as pictures exported from the PowerPoint file
   (`public/decks/day09-python/slide-01.png` … `slide-16.png`, 1920×1080), so every image,
   layout and colour matches the original; the text in the deck file becomes the trainer's
   talking points under the picture. To refresh them after editing the .pptx, run
   `scripts/export-slides.ps1` (needs PowerPoint on the trainer laptop), which re-exports
   `slide-NN.png` files; any deck whose folder under `public/decks/<key>/` holds such files
   is shown the same way.
8. **Present** (17 Sep, Integration / AI): `/present/<session id>` opens on
   the agenda ("what we cover today"), then the deck with speaker notes. The right arrow
   reveals one point at a time, then moves to the next slide; the left arrow goes back;
   `A` shows every point on the current slide; `N` toggles notes; `F` toggles full screen
   (the sidebar disappears so the projector shows only the slide); `J` overlays the QR
   code and join code at any point, and the opening screen shows them beside the agenda.
   The host screen has the same `F` shortcut. Eight slides carry
   animated sequence diagrams (REST, SOAP, Apigee, Kafka, OAuth, Copilot, Gemini, prompting)
   that loop on the projector and on every intern's phone.
9. **Certificate.** Once the session has finished, each intern's phone offers *Get your
   certificate*: a printable page (print or save as PDF) and a downloadable image file with
   their name, session, points and rank. The *Certificates* page (`/trainer` →
   Certificates) lists every participant of a finished session with view/print, download,
   and a zip of all certificates; admins see every session there, trainers their own.
10. **Scorecards** (`/trainer` → Scorecards): *Daily* ranks everyone for one session (with
   who did not join), *Weekly* totals points per training week, *Overall* shows every
   session side by side with attendance and totals. CSV export covers all three. *Clear*
   deletes one intern's answers and ratings from every session (for example after a test
   run) and *Clear all test data* wipes all participants, answers and ratings and returns
   every session to draft, keeping the questions and the participant list. On the host
   lobby, the ✕ on a name removes just that person from the session.

**Branding.** The official Ferguson logo lives in `public/brand/logo.svg` (navy, for light
screens) and `public/brand/logo-light.svg` (white, for dark screens); swap the files to
update it everywhere, including certificates. The theme is Ferguson navy `#00446a` on
white and cool grey for trainer screens, and deep navy with a light-blue accent for
projector and phone screens. All colours are tokens at the top of `public/styles.css`.

Pasting several questions at once (one block per question, blank line between):

```
Q: Which HTTP method is idempotent?
A) POST
*B) PUT
C) PATCH
D) CONNECT
complexity: medium
time: 45
explanation: PUT replaces the whole resource, so repeating it has the same effect.
```

## Hosting on Render (free tier)

The repo carries a `render.yaml` Blueprint and a `.node-version` file, so Render needs
no manual configuration.

1. Push the repo to GitHub (or GitLab / Bitbucket).
2. In the Render dashboard choose **New → Blueprint**, pick the repo and click **Apply**.
   Render creates the web service `ferguson-training-quiz` on the free plan.
3. Open the service URL (`https://ferguson-training-quiz.onrender.com` or similar).
   Go to `/trainer`, sign in with any email and the default password: the first account
   becomes the admin. Interns join from the same URL; the QR code and join link on the
   host and present screens already point at it (`RENDER_EXTERNAL_URL` is picked up
   automatically, or set `PUBLIC_URL` for a custom domain).

Free-tier limits to plan around:

- **No persistent disk.** The instance disk is ephemeral, so every deploy or restart
  resets the database to the copy committed in `data/daily-quiz.sqlite` (trainer
  accounts and edited sessions survive; participants, answers and scores do not).
  Commit the file again after changing accounts or questions locally. Download certificates
  and check scorecards before the session ends. For durable data upgrade the service
  to a paid instance, attach a disk and set `DB_PATH` (see the comments in
  `render.yaml`).
- **Spin-down after 15 minutes idle.** The first request afterwards takes up to a
  minute. Open the host page a few minutes before the session starts.
- **750 free instance hours per workspace per month**, shared by all free services.

## Project layout

```
server/            Node server (no framework): http.js router, api.js routes, live.js session engine,
                   db.js SQLite schema, auth.js accounts + roles, access.js session scoping,
                   certificate.js + zip.js certificates, bulk.js paste parser
server/seed/       schedule.js sessions; questions/<key>.js banks; slides/<key>.js decks
public/            Pages: index (join), play, trainer, host, present + shared app.js / styles.css
tests/             node --test suites: engine, paste parser, HTTP end-to-end
scripts/           validate-questions.mjs checks every bank (count, mix, answer spread)
design/            The Claude Design canvas the screens are built from
docs/superpowers/  Design spec
```

Seeding runs only when the database is empty, so trainer edits persist. To reload the
banks from disk, stop the server and delete `data/daily-quiz.sqlite`.

```bash
npm test                    # engine, parser and HTTP tests
npm run validate:questions  # checks every question bank
```
