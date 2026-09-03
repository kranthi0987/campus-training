import { $, $$, api, html, raw, pill, toast, fmtDate } from '/app.js';

const app = $('#app');
let trainer = null;
let sessions = [];
let current = null;      // { session, questions }
let editing = null;      // question being edited (object) or null for new
let draft = null;        // editor form state

window.addEventListener('hashchange', route);
init();

async function init() {
  try { ({ trainer } = await api('/api/trainer/me')); } catch { trainer = null; }
  route();
}

async function route() {
  const hash = location.hash || '#/sessions';
  if (!trainer) return renderLogin();
  const m = hash.match(/^#\/session\/(\d+)/);
  if (m) return openSession(Number(m[1]));
  if (hash.startsWith('#/dashboard') && isAdmin()) return renderDashboard();
  if (hash.startsWith('#/participants') && isAdmin()) return renderParticipants();
  if (hash.startsWith('#/trainers') && isAdmin()) return renderTrainers();
  if (hash.startsWith('#/certificates')) return renderCertificates();
  return renderSessions();
}

const isAdmin = () => trainer?.role === 'admin';
function navLinks() {
  const links = [['#/sessions', 'Sessions', /^#\/(sessions|session\/)/]];
  if (isAdmin()) links.push(['#/participants', 'Participants', /^#\/participants/], ['#/dashboard', 'Scorecards', /^#\/dashboard/]);
  links.push(['#/certificates', 'Certificates', /^#\/certificates/]);
  if (isAdmin()) links.push(['#/trainers', 'Trainers', /^#\/trainers/]);
  return links;
}

// Trainer accounts (admin only) for the "who can host this session" pickers.
let accounts = null;
async function loadAccounts() {
  if (!isAdmin()) return [];
  if (!accounts) { try { ({ trainers: accounts } = await api('/api/trainers')); } catch { accounts = []; } }
  return accounts.filter((a) => a.role !== 'admin');
}
const pickedAccounts = () => $$('[data-acc]:checked').map((el) => el.dataset.acc);
function accountPicker(list, selected) {
  if (!isAdmin()) return '';
  if (!list.length) return html`<p class="tiny faint">No trainer accounts yet. Add them on the Trainers page to give a trainer access to this session.</p>`;
  return html`<div class="field"><label>Trainer accounts that can host this session</label>
    <div class="picklist">${list.map((a) => html`<label class="row small" style="gap: 8px; cursor: pointer;"><input type="checkbox" data-acc="${a.email}" ${selected.includes(a.email) ? 'checked' : ''}><span>${a.name}</span><span class="tiny muted">${a.email}</span></label>`)}</div>
    <span class="tiny faint">Admins see every session. A trainer also sees sessions whose trainer names include their own name.</span></div>`;
}

// ---------------------------------------------------------------- login
async function renderLogin() {
  let setupNeeded = false;
  try { ({ setupNeeded } = await api('/api/info')); } catch { /* optional */ }
  app.innerHTML = html`
    <div class="login">
      <aside class="side">
        <div class="stack" style="gap: 10px;"><img class="logo" src="/brand/logo-light.svg" alt="Ferguson" style="height: 24px;"><div class="eyebrow">Training</div></div>
        <div class="stack" style="gap: 28px;">
          <h1 style="font-size: 44px;">Host today's session in under a minute.</h1>
          <div class="stack" style="gap: 12px; color: #c9cfdc; font-size: 15px;">
            <div class="row">${raw(icon('clock'))}<span>Session time limit and a timer for every question</span></div>
            <div class="row">${raw(icon('levels'))}<span>Easy, medium and hard questions with their own clocks</span></div>
            <div class="row">${raw(icon('bars'))}<span>100 points per correct answer, live scoreboard at the end</span></div>
          </div>
        </div>
        <div class="tiny" style="color: var(--on-ink-faint);">Trainer access only. Interns join by QR code or session code.</div>
      </aside>
      <section class="form">
        <form class="card stack" id="loginForm" style="gap: 24px;">
          <div class="stack" style="gap: 4px;"><h1 style="font-size: 26px;">Trainer sign‑in</h1><p class="muted small">Use your work email.</p></div>
          <div class="stack" style="gap: 16px;">
            <div class="field"><label for="email">Email</label><input class="input" id="email" type="email" required autocomplete="username" placeholder="you@company.com"></div>
            <div class="field"><label for="password">Password</label><input class="input" id="password" type="password" required autocomplete="current-password"></div>
            ${setupNeeded ? html`<div class="field"><label for="tname">Your name</label><input class="input" id="tname" placeholder="Shown to interns"></div>` : ''}
          </div>
          <button class="btn primary lg block" type="submit">Sign in</button>
          <div class="wash row" style="gap: 10px; align-items: flex-start;">${raw(icon('info'))}<span>${setupNeeded ? html`No accounts yet. Sign in with the default password <strong class="mono" style="color: var(--text);">Ferguson@2026</strong> to create the admin account, then add trainers from the Trainers page.` : html`Accounts are created by the admin. Sign in with the password they gave you (usually <strong class="mono" style="color: var(--text);">Ferguson@2026</strong>) and change it from the top bar.`}</span></div>
        </form>
      </section>
    </div>`;
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const out = await api('/api/trainer/login', { method: 'POST', body: { email: $('#email').value, password: $('#password').value, name: $('#tname')?.value || '' } });
      trainer = out.trainer;
      if (out.usingDefault) toast('Signed in with the default password. Change it from the top bar when you can.', { ms: 5000 });
      location.hash = '#/sessions';
      route();
    } catch (err) { toast(err.message, { error: true }); }
  });
}

// ---------------------------------------------------------------- shell
function shell(content, { crumb = '' } = {}) {
  app.innerHTML = html`
    <header class="topbar">
      <div class="row" style="gap: 16px;">
        <a href="#/sessions" style="display: block;"><img class="logo" src="/brand/logo.svg" alt="Ferguson"></a>
        <span class="vsep"></span>
        <nav class="row" style="gap: 4px;">
          ${navLinks().map(([href, label, re]) => html`<a class="btn sm ${re.test(location.hash || '#/sessions') ? 'dark' : 'ghost'}" href="${href}">${label}</a>`)}
        </nav>
        ${crumb ? html`<span class="vsep"></span>${raw(crumb)}` : ''}
      </div>
      <div class="row">
        <span class="small muted">${trainer.name} · ${isAdmin() ? 'Admin' : 'Trainer'}</span>
        <button class="btn sm" id="pwBtn">Change password</button>
        <button class="btn sm ghost" id="outBtn">Sign out</button>
      </div>
    </header>
    <main class="page">${raw(content)}</main>`;
  $('#outBtn').addEventListener('click', async () => { await api('/api/trainer/logout', { method: 'POST' }); trainer = null; renderLogin(); });
  $('#pwBtn').addEventListener('click', changePassword);
}

function changePassword() {
  modal(html`<h2>Change password</h2>
    <form id="pwForm" class="stack" style="gap: 14px; margin-top: 16px;">
      <div class="field"><label>Current password</label><input class="input" id="pwCur" type="password" required autocomplete="current-password"></div>
      <div class="field"><label>New password (8+ characters)</label><input class="input" id="pwNew" type="password" required minlength="8" autocomplete="new-password"></div>
      <div class="row" style="justify-content: flex-end;"><button type="button" class="btn" data-close>Cancel</button><button class="btn dark" type="submit">Save</button></div>
    </form>`);
  $('#pwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('/api/trainer/password', { method: 'POST', body: { current: $('#pwCur').value, next: $('#pwNew').value } }); toast('Password updated'); closeModal(); }
    catch (err) { toast(err.message, { error: true }); }
  });
}

function modal(content) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.id = 'modal';
  bg.innerHTML = `<div class="card modal">${content}</div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-close]')) closeModal(); });
  document.body.appendChild(bg);
}
function closeModal() { $('#modal')?.remove(); }

// ---------------------------------------------------------------- sessions
async function renderSessions() {
  ({ sessions } = await api('/api/sessions'));
  const rows = sessions.map((s) => html`<tr>
      <td class="num muted">${s.dayNo ?? ''}</td>
      <td class="small">${fmtDate(s.date)}</td>
      <td><div class="tiny muted">${s.module || ''}</div><a class="display" href="#/session/${s.id}" style="color: inherit; text-decoration: none; font-weight: 700;">${s.title}</a></td>
      <td class="small muted">${s.trainers.join(' · ')}${isAdmin() && s.trainerEmails?.length ? html`<div class="tiny faint">${s.trainerEmails.join(', ')}</div>` : ''}</td>
      <td class="num">${s.questionCount}</td>
      <td><span class="pill ${s.status}">${statusLabel(s.status)}</span>${s.participantCount ? html` <span class="tiny muted">${s.participantCount} joined</span>` : ''}</td>
      <td><div class="row" style="gap: 6px; justify-content: flex-end;">
        <a class="btn sm" href="#/session/${s.id}">Questions</a>
        <a class="btn sm" href="/present/${s.id}" target="_blank" title="${s.hasSlides ? 'Slide deck with speaker notes' : 'Content page listing the modules covered'}">${s.hasSlides ? 'Present' : 'Content'}</a>
        <a class="btn sm dark" href="/host/${s.id}" target="_blank">Host</a>
      </div></td>
    </tr>`);
  shell(html`
    <div class="row between wrap" style="margin-bottom: 20px;">
      <div class="stack" style="gap: 4px;"><h1 style="font-size: 26px;">Sessions</h1><p class="muted small">${isAdmin() ? 'Every session on the training schedule.' : 'The sessions assigned to you.'} Open one to review its questions, then Host it on the projector.</p></div>
      <button class="btn" id="newSession">${raw(icon('plus'))} New session</button>
    </div>
    <div class="card" style="padding: 0; overflow: auto;">
      <table class="table sessions">
        <thead><tr><th class="num">Day</th><th>Date</th><th>Session</th><th>Trainers</th><th class="num">Questions</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.length ? rows : html`<tr><td colspan="7" class="muted small" style="padding: 24px;">${isAdmin() ? 'No sessions yet.' : 'No sessions are assigned to you yet. Ask the admin to add you to a session.'}</td></tr>`}</tbody>
      </table>
    </div>`);
  $('#newSession').addEventListener('click', newSession);
}

function statusLabel(s) { return { draft: 'Draft', lobby: 'Lobby open', live: 'Live', ended: 'Finished' }[s] || s; }

// ---------------------------------------------------------------- scorecards
let dashView = 'daily';
let dailySessionId = null;

async function renderDashboard() {
  const { sessions, interns, weeks } = await api('/api/dashboard');
  const run = sessions.filter((s) => s.participantCount > 0);
  const totalPoints = interns.reduce((a, i) => a + i.total, 0);
  const attendances = interns.reduce((a, i) => a + i.attended, 0);
  if (!dailySessionId || !sessions.some((s) => s.id === dailySessionId)) dailySessionId = (run[run.length - 1] || sessions[0])?.id ?? null;
  const cert = (r, s) => (r && s.status === 'ended' ? html`<a class="tiny" href="/api/participants/${r.participantId}/certificate.svg" title="Download certificate" style="text-decoration: none; margin-left: 6px;">🎓</a>` : '');

  let table;
  if (dashView === 'daily') {
    const s = sessions.find((x) => x.id === dailySessionId);
    const rows = interns.map((it) => ({ it, r: it.sessions[s?.id] })).sort((a, b) => (b.r?.score ?? -1) - (a.r?.score ?? -1) || a.it.name.localeCompare(b.it.name));
    let rank = 0, prev = null;
    rows.forEach((row, i) => { if (row.r) { if (row.r.score !== prev) { rank = i + 1; prev = row.r.score; } row.rank = rank; } });
    table = html`
      <div class="row between wrap" style="padding: 14px 16px; border-bottom: 1px solid var(--line-soft); gap: 12px;">
        <div class="row" style="gap: 10px;"><label for="daySel">Session</label><select class="input" id="daySel" style="height: 36px; width: auto; padding: 0 10px;">${sessions.map((x) => html`<option value="${x.id}" ${x.id === s?.id ? 'selected' : ''}>Day ${x.dayNo ?? '·'} · ${fmtDate(x.date)} · ${x.title}${x.participantCount ? ` (${x.participantCount} joined)` : ''}</option>`)}</select></div>
        <span class="small muted">${s ? `${s.questionCount} questions · ${s.participantCount} joined · average ${s.avgScore ?? '–'} pts` : ''}</span>
      </div>
      <table class="table">
        <thead><tr><th class="num">Rank</th><th>Intern</th><th>Email</th><th class="num">Correct</th><th class="num">Answered</th><th class="num">Points</th></tr></thead>
        <tbody>${rows.map(({ it, r, rank }) => html`<tr style="${r ? '' : 'opacity: 0.55;'}">
          <td class="num display" style="font-weight: 700; color: var(--faint);">${r ? rank : '–'}</td>
          <td style="font-weight: 600;">${it.name}${it.onRoster ? '' : html` <span class="pill neutral" title="Joined but not on the participant list">guest</span>`}</td><td class="small muted">${it.email}</td>
          <td class="num">${r ? `${r.correct} / ${s.questionCount}` : html`<span class="tiny faint">did not join</span>`}</td><td class="num">${r ? r.answered : ''}</td>
          <td class="num display" style="font-weight: 800;">${r ? r.score : ''}${cert(r, s)}</td>
        </tr>`)}</tbody>
      </table>`;
  } else if (dashView === 'weekly') {
    const byWeek = (it, w) => it.weeks[w] ?? null;
    const sessionsIn = (w) => sessions.filter((x) => (x.week || 'Unscheduled') === w);
    table = html`<table class="table">
        <thead><tr><th class="num">Rank</th><th>Intern</th><th>Email</th>${weeks.map((w) => html`<th class="num" title="${sessionsIn(w).map((x) => x.title).join(', ')}">${w}<div class="tiny" style="font-weight: 400; letter-spacing: 0; text-transform: none;">${sessionsIn(w).filter((x) => x.participantCount > 0).length} of ${sessionsIn(w).length} run</div></th>`)}<th class="num">Sessions</th><th class="num">Total</th></tr></thead>
        <tbody>${interns.map((it) => html`<tr>
          <td class="num display" style="font-weight: 700; color: var(--faint);">${it.attended ? it.rank : '–'}</td>
          <td style="font-weight: 600;">${it.name}</td><td class="small muted">${it.email}</td>
          ${weeks.map((w) => html`<td class="num">${byWeek(it, w) === null ? html`<span class="faint">–</span>` : html`<strong>${byWeek(it, w)}</strong>`}</td>`)}
          <td class="num">${it.attended}</td><td class="num display" style="font-weight: 800;">${it.total}</td>
        </tr>`)}</tbody>
        <tfoot><tr><td colspan="3" class="tiny muted">Week average per intern who attended</td>${weeks.map((w) => { const vals = interns.map((it) => byWeek(it, w)).filter((v) => v !== null); return html`<td class="num tiny muted">${vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : '–'}</td>`; })}<td colspan="2"></td></tr></tfoot>
      </table>`;
  } else {
    const cols = sessions;
    table = html`<table class="table">
        <thead><tr><th class="num">Rank</th><th>Intern</th><th>Email</th>${cols.map((s) => html`<th class="num" title="${s.title}">Day ${s.dayNo ?? '·'}<div class="tiny" style="font-weight: 400; letter-spacing: 0; text-transform: none;">${s.title.length > 16 ? s.title.slice(0, 15) + '…' : s.title}</div></th>`)}<th class="num">Sessions</th><th class="num">Total</th><th></th></tr></thead>
        <tbody>${interns.map((it) => html`<tr>
          <td class="num display" style="font-weight: 700; color: var(--faint);">${it.attended ? it.rank : '–'}</td>
          <td style="font-weight: 600;">${it.name}</td><td class="small muted">${it.email}</td>
          ${cols.map((s) => { const r = it.sessions[s.id]; return r ? html`<td class="num" title="${r.correct} correct of ${r.answered} answered"><strong>${r.score}</strong>${cert(r, s)}</td>` : html`<td class="num faint">–</td>`; })}
          <td class="num">${it.attended}</td><td class="num display" style="font-weight: 800;">${it.total}</td>
          <td><button class="btn sm ghost danger" data-remove-intern="${it.email}" data-name="${it.name}" title="Delete this intern's answers and ratings from every session">Clear</button></td>
        </tr>`)}</tbody>
        <tfoot><tr><td colspan="3" class="tiny muted">Average per session</td>${cols.map((s) => html`<td class="num tiny muted">${s.avgScore ?? '–'}</td>`)}<td colspan="3"></td></tr></tfoot>
      </table>`;
  }

  shell(html`
    <div class="row between wrap" style="margin-bottom: 20px; gap: 12px;">
      <div class="stack" style="gap: 4px;"><h1 style="font-size: 26px;">Scorecards</h1><p class="muted small">Progress and points for every participant, by day, by week, and overall.</p></div>
      <div class="row wrap" style="gap: 8px;">
        <div class="seg" style="width: 320px;">${[['daily', 'Daily'], ['weekly', 'Weekly'], ['overall', 'Overall']].map(([v, l]) => html`<button type="button" data-view="${v}" style="${dashView === v ? 'background: var(--brand); color: #fff;' : ''}">${l}</button>`)}</div>
        <button class="btn" id="csvBtn">Export CSV</button>
        <button class="btn danger" id="clearBtn">Clear all test data</button>
      </div>
    </div>
    <div class="grid-3" style="gap: 12px; margin-bottom: 20px;">
      <div class="card stack" style="gap: 2px;"><span class="eyebrow">Sessions run</span><span class="display" style="font-weight: 800; font-size: 28px;">${run.length} <span class="small muted" style="font-weight: 400;">of ${sessions.length}</span></span></div>
      <div class="card stack" style="gap: 2px;"><span class="eyebrow">Participants</span><span class="display" style="font-weight: 800; font-size: 28px;">${interns.length} <span class="small muted" style="font-weight: 400;">${interns.filter((i) => i.attended).length} have joined a session</span></span></div>
      <div class="card stack" style="gap: 2px;"><span class="eyebrow">Average points per session attended</span><span class="display" style="font-weight: 800; font-size: 28px;">${attendances ? Math.round(totalPoints / attendances) : 0}</span></div>
    </div>
    <div class="card" style="padding: 0; overflow: auto;">${table}</div>
    <p class="tiny faint" style="margin-top: 12px;">🎓 downloads that intern's certificate for a finished session. Clear (Overall view) deletes one intern's answers and ratings from every session, for example after a test run; the person stays on the participant list. To clear one session only, use Reset session on its host screen.</p>`);

  $$('[data-view]').forEach((b) => b.addEventListener('click', () => { dashView = b.dataset.view; renderDashboard(); }));
  $('#daySel')?.addEventListener('change', (e) => { dailySessionId = Number(e.target.value); renderDashboard(); });
  $$('[data-remove-intern]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`Clear ${b.dataset.name} (${b.dataset.removeIntern}) from every session? Their points and ratings will be deleted. They stay on the participant list.`)) return;
    try { await api(`/api/interns?email=${encodeURIComponent(b.dataset.removeIntern)}`, { method: 'DELETE' }); toast('Cleared'); renderDashboard(); }
    catch (e) { toast(e.message, { error: true }); }
  }));
  $('#clearBtn').addEventListener('click', async () => {
    const typed = prompt('This deletes every participant, answer and rating in every session and returns all sessions to draft. Questions are kept.\n\nType CLEAR to continue.');
    if (typed !== 'CLEAR') return;
    try { const out = await api('/api/admin/clear-data', { method: 'POST', body: { confirm: 'CLEAR' } }); toast(`Removed ${out.participantsRemoved} participants across ${out.sessionsReset} sessions`); renderDashboard(); }
    catch (e) { toast(e.message, { error: true }); }
  });
  $('#csvBtn').addEventListener('click', () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['rank', 'name', 'email', ...sessions.map((s) => `day${s.dayNo ?? ''}_${s.title}`), ...weeks, 'sessions_attended', 'total'];
    const lines = [head.map(esc).join(',')];
    for (const it of interns) lines.push([it.attended ? it.rank : '', it.name, it.email, ...sessions.map((s) => it.sessions[s.id]?.score ?? ''), ...weeks.map((w) => it.weeks[w] ?? ''), it.attended, it.total].map(esc).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'scorecards.csv'; a.click();
  });
}

// ---------------------------------------------------------------- participants
async function renderParticipants() {
  const [{ roster }, { interns }] = await Promise.all([api('/api/roster'), api('/api/dashboard')]);
  const stats = new Map(interns.map((i) => [i.email, i]));
  shell(html`
    <div class="row between wrap" style="margin-bottom: 20px; gap: 12px;">
      <div class="stack" style="gap: 4px;"><h1 style="font-size: 26px;">Participants</h1><p class="muted small">Only people on this list can join a session. They enter their email; the name shown on screens and certificates comes from here.</p></div>
      <button class="btn dark" id="addBtn">${raw(icon('plus'))} Add participants</button>
    </div>
    <div class="card" style="padding: 0; overflow: auto;">
      <table class="table">
        <thead><tr><th>Name</th><th>Email</th><th class="num">Sessions joined</th><th class="num">Total points</th><th></th></tr></thead>
        <tbody>${roster.length ? roster.map((r) => { const st = stats.get(r.email); return html`<tr>
          <td style="font-weight: 600;">${r.name}</td><td class="small muted">${r.email}</td>
          <td class="num">${st?.attended ?? 0}</td><td class="num display" style="font-weight: 800;">${st?.total ?? 0}</td>
          <td><button class="btn sm ghost danger" data-remove-roster="${r.email}" data-name="${r.name}">Remove</button></td>
        </tr>`; }) : html`<tr><td colspan="5" class="muted small" style="padding: 24px;">No participants yet. Add them to let interns join.</td></tr>`}</tbody>
      </table>
    </div>
    <p class="tiny faint" style="margin-top: 12px;">Removing someone stops them joining future sessions; their past results stay on the scorecards until cleared there.</p>`);

  $('#addBtn').addEventListener('click', () => {
    modal(html`<h2>Add participants</h2>
      <p class="small muted" style="margin-top: 6px;">One per line as <strong>Name, email</strong>. Tabs or spaces between the two also work, so you can paste straight from a spreadsheet.</p>
      <textarea class="input mono" id="rosterText" style="margin-top: 14px; min-height: 200px; font-size: 13px;" placeholder="Anmol Joshi, anmol.joshi@ferguson.com
Saifi Ali	saifi.ali@ferguson.com"></textarea>
      <div class="row" style="justify-content: flex-end; margin-top: 14px;"><button type="button" class="btn" data-close>Cancel</button><button class="btn dark" id="rosterGo">Add</button></div>`);
    $('#rosterGo').addEventListener('click', async () => {
      try { const out = await api('/api/roster', { method: 'POST', body: { text: $('#rosterText').value } }); closeModal(); toast(`Added ${out.added} participant${out.added === 1 ? '' : 's'}`); renderParticipants(); }
      catch (e) { toast(e.message, { error: true }); }
    });
  });
  $$('[data-remove-roster]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`Remove ${b.dataset.name} from the participant list?`)) return;
    try { await api(`/api/roster?email=${encodeURIComponent(b.dataset.removeRoster)}`, { method: 'DELETE' }); renderParticipants(); }
    catch (e) { toast(e.message, { error: true }); }
  }));
}

async function newSession() {
  const accountList = await loadAccounts();
  modal(html`<h2>New session</h2>
    <form id="nsForm" class="stack" style="gap: 14px; margin-top: 16px;">
      <div class="grid-2">
        <div class="field"><label>Title</label><input class="input" id="nsTitle" required placeholder="e.g. Python refresher"></div>
        <div class="field"><label>Module</label><input class="input" id="nsModule" placeholder="e.g. Programming"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Date</label><input class="input" id="nsDate" type="date"></div>
        <div class="field"><label>Trainers (comma separated)</label><input class="input" id="nsTrainers" placeholder="Name, Name"></div>
      </div>
      <div class="field"><label>Subtopics</label><input class="input" id="nsSub" placeholder="What the session covers"></div>
      ${accountPicker(accountList, [])}
      <div class="row" style="justify-content: flex-end;"><button type="button" class="btn" data-close>Cancel</button><button class="btn dark" type="submit">Create</button></div>
    </form>`);
  $('#nsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const { session } = await api('/api/sessions', { method: 'POST', body: { title: $('#nsTitle').value, module: $('#nsModule').value, date: $('#nsDate').value, trainers: $('#nsTrainers').value.split(',').map((t) => t.trim()).filter(Boolean), subtopics: $('#nsSub').value, trainerEmails: pickedAccounts() } });
      closeModal();
      location.hash = `#/session/${session.id}`;
    } catch (err) { toast(err.message, { error: true }); }
  });
}

