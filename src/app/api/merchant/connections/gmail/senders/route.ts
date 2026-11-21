import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeMerchant } from '@/lib/auth/authorization';
import { getAuthenticatedDatabase } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  connectionId: z.string().uuid(),
  senders: z.array(z.string().trim().email().max(254)).min(1).max(20),
});

export async function PUT(request: Request) {
  const membership = await authorizeMerchant('settings.manage');
  if (!membership) return NextResponse.json({ error: 'No tenés permisos para administrar conexiones.' }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Ingresá entre 1 y 20 direcciones de remitente válidas.' }, { status: 400 });
  try {
    const sql = await getAuthenticatedDatabase();
    const result = await sql.query(
      "UPDATE public.payment_connections pc SET metadata=pc.metadata || $1::jsonb,updated_at=now() " +
      "FROM public.payment_providers pp WHERE pc.provider_id=pp.id AND pp.code='bank_gmail' " +
      "AND pc.id=$2 AND pc.merchant_id=$3 RETURNING pc.id",
      [JSON.stringify({ allowed_senders: [...new Set(parsed.data.senders.map((s) => s.toLowerCase()))] }),
        parsed.data.connectionId, membership.merchantId]);
    const rows = Array.isArray(result) ? result : result.rows;
    if (!rows.length) return NextResponse.json({ error: 'No se encontró esa conexión Gmail en tu comercio.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('ARCREDIX Gmail sender configuration failed:', error);
    return NextResponse.json({ error: 'No se pudo guardar la lista de remitentes.' }, { status: 500 });
  }
}
