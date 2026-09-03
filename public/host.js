import { $, $$, api, html, raw, connect, secondsLeft, serverNow, fmtClock, pill, ring, toast, initials, starIcon } from '/app.js';

const id = Number(location.pathname.split('/').pop());
const app = $('#app');
let state = null;
let tick = null;
let publicUrl = '';
let lastJoinCount = 0;
let newest = null;
let showReview = false;

(async () => {
  try { await api('/api/trainer/me'); } catch { location.replace('/trainer'); return; }
  try { ({ publicUrl } = await api('/api/info')); } catch { /* optional */ }
  try { await api(`/api/sessions/${id}/state`); }
  catch (e) { app.innerHTML = html`<main class="page"><div class="card stack" style="gap: 8px; max-width: 520px; margin: 40px auto;"><h2>Not available</h2><p class="muted">${e.message}</p><a class="btn" href="/trainer">Back to your sessions</a></div></main>`.value; return; }
  connect(`/api/sessions/${id}/events`, (snap) => { state = snap; render(); });
})();

async function act(name, body) {
  try { await api(`/api/sessions/${id}/${name}`, { method: 'POST', body }); }
  catch (e) { toast(e.message, { error: true }); }
}

function render() {
  clearInterval(tick);
  const s = state.session;
  const status = s.status;
  const clock = status === 'live' && s.endsAt ? `<span class="muted small">Session ends in</span> <span class="display" id="sessClock" style="font-weight: 700; font-size: 18px;">${fmtClock(s.endsAt - serverNow())}</span>` : '';
  const top = html`<header class="topbar">
      <div class="row" style="gap: 16px;"><img class="logo" src="/brand/logo-light.svg" alt="Ferguson"><span class="vsep"></span><span class="display" style="font-weight: 700; color: var(--on-ink-muted);">${s.module ? s.module + ' · ' : ''}${s.title}</span><span class="pill ${status}">${{ draft: 'Draft', lobby: 'Lobby', live: 'Live', ended: 'Finished' }[status]}</span></div>
      <div class="row" style="gap: 16px;">${raw(clock)}${raw(controls(s))}<button class="btn ghost" id="fsBtn" title="Full screen (F)">⛶</button></div>
    </header>`;
  let body;
  if (status === 'live' && state.question) body = renderLive(s, state.question);
  else if (status === 'ended') body = renderEnded(s);
  else body = renderLobby(s);
  app.innerHTML = top.value + body.value;
  bind();
  if (status === 'live' && state.question) {
    const q = state.question;
    tick = setInterval(() => {
      const r = $('.ring'); if (r) r.outerHTML = ring(secondsLeft(q.endsAt), q.seconds, { big: true }).value;
      const c = $('#sessClock'); if (c) c.textContent = fmtClock(s.endsAt - serverNow());
    }, 250);
  }
  if (s.participantCount > lastJoinCount && state.participants?.length) newest = state.participants[state.participants.length - 1].id;
  lastJoinCount = s.participantCount;
}

function controls(s) {
  const btn = (name, label, cls = '') => `<button class="btn ${cls}" data-act="${name}">${label}</button>`;
  switch (s.status) {
    case 'draft': return btn('lobby', 'Open lobby', 'primary');
    case 'lobby': {
      const remaining = s.questionCount - s.askedCount;
      const present = state.deck ? `<a class="btn" href="/present/${s.id}" target="_blank">${state.deck.synthetic ? 'Show content' : s.slideIndex >= 0 ? 'Back to slides' : 'Present slides'}</a>` : '';
      if (!remaining) return present + btn('end', 'Show scoreboard', 'primary');
      return present + btn('start', s.askedCount ? `▶ Run remaining ${remaining} question${remaining === 1 ? '' : 's'}` : '▶ Start quiz', 'primary');
    }
    case 'live': {
      const q = state.question;
      if (!q) return '';
      const last = q.index + 1 >= s.questionCount;
      const blockDone = s.blockEnd !== null && q.index >= s.blockEnd;
      return q.closed ? btn('next', last ? 'Show scoreboard' : blockDone ? 'Back to slides →' : 'Next question →', 'primary') : btn('close', 'Close question early') + btn('end', 'End quiz', 'ghost');
    }
    case 'ended': return (state.deck ? `<a class="btn" href="/present/${s.id}" target="_blank">Present slides</a>` : '') + `<a class="btn" href="/api/sessions/${s.id}/results.csv">Export results</a>` + btn('reset', 'Reset session', 'ghost');
    default: return '';
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => toast('Full screen is not available in this browser', { error: true }));
}
document.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'f' && !e.target?.matches?.('input, textarea')) toggleFullscreen(); });

