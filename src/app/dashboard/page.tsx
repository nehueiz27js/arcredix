import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, Clock3, ShieldCheck } from 'lucide-react';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { auth } from '@/lib/auth/server';
import { getAuthenticatedDatabase } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

type MerchantDashboardRecord = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  status: string;
  email: string | null;
  whatsapp_phone: string | null;
  role: string;
  subscription_status: string | null;
  billing_interval: string | null;
  current_period_end: string | Date | null;
  plan_name: string | null;
};

function formatDate(value: string | Date | null): string {
  if (!value) return 'Sin fecha registrada';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha registrada';

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

function statusLabel(status: string | null): string {
  if (!status) return 'Sin suscripción';
  const labels: Record<string, string> = {
    active: 'Activa',
    trialing: 'En prueba',
    pending: 'Pendiente',
    past_due: 'Pago pendiente',
    canceled: 'Cancelada',
    suspended: 'Suspendida',
    expired: 'Vencida',
  };
  return labels[status] ?? status;
}

export default async function DashboardPage() {
  const { data: session } = await auth.getSession();
  const user = session?.user;

  if (!user?.id) redirect('/login');

  const sql = await getAuthenticatedDatabase();
  const result = await sql`
    SELECT
      m.id,
      m.legal_name,
      m.trade_name,
      m.status,
      m.email,
      m.whatsapp_phone,
      mu.role,
      s.status AS subscription_status,
      s.billing_interval,
      s.current_period_end,
      s.plan_name
    FROM public.merchant_users mu
    INNER JOIN public.merchants m ON m.id = mu.merchant_id
    LEFT JOIN LATERAL (
      SELECT
        subscriptions.status,
        subscriptions.billing_interval,
        subscriptions.current_period_end,
        plans.name AS plan_name
      FROM public.subscriptions
      INNER JOIN public.plans ON plans.id = subscriptions.plan_id
      WHERE subscriptions.merchant_id = m.id
      ORDER BY subscriptions.created_at DESC
      LIMIT 1
    ) s ON true
    WHERE mu.auth_subject = ${user.id}
      AND mu.status = 'active'
      AND m.status = 'active'
    LIMIT 1
  `;

  const rows = Array.isArray(result) ? result : result.rows;
  const merchant = rows[0] as MerchantDashboardRecord | undefined;

  if (!merchant) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050b12] px-5 py-12 text-white">
        <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0b1721] p-8">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
            <ShieldCheck size={25} />
          </div>
          <p className="text-xs font-semibold tracking-[0.2em] text-emerald-300">ARCREDIX · ÁREA DE COMERCIOS</p>
          <h1 className="mt-3 text-2xl font-bold">Cuenta sin comercio asignado</h1>
          <p className="mt-3 leading-7 text-slate-300">
            Tu usuario inició sesión correctamente, pero todavía no tiene un comercio activo vinculado.
            Contactá al administrador de la plataforma para completar el alta.
          </p>
          <div className="mt-7">
            <SignOutButton />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050b12] px-4 py-8 text-white sm:px-7">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-300">
              <ShieldCheck size={18} />
              <span className="text-xs font-semibold tracking-[0.2em]">ARCREDIX · PANEL DE COMERCIO</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Panel principal</h1>
            <p className="mt-1 text-sm text-slate-400">Estado de tu cuenta y suscripción.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">{user.email}</span>
            <SignOutButton />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-[#0b1721] p-6">
            <div className="flex items-center gap-2 text-emerald-300">
              <Building2 size={18} />
              <span className="text-xs font-semibold tracking-[0.16em]">COMERCIO</span>
            </div>
            <h2 className="mt-4 text-xl font-semibold">{merchant.trade_name || merchant.legal_name}</h2>
            {merchant.trade_name && <p className="mt-1 text-sm text-slate-400">{merchant.legal_name}</p>}
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Estado</dt>
                <dd className="font-medium">{merchant.status === 'active' ? 'Activo' : merchant.status}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Correo</dt>
                <dd className="text-right">{merchant.email || 'No registrado'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">WhatsApp</dt>
                <dd className="text-right">{merchant.whatsapp_phone || 'No vinculado'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Rol</dt>
                <dd className="text-right">{merchant.role}</dd>
              </div>
            </dl>
          </article>

          <article className="rounded-2xl border border-white/10 bg-[#0b1721] p-6">
            <div className="flex items-center gap-2 text-emerald-300">
              <Clock3 size={18} />
              <span className="text-xs font-semibold tracking-[0.16em]">SUSCRIPCIÓN</span>
            </div>
            <h2 className="mt-4 text-xl font-semibold">{merchant.plan_name || 'Plan no asignado'}</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Estado</dt>
                <dd className="font-medium">{statusLabel(merchant.subscription_status)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Facturación</dt>
                <dd className="text-right">{merchant.billing_interval || 'No definida'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-400">Vencimiento del período</dt>
                <dd className="text-right">{formatDate(merchant.current_period_end)}</dd>
              </div>
            </dl>
          </article>
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-slate-500">
          <span>ARCREDIX · Validá tus cobros. Evitá estafas.</span>
          <Link href="/login" className="text-emerald-300 hover:text-emerald-200">Volver al acceso</Link>
        </footer>
      </div>
    </main>
  );
}
