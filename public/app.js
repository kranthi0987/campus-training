// Shared browser helpers: DOM, API calls, live updates, timers, small widgets.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Tagged template that escapes interpolations unless they are wrapped with raw(). */
export function html(strings, ...vals) {
  return new Raw(strings.reduce((out, s, i) => {
    const v = vals[i - 1];
    const str = v === undefined || v === null || v === false ? '' : (v instanceof Raw ? v.value : Array.isArray(v) ? v.map((x) => (x instanceof Raw ? x.value : esc(x))).join('') : esc(v));
    return out + str + s;
  }));
}
class Raw { constructor(value) { this.value = value; } toString() { return this.value; } }
export const raw = (value) => (value instanceof Raw ? value : new Raw(String(value ?? '')));

export const store = {
  get token() { return localStorage.getItem('dq_token') || ''; },
  set token(v) { v ? localStorage.setItem('dq_token', v) : localStorage.removeItem('dq_token'); },
  get sessionId() { return localStorage.getItem('dq_session') || ''; },
  set sessionId(v) { v ? localStorage.setItem('dq_session', String(v)) : localStorage.removeItem('dq_session'); },
};

export async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const t = token ?? store.token;
  if (t) headers['X-Participant-Token'] = t;
  const res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
  let data = {};
  try { data = await res.json(); } catch { /* no body */ }
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.errors = data.errors;
    throw err;
  }
  return data;
}

/** Keeps a server clock offset so countdowns stay right on slow phones. */
let offset = 0;
export function syncClock(snapshot) { if (snapshot?.serverNow) offset = snapshot.serverNow - Date.now(); }
export const serverNow = () => Date.now() + offset;
export const secondsLeft = (endsAt) => Math.max(0, Math.ceil((endsAt - serverNow()) / 1000));

/** Subscribes to a state stream; retries on its own. onState gets each snapshot. */
export function connect(url, onState, { onError } = {}) {
  let es = null, closed = false, retry = 1000;
  const open = () => {
    if (closed) return;
    es = new EventSource(url);
    es.addEventListener('state', (e) => { retry = 1000; const snap = JSON.parse(e.data); syncClock(snap); onState(snap); });
    es.onerror = () => {
      es.close();
      onError?.();
      setTimeout(open, retry);
      retry = Math.min(retry * 2, 10_000);
    };
  };
  open();
  return () => { closed = true; es?.close(); };
}

export function fmtClock(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

export function pill(complexity) {
  return raw(`<span class="pill ${esc(complexity)}">${esc(complexity[0].toUpperCase() + complexity.slice(1))}</span>`);
}

export function ring(seconds, total, { big = false } = {}) {
  const r = big ? 54 : 28, size = big ? 120 : 64, sw = big ? 8 : 5;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, seconds / total) : 0;
  const color = seconds <= 5 ? 'var(--hard-ink)' : 'var(--amber)';
  return raw(`<div class="ring ${big ? 'big' : ''}"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ink-line)" stroke-width="${sw}"></circle>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - frac)).toFixed(1)}"></circle>
  </svg><div class="n">${seconds}</div></div>`);
}

export function starIcon() {
  return '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"></path></svg>';
}

let toastTimer = null;
export function toast(message, { error = false, ms = 3200 } = {}) {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.className = `toast ${error ? 'error' : ''}`;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

export function qs(name) { return new URLSearchParams(location.search).get(name); }
