import { $, $$, api, store, html, raw, connect, secondsLeft, serverNow, fmtClock, pill, ring, starIcon, toast, initials } from '/app.js';
import { renderDiagram } from '/diagrams.js';
let lastSlideIndex = null, lastSlideStep = null;

const app = $('#app');
let state = null;
let selected = null;        // option index picked but not yet locked in
let ratingDraft = {};       // trainer -> stars
let lastQuestionId = null;
let tick = null;

if (!store.token) location.replace('/');

connect(`/api/play/events?token=${encodeURIComponent(store.token)}`, (snap) => {
  state = snap;
  if (snap.question?.id !== lastQuestionId) { selected = null; lastQuestionId = snap.question?.id ?? null; }
  render();
}, { onError: () => { if (!state) app.innerHTML = '<p class="muted">Reconnecting…</p>'; } });

// Make sure a dead token sends the intern back to the join page.
api('/api/play/state').catch((e) => { if (e.status === 401) { store.token = ''; location.replace('/'); } });

function render() {
  clearInterval(tick);
  const { session: s, question: q, me, slide } = state;
  const name = me?.name || localStorage.getItem('dq_name') || 'You';
  document.body.classList.toggle('training', !!(slide && s.status !== 'live' && s.status !== 'ended'));

  if (s.status === 'live' && q) return renderQuestion(s, q, me, name);
  if (s.status === 'ended') return renderEnded(s, me, name);
  if (slide) return renderSlide(s, slide, name);
  return renderWaiting(s, name);
}

function header(s, extraRight = '') {
  return html`<div class="row between" style="align-items: flex-start;">
    <div class="stack" style="gap: 6px;">
      <img class="logo" src="/brand/logo-light.svg" alt="Ferguson" style="height: 16px;">
      <div class="eyebrow">${s.module || 'Ferguson Training'}</div>
      <div class="display" style="font-weight: 700; font-size: 15px;">${s.title}</div>
    </div>
    ${raw(extraRight)}
  </div>`;
}

function renderWaiting(s, name) {
  app.innerHTML = html`
    ${header(s)}
    <div class="stack pop" style="margin-top: 48px; gap: 16px;">
      <div class="avatar amber" style="width: 56px; height: 56px; font-size: 18px;">${initials(name)}</div>
      <h1>You're in, ${name.split(' ')[0]}.</h1>
      <p class="muted">Waiting for ${s.trainers.length ? s.trainers[0].replace(/\s*\(.*\)$/, '') : 'the trainer'} to start the quiz. Keep this page open.</p>
      <div class="card stack" style="gap: 8px; margin-top: 8px;">
        <div class="row between small"><span class="muted">Questions</span><strong>${s.questionCount}</strong></div>
        <div class="row between small"><span class="muted">Session time limit</span><strong>${s.timeLimitMin} min</strong></div>
        <div class="row between small"><span class="muted">Correct answer</span><strong>100 pts</strong></div>
        <div class="row between small"><span class="muted">Joined so far</span><strong>${s.participantCount}</strong></div>
      </div>
    </div>
    <div class="footer"><span>${name}</span><a href="/" class="faint" style="font-size: 12px;">Not you?</a></div>`;
}