// ---------------------------------------------------------------- builder
async function openSession(id) {
  try { current = await api(`/api/sessions/${id}`); }
  catch (err) { toast(err.message, { error: true }); location.hash = '#/sessions'; return; }
  editing = current.questions[0] || null;
  draft = editing ? fromQuestion(editing) : blankDraft();
  renderBuilder();
}

function blankDraft() { return { text: '', code: '', options: ['', '', '', ''], answer: -1, complexity: 'medium', seconds: '', explanation: '' }; }
function fromQuestion(q) { return { text: q.text, code: q.code || '', options: [...q.options], answer: q.answer, complexity: q.complexity, seconds: q.seconds ?? '', explanation: q.explanation || '' }; }

function renderBuilder() {
  const s = current.session, qs = current.questions;
  const totalSeconds = qs.reduce((a, q) => a + (q.seconds || { easy: s.easyS, medium: s.mediumS, hard: s.hardS }[q.complexity]), 0);
  const list = qs.map((q, i) => html`<div class="qrow ${editing?.id === q.id ? 'active' : ''}" data-id="${q.id}">
      <span class="num">${i + 1}</span><span class="t">${q.text}</span>${pill(q.complexity)}<span class="sec">${q.seconds || { easy: s.easyS, medium: s.mediumS, hard: s.hardS }[q.complexity]}s</span>
    </div>`);
  const d = draft;
  const editor = html`
    <div class="card stack" style="gap: 20px; padding: 28px;">
      <div class="row between">
        <div class="row" style="gap: 12px; align-items: baseline;"><h2 style="font-size: 22px; font-weight: 800;">${editing ? `Question ${qs.findIndex((q) => q.id === editing.id) + 1}` : 'New question'}</h2><span class="small muted">${editing ? '' : 'Added to the end of the list'}</span></div>
        ${editing ? html`<button class="btn sm ghost danger" id="delQ">${raw(icon('trash'))} Delete</button>` : ''}
      </div>
      <div class="field"><label>Question</label><textarea class="input" id="qText" style="font-size: 17px;">${d.text}</textarea></div>
      <div class="field"><label>Code shown under the question <span class="faint" style="font-weight: 400;">(optional, keeps indentation)</span></label><textarea class="input mono" id="qCode" style="font-size: 13px; min-height: 64px; white-space: pre;" spellcheck="false" placeholder="a = [1, 2, 3]&#10;print(a[-1])">${d.code}</textarea></div>
      <div class="stack" style="gap: 10px;">
        <div class="row between"><label>Answers</label><span class="tiny faint">Click the circle to mark the correct one</span></div>
        ${[0, 1, 2, 3].map((i) => html`<div class="optrow">
          <span class="radio ${d.answer === i ? 'on' : ''}" data-ans="${i}">${d.answer === i ? raw(icon('check')) : ''}</span>
          <span class="key">${'ABCD'[i]}</span>
          <input class="input" data-opt="${i}" value="${d.options[i]}" placeholder="Option ${'ABCD'[i]}" style="height: 44px;">
          ${d.answer === i ? html`<span class="tiny" style="color: var(--easy); font-weight: 700; white-space: nowrap;">Correct · 100 pts</span>` : ''}
        </div>`)}
      </div>
      <div class="grid-2" style="gap: 20px;">
        <div class="field"><label>Complexity</label>
          <div class="seg">${['easy', 'medium', 'hard'].map((c) => html`<button type="button" class="${c} ${d.complexity === c ? 'on' : ''}" data-cx="${c}">${c[0].toUpperCase() + c.slice(1)}</button>`)}</div>
        </div>
        <div class="field"><label>Time for this question</label>
          <div class="row"><input class="input" id="qSeconds" type="number" min="5" max="600" value="${d.seconds}" placeholder="${{ easy: s.easyS, medium: s.mediumS, hard: s.hardS }[d.complexity]}" style="width: 120px;"><span class="small muted">seconds · blank uses the ${d.complexity} default (${{ easy: s.easyS, medium: s.mediumS, hard: s.hardS }[d.complexity]}s)</span></div>
        </div>
      </div>
      <div class="field"><label>Explanation shown after the timer (optional)</label><input class="input" id="qExp" value="${d.explanation}" placeholder="One line on why the answer is right"></div>
      <div class="row between" style="padding-top: 16px; border-top: 1px solid var(--line-soft);">
        <span class="small muted">Changes apply to this session only.</span>
        <div class="row" style="gap: 10px;">
          <button class="btn" id="saveNext">Save and add next</button>
          <button class="btn dark" id="saveQ">${editing ? 'Save question' : 'Add question'}</button>
        </div>
      </div>
    </div>`;

  shell(html`
    <div class="row between wrap" style="margin-bottom: 20px; gap: 12px;">
      <div class="stack" style="gap: 2px;">
        <div class="row" style="gap: 10px;"><span class="small muted">${s.module || 'Session'} · ${fmtDate(s.date)}</span><span class="pill ${s.status}">${statusLabel(s.status)}</span></div>
        <h1 style="font-size: 24px;">${s.title}</h1>
        <div class="small muted">${s.trainers.join(' · ')}</div>
      </div>
      <div class="row wrap" style="gap: 8px;">
        <a class="btn" href="/present/${s.id}" target="_blank">${raw(icon('present'))} ${s.hasSlides ? 'Present slides' : 'Show content'}</a>
        <a class="btn primary" href="/host/${s.id}" target="_blank">${raw(icon('play'))} ${s.status === 'draft' ? 'Open lobby' : 'Open host screen'}</a>
      </div>
    </div>
    <div class="builder">
      <div class="stack" style="gap: 20px;">
        <div class="card stack" style="gap: 16px;">
          <div class="row between"><h3>Session settings</h3><button class="btn sm" id="editMeta">Edit details</button></div>
          <div class="grid-2">
            <div class="field"><label>Session time limit</label>
              <div class="row" style="border: 1px solid var(--input); border-radius: 8px; background: #fff; height: 44px; overflow: hidden; gap: 0;">
                <button class="btn ghost" data-limit="-5" style="height: 100%; border-radius: 0;">−</button>
                <div class="grow center display" style="font-weight: 700;"><span id="limitVal">${s.timeLimitMin}</span> min</div>
                <button class="btn ghost" data-limit="5" style="height: 100%; border-radius: 0;">+</button>
              </div>
            </div>
            <div class="field"><label>Join code</label>
              <div class="row between" style="border: 1px dashed var(--input); border-radius: 8px; background: var(--wash); height: 44px; padding: 0 12px;">
                <span class="display" style="font-weight: 800; font-size: 18px; letter-spacing: 0.12em;">${s.joinCode}</span>
                <button class="btn sm ghost" id="newCode" title="Generate a new code">${raw(icon('refresh'))}</button>
              </div>
            </div>
          </div>
          <div class="stack" style="gap: 8px;">
            <div class="row between"><label>Default time per question, by complexity</label><span class="tiny faint">seconds</span></div>
            <div class="grid-3">
              ${['easy', 'medium', 'hard'].map((c) => html`<div class="stack" style="gap: 6px; border: 1px solid var(--input); border-radius: 8px; background: #fff; padding: 8px 10px;">
                <span class="row tiny" style="gap: 6px; font-weight: 600;"><span class="dot ${c}"></span>${c[0].toUpperCase() + c.slice(1)}</span>
                <input class="input" data-default="${c}" type="number" min="5" max="600" value="${s[c + 'S']}" style="height: 32px; padding: 0 8px; font-weight: 700;">
              </div>`)}
            </div>
          </div>
          <div class="field"><label>Show correct answers</label>
            <div class="seg">
              <button type="button" class="${s.reveal === 'end' ? 'on end' : ''}" data-reveal="end" style="${s.reveal === 'end' ? 'background: var(--brand); color: #fff;' : ''}">At the end</button>
              <button type="button" class="${s.reveal === 'each' ? 'on' : ''}" data-reveal="each" style="${s.reveal === 'each' ? 'background: var(--brand); color: #fff;' : ''}">After each question</button>
            </div>
            <span class="tiny faint">${s.reveal === 'end' ? 'Nothing is revealed during the quiz, not even scores. Interns get a full answer review when it ends.' : 'The correct answer, tally and explanation show after every question.'}</span>
          </div>
          <div class="wash row" style="gap: 8px;">${raw(icon('info'))}<span>Scoring is fixed: 100 points for a correct answer, 0 for a wrong one.</span></div>
        </div>
        <div class="card" style="padding: 0; overflow: hidden;">
          <div class="row between wrap" style="padding: 14px 16px 10px; border-bottom: 1px solid var(--line-soft); gap: 8px;">
            <div class="row" style="gap: 8px; align-items: baseline;"><h3 style="white-space: nowrap;">Questions</h3><span class="tiny muted" style="white-space: nowrap;">${qs.length} · ~${Math.round(totalSeconds / 60)} min</span></div>
            <div class="row" style="gap: 6px;"><button class="btn sm" id="bulkBtn">Add several</button><button class="btn sm dark" id="addBtn">${raw(icon('plus'))} Add question</button></div>
          </div>
          <div class="qlist">${qs.length ? list : html`<p class="small muted" style="padding: 20px;">No questions yet. Add one on the right, or paste several at once.</p>`}</div>
        </div>
      </div>
      ${editor}
    </div>`);

  // settings
  $$('[data-limit]').forEach((b) => b.addEventListener('click', () => saveSettings({ timeLimitMin: Math.max(1, s.timeLimitMin + Number(b.dataset.limit)) })));
  $$('[data-default]').forEach((inp) => inp.addEventListener('change', () => saveSettings({ [inp.dataset.default + 'S']: Number(inp.value) })));
  $$('[data-reveal]').forEach((b) => b.addEventListener('click', () => saveSettings({ reveal: b.dataset.reveal })));
  $('#newCode').addEventListener('click', async () => { if (!confirm('Generate a new join code? Anyone using the old one will have to re-enter it.')) return; current.session = (await api(`/api/sessions/${s.id}/code`, { method: 'POST' })).session; renderBuilder(); });
  $('#editMeta').addEventListener('click', editMeta);
  // list
  $$('.qrow').forEach((row) => row.addEventListener('click', () => { editing = qs.find((q) => q.id === Number(row.dataset.id)); draft = fromQuestion(editing); renderBuilder(); }));
  $('#addBtn').addEventListener('click', () => { editing = null; draft = blankDraft(); renderBuilder(); $('#qText').focus(); });
  $('#bulkBtn').addEventListener('click', bulkAdd);
  // editor
  const readDraft = () => { draft = { ...draft, text: $('#qText').value, code: $('#qCode').value, options: [0, 1, 2, 3].map((i) => $(`[data-opt="${i}"]`).value), seconds: $('#qSeconds').value, explanation: $('#qExp').value }; };
  $$('[data-ans]').forEach((r) => r.addEventListener('click', () => { readDraft(); draft.answer = Number(r.dataset.ans); renderBuilder(); }));
  $$('[data-cx]').forEach((b) => b.addEventListener('click', () => { readDraft(); draft.complexity = b.dataset.cx; renderBuilder(); }));
  $('#saveQ').addEventListener('click', () => { readDraft(); saveQuestion(false); });
  $('#saveNext').addEventListener('click', () => { readDraft(); saveQuestion(true); });
  $('#delQ')?.addEventListener('click', async () => {
    if (!confirm('Delete this question?')) return;
    try { current.questions = (await api(`/api/questions/${editing.id}`, { method: 'DELETE' })).questions; editing = current.questions[0] || null; draft = editing ? fromQuestion(editing) : blankDraft(); renderBuilder(); }
    catch (err) { toast(err.message, { error: true }); }
  });
}

