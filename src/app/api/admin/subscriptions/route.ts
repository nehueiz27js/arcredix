import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/authorization';
import { getAuthenticatedDatabase } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSubscriptionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('extend'),
    subscriptionId: z.string().uuid(),
    days: z.number().int().min(1).max(3650),
    reason: z.string().trim().min(4).max(500),
  }),
  z.object({
    action: z.literal('set_status'),
    subscriptionId: z.string().uuid(),
    status: z.enum(['pending', 'trialing', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled', 'expired']),
    reason: z.string().trim().min(4).max(500),
  }),
]);

export async function GET(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status') ?? 'all';
  const allowedStatuses = ['all', 'pending', 'trialing', 'active', 'past_due', 'grace_period', 'suspended', 'cancelled', 'expired'];

  if (!allowedStatuses.includes(status)) {
    return NextResponse.json({ error: 'Filtro de estado inválido.' }, { status: 400 });
  }

  try {
    const sql = await getAuthenticatedDatabase();
    const result = await sql`
      SELECT
        s.id,
        s.merchant_id,
        m.legal_name,
        m.trade_name,
        m.email AS merchant_email,
        s.plan_id,
        p.code AS plan_code,
        p.name AS plan_name,
        s.status,
        s.billing_interval,
        s.price_usd,
        s.starts_at,
        s.current_period_start,
        s.current_period_end,
        s.grace_period_ends_at,
        s.cancelled_at,
        s.created_at,
        s.updated_at
      FROM public.subscriptions s
      INNER JOIN public.merchants m ON m.id = s.merchant_id
      INNER JOIN public.plans p ON p.id = s.plan_id
      WHERE (${status} = 'all' OR s.status = ${status})
      ORDER BY s.created_at DESC
      LIMIT 300
    `;
    const rows = Array.isArray(result) ? result : result.rows;

    return NextResponse.json({ data: rows, meta: { returned: rows.length, limit: 300 } });
  } catch (error) {
    console.error('ARCREDIX admin subscriptions GET failed:', error);
    return NextResponse.json({ error: 'No se pudieron cargar las suscripciones.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updateSubscriptionSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'La acción solicitada no es válida.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const nextStatus = data.action === 'set_status' ? data.status : null;
  const extensionDays = data.action === 'extend' ? data.days : 0;
  const eventType = data.action === 'extend' ? 'subscription.extended' : 'subscription.status_changed';

  try {
    const sql = await getAuthenticatedDatabase();
    const result = await sql`
      WITH target AS (
        SELECT
          id,
          merchant_id,
          status,
          current_period_start,
          current_period_end,
          grace_period_ends_at,
          cancelled_at,
          plan_id,
          price_usd
        FROM public.subscriptions
        WHERE id = ${data.subscriptionId}
        FOR UPDATE
      ),
      updated AS (
        UPDATE public.subscriptions s
        SET
          status = CASE WHEN ${data.action === 'set_status'} THEN ${nextStatus} ELSE s.status END,
          current_period_end = CASE
            WHEN ${data.action === 'extend'}
              THEN GREATEST(COALESCE(s.current_period_end, now()), now()) + (${extensionDays} * interval '1 day')
            ELSE s.current_period_end
          END,
          grace_period_ends_at = CASE
            WHEN ${nextStatus === 'active'} THEN NULL
            ELSE s.grace_period_ends_at
          END,
          cancelled_at = CASE
            WHEN ${nextStatus === 'cancelled'} THEN now()
            WHEN ${nextStatus === 'active'} THEN NULL
            ELSE s.cancelled_at
          END,
          updated_at = now()
        FROM target
        WHERE s.id = target.id
        RETURNING
          s.id,
          s.merchant_id,
          s.status,
          s.current_period_start,
          s.current_period_end,
          s.grace_period_ends_at,
          s.cancelled_at,
          s.plan_id,
          s.price_usd
      ),
      event_logged AS (
        INSERT INTO public.subscription_events (
          subscription_id,
          merchant_id,
          actor_type,
          actor_reference,
          event_type,
          reason,
          before_data,
          after_data
        )
        SELECT
          updated.id,
          updated.merchant_id,
          'superadmin',
          ${actor.email},
          ${eventType},
          ${data.reason},
          jsonb_build_object(
            'status', target.status,
            'current_period_start', target.current_period_start,
            'current_period_end', target.current_period_end,
            'grace_period_ends_at', target.grace_period_ends_at,
            'cancelled_at', target.cancelled_at,
            'plan_id', target.plan_id,
            'price_usd', target.price_usd
          ),
          jsonb_build_object(
            'status', updated.status,
            'current_period_start', updated.current_period_start,
            'current_period_end', updated.current_period_end,
            'grace_period_ends_at', updated.grace_period_ends_at,
            'cancelled_at', updated.cancelled_at,
            'plan_id', updated.plan_id,
            'price_usd', updated.price_usd
          )
        FROM updated
        INNER JOIN target ON target.id = updated.id
        RETURNING id
      ),
      audit_logged AS (
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
          updated.merchant_id,
          'superadmin',
          ${eventType},
          'subscription',
          updated.id,
          ${data.reason},
          jsonb_build_object('status', target.status, 'current_period_end', target.current_period_end),
          jsonb_build_object(
            'status', updated.status,
            'current_period_end', updated.current_period_end,
            'actor_email', ${actor.email}
          )
        FROM updated
        INNER JOIN target ON target.id = updated.id
        CROSS JOIN event_logged
        RETURNING id
      )
      SELECT
        updated.id,
        updated.merchant_id,
        updated.status,
        updated.current_period_start,
        updated.current_period_end,
        updated.grace_period_ends_at,
        updated.cancelled_at,
        event_logged.id AS subscription_event_id,
        audit_logged.id AS audit_log_id
      FROM updated
      CROSS JOIN event_logged
      CROSS JOIN audit_logged
    `;
    const rows = Array.isArray(result) ? result : result.rows;

    if (!rows.length) {
      return NextResponse.json({ error: 'No se encontró la suscripción solicitada.' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error) {
    console.error('ARCREDIX admin subscriptions PATCH failed:', error);
    return NextResponse.json({ error: 'No se pudo actualizar la suscripción.' }, { status: 500 });
  }
}
