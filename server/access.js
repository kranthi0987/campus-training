// Who may open which session.
//
// Admins see every session. A trainer sees a session they created (session.ownerEmail), one an
// admin or the owner assigned their account to (session.trainerEmails), or one whose trainer
// names include their own name, so the seeded schedule works as soon as accounts with matching
// names exist. Owners and admins also manage the session: co-trainers, slides, deletion.

/** "Kranthi Kumar (Integration)" -> "kranthi kumar" */
export const nameKey = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

export function sessionAllows(session, user) {
  if (!session || !user) return false;
  if (user.role === 'admin') return true;
  if (session.ownerEmail && session.ownerEmail === user.email) return true;
  if ((session.trainerEmails || []).includes(user.email)) return true;
  const me = nameKey(user.name);
  return !!me && (session.trainers || []).some((t) => nameKey(t) === me);
}

/** May this user change who hosts the session, replace its slides or delete it? */
export function sessionManagedBy(session, user) {
  if (!session || !user) return false;
  return user.role === 'admin' || (!!session.ownerEmail && session.ownerEmail === user.email);
}