async function saveSettings(patch) {
  try { current.session = { ...current.session, ...(await api(`/api/sessions/${current.session.id}`, { method: 'PUT', body: patch })).session }; renderBuilder(); toast('Saved'); }
  catch (err) { toast(err.message, { error: true }); }
}

async function saveQuestion(thenNew) {
  const body = { ...draft, seconds: draft.seconds === '' ? null : Number(draft.seconds) };
  try {
    if (editing) {
      const { question } = await api(`/api/questions/${editing.id}`, { method: 'PUT', body });
      current.questions = current.questions.map((q) => (q.id === question.id ? question : q));
      editing = question;
    } else {
      current.questions = (await api(`/api/sessions/${current.session.id}/questions`, { method: 'POST', body })).questions;
      editing = current.questions[current.questions.length - 1];
    }
    toast('Question saved');
    if (thenNew) { editing = null; draft = blankDraft(); } else draft = fromQuestion(editing);
    renderBuilder();
    if (thenNew) $('#qText').focus();
  } catch (err) { toast(err.message, { error: true }); }
}

async function editMeta() {
  const s = current.session;
  const accountList = await loadAccounts();
  modal(html`<h2>Session details</h2>
    <form id="metaForm" class="stack" style="gap: 14px; margin-top: 16px;">
      <div class="grid-2">
        <div class="field"><label>Title</label><input class="input" id="mTitle" value="${s.title}" required></div>
        <div class="field"><label>Module</label><input class="input" id="mModule" value="${s.module || ''}"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Date</label><input class="input" id="mDate" type="date" value="${s.date || ''}"></div>
        <div class="field"><label>Trainers (comma separated; interns rate each)</label><input class="input" id="mTrainers" value="${s.trainers.join(', ')}"></div>
      </div>
      <div class="field"><label>Subtopics</label><input class="input" id="mSub" value="${s.subtopics || ''}"></div>
      ${accountPicker(accountList, s.trainerEmails || [])}
      <div class="row" style="justify-content: flex-end;"><button type="button" class="btn" data-close>Cancel</button><button class="btn dark" type="submit">Save</button></div>
    </form>`);
  $('#metaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const patch = { title: $('#mTitle').value, module: $('#mModule').value, date: $('#mDate').value, trainers: $('#mTrainers').value.split(',').map((t) => t.trim()).filter(Boolean), subtopics: $('#mSub').value };
    if (isAdmin()) patch.trainerEmails = pickedAccounts();
    closeModal();
    await saveSettings(patch);
  });
}

