'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, RefreshCw, Search, ShieldCheck } from 'lucide-react';

type MerchantStatus = 'pending' | 'active' | 'suspended' | 'cancelled';

type Merchant = {
  id: string;
  legal_name: string;
  trade_name: string | null;
  owner_name: string | null;
  email: string;
  phone: string | null;
  whatsapp_phone: string | null;
  tax_id: string | null;
  status: MerchantStatus;
  created_at: string;
  plan_name: string | null;
  plan_code: string | null;
  subscription_status: string | null;
  billing_interval: string | null;
  price_usd: string | number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  users_count: number;
  connections_count: number;
  registers_count: number;
  qr_count: number;
};

type Stats = {
  merchants_total: number;
  merchants_pending: number;
  merchants_active: number;
  merchants_suspended: number;
  merchants_cancelled: number;
};

const emptyStats: Stats = {
  merchants_total: 0,
  merchants_pending: 0,
  merchants_active: 0,
  merchants_suspended: 0,
  merchants_cancelled: 0,
};

const statusLabels: Record<MerchantStatus, string> = {
  pending: 'Pendiente',
  active: 'Activo',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
};

function dateLabel(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date);
}

export function MerchantManager() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [nextStatuses, setNextStatuses] = useState<Record<string, MerchantStatus>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ q: search, status: statusFilter });
      const response = await fetch('/api/admin/merchants?' + params.toString(), { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo cargar la cartera.');
      setMerchants(payload.data ?? []);
      setStats(payload.stats ?? emptyStats);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [load]);

  async function updateStatus(merchant: Merchant) {
    const nextStatus = nextStatuses[merchant.id] ?? merchant.status;
    const reason = (reasons[merchant.id] ?? '').trim();
    if (nextStatus === merchant.status) {
      setError('Seleccioná un estado distinto al actual.');
      return;
    }
    if (reason.length < 4) {
      setError('Escribí el motivo del cambio antes de actualizar el estado.');
      return;
    }

    setPendingId(merchant.id);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/merchants', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId: merchant.id, status: nextStatus, reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo actualizar el comercio.');
      setNotice(`${merchant.legal_name}: estado actualizado a ${statusLabels[nextStatus]}.`);
      setReasons((current) => ({ ...current, [merchant.id]: '' }));
      setNextStatuses((current) => {
        const updated = { ...current };
        delete updated[merchant.id];
        return updated;
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error inesperado.');
    } finally {
      setPendingId(null);
    }
  }

  const cards = [
    { label: 'Comercios', value: stats.merchants_total },
    { label: 'Pendientes', value: stats.merchants_pending },
    { label: 'Activos', value: stats.merchants_active },
    { label: 'Suspendidos', value: stats.merchants_suspended },
  ];

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-xl border border-white/10 bg-[#0b1721] p-5">
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{card.value}</p>
          </article>
        ))}
      </div>

      <div className="mt-7 rounded-xl border border-white/10 bg-[#0b1721] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Comercios registrados</h2>
            <p className="mt-1 text-sm text-slate-400">Hasta 200 registros, ordenados por fecha de alta.</p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:border-emerald-300/50 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_210px]">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#07111a] px-3">
            <Search size={16} className="text-slate-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar comercio, titular, email o WhatsApp" className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-slate-600" />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-lg border border-white/10 bg-[#07111a] px-3 text-sm text-white outline-none">
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="active">Activos</option>
            <option value="suspended">Suspendidos</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>

        {error ? <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p> : null}
        {notice ? <p role="status" className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{notice}</p> : null}

        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">Cargando comercios…</p>
        ) : merchants.length === 0 ? (
          <div className="py-14 text-center">
            <Building2 className="mx-auto text-slate-600" size={30} />
            <p className="mt-3 text-sm text-slate-300">No hay comercios para mostrar con estos filtros.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {merchants.map((merchant) => (
              <article key={merchant.id} className="rounded-xl border border-white/10 bg-[#07111a] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{merchant.trade_name || merchant.legal_name}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs ${merchant.status === 'active' ? 'bg-emerald-400/10 text-emerald-300' : merchant.status === 'suspended' || merchant.status === 'cancelled' ? 'bg-red-400/10 text-red-300' : 'bg-amber-300/10 text-amber-200'}`}>
                        {statusLabels[merchant.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{merchant.legal_name} · {merchant.owner_name || 'Titular sin informar'}</p>
                    <p className="mt-1 break-all text-sm text-slate-300">{merchant.email}{merchant.whatsapp_phone ? ` · WhatsApp ${merchant.whatsapp_phone}` : ''}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-medium">{merchant.plan_name ?? 'Sin plan asignado'}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {merchant.price_usd !== null ? `USD ${Number(merchant.price_usd).toFixed(2)} / ${merchant.billing_interval === 'year' ? 'año' : merchant.billing_interval === 'one_time' ? 'único' : 'mes'}` : 'Sin suscripción'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                  <p>Alta: <span className="text-slate-200">{dateLabel(merchant.created_at)}</span></p>
                  <p>Vencimiento: <span className="text-slate-200">{dateLabel(merchant.current_period_end)}</span></p>
                  <p>Usuarios: <span className="text-slate-200">{merchant.users_count}</span> · Conexiones: <span className="text-slate-200">{merchant.connections_count}</span></p>
                  <p>Cajas: <span className="text-slate-200">{merchant.registers_count}</span> · QRs: <span className="text-slate-200">{merchant.qr_count}</span></p>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-[1fr_190px_auto]">
                  <input
                    value={reasons[merchant.id] ?? ''}
                    onChange={(event) => setReasons((current) => ({ ...current, [merchant.id]: event.target.value }))}
                    placeholder="Motivo obligatorio para auditar el cambio"
                    className="h-10 min-w-0 rounded-lg border border-white/10 bg-[#0b1721] px-3 text-sm outline-none placeholder:text-slate-600 focus:border-emerald-300/50"
                  />
                  <select
                    aria-label={`Nuevo estado de ${merchant.legal_name}`}
                    value={nextStatuses[merchant.id] ?? merchant.status}
                    onChange={(event) => setNextStatuses((current) => ({ ...current, [merchant.id]: event.target.value as MerchantStatus }))}
                    className="h-10 rounded-lg border border-white/10 bg-[#0b1721] px-3 text-sm text-white outline-none"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="active">Activo</option>
                    <option value="suspended">Suspendido</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                  <button
                    type="button"
                    disabled={pendingId === merchant.id}
                    onClick={() => void updateStatus(merchant)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-4 text-sm font-semibold text-[#04130e] hover:bg-emerald-300 disabled:opacity-50"
                  >
                    <ShieldCheck size={15} /> {pendingId === merchant.id ? 'Guardando…' : 'Aplicar estado'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