function renderSlide(s, slide, name) {
  const changed = lastSlideIndex !== slide.index;
  const newest = !changed && lastSlideStep !== null && slide.step > lastSlideStep ? slide.step - 1 : -1;
  lastSlideIndex = slide.index; lastSlideStep = slide.step;
  const cls = (k) => (k < slide.step ? (k === newest ? 'reveal' : '') : 'pending');
  const body = slide.image
    ? html`<img src="${slide.image}" alt="${slide.title}" style="width: 100%; height: auto; border-radius: 8px; background: #fff; display: block;">
      ${slide.bullets.length ? html`<ul class="bullets" style="font-size: 14px; gap: 6px; margin-top: 6px;">${slide.bullets.map((b) => html`<li>${b}</li>`)}</ul>` : ''}`
    : slide.agenda
    ? html`<div class="agenda" style="grid-template-columns: 1fr;">${slide.agenda.map((a, k) => html`<div class="item ${cls(k)}"><span class="n">${k + 1}</span><div><div class="t">${a.title}</div><div class="s">${a.first.join(' · ')}</div></div></div>`)}</div>`
    : html`<ul class="bullets">${slide.bullets.map((b, k) => html`<li class="${cls(k)}">${b}</li>`)}</ul>
      ${slide.diagram ? raw(renderDiagram(slide.diagram, { compact: true })) : slide.code ? html`<pre class="code" style="font-size: 13px;">${slide.code.text}</pre>` : ''}`;
  app.innerHTML = html`
    ${header(s, `<span class="pill neutral">Slide ${slide.index + 1} / ${slide.total}</span>`)}
    <div class="stack ${changed ? 'slidein' : ''}" style="margin-top: 28px; gap: 14px;">
      <div class="eyebrow" style="color: var(--amber);">${slide.sectionTitle}</div>
      <h1 style="font-size: ${slide.image ? 18 : 26}px;">${slide.title}</h1>
      ${body}
    </div>
    <div class="footer"><span>${name}</span><span>Following the trainer's slides</span></div>`;
}

function renderQuestion(s, q, me, name) {
  const total = q.seconds;
  const draw = () => {
    const left = secondsLeft(q.endsAt);
    const answered = me?.answer;
    const canAnswer = !q.closed && !answered && left > 0;
    const sessionLeft = s.endsAt ? fmtClock(s.endsAt - serverNow()) : '';

    const revealed = q.closed && q.answer !== undefined;
    let options;
    if (revealed) {
      options = q.options.map((o, i) => {
        const cls = i === q.answer ? 'correct' : (answered && answered.choice === i ? 'wrong' : '');
        return html`<button class="option ${cls}" disabled><span class="key">${'ABCD'[i]}</span><span class="grow">${o}</span>${q.tally ? html`<span class="tiny faint">${q.tally[i]}</span>` : ''}</button>`;
      });
    } else if (q.closed) {
      options = q.options.map((o, i) => html`<button class="option ${answered && answered.choice === i ? 'selected' : ''}" disabled><span class="key">${'ABCD'[i]}</span><span class="grow">${o}</span></button>`);
    } else {
      options = q.options.map((o, i) => {
        const cls = (answered ? answered.choice === i : selected === i) ? 'selected' : '';
        return html`<button class="option ${cls}" data-i="${i}" ${canAnswer ? '' : 'disabled'}><span class="key">${'ABCD'[i]}</span><span class="grow">${o}</span></button>`;
      });
    }

    let action = '';
    if (q.closed && !revealed) {
      action = html`<div class="wash small pop" style="margin-top: 20px;">${answered ? html`Locked in <strong>${'ABCD'[answered.choice]}</strong>.` : 'No answer this time.'} Correct answers and scores are shown at the end of the session.</div>`;
    } else if (q.closed) {
      action = answered
        ? html`<div class="stack pop" style="gap: 10px; margin-top: 20px;">
            <span class="result-badge ${answered.correct ? 'correct' : 'wrong'}">${answered.correct ? `Correct · +${answered.points} pts` : 'Not this time · 0 pts'}</span>
            ${q.explanation ? html`<p class="small muted">${q.explanation}</p>` : ''}
            <p class="tiny faint">Waiting for the next question…</p></div>`
        : html`<div class="stack pop" style="gap: 10px; margin-top: 20px;"><span class="result-badge wrong">No answer · 0 pts</span>
            ${q.explanation ? html`<p class="small muted">${q.explanation}</p>` : ''}<p class="tiny faint">Waiting for the next question…</p></div>`;
    } else if (answered) {
      action = html`<div class="wash small" style="margin-top: 20px;">Locked in <strong>${'ABCD'[answered.choice]}</strong>. The answer shows when the timer ends.</div>`;
    } else if (canAnswer) {
      action = html`<button class="btn primary lg block" id="lock" style="margin-top: 20px;" ${selected === null ? 'disabled' : ''}>${selected === null ? 'Pick an answer' : `Lock in ${'ABCD'[selected]}`}</button>`;
    } else {
      action = html`<div class="wash small" style="margin-top: 20px;">Time's up. Waiting for the trainer…</div>`;
    }

    app.innerHTML = html`
      <div class="row between">
        <div class="stack" style="gap: 6px;">
          <div class="eyebrow">Question ${q.index + 1} of ${s.questionCount}</div>
          <div class="row" style="gap: 8px;">${pill(q.complexity)}<span class="tiny muted">100 pts if correct</span></div>
        </div>
        ${ring(left, total)}
      </div>
      <div class="question">${q.text}</div>
      ${q.code ? html`<pre class="code" style="font-size: 13px; margin-top: 14px;">${q.code}</pre>` : ''}
      <div class="stack" style="gap: 10px; margin-top: ${q.code ? 20 : 28}px;">${options}</div>
      ${action}
      <div class="footer"><span>${name}</span><span>${me?.score === null || me?.score === undefined ? html`<span class="faint">Scores at the end</span>` : html`Score <strong class="display" style="color: var(--on-ink); font-size: 15px;">${me.score}</strong>`}${sessionLeft ? html` · <span class="faint">ends in ${sessionLeft}</span>` : ''}</span></div>`;

    $$('.option[data-i]').forEach((b) => b.addEventListener('click', () => { selected = Number(b.dataset.i); draw(); }));
    $('#lock')?.addEventListener('click', lockIn);
  };
  draw();
  tick = setInterval(() => {
    // Only redraw the parts that move, unless the state changes underneath us.
    const left = secondsLeft(q.endsAt);
    const r = $('.ring');
    if (r) r.outerHTML = ring(left, total).value;
    if (left === 0 && !q.closed) { /* wait for server close */ }
  }, 250);

  async function lockIn() {
    if (selected === null) return;
    const choice = selected;
    $('#lock').disabled = true;
    try {
      await api('/api/play/answer', { method: 'POST', body: { questionId: q.id, choice } });
    } catch (e) {
      toast(e.message, { error: true });
      $('#lock').disabled = false;
    }
  }
}