function bulkAdd() {
  modal(html`<h2>Add several questions</h2>
    <p class="small muted" style="margin-top: 6px;">One question per block, blank line between blocks. Put a <strong>*</strong> in front of the correct option. Complexity, time and explanation lines are optional.</p>
    <textarea class="input mono" id="bulkText" style="margin-top: 14px; min-height: 260px; font-size: 13px;" placeholder="Q: Which HTTP method is idempotent?
A) POST
*B) PUT
C) PATCH
D) CONNECT
complexity: medium
time: 45
explanation: PUT replaces the whole resource, so repeating it has the same effect."></textarea>
    <div id="bulkErrors" class="small" style="color: var(--hard-text); margin-top: 8px;"></div>
    <div class="row" style="justify-content: flex-end; margin-top: 14px;"><button type="button" class="btn" data-close>Cancel</button><button class="btn dark" id="bulkGo">Add questions</button></div>`);
  $('#bulkGo').addEventListener('click', async () => {
    try {
      const out = await api(`/api/sessions/${current.session.id}/questions/bulk`, { method: 'POST', body: { text: $('#bulkText').value } });
      current.questions = out.questions;
      closeModal();
      toast(`Added ${out.added} question${out.added === 1 ? '' : 's'}`);
      renderBuilder();
    } catch (err) { $('#bulkErrors').innerHTML = (err.errors || [err.message]).map((x) => `<div>• ${x}</div>`).join(''); }
  });
}

