import { $, $$, api, html, raw, connect, toast, ring, secondsLeft, initials } from '/app.js';
import { renderDiagram } from '/diagrams.js';

const id = Number(location.pathname.split('/').pop());
const app = $('#app');
let deck = null;
let state = null;
let showNotes = localStorage.getItem('dq_notes') !== '0';
let lastIndex = null;
let lastStep = null;
let tick = null;
let publicUrl = '';
let showJoin = false;

document.body.classList.add('training');

(async () => {
  try { await api('/api/trainer/me'); } catch { location.replace('/trainer'); return; }
  try { ({ publicUrl } = await api('/api/info')); } catch { /* optional */ }
  try { ({ deck } = await api(`/api/sessions/${id}/deck`)); }
  catch (e) { app.innerHTML = html`<div class="idle"><h1>${e.status === 403 ? 'Not available' : 'No slides for this session'}</h1><p class="muted">${e.message}</p></div>`.value; return; }
  let opening = false;
  connect(`/api/sessions/${id}/events`, (snap) => {
    state = snap;
    // The opening screen shows the QR code, so the room must be open for interns to join.
    if (snap.session.status === 'draft' && !opening) { opening = true; api(`/api/sessions/${id}/lobby`, { method: 'POST' }).catch(() => {}); }
    render();
  });
})();

// Full screen hides the sidebar so the projector shows only the slide.
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => toast('Full screen is not available in this browser', { error: true }));
}
document.addEventListener('fullscreenchange', () => { document.body.classList.toggle('fullscreen', !!document.fullscreenElement); });

