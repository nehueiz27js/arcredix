import 'server-only';

import { auth } from '@/lib/auth/server';
import { isSuperAdminEmail } from '@/lib/auth/superadmin';
import { getDatabase } from '@/lib/db/client';

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
  const user = await getAuthenticatedUser();
  if (!user?.id) return null;

  const sql = getDatabase();
  const result = await sql`
    SELECT
      mu.id AS membership_id,
      mu.merchant_id,
      mu.role,
      mu.permissions
    FROM public.merchant_users mu
    INNER JOIN public.merchants m ON m.id = mu.merchant_id
    WHERE mu.auth_subject = ${user.id}
      AND mu.status = 'active'
      AND m.status = 'active'
    LIMIT 1
  `;

  const rows = Array.isArray(result) ? result : result.rows;
  const membership = rows[0] as {
    membership_id: string;
    merchant_id: string;
    role: MerchantRole;
    permissions: Record<string, boolean> | null;
  } | undefined;

  if (!membership || !(membership.role in rolePermissions)) return null;

  return {
    membershipId: membership.membership_id,
    merchantId: membership.merchant_id,
    role: membership.role,
    permissions: membership.permissions ?? {},
  };
}

export function hasMerchantPermission(
  membership: MerchantMembership,
  permission: MerchantPermission,
): boolean {
  const explicit = membership.permissions[permission];

  if (explicit === false) return false;
  if (explicit === true) return true;

  return rolePermissions[membership.role].includes(permission);
}

export async function authorizeMerchant(
  permission: MerchantPermission,
): Promise<MerchantMembership | null> {
  const membership = await getCurrentMerchantMembership();

  if (!membership || !hasMerchantPermission(membership, permission)) return null;

  return membership;
}
