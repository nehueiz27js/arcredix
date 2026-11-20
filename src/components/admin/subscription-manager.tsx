'use client';

import { useCallback, useEffect, useState } from 'react';

type Subscription = {
  id: string;
  merchant_id: string;
  legal_name: string;
  trade_name: string | null;
  merchant_email: string;
  plan_name: string;
  plan_code: string;
  status: string;
  billing_interval: string;
  price_usd: string | number;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  trialing: 'En prueba',
  active: 'Activa',
  past_due: 'Pago pendiente',
  grace_period: 'En gracia',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
  expired: 'Vencida',
};

function dateLabel(value: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function SubscriptionManager() {
  const [items, setItems] = useState<Subscription[]>([]);
  const [filter, setFilter] = useState('all');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ status: filter });
      const response = await fetch('/api/admin/subscriptions?' + params.toString(), { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudieron cargar las suscripciones.');
      setItems(payload.data ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function mutate(subscription: Subscription, action: 'extend' | 'set_status') {
    const reason = (reasons[subscription.id] ?? '').trim();
    if (reason.length < 4) {
      setError('Escribí un motivo de al menos 4 caracteres para registrar la acción.');
      return;
    }

    setSaving(subscription.id);
    setError('');
    setNotice('');

    try {
      const body = action === 'extend'
        ? { action, subscriptionId: subscription.id, days: 30, reason }
        : { action, subscriptionId: subscription.id, status: statuses[subscription.id] ?? subscription.status, reason };

      const response = await fetch('/api/admin/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo actualizar la suscripción.');
      setNotice(action === 'extend' ? 'Se agregaron 30 días al período.' : 'Estado de suscripción actualizado.');
      setReasons((current) => ({ ...current, [subscription.id]: '' }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error inesperado.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0b1721] p-4">
        <div>
          <h2 className="font-semibold">Cartera de suscripciones</h2>
          <p className="mt-1 text-xs text-slate-400">Cambios manuales con motivo y registro histórico.</p>
        </div>
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-lg border border-white/10 bg-[#07111a] px-3 text-sm text-white">
          <option value="all">Todos los estados</option>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {error ? <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{notice}</p> : null}

      {loading ? <p className="py-10 text-center text-sm text-slate-400">Cargando suscripciones…</p> : items.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-[#0b1721] p-6 text-sm text-slate-400">No hay suscripciones para este filtro.</p>
      ) : items.map((subscription) => (
        <article key={subscription.id} className="rounded-2xl border border-white/10 bg-[#0b1721] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">{subscription.trade_name || subscription.legal_name}</h3>
              <p className="mt-1 text-sm text-slate-400">{subscription.merchant_email}</p>
            </div>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">{statusLabels[subscription.status] ?? subscription.status}</span>
          </div>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <p><span className="text-slate-500">Plan</span><br />{subscription.plan_name}</p>
            <p><span className="text-slate-500">Precio</span><br />USD {Number(subscription.price_usd).toFixed(2)} / {subscription.billing_interval}</p>
            <p><span className="text-slate-500">Inicio del período</span><br />{dateLabel(subscription.current_period_start)}</p>
            <p><span className="text-slate-500">Vencimiento</span><br />{dateLabel(subscription.current_period_end)}</p>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px_auto_auto]">
            <input value={reasons[subscription.id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [subscription.id]: event.target.value }))} placeholder="Motivo obligatorio para auditoría" className="h-10 rounded-lg border border-white/10 bg-[#07111a] px-3 text-sm outline-none" />
            <select value={statuses[subscription.id] ?? subscription.status} onChange={(event) => setStatuses((current) => ({ ...current, [subscription.id]: event.target.value }))} className="h-10 rounded-lg border border-white/10 bg-[#07111a] px-3 text-sm text-white">
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <button type="button" onClick={() => void mutate(subscription, 'set_status')} disabled={saving === subscription.id} className="h-10 rounded-lg border border-white/15 px-3 text-sm text-white disabled:opacity-50">Guardar estado</button>
            <button type="button" onClick={() => void mutate(subscription, 'extend')} disabled={saving === subscription.id} className="h-10 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-[#04130e] disabled:opacity-50">+30 días</button>
          </div>
        </article>
      ))}
    </section>
  );
}
