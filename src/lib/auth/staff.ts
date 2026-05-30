/**
 * Staff identity check.
 *
 * Reads STAFF_EMAILS env var (comma-separated, case-insensitive) and
 * returns true for any user whose email is on the list. Used to gate
 * staff-only UI surfaces — for now, the embedded coach diagnostic on
 * the /write review page.
 *
 * No DB role yet. When we need finer-grained roles we'll move to a
 * `user_roles` table in Supabase; for the staff/non-staff binary the
 * env list is sufficient and deployable without migrations.
 */

export function isStaffEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.STAFF_EMAILS ?? "";
  if (!raw) return false;
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
