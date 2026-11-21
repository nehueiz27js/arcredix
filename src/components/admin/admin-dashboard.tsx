'use client';

import { useEffect, useState } from 'react';
import { Activity, Building2, CalendarClock, CircleDollarSign, Users } from 'lucide-react';

type Merchant = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  owner_name: string | null;
  email: string;
  status: string;
  plan_name: string | null;
  price_usd: string | number | null;
  billing_interval: string | null;
  current_period_end: string | null;
  created_at: string;
};
type Stats = { merchants_total: number; merchants_pending: number; merchants_active: number; merchants_suspended: number; merchants_cancelled: number };

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(date);
}

export function AdminDashboard() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/merchants?status=all', { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? 'No se pudo cargar el dashboard.');
        if (!cancelled) {
          setMerchants(payload.data ?? []);
          setStats(payload.stats ?? null);
        }
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Error inesperado.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const recurring = merchants.reduce((total, merchant) => {
    if (merchant.status !== 'active' || merchant.billing_interval === 'one_time' || merchant.price_usd === null) return total;
    const amount = Number(merchant.price_usd);
    return total + (merchant.billing_interval === 'year' ? amount / 12 : amount);
  }, 0);
  const dueSoon = merchants.filter((merchant) => {
    if (!merchant.current_period_end || merchant.status !== 'active') return false;
    const days = (new Date(merchant.current_period_end).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 7;
  }).length;
  const cards = [
    { label: 'Clientes registrados', value: stats?.merchants_total ?? 0, icon: Building2 },
    { label: 'Clientes activos', value: stats?.merchants_active ?? 0, icon: Activity },
    { label: 'Pendientes de activar', value: stats?.merchants_pending ?? 0, icon: Users },
    { label: 'Vencen en 7 días', value: dueSoon, icon: CalendarClock },
  ];

  return (
    <main className="min-h-screen px-4 py-7 sm:px-7">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-7 border-b border-white/10 pb-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-emerald-300">ARCREDIX · SUPERADMIN</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">Resumen general de clientes, suscripciones y facturación.</p>
        </header>

        {error && <p role="alert" className="mb-4 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, icon: Icon }) => (
            <article key={label} className="rounded-xl border border-white/10 bg-[#0b1721] p-5">
              <div className="flex items-center justify-between text-slate-400"><span className="text-sm">{label}</span><Icon size={18} className="text-emerald-300" /></div>
              <p className="mt-3 text-3xl font-semibold tabular-nums">{loading ? '—' : value}</p>
            </article>
          ))}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <article className="rounded-xl border border-white/10 bg-[#0b1721] p-5">
            <div className="flex items-center gap-2 text-emerald-300"><CircleDollarSign size={18} /><h2 className="font-semibold text-white">Facturación mensual estimada</h2></div>
            <p className="mt-5 text-3xl font-semibold tabular-nums">USD {recurring.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="mt-2 text-xs text-slate-500">Suma de planes activos. Los pagos únicos no se incluyen.</p>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-sm">
              <div><p className="text-slate-500">Suspendidos</p><p className="mt-1 text-xl font-semibold">{stats?.merchants_suspended ?? '—'}</p></div>
              <div><p className="text-slate-500">Cancelados</p><p className="mt-1 text-xl font-semibold">{stats?.merchants_cancelled ?? '—'}</p></div>
            </div>
          </article>

          <article className="rounded-xl border border-white/10 bg-[#0b1721] p-5">
            <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Últimos clientes registrados</h2><span className="text-xs text-slate-500">Hasta 200 registros</span></div>
            {loading ? <p className="py-8 text-center text-sm text-slate-500">Cargando…</p> : merchants.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Todavía no hay clientes registrados.</p> : (
              <div className="mt-4 divide-y divide-white/5">
                {merchants.slice(0, 6).map((merchant) => (
                  <div key={merchant.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{merchant.trade_name || merchant.legal_name}</p><p className="mt-1 truncate text-xs text-slate-500">{merchant.owner_name || merchant.email} · {merchant.plan_name || 'Sin plan'}</p></div>
                    <div className="text-right"><p className="text-xs text-slate-300">{merchant.status === 'active' ? 'Activo' : merchant.status === 'pending' ? 'Pendiente' : merchant.status}</p><p className="mt-1 text-xs text-slate-500">{formatDate(merchant.created_at)}</p></div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
