import { NextResponse } from 'next/server';
import { authorizeMerchant } from '@/lib/auth/authorization';
import { getAuthenticatedDatabase } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rowsOf<T>(result: T[] | { rows: T[] }): T[] { return Array.isArray(result) ? result : result.rows; }

export async function GET() {
  const membership = await authorizeMerchant('settings.manage');
  if (!membership) return NextResponse.json({ error: 'No tenés permisos para administrar conexiones.' }, { status: 403 });
  try {
    const sql = await getAuthenticatedDatabase();
    const result = await sql.query(
      "SELECT pc.id,pc.display_name,pc.account_reference,pc.account_alias,pc.status,pc.last_verified_at,pc.created_at,pc.metadata,pp.code AS provider_code,pp.name AS provider_name " +
      "FROM public.payment_connections pc JOIN public.payment_providers pp ON pp.id=pc.provider_id " +
      "WHERE pc.merchant_id=$1 ORDER BY pc.created_at DESC", [membership.merchantId]);
    return NextResponse.json({ data: rowsOf(result) });
  } catch (error) {
    console.error('ARCREDIX connections GET failed:', error);
    return NextResponse.json({ error: 'No se pudieron cargar las conexiones.' }, { status: 500 });
  }
}
