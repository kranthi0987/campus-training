// Trainer accounts, roles and cookie sessions.
//
// Two roles: 'admin' sees and manages everything (all sessions, participants, scorecards,
// trainer accounts, certificates); 'trainer' only sees the sessions assigned to them.
// The very first account is created by signing in with the default password and becomes
// the admin; every later account is created by an admin.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http.js';

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
  constructor(db) {
    this.db = db;
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

  issueToken(email) {
    const token = randomBytes(24).toString('hex');
    this.db.prepare('INSERT INTO trainer_tokens (token, email, created_at) VALUES (?, ?, ?)').run(token, email, Date.now());
    return token;
  }

  trainerForToken(token) {
    if (!token) return null;
    const row = this.db.prepare(
      'SELECT t.email, t.name, t.role FROM trainer_tokens k JOIN trainers t ON t.email = k.email WHERE k.token = ?',
    ).get(token);
    return row ? { email: row.email, name: row.name, role: row.role || 'trainer' } : null;
  }

  revoke(token) {
    this.db.prepare('DELETE FROM trainer_tokens WHERE token = ?').run(token);
  }
}