const joinCard = (s, { big = false } = {}) => html`<div class="joincard ${big ? 'big' : ''}">
  <img src="/api/sessions/${s.id}/qr.svg?v=${s.joinCode}" alt="QR code to join">
  <div class="stack" style="gap: 6px; min-width: 0;">
    <div class="eyebrow">Scan or enter the code</div>
    <div class="jcode">${s.joinCode.slice(0, 3)} ${s.joinCode.slice(3)}</div>
    ${publicUrl ? html`<div class="small muted">at <strong style="color: var(--on-ink);">${publicUrl.replace(/^https?:\/\//, '')}</strong></div>` : ''}
    <div class="small muted">${s.status === 'draft' ? 'Open the lobby on the host screen to let interns join.' : `${s.participantCount} joined · Ferguson email only`}</div>
  </div>
</div>`;

const post = async (path, body) => { try { await api(`/api/sessions/${id}/${path}`, { method: 'POST', body }); } catch (e) { toast(e.message, { error: true }); } };
const advance = (dir) => post('advance', { dir });
const jump = (index, step = 0) => post('slide', { index, step });

document.addEventListener('keydown', (e) => {
  if (!state || !deck) return;
  if (e.target?.matches?.('input, textarea')) return;
  if (state.session.status === 'live') {
    // During a quiz block the arrow key closes the open question, then moves on.
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); post('next'); }
    else if (e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFullscreen(); }
    return;
  }
  if (e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFullscreen(); return; }
  if (e.key.toLowerCase() === 'j') { showJoin = !showJoin; render(); return; }
  if (e.key === 'Escape' && showJoin) { showJoin = false; render(); return; }
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(1); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') { e.preventDefault(); advance(-1); }
  else if (e.key === 'Escape') { if (document.fullscreenElement) return; jump(null); }
  else if (e.key.toLowerCase() === 'n') { showNotes = !showNotes; localStorage.setItem('dq_notes', showNotes ? '1' : '0'); render(); }
  else if (e.key.toLowerCase() === 'a') { const i = state.session.slideIndex; if (i >= 0) jump(i, 'all'); }
  else if (e.key === 'Home') jump(0);
  else if (e.key === 'End') jump(deck.slides.length - 1, 'all');
});

function renderQuizBlock(s, q) {
  const ps = state.participants || [];
  const answered = ps.filter((p) => p.answered).length;
  const last = q.index + 1 >= s.questionCount;
  const blockDone = s.blockEnd !== null && q.index >= s.blockEnd;
  const revealed = q.closed && q.answer !== undefined;
  const nextLabel = !q.closed ? 'Close question' : last ? 'Show scoreboard →' : blockDone ? 'Back to slides →' : 'Next question →';
  const blockLabel = s.blockEnd !== null ? `Quiz · question ${q.index + 1} of ${s.questionCount} · block ends after question ${s.blockEnd + 1}` : `Quiz · question ${q.index + 1} of ${s.questionCount}`;
  return html`<div class="slide">
    <div class="row between" style="align-items: flex-start;">
      <div class="stack" style="gap: 6px;"><div class="eyebrow">${blockLabel}</div><div class="row" style="gap: 8px;"><span class="pill ${q.complexity}">${q.complexity[0].toUpperCase() + q.complexity.slice(1)}</span><span class="tiny muted">${q.seconds}s · 100 pts · ${answered} of ${ps.length} answered</span></div></div>
      ${q.closed ? html`<span class="pill neutral" style="font-size: 13px; padding: 6px 12px;">${revealed ? 'Closed' : 'Closed · answers at the end'}</span>` : ring(secondsLeft(q.endsAt), q.seconds, { big: true })}
    </div>
    <h1 style="font-size: 40px; margin-top: 20px;">${q.text}</h1>
    <div class="body ${q.code ? '' : 'single'}" style="margin-top: 24px; flex: 0 0 auto;">
      <div class="stack" style="gap: 12px;">${q.options.map((o, i) => html`<div class="option ${revealed && i === q.answer ? 'correct' : ''}" style="min-height: 64px; font-size: 20px; cursor: default;"><span class="key" style="width: 36px; height: 36px; font-size: 16px;">${'ABCD'[i]}</span><span class="grow">${o}</span>${revealed && q.tally ? html`<span class="display" style="font-weight: 700; color: var(--on-ink-muted);">${q.tally[i]}</span>` : ''}</div>`)}</div>
      ${q.code ? html`<pre class="code">${q.code}</pre>` : ''}
    </div>
    ${revealed && q.explanation ? html`<div class="notes" style="margin-top: 20px;">${q.explanation}</div>` : ''}
    <div class="row wrap" style="gap: 6px; margin-top: 20px;">${ps.map((p) => html`<span class="pill ${p.answered ? 'ended' : 'neutral'}" style="gap: 6px;">${initials(p.name)} · ${p.name}</span>`)}</div>
    <div class="bar" style="margin-top: auto;">
      <div class="row" style="gap: 8px;"><button class="btn sm primary" data-post="next">${nextLabel}</button>${q.closed ? '' : html`<button class="btn sm ghost" data-post="end">End quiz now</button>`}</div>
      <div class="small muted">${s.askedCount} of ${s.questionCount} asked · <kbd>→</kbd> ${!q.closed ? 'close' : 'next'}</div>
    </div>
  </div>`;
}

function render() {
  clearInterval(tick);
  const s = state.session;
  const i = s.slideIndex;
  const total = deck.slides.length;
  const agendaSections = deck.sections.filter((sec) => sec.id !== 'agenda');

  const agendaItems = agendaSections.length
    ? agendaSections.map((sec) => ({ title: sec.title, sub: sec.slides.map((x) => x.title).join(' · ') }))
    : (deck.slides[0]?.agenda || []).map((a) => ({ title: a.title, sub: '' }));
  const nav = html`<nav class="nav">
    <div class="stack" style="gap: 8px;"><img class="logo" src="/brand/logo-light.svg" alt="Ferguson"><span class="tiny muted">${deck.title}</span></div>
    ${deck.sections.map((sec) => {
      const start = deck.slides.findIndex((sl) => sl.sectionId === sec.id);
      return html`<div class="sec"><div class="name">${sec.title}</div>${sec.slides.map((sl, k) => html`<button class="${start + k === i ? 'on' : ''}" data-jump="${start + k}">${sl.title}${sl.askAfter ? html`<span class="qmark" title="Quiz after this slide">${sl.askAfter} q</span>` : ''}</button>`)}</div>`;
    })}
    <div class="row wrap" style="gap: 6px; margin-top: 8px;"><a class="btn sm primary" href="/host/${s.id}">Go to quiz →</a><button class="btn sm" id="fsBtn">⛶ Full screen</button><button class="btn sm" data-join="1">Join code</button></div>
    <div class="tiny faint" style="margin-top: auto; line-height: 1.8;"><kbd>→</kbd> next point / slide · <kbd>←</kbd> back · <kbd>A</kbd> show all · <kbd>N</kbd> notes · <kbd>J</kbd> join code · <kbd>F</kbd> full screen · <kbd>Esc</kbd> stop</div>
  </nav>`;

  let main;
  if (s.status === 'live' && state.question) {
    main = renderQuizBlock(s, state.question);
  } else if (s.status === 'live') {
    main = html`<div class="idle"><h1>The quiz is running</h1><a class="btn" href="/host/${s.id}">Go to host screen</a></div>`;
  } else if (s.status === 'ended') {
    main = html`<div class="idle"><h1>Session finished</h1><p class="muted">Scores, the answer review and ratings are on the host screen and on every intern's phone.</p><div class="row"><a class="btn primary" href="/host/${s.id}">Open scoreboard</a>${i >= 0 ? html`<button class="btn" data-jump="${i}">Keep showing slides</button>` : ''}</div></div>`;
  } else if (i < 0) {
    // Join screen: the QR code, who has joined so far, what is coming and where the quiz sits.
    const ps = state.participants || [];
    const checkpoints = deck.slides.map((sl, k) => (sl.askAfter ? { n: k + 1, q: sl.askAfter } : null)).filter(Boolean);
    const placed = Math.min(s.questionCount, checkpoints.reduce((a, c) => a + c.q, 0));
    const quizPlan = !s.questionCount ? 'No quiz questions yet.'
      : checkpoints.length ? `${s.questionCount} questions: ${placed} asked in the middle, after slide${checkpoints.length === 1 ? '' : 's'} ${checkpoints.map((c) => c.n).join(', ')}${s.questionCount > placed ? `, and ${s.questionCount - placed} at the end` : ''}.`
      : `${s.questionCount} questions, all at the end. To ask some in the middle, set checkpoints on the session page.`;
    main = html`<div class="idle welcome">
      <div class="idle-grid">
        <div class="stack" style="gap: 18px; min-width: 0;">
          <div class="eyebrow" style="color: var(--amber);">${s.module || 'Session'}${s.trainers.length ? ` · ${s.trainers.join(' & ')}` : ''}</div>
          <h1 style="font-size: 44px;">${s.title}</h1>
          <div class="muted" style="font-size: 18px; margin-top: -8px;">${deck.title}</div>
          <div class="joined">
            <div class="row" style="align-items: baseline; gap: 12px;"><span class="jcount">${ps.length}</span><span class="muted" style="font-size: 18px;">${ps.length === 1 ? 'intern has' : 'interns have'} joined${ps.length ? '' : ' · scan the code to join'}</span></div>
            ${ps.length ? html`<div class="names">${ps.map((p) => html`<span class="chip">${p.name}</span>`)}</div>` : ''}
          </div>
          <div class="plan"><div class="eyebrow">Today</div><div class="row wrap" style="gap: 6px;">${agendaItems.map((a, k) => html`<span class="chip soft">${k + 1}. ${a.title}</span>`)}</div></div>
          <div class="plan"><div class="eyebrow">Quiz</div><div class="small muted">${quizPlan}</div></div>
          <div class="row wrap" style="margin-top: 4px; gap: 12px;"><button class="btn primary lg" data-jump="0">${deck.synthetic ? 'Show content on screen' : 'Start presenting'}</button><button class="btn lg" id="fsBtn2">⛶ Full screen</button><a class="btn lg" href="/host/${s.id}">Go to quiz →</a><span class="small muted">${total} slide${total === 1 ? '' : 's'}</span></div>
        </div>
        ${joinCard(s, { big: true })}
      </div>
    </div>`;
  } else {
    const sl = deck.slides[i];
    const steps = sl.build === false ? 0 : sl.bullets.length;
    const step = Math.min(state.slide?.step ?? 0, steps);
    const changed = lastIndex !== i;
    const newest = !changed && lastStep !== null && step > lastStep ? step - 1 : (changed ? -1 : -1);
    const bullet = (b, k) => html`<li class="${k < step ? (k === newest ? 'reveal' : '') : 'pending'}">${b}</li>`;
    let body;
    if (sl.image) {
      // The exported slide picture is the slide; the bullets are the trainer's talking points.
      body = html`<div class="picture"><img src="${sl.image}" alt="${sl.title}"></div>`;
    } else if (sl.agenda) {
      body = html`<div class="agenda" style="align-self: start;">
        ${sl.agenda.map((a, k) => html`<div class="item ${k < step ? (k === newest ? 'reveal' : '') : 'pending'}"><span class="n">${k + 1}</span><div><div class="t">${a.title}</div><div class="s">${a.first.join(' · ')}</div></div></div>`)}
      </div>`;
    } else {
      body = html`<div class="body ${sl.diagram || sl.code ? '' : 'single'}">
        <ul class="bullets">${sl.bullets.map(bullet)}</ul>
        ${sl.diagram ? raw(renderDiagram(sl.diagram)) : sl.code ? html`<pre class="code">${sl.code.text}</pre>` : ''}
      </div>`;
    }
    const joinBadge = html`<button class="joinbadge" data-join="1" title="Show the QR code and join code (J)">Join · <strong>${s.joinCode.slice(0, 3)} ${s.joinCode.slice(3)}</strong> · ${s.participantCount}</button>`;
    main = html`<div class="slide ${changed ? 'slidein' : ''} ${sl.image ? 'has-picture' : ''}">
      ${sl.image ? html`<div class="row between" style="align-items: baseline;"><div class="eyebrow">${sl.sectionTitle}</div><div class="row" style="gap: 12px;"><div class="tiny muted">${sl.title}</div>${joinBadge}</div></div>` : html`<div class="row between" style="align-items: baseline;"><div class="eyebrow">${sl.sectionTitle}</div>${joinBadge}</div><h1>${sl.title}</h1>`}
      ${body}
      ${showNotes && sl.image && sl.bullets.length ? html`<div class="notes" style="margin-top: 16px;"><strong style="color: var(--on-ink);">Points:</strong> ${sl.bullets.join(' · ')}</div>` : ''}
      ${showNotes && sl.note ? html`<div class="notes" style="margin-top: ${sl.image ? 8 : 24}px;"><strong style="color: var(--on-ink);">Say:</strong> ${sl.note}</div>` : ''}
      <div class="bar">
        <div class="row" style="gap: 8px;"><button class="btn sm" data-adv="-1" ${i === 0 && step === 0 ? 'disabled' : ''}>← Back</button>${step >= steps && s.pendingBlock ? html`<button class="btn sm primary" data-adv="1">Quiz: ${s.pendingBlock} question${s.pendingBlock === 1 ? '' : 's'} →</button>` : i >= total - 1 && step >= steps ? (s.askedCount < s.questionCount ? html`<a class="btn sm primary" href="/host/${s.id}">Content done · go to quiz →</a>` : html`<button class="btn sm primary" data-post="end">Finish session · show scoreboard →</button>`) : html`<button class="btn sm primary" data-adv="1">${step < steps ? 'Next point →' : 'Next slide →'}</button>`}<button class="btn sm ghost" data-jump="stop">Stop</button></div>
        <div class="small muted">${i + 1} / ${total}${steps ? html` · point ${step} / ${steps}` : ''}${sl.askAfter ? html` · quiz after this slide` : ''} · ${s.askedCount ? `${s.askedCount} of ${s.questionCount} asked · ` : ''}${s.participantCount} following · <button class="btn sm ghost" id="notesBtn">${showNotes ? 'Hide' : 'Show'} notes</button></div>
      </div>
    </div>`;
    lastIndex = i; lastStep = step;
  }
  if (i < 0) { lastIndex = null; lastStep = null; }
  const overlay = showJoin ? html`<div class="joinoverlay" data-join="1"><div class="joinoverlay-inner">${joinCard(s, { big: true })}<div class="tiny muted center" style="margin-top: 14px;">Press <kbd>J</kbd> or click anywhere to close</div></div></div>` : '';
  app.innerHTML = html`<div class="deck">${nav}${main}</div>${overlay}`.value;
  $$('[data-join]').forEach((b) => b.addEventListener('click', () => { showJoin = !showJoin; render(); }));
  $('#fsBtn')?.addEventListener('click', toggleFullscreen);
  $('#fsBtn2')?.addEventListener('click', toggleFullscreen);
  $$('[data-jump]').forEach((b) => b.addEventListener('click', () => jump(b.dataset.jump === 'stop' ? null : Number(b.dataset.jump))));
  $$('[data-adv]').forEach((b) => b.addEventListener('click', () => advance(Number(b.dataset.adv))));
  $$('[data-post]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.post === 'end' && !confirm('End the quiz and show the scoreboard?')) return;
    post(b.dataset.post);
  }));
  $('#notesBtn')?.addEventListener('click', () => { showNotes = !showNotes; localStorage.setItem('dq_notes', showNotes ? '1' : '0'); render(); });
  if (s.status === 'live' && state.question && !state.question.closed) {
    const q = state.question;
    tick = setInterval(() => { const r = $('.ring'); if (r) r.outerHTML = ring(secondsLeft(q.endsAt), q.seconds, { big: true }).value; }, 250);
  }
}
