import { $, api, store, toast, qs } from '/app.js';

const codeEl = $('#code'), hint = $('#codeHint'), line = $('#sessionLine'), form = $('#joinForm'), btn = $('#joinBtn');
const emailEl = $('#email'), emailHint = $('#emailHint');
let lookupTimer = null, emailTimer = null;

const fromQr = qs('code');
if (fromQr) { codeEl.value = fromQr.toUpperCase(); lookup(); }
codeEl.addEventListener('input', () => { clearTimeout(lookupTimer); lookupTimer = setTimeout(lookup, 300); });
emailEl.addEventListener('input', () => { clearTimeout(emailTimer); emailTimer = setTimeout(lookupEmail, 350); });

async function lookup() {
  const code = codeEl.value.replace(/[^a-z0-9]/gi, '').toUpperCase();
  codeEl.classList.remove('ok');
  hint.textContent = '';
  if (code.length < 6) return;
  try {
    const { session } = await api(`/api/session-by-code?code=${encodeURIComponent(code)}`);
    codeEl.classList.add('ok');
    line.textContent = `${session.module ? session.module + ' · ' : ''}${session.title}`;
    hint.textContent = session.status === 'draft' ? 'Found the session. The trainer has not opened it yet.' : session.status === 'ended' ? 'This session has already finished.' : fromQr ? 'Code from QR ✓' : 'Session found ✓';
  } catch (e) {
    hint.textContent = e.status === 404 ? 'No session with that code yet.' : e.message;
  }
}

async function lookupEmail() {
  const email = emailEl.value.trim();
  emailEl.classList.remove('ok');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { emailHint.textContent = 'Your name comes from the participant list.'; return; }
  try {
    const { name } = await api(`/api/roster/lookup?email=${encodeURIComponent(email)}`, { token: '' });
    emailEl.classList.add('ok');
    emailHint.textContent = `Hi ${name} ✓`;
  } catch (e) {
    emailHint.textContent = e.status === 404 ? 'Not on the participant list yet. Ask your trainer to add you.' : e.message;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  try {
    const out = await api('/api/join', { method: 'POST', body: { code: codeEl.value, email: emailEl.value }, token: '' });
    store.token = out.token;
    store.sessionId = out.sessionId;
    localStorage.setItem('dq_name', out.name);
    localStorage.setItem('dq_email', emailEl.value.trim());
    location.href = '/play';
  } catch (err) {
    toast(err.message, { error: true });
    btn.disabled = false;
  }
});

// Remember the email on this device and offer to continue an open session.
const remembered = localStorage.getItem('dq_email');
if (remembered) { emailEl.value = remembered; lookupEmail(); }
(async () => {
  if (!store.token) return;
  try {
    const { state } = await api('/api/play/state');
    if (state.session.status === 'ended') return;
    $('#resumeName').textContent = `${state.me?.name || 'You'} · ${state.session.title}`;
    $('#resume').hidden = false;
    if (!codeEl.value) codeEl.value = state.session.joinCode;
    if (state.me) { emailEl.value = state.me.email; lookupEmail(); }
  } catch { store.token = ''; }
})();