// ---------------------------------------------------------------- trainers (admin)
async function renderTrainers() {
  const [{ trainers: list }, { sessions: all }] = await Promise.all([api('/api/trainers'), api('/api/sessions')]);
  accounts = list;
  const byId = new Map(all.map((s) => [s.id, s]));
  const label = (id) => { const s = byId.get(id); return s ? `Day ${s.dayNo ?? '·'} · ${s.title}` : `#${id}`; };
  const rows = list.map((t) => html`<tr>
      <td style="font-weight: 600;">${t.name}${t.email === trainer.email ? html` <span class="tiny muted">(you)</span>` : ''}</td>
      <td class="small muted">${t.email}</td>
      <td><span class="pill ${t.role === 'admin' ? 'lobby' : 'neutral'}">${t.role === 'admin' ? 'Admin' : 'Trainer'}</span></td>
      <td class="small">${t.role === 'admin' ? html`<span class="muted">All sessions</span>` : (t.sessionIds.length || t.matchedSessionIds.length)
        ? html`${t.sessionIds.map((id) => html`<div>${label(id)}</div>`)}${t.matchedSessionIds.map((id) => html`<div class="muted">${label(id)} <span class="tiny faint">by name</span></div>`)}`
        : html`<span class="faint">None yet</span>`}</td>
      <td><div class="row" style="gap: 6px; justify-content: flex-end;">
        <button class="btn sm" data-edit="${t.email}">Edit</button>
        ${t.email === trainer.email ? '' : html`<button class="btn sm ghost danger" data-remove-trainer="${t.email}" data-name="${t.name}">Remove</button>`}
      </div></td>
    </tr>`);
  shell(html`
    <div class="row between wrap" style="margin-bottom: 20px; gap: 12px;">
      <div class="stack" style="gap: 4px;"><h1 style="font-size: 26px;">Trainers</h1><p class="muted small">Admins see and manage everything. Trainers sign in to the sessions assigned to them and nothing else.</p></div>
      <button class="btn dark" id="addTrainer">${raw(icon('plus'))} Add trainer</button>
    </div>
    <div class="card" style="padding: 0; overflow: auto;">
      <table class="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Sessions</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="tiny faint" style="margin-top: 12px;">New accounts sign in with the password you set here (the default is Ferguson@2026) and should change it from the top bar. "By name" means the session's trainer names include this person's name, so no assignment is needed.</p>`);
  $('#addTrainer').addEventListener('click', () => trainerForm(null, all));
  $$('[data-edit]').forEach((b) => b.addEventListener('click', () => trainerForm(list.find((t) => t.email === b.dataset.edit), all)));
  $$('[data-remove-trainer]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`Remove ${b.dataset.name} (${b.dataset.removeTrainer})? They will no longer be able to sign in.`)) return;
    try { await api(`/api/trainers/${encodeURIComponent(b.dataset.removeTrainer)}`, { method: 'DELETE' }); accounts = null; toast('Removed'); renderTrainers(); }
    catch (e) { toast(e.message, { error: true }); }
  }));
}

