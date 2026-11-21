import 'server-only';

import { isSuperAdminEmail } from '@/lib/auth/superadmin';
import { getAuthenticatedDatabase } from '@/lib/db/client';
import { readClientSession } from '@/lib/auth/client-session';

export type MerchantRole = 'owner' | 'admin' | 'manager' | 'operator' | 'viewer';

export type MerchantPermission =
  | 'dashboard.read'
  | 'payments.read'
  | 'payments.manage'
  | 'registers.manage'
  | 'qrs.manage'
  | 'team.read'
  | 'team.manage'
  | 'reports.read'
  | 'settings.manage';

export interface MerchantMembership {
  membershipId: string;
  merchantId: string;
  role: MerchantRole;
  permissions: Record<string, boolean>;
  email: string;
  fullName: string | null;
}

const rolePermissions: Record<MerchantRole, readonly MerchantPermission[]> = {
  owner: [
    'dashboard.read',
    'payments.read',
    'payments.manage',
    'registers.manage',
    'qrs.manage',
    'team.read',
    'team.manage',
    'reports.read',
    'settings.manage',
  ],
  admin: [
    'dashboard.read',
    'payments.read',
    'payments.manage',
    'registers.manage',
    'qrs.manage',
    'team.read',
    'team.manage',
    'reports.read',
    'settings.manage',
  ],
  manager: [
    'dashboard.read',
    'payments.read',
    'payments.manage',
    'registers.manage',
    'qrs.manage',
    'team.read',
    'reports.read',
  ],
  operator: ['dashboard.read', 'payments.read', 'payments.manage', 'registers.manage', 'qrs.manage'],
  viewer: ['dashboard.read', 'payments.read', 'team.read', 'reports.read'],
};

export async function getAuthenticatedUser() {
  const { auth } = await import('@/lib/auth/server');
  const { data: session } = await auth.getSession();
  return session?.user ?? null;
}

export async function requireSuperAdmin() {
  const user = await getAuthenticatedUser();

  if (!user?.id || !isSuperAdminEmail(user.email)) return null;

  return { id: user.id, email: user.email };
}

/**
 * Resolves tenant membership exclusively from the authenticated Neon Auth
 * subject. Never accept merchantId from an untrusted request as authority.
 */
export async function getCurrentMerchantMembership(): Promise<MerchantMembership | null> {
  const clientSession = await readClientSession();
  const user = clientSession ? { id: clientSession.sub } : await getAuthenticatedUser();
  if (!user?.id) return null;

  const sql = await getAuthenticatedDatabase();
  const result = await sql`
    SELECT
      mu.id AS membership_id,
      mu.merchant_id,
      mu.role,
      mu.permissions,
      mu.email,
      mu.full_name
    FROM public.merchant_users mu
    INNER JOIN public.merchants m ON m.id = mu.merchant_id
    WHERE mu.auth_subject = ${user.id}
      AND mu.status = 'active'
      AND m.status = 'active'
      AND (mu.access_key_expires_at IS NULL OR mu.access_key_expires_at > now())
    LIMIT 1
  `;

  const rows = Array.isArray(result) ? result : result.rows;
  const membership = rows[0] as {
    membership_id: string;
    merchant_id: string;
    role: MerchantRole;
    permissions: Record<string, boolean> | null;
    email: string;
    full_name: string | null;
  } | undefined;

  if (!membership || !(membership.role in rolePermissions)) return null;

  return {
    membershipId: membership.membership_id,
    merchantId: membership.merchant_id,
    role: membership.role,
    permissions: membership.permissions ?? {},
    email: membership.email,
    fullName: membership.full_name,
  };
}

export function hasMerchantPermission(
  membership: MerchantMembership,
  permission: MerchantPermission,
): boolean {
  const explicit = membership.permissions[permission];

  if (explicit === false) return false;

  return rolePermissions[membership.role].includes(permission);
}

export async function authorizeMerchant(
  permission: MerchantPermission,
): Promise<MerchantMembership | null> {
  const membership = await getCurrentMerchantMembership();

  if (!membership || !hasMerchantPermission(membership, permission)) return null;

  return membership;
}
