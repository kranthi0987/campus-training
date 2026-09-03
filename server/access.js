// Who may open which session.
//
// Admins see every session. A trainer sees a session when an admin assigned their account
// to it (session.trainerEmails) or when the session's trainer names include their own name,
// so the seeded schedule works as soon as accounts with matching names exist.

/** "Kranthi Kumar (Integration)" -> "kranthi kumar" */
export const nameKey = (s) => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();

export function sessionAllows(session, user) {
  if (!session || !user) return false;
  if (user.role === 'admin') return true;
  if ((session.trainerEmails || []).includes(user.email)) return true;
  const me = nameKey(user.name);
  return !!me && (session.trainers || []).some((t) => nameKey(t) === me);
}