function trainerForm(existing, all) {
  const me = existing?.email === trainer.email;
  modal(html`<h2>${existing ? 'Edit trainer' : 'Add trainer'}</h2>
    <form id="trForm" class="stack" style="gap: 14px; margin-top: 16px;">
      <div class="grid-2">
        <div class="field"><label>Name <span class="faint" style="font-weight: 400;">(as it appears in the session's trainer list)</span></label><input class="input" id="trName" value="${existing?.name || ''}" required placeholder="e.g. Subachandran G"></div>
        <div class="field"><label>Email</label><input class="input" id="trEmail" type="email" value="${existing?.email || ''}" ${existing ? 'readonly' : ''} required placeholder="name@ferguson.com"></div>
      </div>
      <div class="grid-2">
        <div class="field"><label>Role</label>
          <select class="input" id="trRole" ${me ? 'disabled' : ''}>
            <option value="trainer" ${existing?.role !== 'admin' ? 'selected' : ''}>Trainer · assigned sessions only</option>
            <option value="admin" ${existing?.role === 'admin' ? 'selected' : ''}>Admin · sees and manages everything</option>
          </select></div>
        <div class="field"><label>${existing ? 'New password' : 'Password'} <span class="faint" style="font-weight: 400;">${existing ? '(blank keeps the current one)' : '(blank uses Ferguson@2026)'}</span></label><input class="input" id="trPass" type="text" autocomplete="off" placeholder="${existing ? '' : 'Ferguson@2026'}" minlength="8"></div>
      </div>
      <div class="field"><label>Sessions this trainer can host</label>
        <div class="picklist">${all.map((s) => html`<label class="row small" style="gap: 8px; cursor: pointer;"><input type="checkbox" data-sid="${s.id}" ${existing?.sessionIds?.includes(s.id) ? 'checked' : ''}><span>Day ${s.dayNo ?? '·'} · ${s.title}</span><span class="tiny muted">${s.trainers.join(' · ')}${existing?.matchedSessionIds?.includes(s.id) ? ' · matched by name' : ''}</span></label>`)}</div>
        <span class="tiny faint">Admins see every session regardless. A trainer also sees sessions whose trainer names include their own name.</span>
      </div>
      <div class="row" style="justify-content: flex-end;"><button type="button" class="btn" data-close>Cancel</button><button class="btn dark" type="submit">${existing ? 'Save' : 'Add trainer'}</button></div>
    </form>`);
  $('#trForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { name: $('#trName').value, role: $('#trRole').value, sessionIds: $$('[data-sid]:checked').map((el) => Number(el.dataset.sid)) };
    if ($('#trPass').value) body.password = $('#trPass').value;
    if (me) delete body.role;
    try {
      if (existing) { await api(`/api/trainers/${encodeURIComponent(existing.email)}`, { method: 'PUT', body }); toast('Saved'); }
      else { const out = await api('/api/trainers', { method: 'POST', body: { ...body, email: $('#trEmail').value } }); toast(out.usingDefault ? `Added. They sign in with Ferguson@2026.` : 'Added.'); }
      accounts = null;
      closeModal();
      renderTrainers();
    } catch (err) { toast(err.message, { error: true }); }
  });
}

