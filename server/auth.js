// Trainer accounts, roles and cookie sessions.
//
// Two roles: 'admin' sees and manages everything (all sessions, participants, scorecards,
// trainer accounts, certificates); 'trainer' only sees the sessions assigned to them.
// The very first account is created by signing in with the default password and becomes
// the admin; every later account is created by an admin.
import { scryptSync, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { HttpError } from './http.js';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // matches the cookie's Max-Age
/** Short, non-reversible mark of a password hash: changing the password invalidates old tokens. */
const fingerprint = (passwordHash) => createHash('sha256').update(String(passwordHash)).digest('base64url').slice(0, 16);

export const DEFAULT_PASSWORD = process.env.DEFAULT_TRAINER_PASSWORD || 'Ferguson@2026';
export const COOKIE = 'dq_trainer';
export const ROLES = ['admin', 'trainer'];

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = scryptSync(password, salt, 64);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const toUser = (r) => (r ? { email: r.email, name: r.name, role: r.role || 'trainer', createdAt: r.created_at } : null);

export class Auth {
  /** `secret` signs sign-in tokens; pass a stable one (SESSION_SECRET) so trainers stay signed in across restarts. */
  constructor(db, { secret } = {}) {
    this.db = db;
    this.secret = secret || randomBytes(32).toString('hex');
  }

  count() {
    return this.db.prepare('SELECT COUNT(*) AS n FROM trainers').get().n;
  }

  adminCount() {
    return this.db.prepare("SELECT COUNT(*) AS n FROM trainers WHERE role = 'admin'").get().n;
  }

  get(emailRaw) {
    return toUser(this.db.prepare('SELECT * FROM trainers WHERE email = ?').get(normalizeEmail(emailRaw)));
  }

  list() {
    return this.db.prepare('SELECT * FROM trainers ORDER BY created_at, email').all().map(toUser);
  }

  /**
   * Signs a trainer in. When no account exists yet, the default password creates the first
   * account as the admin. Returns { email, name, role, usingDefault } or null.
   */
  login(emailRaw, password, name) {
    const email = normalizeEmail(emailRaw);
    if (!isEmail(email) || typeof password !== 'string') return null;
    const row = this.db.prepare('SELECT * FROM trainers WHERE email = ?').get(email);
    if (!row) {
      if (this.count() > 0 || password !== DEFAULT_PASSWORD) return null;
      const created = this.create({ email, name, role: 'admin', password });
      return { ...created, usingDefault: true };
    }
    if (!verifyPassword(password, row.password_hash)) return null;
    return { email, name: row.name, role: row.role || 'trainer', usingDefault: password === DEFAULT_PASSWORD };
  }

  /** Creates an account (admin action). Throws HttpError on bad input. */
  create({ email: emailRaw, name, role = 'trainer', password }) {
    const email = normalizeEmail(emailRaw);
    if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email');
    if (!ROLES.includes(role)) throw new HttpError(400, 'Role must be admin or trainer');
    const pw = typeof password === 'string' && password ? password : DEFAULT_PASSWORD;
    if (pw.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
    if (this.db.prepare('SELECT 1 FROM trainers WHERE email = ?').get(email)) throw new HttpError(409, 'An account with this email already exists');
    const cleanName = String(name || '').trim().slice(0, 60) || email.split('@')[0];
    this.db.prepare('INSERT INTO trainers (email, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(email, cleanName, role, hashPassword(pw), Date.now());
    return { email, name: cleanName, role, usingDefault: pw === DEFAULT_PASSWORD };
  }

  /** Updates name, role and/or password (admin action). Returns the account. */
  update(emailRaw, { name, role, password } = {}) {
    const email = normalizeEmail(emailRaw);
    const row = this.db.prepare('SELECT * FROM trainers WHERE email = ?').get(email);
    if (!row) throw new HttpError(404, 'Trainer not found');
    if (role !== undefined && !ROLES.includes(role)) throw new HttpError(400, 'Role must be admin or trainer');
    if (role === 'trainer' && row.role === 'admin' && this.adminCount() <= 1) throw new HttpError(400, 'Keep at least one admin');
    const cleanName = name === undefined ? row.name : String(name).trim().slice(0, 60) || row.name;
    this.db.prepare('UPDATE trainers SET name = ?, role = ? WHERE email = ?').run(cleanName, role ?? row.role, email);
    if (password !== undefined && password !== null && password !== '') {
      if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
      this.db.prepare('UPDATE trainers SET password_hash = ? WHERE email = ?').run(hashPassword(password), email);
      this.db.prepare('DELETE FROM trainer_tokens WHERE email = ?').run(email);
    }
    return this.get(email);
  }

  remove(emailRaw) {
    const email = normalizeEmail(emailRaw);
    const row = this.db.prepare('SELECT * FROM trainers WHERE email = ?').get(email);
    if (!row) throw new HttpError(404, 'Trainer not found');
    if (row.role === 'admin' && this.adminCount() <= 1) throw new HttpError(400, 'Keep at least one admin');
    this.db.prepare('DELETE FROM trainer_tokens WHERE email = ?').run(email);
    this.db.prepare('DELETE FROM trainers WHERE email = ?').run(email);
    return { removed: email };
  }

  changePassword(emailRaw, current, next) {
    const email = normalizeEmail(emailRaw);
    const row = this.db.prepare('SELECT * FROM trainers WHERE email = ?').get(email);
    if (!row || !verifyPassword(current, row.password_hash)) return false;
    if (typeof next !== 'string' || next.length < 8) return false;
    this.db.prepare('UPDATE trainers SET password_hash = ? WHERE email = ?').run(hashPassword(next), email);
    return true;
  }

  /**
   * Sign-in tokens are signed, not stored: <payload>.<hmac>, where the payload carries the
   * email, the issue time and a fingerprint of the password hash. They stay valid across server
   * restarts and redeploys (the database is wiped on every deploy on the free hosting tier) as
   * long as the secret is the same, and die when the password changes or the account is removed.
   */
  issueToken(email) {
    const row = this.db.prepare('SELECT password_hash FROM trainers WHERE email = ?').get(email);
    if (!row) return null;
    const payload = Buffer.from(JSON.stringify({ e: email, t: Date.now(), p: fingerprint(row.password_hash) })).toString('base64url');
    return `${payload}.${this.sign(payload)}`;
  }

  sign(payload) {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }

  trainerForToken(token) {
    if (!token) return null;
    const dot = String(token).indexOf('.');
    if (dot < 0) return this.legacyTrainerForToken(token);
    const payload = token.slice(0, dot), sig = token.slice(dot + 1);
    const expected = this.sign(payload);
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    let data;
    try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
    if (!data || typeof data.e !== 'string' || !(Date.now() - Number(data.t) < TOKEN_TTL_MS)) return null;
    const row = this.db.prepare('SELECT email, name, role, password_hash FROM trainers WHERE email = ?').get(data.e);
    if (!row || fingerprint(row.password_hash) !== data.p) return null;
    return { email: row.email, name: row.name, role: row.role || 'trainer' };
  }

  /** Cookies issued before signed tokens: rows in trainer_tokens, valid until the next deploy. */
  legacyTrainerForToken(token) {
    const row = this.db.prepare(
      'SELECT t.email, t.name, t.role FROM trainer_tokens k JOIN trainers t ON t.email = k.email WHERE k.token = ?',
    ).get(token);
    return row ? { email: row.email, name: row.name, role: row.role || 'trainer' } : null;
  }

  revoke(token) {
    // Signed tokens cannot be recalled individually; clearing the cookie signs the browser out.
    if (token && !String(token).includes('.')) this.db.prepare('DELETE FROM trainer_tokens WHERE token = ?').run(token);
  }
}