function renderEnded(s, me, name) {
  const rank = me?.rank;
  const correct = state.scoreboard?.find((r) => r.id === me?.id)?.correct ?? 0;
  const certPart = html`<a class="btn lg block" href="/certificate" style="margin-top: 16px; border-color: var(--amber); color: var(--amber);">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="5"></circle><path d="M6.5 12.5L5 18l5-2 5 2-1.5-5.5"></path></svg>
      Get your certificate</a>`;
  const ratingPart = me?.rated
    ? html`<div class="card stack pop" style="gap: 6px; margin-top: 24px;"><h3>Thanks for the feedback.</h3><p class="small muted">Your rating has been recorded. Your certificate is ready below.</p></div>${certPart}`
    : html`<div class="card stack" style="gap: 16px; margin-top: 24px;">
        <div class="stack" style="gap: 4px;"><h3>Rate today's trainer${s.trainers.length > 1 ? 's' : ''}</h3><p class="small muted">Tap the stars, 1 to 5.</p></div>
        ${s.trainers.map((t) => html`<div class="stack" style="gap: 6px;">
          <div class="small" style="font-weight: 600;">${t}</div>
          <div class="stars" data-trainer="${t}">${[1, 2, 3, 4, 5].map((n) => html`<button class="star ${ratingDraft[t] >= n ? 'on' : ''}" data-n="${n}" aria-label="${n} star${n > 1 ? 's' : ''}">${raw(starIcon())}</button>`)}</div>
        </div>`)}
        <div class="field"><label for="comment">Anything to add? (optional)</label><textarea class="input" id="comment" maxlength="500" placeholder="What worked, what to change next time"></textarea></div>
        <button class="btn primary lg block" id="sendRating" ${s.trainers.every((t) => ratingDraft[t]) ? '' : 'disabled'}>Send rating</button>
      </div>${certPart}`;

  const review = me?.review || [];
  const reviewPart = review.length ? html`<div class="stack" style="gap: 10px; margin-top: 28px;">
      <div class="row between" style="align-items: baseline;"><h3>Your answers</h3><span class="tiny muted">${correct} correct of ${review.length} asked</span></div>
      ${review.map((r) => html`<div class="card stack" style="gap: 8px; padding: 14px;">
        <div class="row" style="gap: 8px; align-items: flex-start;"><span class="tiny faint" style="width: 20px; flex-shrink: 0;">${r.index + 1}</span><span class="small" style="font-weight: 600; line-height: 1.35;">${r.text}</span></div>
        ${r.code ? html`<pre class="code" style="font-size: 12px; padding: 10px 12px;">${r.code}</pre>` : ''}
        <div class="stack" style="gap: 6px;">${r.options.map((o, i) => html`<div class="row small" style="gap: 8px; padding: 6px 8px; border-radius: 6px; ${i === r.answer ? 'background: rgba(95,207,152,0.16); color: var(--easy-ink); font-weight: 600;' : (r.choice === i ? 'background: rgba(240,124,124,0.16); color: var(--hard-ink);' : 'color: var(--on-ink-muted);')}"><span style="width: 16px; font-weight: 700;">${'ABCD'[i]}</span><span class="grow">${o}</span>${i === r.answer ? html`<span class="tiny">correct</span>` : r.choice === i ? html`<span class="tiny">yours</span>` : ''}</div>`)}</div>
        ${r.choice === null ? html`<div class="tiny faint">No answer · 0 pts</div>` : r.correct ? html`<div class="tiny" style="color: var(--easy-ink);">+100 pts</div>` : html`<div class="tiny" style="color: var(--hard-ink);">0 pts</div>`}
        ${r.explanation ? html`<div class="tiny muted">${r.explanation}</div>` : ''}
      </div>`)}
    </div>` : '';
  app.innerHTML = html`
    ${header(s, '<span class="pill ended">Finished</span>')}
    <div class="stack pop" style="margin-top: 32px; gap: 6px;">
      <div class="eyebrow">Your result</div>
      <div class="bigscore">${me?.score ?? 0}<span style="font-size: 20px; color: var(--on-ink-muted); letter-spacing: 0;"> pts</span></div>
      <p class="muted">${rank ? `Rank ${rank} of ${s.participantCount}` : ''} · ${correct} of ${s.questionCount} correct</p>
    </div>
    ${ratingPart}
    ${reviewPart}
    <div class="footer"><span>${name}</span><span>Well played.</span></div>`;

  const commentEl = $('#comment');
  $$('.stars').forEach((group) => {
    group.querySelectorAll('.star').forEach((b) => b.addEventListener('click', () => {
      ratingDraft[group.dataset.trainer] = Number(b.dataset.n);
      const draft = commentEl?.value || '';
      renderEnded(s, me, name);
      if ($('#comment')) $('#comment').value = draft;
    }));
  });
  $('#sendRating')?.addEventListener('click', async () => {
    $('#sendRating').disabled = true;
    try {
      await api('/api/play/rating', { method: 'POST', body: { ratings: s.trainers.map((t) => ({ trainer: t, stars: ratingDraft[t] })), comment: $('#comment').value } });
      toast('Thank you!');
    } catch (e) { toast(e.message, { error: true }); $('#sendRating').disabled = false; }
  });
}