// ---------------------------------------------------------------- certificates
let certSessionId = null;

async function renderCertificates() {
  ({ sessions } = await api('/api/sessions'));
  const ended = sessions.filter((s) => s.status === 'ended');
  if (!certSessionId || !ended.some((s) => s.id === certSessionId)) certSessionId = ended[ended.length - 1]?.id ?? null;
  let body;
  if (!certSessionId) {
    body = html`<div class="card"><p class="muted small">Certificates are issued once a session has finished. None of ${isAdmin() ? 'the' : 'your'} sessions has finished yet${sessions.length ? '' : ', and no sessions are assigned to you'}.</p></div>`;
  } else {
    let certificates = [];
    try { ({ certificates } = await api(`/api/sessions/${certSessionId}/certificates`)); } catch (e) { toast(e.message, { error: true }); }
    body = html`<div class="card" style="padding: 0; overflow: auto;">
      <div class="row between wrap" style="padding: 14px 16px; border-bottom: 1px solid var(--line-soft); gap: 12px;">
        <div class="row" style="gap: 10px;"><label for="certSel">Session</label><select class="input" id="certSel" style="height: 36px; width: auto; padding: 0 10px;">${ended.map((x) => html`<option value="${x.id}" ${x.id === certSessionId ? 'selected' : ''}>Day ${x.dayNo ?? '·'} · ${fmtDate(x.date)} · ${x.title}</option>`)}</select></div>
        <div class="row wrap" style="gap: 8px;"><span class="small muted">${certificates.length} participant${certificates.length === 1 ? '' : 's'}</span>${certificates.length ? html`<a class="btn sm dark" href="/api/sessions/${certSessionId}/certificates.zip">Download all (zip)</a>` : ''}</div>
      </div>
      <table class="table">
        <thead><tr><th class="num">Rank</th><th>Participant</th><th>Email</th><th class="num">Correct</th><th class="num">Points</th><th></th></tr></thead>
        <tbody>${certificates.length ? certificates.map((c) => html`<tr>
          <td class="num display" style="font-weight: 700; color: var(--faint);">${c.rank}</td>
          <td style="font-weight: 600;">${c.name}</td><td class="small muted">${c.email}</td>
          <td class="num">${c.correct} / ${c.questionCount}</td><td class="num display" style="font-weight: 800;">${c.score}</td>
          <td><div class="row" style="gap: 6px; justify-content: flex-end;">
            <a class="btn sm" href="/certificate?participant=${c.participantId}" target="_blank">View / print</a>
            <a class="btn sm" href="/api/participants/${c.participantId}/certificate.svg">Download</a>
          </div></td>
        </tr>`) : html`<tr><td colspan="6" class="muted small" style="padding: 24px;">Nobody joined this session.</td></tr>`}</tbody>
      </table>
    </div>`;
  }
  shell(html`
    <div class="row between wrap" style="margin-bottom: 20px; gap: 12px;">
      <div class="stack" style="gap: 4px;"><h1 style="font-size: 26px;">Certificates</h1><p class="muted small">Generate, print and download certificates of completion for the participants of a finished session.</p></div>
    </div>
    ${body}`);
  $('#certSel')?.addEventListener('change', (e) => { certSessionId = Number(e.target.value); renderCertificates(); });
}

