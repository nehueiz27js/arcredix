import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireSuperAdmin } from '@/lib/auth/authorization';
import { getAuthenticatedDatabase } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createPlanSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(2).max(80),
  monthlyPriceUsd: z.number().finite().nonnegative(),
  connectionLimit: z.number().int().positive().nullable(),
  features: z.record(z.string(), z.unknown()).default({}),
});

const updatePlanSchema = z.object({
  planId: z.string().uuid(),
  name: z.string().trim().min(2).max(80).optional(),
  monthlyPriceUsd: z.number().finite().nonnegative().optional(),
  connectionLimit: z.number().int().positive().nullable().optional(),
  features: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
  reason: z.string().trim().min(4).max(500),
}).refine((value) => (
  value.name !== undefined ||
  value.monthlyPriceUsd !== undefined ||
  value.connectionLimit !== undefined ||
  value.features !== undefined ||
  value.isActive !== undefined
), { message: 'Indicá al menos un campo para actualizar.' });

export async function GET() {
  const actor = await requireSuperAdmin();
  if (!actor) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  try {
    const sql = await getAuthenticatedDatabase();
    const result = await sql`
      SELECT
        p.id,
        p.code,
        p.name,
        p.monthly_price_usd,
        p.connection_limit,
        p.features,
        p.is_active,
        p.created_at,
        p.updated_at,
        (
          SELECT count(*)::int
          FROM public.subscriptions s
          WHERE s.plan_id = p.id
            AND s.status IN ('pending', 'trialing', 'active', 'past_due', 'grace_period', 'suspended')
        ) AS current_subscriptions
      FROM public.plans p
      ORDER BY p.monthly_price_usd ASC, p.name ASC
    `;
    const rows = Array.isArray(result) ? result : result.rows;

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error('ARCREDIX admin plans GET failed:', error);
    return NextResponse.json({ error: 'No se pudieron cargar los planes.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = createPlanSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Los datos del plan no son válidos.', issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const sql = await getAuthenticatedDatabase();
    const result = await sql`
      WITH created AS (
        INSERT INTO public.plans (
          code,
          name,
          monthly_price_usd,
          connection_limit,
          features
        )
        VALUES (
          ${parsed.data.code},
          ${parsed.data.name},
          ${parsed.data.monthlyPriceUsd},
          ${parsed.data.connectionLimit},
          ${JSON.stringify(parsed.data.features)}::jsonb
        )
        RETURNING id, code, name, monthly_price_usd, connection_limit, features, is_active, created_at
      ),
      logged AS (
        INSERT INTO public.audit_logs (
          actor_type, action, entity_type, entity_id, reason, after_data
        )
        SELECT
          'superadmin',
          'plan.created',
          'plan',
          created.id,
          'Alta de plan desde superadministración',
          jsonb_build_object(
            'code', created.code,
            'name', created.name,
            'monthly_price_usd', created.monthly_price_usd,
            'connection_limit', created.connection_limit,
            'actor_email', ${actor.email}
          )
        FROM created
        RETURNING id
      )
      SELECT created.*, logged.id AS audit_log_id
      FROM created
      CROSS JOIN logged
    `;
    const rows = Array.isArray(result) ? result : result.rows;

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error('ARCREDIX admin plans POST failed:', error);
    return NextResponse.json({ error: 'No se pudo crear el plan. Verificá que el código no esté repetido.' }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const actor = await requireSuperAdmin();
  if (!actor) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = updatePlanSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Los datos para actualizar el plan no son válidos.', issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const sql = await getAuthenticatedDatabase();
    const result = await sql`
      WITH target AS (
        SELECT id, name, monthly_price_usd, connection_limit, features, is_active
        FROM public.plans
        WHERE id = ${data.planId}
        FOR UPDATE
      ),
      updated AS (
        UPDATE public.plans p
        SET
          name = CASE WHEN ${data.name !== undefined} THEN ${data.name ?? null} ELSE p.name END,
          monthly_price_usd = CASE WHEN ${data.monthlyPriceUsd !== undefined} THEN ${data.monthlyPriceUsd ?? null} ELSE p.monthly_price_usd END,
          connection_limit = CASE WHEN ${data.connectionLimit !== undefined} THEN ${data.connectionLimit} ELSE p.connection_limit END,
          features = CASE WHEN ${data.features !== undefined} THEN ${JSON.stringify(data.features ?? {})}::jsonb ELSE p.features END,
          is_active = CASE WHEN ${data.isActive !== undefined} THEN ${data.isActive ?? null} ELSE p.is_active END,
          updated_at = now()
        FROM target
        WHERE p.id = target.id
        RETURNING p.id, p.code, p.name, p.monthly_price_usd, p.connection_limit, p.features, p.is_active, p.updated_at
      ),
      logged AS (
        INSERT INTO public.audit_logs (
          actor_type, action, entity_type, entity_id, reason, before_data, after_data
        )
        SELECT
          'superadmin',
          'plan.updated',
          'plan',
          updated.id,
          ${data.reason},
          jsonb_build_object(
            'name', target.name,
            'monthly_price_usd', target.monthly_price_usd,
            'connection_limit', target.connection_limit,
            'features', target.features,
            'is_active', target.is_active
          ),
          jsonb_build_object(
            'name', updated.name,
            'monthly_price_usd', updated.monthly_price_usd,
            'connection_limit', updated.connection_limit,
            'features', updated.features,
            'is_active', updated.is_active,
            'actor_email', ${actor.email}
          )
        FROM updated
        INNER JOIN target ON target.id = updated.id
        RETURNING id
      )
      SELECT updated.*, logged.id AS audit_log_id
      FROM updated
      CROSS JOIN logged
    `;
    const rows = Array.isArray(result) ? result : result.rows;

    if (!rows.length) {
      return NextResponse.json({ error: 'No se encontró el plan solicitado.' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error) {
    console.error('ARCREDIX admin plans PATCH failed:', error);
    return NextResponse.json({ error: 'No se pudo actualizar el plan.' }, { status: 500 });
  }
}
