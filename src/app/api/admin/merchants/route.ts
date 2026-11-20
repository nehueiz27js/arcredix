import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/server';
import { isSuperAdminEmail } from '@/lib/auth/superadmin';
import { getAuthenticatedDatabase } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorize() {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  return user?.id && isSuperAdminEmail(user.email) ? user : null;
}

export async function GET(request: Request) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  const url = new URL(request.url);
  const search = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
  const status = url.searchParams.get('status') ?? 'all';
  if (!['all', 'pending', 'active', 'suspended', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Filtro de estado inválido.' }, { status: 400 });
  }
  try {
    const sql = await getAuthenticatedDatabase();
    const [merchantResult, statsResult] = await Promise.all([
      sql`
        SELECT m.id, m.legal_name, m.trade_name, m.owner_name, m.email, m.phone,
          m.whatsapp_phone, m.tax_id, m.status, m.created_at, m.metadata,
          latest.plan_name, latest.plan_code, latest.subscription_status,
          latest.billing_interval, latest.price_usd, latest.current_period_start,
          latest.current_period_end, latest.connection_limit, latest.plan_features,
          (SELECT count(*)::int FROM public.merchant_users mu WHERE mu.merchant_id=m.id) AS users_count,
          (SELECT count(*)::int FROM public.payment_connections pc WHERE pc.merchant_id=m.id) AS connections_count,
          (SELECT count(*)::int FROM public.registers r WHERE r.merchant_id=m.id) AS registers_count,
          (SELECT count(*)::int FROM public.qr_codes q WHERE q.merchant_id=m.id) AS qr_count
        FROM public.merchants m
        LEFT JOIN LATERAL (
          SELECT p.name AS plan_name, p.code AS plan_code, p.connection_limit,
            p.features AS plan_features, s.status AS subscription_status,
            s.billing_interval, s.price_usd, s.current_period_start, s.current_period_end
          FROM public.subscriptions s JOIN public.plans p ON p.id=s.plan_id
          WHERE s.merchant_id=m.id ORDER BY s.created_at DESC LIMIT 1
        ) latest ON true
        WHERE (${status}='all' OR m.status=${status})
          AND (${search}='' OR m.legal_name ILIKE ${'%' + search + '%'}
            OR coalesce(m.trade_name,'') ILIKE ${'%' + search + '%'}
            OR coalesce(m.owner_name,'') ILIKE ${'%' + search + '%'}
            OR m.email ILIKE ${'%' + search + '%'}
            OR coalesce(m.whatsapp_phone,'') ILIKE ${'%' + search + '%'}
            OR coalesce(m.metadata->'admin_label'->>'name','') ILIKE ${'%' + search + '%'})
        ORDER BY m.created_at DESC LIMIT 200
      `,
      sql`SELECT count(*)::int AS merchants_total,
        count(*) FILTER (WHERE status='pending')::int AS merchants_pending,
        count(*) FILTER (WHERE status='active')::int AS merchants_active,
        count(*) FILTER (WHERE status='suspended')::int AS merchants_suspended,
        count(*) FILTER (WHERE status='cancelled')::int AS merchants_cancelled
        FROM public.merchants`,
    ]);
    const merchants = Array.isArray(merchantResult) ? merchantResult : merchantResult.rows;
    const stats = Array.isArray(statsResult) ? statsResult[0] : statsResult.rows[0];
    return NextResponse.json({ data: merchants, stats, meta: { returned: merchants.length, limit: 200 } });
  } catch (error) {
    console.error('ARCREDIX admin merchants GET failed:', error);
    return NextResponse.json({ error: 'No se pudo cargar la cartera de comercios.' }, { status: 500 });
  }
}

const labelColors = ['emerald','blue','violet','amber','rose','cyan','slate'] as const;
const createSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  tradeName: z.string().trim().max(200).optional().default(''),
  ownerName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(256),
  phone: z.string().trim().max(40).optional().default(''),
  whatsappPhone: z.string().trim().max(40).optional().default(''),
  taxId: z.string().trim().max(40).optional().default(''),
  planCode: z.enum(['starter','growth','business']),
  billingInterval: z.enum(['month','year','one_time']),
  status: z.enum(['pending','active']).default('pending'),
  labelName: z.string().trim().max(40).optional().default(''),
  labelColor: z.enum(labelColors).default('emerald'),
});

