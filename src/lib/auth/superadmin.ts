import 'server-only';

const SUPERADMIN_ENV_KEY = 'ARCREDIX_SUPERADMIN_EMAILS';

/**
 * Server-side allowlist for platform administrators.
 * Values are comma-separated authentication email addresses.
 */
export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;

  const allowlist = (process.env[SUPERADMIN_ENV_KEY] ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowlist.includes(email.trim().toLowerCase());
}