function bind() {
  $('#fsBtn')?.addEventListener('click', toggleFullscreen);
  $('#reviewToggle')?.addEventListener('click', () => { showReview = !showReview; render(); });
  $$('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(`Remove ${b.dataset.name} from this session?`)) return;
    try { await api(`/api/participants/${b.dataset.remove}`, { method: 'DELETE' }); } catch (e) { toast(e.message, { error: true }); }
  }));
  $$('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'reset' && !confirm('Reset this session? Participants, answers and ratings will be cleared.')) return;
    if (a === 'end' && !confirm('End the quiz now and show the scoreboard?')) return;
    act(a);
  }));
}

function renderLobby(s) {
  const ps = state.participants || [];
  const joinUrl = publicUrl ? `${publicUrl}/join?code=${s.joinCode}` : '';
  return html`<main class="stage lobby">
    <section class="stack" style="gap: 28px; align-items: flex-start;">
      <div class="stack" style="gap: 6px;"><h1 style="font-size: 40px;">Scan to join</h1><p class="muted">Camera app, then enter your Ferguson email.</p></div>
      <div class="qr"><img src="/api/sessions/${s.id}/qr.svg?v=${s.joinCode}" alt="QR code to join"></div>
      <div class="stack" style="gap: 8px;">
        <div class="eyebrow">Or enter the code</div>
        <div class="code">${s.joinCode.slice(0, 3)} ${s.joinCode.slice(3)}</div>
        ${joinUrl ? html`<div class="muted">at <strong style="color: var(--on-ink);">${publicUrl.replace(/^https?:\/\//, '')}</strong></div>` : ''}
      </div>
      ${s.status === 'draft' ? html`<div class="wash small">Interns can join once you open the lobby.</div>` : ''}
      ${s.status === 'lobby' && s.askedCount ? html`<div class="wash small">${s.askedCount} of ${s.questionCount} questions asked so far during the presentation. ${s.askedCount < s.questionCount ? 'The rest run from the slides\' next checkpoint, or all at once from here.' : 'Show the scoreboard when you are ready.'}</div>` : ''}
    </section>
    <section class="stack" style="gap: 24px;">
      <div class="row between" style="align-items: baseline;">
        <div class="row" style="gap: 12px; align-items: baseline;"><span class="display" style="font-weight: 800; font-size: 40px;">${ps.length}</span><span class="display" style="font-weight: 700; font-size: 22px; color: #c9cfdc;">joined</span></div>
        <span class="row small muted" style="gap: 8px;"><span class="dot" style="background: var(--easy-ink);"></span>Live · new joins appear here</span>
      </div>
      <div class="roster">
        ${ps.map((p) => html`<div class="chip ${p.id === newest ? 'new' : ''}"><span class="avatar ${p.id === newest ? 'amber' : ''}">${initials(p.name)}</span><span class="grow" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</span><button class="btn sm ghost" data-remove="${p.id}" data-name="${p.name}" title="Remove ${p.name}" style="padding: 0 6px; color: var(--on-ink-faint);">✕</button></div>`)}
        ${ps.length ? '' : html`<div class="chip" style="border-style: dashed; color: var(--on-ink-faint); font-weight: 400;">Waiting for the first intern…</div>`}
      </div>
      <div class="row" style="gap: 32px; margin-top: auto; padding-top: 20px; border-top: 1px solid var(--ink-line); color: var(--on-ink-muted); font-size: 14px;">
        <div><span class="kpi">${s.questionCount}</span> questions</div>
        <div><span class="kpi">${s.timeLimitMin}</span> min limit</div>
        <div><span class="kpi">100</span> points per correct answer</div>
        <div><span class="kpi">0</span> for a wrong one</div>
      </div>
    </section>
  </main>`;
}

function renderLive(s, q) {
  const ps = state.participants || [];
  const answered = ps.filter((p) => p.answered).length;
  const revealed = q.closed && q.answer !== undefined;
  const opts = q.options.map((o, i) => {
    const cls = revealed && i === q.answer ? 'correct' : '';
    return html`<div class="option ${cls}"><span class="key">${'ABCD'[i]}</span><span class="grow">${o}</span>${revealed && q.tally ? html`<span class="tally">${q.tally[i]}</span>` : ''}</div>`;
  });
  return html`<main class="stage live">
    <section class="stack" style="gap: 32px;">
      <div class="row between">
        <div class="stack" style="gap: 6px;"><div class="eyebrow">Question ${q.index + 1} of ${s.questionCount}</div><div class="row" style="gap: 8px;">${pill(q.complexity)}<span class="tiny muted">${q.seconds}s · 100 pts</span></div></div>
        ${q.closed ? html`<span class="pill neutral" style="font-size: 13px; padding: 6px 12px;">${revealed ? 'Closed' : 'Closed · answers at the end'}</span>` : ring(secondsLeft(q.endsAt), q.seconds, { big: true })}
      </div>
      <div class="qtext">${q.text}</div>
      ${q.code ? html`<pre class="code" style="max-width: 720px;">${q.code}</pre>` : ''}
      <div class="opts">${opts}</div>
      ${revealed && q.explanation ? html`<div class="wash" style="font-size: 16px;">${q.explanation}</div>` : ''}
    </section>
    <aside class="stack" style="gap: 20px;">
      <div class="card stack" style="gap: 6px;"><div class="eyebrow">Answered</div><div class="bigclock">${answered} <span style="font-size: 20px; color: var(--on-ink-muted);">/ ${ps.length}</span></div></div>
      <div class="card" style="padding: 12px; max-height: 60vh; overflow: auto;">
        <div class="stack" style="gap: 6px;">
          ${[...ps].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name)).map((p) => html`<div class="row between small" style="padding: 6px 8px; border-radius: 6px; ${p.answered ? 'background: rgba(95,207,152,0.12);' : ''}">
            <span class="row" style="gap: 8px;"><span class="avatar" style="width: 24px; height: 24px; font-size: 10px;">${initials(p.name)}</span>${p.name}</span>
            <span class="row" style="gap: 10px;">${p.answered ? html`<span class="tiny" style="color: var(--easy-ink); font-weight: 700;">in</span>` : html`<span class="tiny faint">waiting</span>`}${p.score === null ? '' : html`<span class="display" style="font-weight: 700;">${p.score}</span>`}</span>
          </div>`)}
        </div>
      </div>
    </aside>
  </main>`;
}

function renderEnded(s) {
  const board = state.scoreboard || [];
  const [a, b, c] = board;
  const col = (r, place, cls) => r ? html`<div class="col ${cls}">
      <span class="avatar ${place === 1 ? 'amber' : ''}" style="width: ${place === 1 ? 80 : 64}px; height: ${place === 1 ? 80 : 64}px; font-size: ${place === 1 ? 22 : 18}px;">${initials(r.name)}</span>
      <div class="center"><div style="font-weight: 700; font-size: ${place === 1 ? 18 : 16}px;">${r.name}</div><div class="display" style="font-weight: 800; font-size: ${place === 1 ? 34 : 26}px; color: ${place === 1 ? 'var(--amber)' : '#c9cfdc'};">${r.score.toLocaleString()}</div></div>
      <div class="block" style="height: ${place === 1 ? 170 : place === 2 ? 120 : 90}px;">${place}</div>
    </div>` : html`<div></div>`;
  const ratings = state.ratings;
  const used = s.endedAt && s.startedAt ? fmtClock(Math.min(s.endedAt - s.startedAt, s.timeLimitMin * 60_000)) : '';
  return html`<main class="stage ended">
    <section class="stack" style="gap: 32px;">
      <div class="stack" style="gap: 6px;"><div class="eyebrow">Final scoreboard</div><h1 style="font-size: 44px;">Well played, everyone.</h1></div>
      ${board.length ? html`<div class="podium">${col(b, 2, '')}${col(a, 1, 'first')}${col(c, 3, '')}</div>` : html`<p class="muted">Nobody joined this session.</p>`}
      <div class="row" style="gap: 32px; color: var(--on-ink-muted); font-size: 14px;">
        <div><span class="kpi">${board.length}</span> players</div><div><span class="kpi">${s.questionCount}</span> questions</div>${used ? html`<div><span class="kpi">${used}</span> of ${s.timeLimitMin}:00 used</div>` : ''}
      </div>
      ${ratings ? html`<div class="card stack" style="gap: 12px;">
        <div class="row between"><h3>Trainer rating</h3><span class="tiny muted">from interns, 1–5 stars</span></div>
        ${ratings.trainers.map((t) => html`<div class="row between"><span>${t.trainer}</span><span class="row" style="gap: 10px;">
          <span class="row" style="gap: 2px; color: var(--amber);">${raw([1, 2, 3, 4, 5].map((n) => `<span style="width:18px;height:18px;display:inline-block;opacity:${t.average !== null && n <= Math.round(t.average) ? 1 : 0.2}">${starIcon()}</span>`).join(''))}</span>
          <span class="display" style="font-weight: 700;">${t.average === null ? '–' : t.average.toFixed(1)}</span><span class="tiny muted">(${t.count})</span></span></div>`)}
        ${ratings.comments.length ? html`<div class="stack small muted" style="gap: 6px; padding-top: 8px; border-top: 1px solid var(--ink-line);">${ratings.comments.map((c) => html`<div>“${c.comment}” <span class="faint">· ${c.name}</span></div>`)}</div>` : ''}
      </div>` : ''}
    </section>
    <section class="stack" style="gap: 24px; align-self: start; min-width: 0;">
      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="table">
          <thead><tr><th class="num">Rank</th><th>Name</th><th>Email</th><th class="num">Correct</th><th class="num">Points</th></tr></thead>
          <tbody>${board.map((r) => html`<tr><td class="num display" style="font-weight: 700; color: var(--on-ink-muted);">${r.rank}</td><td style="font-weight: 600;">${r.name}</td><td class="small muted">${r.email}</td><td class="num" style="color: #c9cfdc;">${r.correct} / ${s.questionCount}</td><td class="num display" style="font-weight: 700;">${r.score}</td></tr>`)}</tbody>
        </table>
      </div>
      ${state.review?.length ? html`<div class="card stack" style="gap: 12px;">
        <div class="row between"><h3>Answer review</h3><button class="btn sm" id="reviewToggle">${showReview ? 'Hide' : 'Show on screen'}</button></div>
        ${showReview ? html`<div class="stack" style="gap: 10px;">${state.review.map((r) => html`<div class="stack" style="gap: 6px; padding: 10px 12px; border: 1px solid var(--ink-line); border-radius: 10px;">
          <div class="row" style="gap: 10px; align-items: flex-start;"><span class="tiny faint" style="width: 22px; flex-shrink: 0;">${r.index + 1}</span><span style="font-weight: 600; line-height: 1.35;">${r.text}</span><span class="tiny muted" style="margin-left: auto; white-space: nowrap;">${r.correctCount} / ${r.answered} right</span></div>
          ${r.code ? html`<pre class="code" style="font-size: 12px; padding: 8px 12px; margin-left: 32px;">${r.code}</pre>` : ''}
          <div class="row wrap" style="gap: 8px; padding-left: 32px;">${r.options.map((o, i) => html`<span class="pill ${i === r.answer ? 'ended' : 'neutral'}" style="font-size: 12px; padding: 4px 10px;">${'ABCD'[i]} · ${o}${r.tally ? html` <span style="opacity: 0.7;">(${r.tally[i]})</span>` : ''}</span>`)}</div>
          ${r.explanation ? html`<div class="tiny muted" style="padding-left: 32px;">${r.explanation}</div>` : ''}
        </div>`)}</div>` : html`<p class="small muted">Every question with its correct answer and how many got it right. Interns already see their own answers on their phones.</p>`}
      </div>` : ''}
    </section>
  </main>`;
}
