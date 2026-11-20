import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/lib/auth/server';
import { isSuperAdminEmail } from '@/lib/auth/superadmin';
import { getDatabase } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorize() {
  const { data: session } = await auth.getSession();
  const user = session?.user;

  if (!user?.id || !isSuperAdminEmail(user.email)) {
    return null;
  }

  return user;
}

export async function GET(request: Request) {
  const user = await authorize();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const search = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
  const status = url.searchParams.get('status') ?? 'all';
  const allowedStatuses = ['all', 'pending', 'active', 'suspended', 'cancelled'];

  if (!allowedStatuses.includes(status)) {
    return NextResponse.json({ error: 'Filtro de estado inválido.' }, { status: 400 });
  }

  try {
    const sql = getDatabase();
    const [merchantResult, statsResult] = await Promise.all([
      sql`
        SELECT
          m.id,
          m.legal_name,
          m.trade_name,
          m.owner_name,
          m.email,
          m.phone,
          m.whatsapp_phone,
          m.tax_id,
          m.status,
          m.created_at,
          latest.plan_name,
          latest.plan_code,
          latest.subscription_status,
          latest.billing_interval,
          latest.price_usd,
          latest.current_period_start,
          latest.current_period_end,
          (SELECT count(*)::int FROM public.merchant_users mu WHERE mu.merchant_id = m.id) AS users_count,
          (SELECT count(*)::int FROM public.payment_connections pc WHERE pc.merchant_id = m.id) AS connections_count,
          (SELECT count(*)::int FROM public.registers r WHERE r.merchant_id = m.id) AS registers_count,
          (SELECT count(*)::int FROM public.qr_codes q WHERE q.merchant_id = m.id) AS qr_count
        FROM public.merchants m
        LEFT JOIN LATERAL (
          SELECT
            p.name AS plan_name,
            p.code AS plan_code,
            s.status AS subscription_status,
            s.billing_interval,
            s.price_usd,
            s.current_period_start,
            s.current_period_end
          FROM public.subscriptions s
          INNER JOIN public.plans p ON p.id = s.plan_id
          WHERE s.merchant_id = m.id
          ORDER BY s.created_at DESC
          LIMIT 1
        ) latest ON true
        WHERE
          (${status} = 'all' OR m.status = ${status})
          AND (
            ${search} = ''
            OR m.legal_name ILIKE ${'%' + search + '%'}
            OR coalesce(m.trade_name, '') ILIKE ${'%' + search + '%'}
            OR coalesce(m.owner_name, '') ILIKE ${'%' + search + '%'}
            OR m.email ILIKE ${'%' + search + '%'}
            OR coalesce(m.whatsapp_phone, '') ILIKE ${'%' + search + '%'}
          )
        ORDER BY m.created_at DESC
        LIMIT 200
      `,
      sql`
        SELECT
          count(*)::int AS merchants_total,
          count(*) FILTER (WHERE status = 'pending')::int AS merchants_pending,
          count(*) FILTER (WHERE status = 'active')::int AS merchants_active,
          count(*) FILTER (WHERE status = 'suspended')::int AS merchants_suspended,
          count(*) FILTER (WHERE status = 'cancelled')::int AS merchants_cancelled
        FROM public.merchants
      `,
    ]);

    const merchants = Array.isArray(merchantResult) ? merchantResult : merchantResult.rows;
    const stats = Array.isArray(statsResult) ? statsResult[0] : statsResult.rows[0];

    return NextResponse.json({
      data: merchants,
      stats,
      meta: { returned: merchants.length, limit: 200 },
    });
  } catch (error) {
    console.error('ARCREDIX admin merchants GET failed:', error);
    return NextResponse.json({ error: 'No se pudo cargar la cartera de comercios.' }, { status: 500 });
  }
}

const updateSchema = z.object({
  merchantId: z.string().uuid(),
  status: z.enum(['pending', 'active', 'suspended', 'cancelled']),
  reason: z.string().trim().min(4).max(500),
});

export async function PATCH(request: Request) {
  const user = await authorize();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Indicá un comercio, un estado válido y un motivo de al menos 4 caracteres.' },
      { status: 400 },
    );
  }

  try {
    const sql = getDatabase();
    const result = await sql`
      WITH target AS (
        SELECT id, status
        FROM public.merchants
        WHERE id = ${parsed.data.merchantId}
        FOR UPDATE
      ),
      updated AS (
        UPDATE public.merchants AS merchant
        SET status = ${parsed.data.status}, updated_at = now()
        FROM target
        WHERE merchant.id = target.id
        RETURNING merchant.id, merchant.status
      ),
      logged AS (
        INSERT INTO public.audit_logs (
          merchant_id,
          actor_type,
          action,
          entity_type,
          entity_id,
          reason,
          before_data,
          after_data
        )
        SELECT
          updated.id,
          'superadmin',
          'merchant.status_changed',
          'merchant',
          updated.id,
          ${parsed.data.reason},
          jsonb_build_object('status', target.status),
          jsonb_build_object('status', updated.status, 'actor_email', ${user.email})
        FROM updated
        INNER JOIN target ON target.id = updated.id
        RETURNING id
      )
      SELECT updated.id, updated.status, target.status AS previous_status, logged.id AS audit_log_id
      FROM updated
      INNER JOIN target ON target.id = updated.id
      CROSS JOIN logged
    `;

    const rows = Array.isArray(result) ? result : result.rows;

    if (!rows.length) {
      return NextResponse.json({ error: 'No se encontró el comercio solicitado.' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error) {
    console.error('ARCREDIX admin merchants PATCH failed:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el estado del comercio.' }, { status: 500 });
  }
}