export async function POST(request: Request) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Revisá los datos del comercio y el plan.' }, { status: 400 });
  const input = parsed.data;
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const email = input.email.toLowerCase();

  try {
    const sql = await getAuthenticatedDatabase();
    const result = await sql`
      WITH plan AS (
        SELECT id, monthly_price_usd FROM public.plans
        WHERE code=${input.planCode} AND is_active=true
      ), merchant AS (
        INSERT INTO public.merchants (legal_name,trade_name,owner_name,email,phone,whatsapp_phone,tax_id,status,metadata)
        SELECT ${input.legalName},nullif(${input.tradeName},''),${input.ownerName},${email},
          nullif(${input.phone},''),nullif(${input.whatsappPhone},''),nullif(${input.taxId},''),
          ${input.status},jsonb_build_object('admin_label',jsonb_build_object(
            'name',nullif(${input.labelName},''),'color',${input.labelColor}))
        FROM plan RETURNING id,created_at
      ), subscription AS (
        INSERT INTO public.subscriptions (merchant_id,plan_id,status,billing_interval,price_usd,starts_at,current_period_start,current_period_end,metadata)
        SELECT m.id,p.id,${input.status === 'active' ? 'active' : 'pending'},${input.billingInterval},
          CASE WHEN ${input.billingInterval}='year' THEN p.monthly_price_usd*12
               WHEN ${input.billingInterval}='one_time' THEN 390
               ELSE p.monthly_price_usd END,
          now(),now(),CASE WHEN ${input.billingInterval}='month' THEN now()+interval '1 month'
                          WHEN ${input.billingInterval}='year' THEN now()+interval '1 year' ELSE NULL END,
          jsonb_build_object('created_by',${user.email},'source','superadmin')
        FROM merchant m CROSS JOIN plan p RETURNING id,merchant_id
      ), membership AS (
        INSERT INTO public.merchant_users (merchant_id,email,full_name,role,status)
        SELECT id,${email},${input.ownerName},'owner','invited' FROM merchant RETURNING merchant_id
      ), invite AS (
        INSERT INTO public.merchant_invitations (merchant_id,email,full_name,role,token_hash,invited_by,expires_at)
        SELECT id,${email},${input.ownerName},'owner',${tokenHash},${user.email},now()+interval '7 days'
        FROM merchant RETURNING merchant_id,id,expires_at
      ), audit AS (
        INSERT INTO public.audit_logs (merchant_id,actor_type,action,entity_type,entity_id,reason,after_data)
        SELECT id,'superadmin','merchant.created','merchant',id,'Alta desde superadmin',
          jsonb_build_object('email',${email},'plan',${input.planCode},'billing_interval',${input.billingInterval})
        FROM merchant RETURNING id
      )
      SELECT m.id,m.created_at,s.id AS subscription_id,i.id AS invitation_id,i.expires_at
      FROM merchant m JOIN subscription s ON s.merchant_id=m.id
      JOIN invite i ON i.merchant_id=m.id JOIN membership mm ON mm.merchant_id=m.id CROSS JOIN audit
    `;
    const rows = Array.isArray(result) ? result : result.rows;
    if (!rows.length) return NextResponse.json({ error: 'El plan no existe o está inactivo.' }, { status: 400 });
    const created = rows[0] as Record<string, unknown>;
    return NextResponse.json({
      data: created,
      invitation: { url: `${new URL(request.url).origin}/aceptar-invitacion?token=${token}`,
        expiresAt: created.expires_at,
        message: 'Comercio creado. El titular debe aceptar la invitación para vincular su cuenta y definir la contraseña.' },
    }, { status: 201 });
  } catch (error) {
    console.error('ARCREDIX admin merchants POST failed:', error);
    return NextResponse.json({ error: 'No se pudo crear el comercio. Verificá que el email no esté registrado.' }, { status: 500 });
  }
}

const updateSchema = z.object({
  merchantId: z.string().uuid(),
  status: z.enum(['pending','active','suspended','cancelled']).optional(),
  reason: z.string().trim().min(4).max(500).optional(),
  labelName: z.string().trim().max(40).optional(),
  labelColor: z.enum(labelColors).optional(),
});

export async function PATCH(request: Request) {
  const user = await authorize();
  if (!user) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.status && parsed.data.labelName === undefined && parsed.data.labelColor === undefined)) {
    return NextResponse.json({ error: 'Indicá cambios válidos para el comercio.' }, { status: 400 });
  }
  const input = parsed.data;
  if (input.status && (!input.reason || input.reason.length < 4)) {
    return NextResponse.json({ error: 'Escribí un motivo de al menos 4 caracteres para cambiar el estado.' }, { status: 400 });
  }
  try {
    const sql = await getAuthenticatedDatabase();
    const result = await sql`
      WITH target AS (
        SELECT id,status,metadata FROM public.merchants WHERE id=${input.merchantId} FOR UPDATE
      ), updated AS (
        UPDATE public.merchants m
        SET status=coalesce(${input.status ?? null},m.status),
          metadata=m.metadata || jsonb_build_object('admin_label',
            coalesce(m.metadata->'admin_label','{}'::jsonb) || jsonb_build_object(
              'name',coalesce(${input.labelName === undefined ? null : input.labelName || null},m.metadata->'admin_label'->>'name'),
              'color',coalesce(${input.labelColor ?? null},m.metadata->'admin_label'->>'color','emerald'))),
          updated_at=now()
        FROM target WHERE m.id=target.id
        RETURNING m.id,m.status,m.metadata
      ), audit AS (
        INSERT INTO public.audit_logs (merchant_id,actor_type,action,entity_type,entity_id,reason,before_data,after_data)
        SELECT u.id,'superadmin',CASE WHEN ${input.status ?? null} IS NULL THEN 'merchant.label_updated' ELSE 'merchant.status_changed' END,
          'merchant',u.id,${input.reason ?? 'Actualización de etiqueta'},
          jsonb_build_object('status',t.status,'metadata',t.metadata),
          jsonb_build_object('status',u.status,'metadata',u.metadata,'actor_email',${user.email})
        FROM updated u JOIN target t ON t.id=u.id RETURNING id
      )
      SELECT u.id,u.status,u.metadata,a.id AS audit_log_id FROM updated u CROSS JOIN audit a
    `;
    const rows = Array.isArray(result) ? result : result.rows;
    if (!rows.length) return NextResponse.json({ error: 'No se encontró el comercio solicitado.' }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (error) {
    console.error('ARCREDIX admin merchants PATCH failed:', error);
    return NextResponse.json({ error: 'No se pudo guardar la información del comercio.' }, { status: 500 });
  }
}