function icon(name) {
  const s = 'width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"';
  return {
    clock: `<svg ${s} stroke="#5fb2ea" width="20" height="20"><circle cx="10" cy="10" r="7.5"></circle><path d="M10 6v4l2.5 1.5"></path></svg>`,
    levels: `<svg ${s} stroke="#5fb2ea" width="20" height="20"><path d="M4 14l4-8 4 8M5.5 11.5h5M14 6v8"></path></svg>`,
    bars: `<svg ${s} stroke="#5fb2ea" width="20" height="20"><path d="M3 16h14M6 16V9M10 16V4M14 16v-5"></path></svg>`,
    info: `<svg ${s}><circle cx="10" cy="10" r="7.5"></circle><path d="M10 9v5M10 6.5v.5"></path></svg>`,
    plus: `<svg ${s}><path d="M10 4v12M4 10h12"></path></svg>`,
    trash: `<svg ${s}><path d="M3 5.5h14M7.5 5.5V4h5v1.5M5 5.5l.8 10.5h8.4l.8-10.5"></path></svg>`,
    check: `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.5l2.5 2.5 4.5-5"></path></svg>`,
    refresh: `<svg ${s}><path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v3.5h-3.5"></path></svg>`,
    play: `<svg ${s}><path d="M6 4v12l10-6z"></path></svg>`,
    present: `<svg ${s}><rect x="3" y="4" width="14" height="9" rx="1.5"></rect><path d="M10 13v3M7 16h6"></path></svg>`,
  }[name] || '';
}
