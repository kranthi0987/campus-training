import { $, api, store, html, fmtDate, qs } from '/app.js';

// Interns open /certificate with their participant token; an admin or the session's trainer
// opens /certificate?participant=<id> with their sign-in cookie.
const app = $('#app');
const participantId = qs('participant');
if (!participantId && !store.token) location.replace('/');

(async () => {
  let c;
  try { ({ certificate: c } = await api(participantId ? `/api/participants/${encodeURIComponent(participantId)}/certificate` : '/api/play/certificate', { token: participantId ? '' : undefined })); }
  catch (e) {
    app.innerHTML = html`<div class="card stack" style="gap: 8px; max-width: 520px; margin: 40px auto;"><h2>Not yet</h2><p class="muted">${e.message}</p><a class="btn" href="${participantId ? '/trainer#/certificates' : '/play'}">${participantId ? 'Back to certificates' : 'Back to the session'}</a></div>`.value;
    return;
  }
  document.title = `${c.name} · Certificate`;
  const download = participantId ? `/api/participants/${encodeURIComponent(participantId)}/certificate.svg` : `/api/play/certificate.svg?token=${encodeURIComponent(store.token)}`;
  app.innerHTML = html`
    <div class="row between wrap actions" style="gap: 12px;">
      <div class="stack" style="gap: 2px;"><h2>${participantId ? `Certificate for ${c.name}` : 'Your certificate'}</h2><p class="small muted">Print it, save it as a PDF, or download the image file.</p></div>
      <div class="row wrap" style="gap: 8px;">
        <a class="btn" href="${participantId ? '/trainer#/certificates' : '/play'}">Back</a>
        <a class="btn" href="${download}" download="${c.filename || 'certificate.svg'}">Download image</a>
        <button class="btn primary" id="printBtn">Print / Save as PDF</button>
      </div>
    </div>
    <div class="cert">
      <div class="stripes"></div>
      <div class="programme">Campus Training</div>
      <div class="kicker">CERTIFICATE OF COMPLETION</div>
      <p class="muted" style="margin-top: 18px;">This certifies that</p>
      <div class="name">${c.name}</div>
      <div class="rule"></div>
      <p class="muted">completed the training session</p>
      <div class="title">${c.sessionTitle}</div>
      <p class="small muted" style="margin-top: 6px;">${c.module ? c.module + ' · ' : ''}${fmtDate(c.date)}</p>
      <div class="stats">
        <div><strong>${c.score}</strong><span>POINTS</span></div>
        <div><strong>${c.correct} / ${c.questionCount}</strong><span>CORRECT</span></div>
        <div><strong>${c.rank} of ${c.participants}</strong><span>RANK</span></div>
      </div>
      <div class="sigs">${c.trainers.slice(0, 3).map((t) => html`<div class="sig"><strong>${t}</strong><span>TRAINER</span></div>`)}</div>
      <div class="foot">Issued ${c.issuedOn} · ${c.email}</div>
    </div>`.value;
  $('#printBtn').addEventListener('click', () => window.print());
})();
