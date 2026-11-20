'use client';

import { useCallback, useEffect, useState } from 'react';

type Plan = {
  id: string;
  code: string;
  name: string;
  monthly_price_usd: string | number;
  connection_limit: number | null;
  features: Record<string, unknown>;
  is_active: boolean;
  current_subscriptions: number;
};

type Draft = {
  name: string;
  monthlyPriceUsd: string;
  connectionLimit: string;
  isActive: boolean;
  reason: string;
};

export function PlanManager() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newPlan, setNewPlan] = useState({ code: '', name: '', monthlyPriceUsd: '', connectionLimit: '3' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/plans', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudieron cargar los planes.');

      const items = (payload.data ?? []) as Plan[];
      setPlans(items);
      setDrafts(Object.fromEntries(items.map((plan) => [plan.id, {
        name: plan.name,
        monthlyPriceUsd: String(plan.monthly_price_usd),
        connectionLimit: plan.connection_limit === null ? '' : String(plan.connection_limit),
        isActive: plan.is_active,
        reason: '',
      }])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving('new');
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newPlan.code.trim().toLowerCase(),
          name: newPlan.name.trim(),
          monthlyPriceUsd: Number(newPlan.monthlyPriceUsd),
          connectionLimit: newPlan.connectionLimit === '' ? null : Number(newPlan.connectionLimit),
          features: {},
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo crear el plan.');
      setNewPlan({ code: '', name: '', monthlyPriceUsd: '', connectionLimit: '3' });
      setNotice('Plan creado y registrado en auditoría.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error inesperado.');
    } finally {
      setSaving(null);
    }
  }

  async function updatePlan(plan: Plan) {
    const draft = drafts[plan.id];
    if (!draft || draft.reason.trim().length < 4) {
      setError('Cada cambio necesita un motivo de auditoría de al menos 4 caracteres.');
      return;
    }

    setSaving(plan.id);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/admin/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          name: draft.name.trim(),
          monthlyPriceUsd: Number(draft.monthlyPriceUsd),
          connectionLimit: draft.connectionLimit === '' ? null : Number(draft.connectionLimit),
          isActive: draft.isActive,
          reason: draft.reason.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo actualizar el plan.');
      setNotice(`${plan.code}: cambios guardados.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error inesperado.');
    } finally {
      setSaving(null);
    }
  }

  function patchDraft(planId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [planId]: { ...current[planId], ...patch },
    }));
  }

  return (
    <section className="space-y-6">
      <form onSubmit={createPlan} className="rounded-2xl border border-white/10 bg-[#0b1721] p-5">
        <h2 className="text-lg font-semibold">Crear plan</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <input required minLength={2} maxLength={40} pattern="[a-z0-9_]+" value={newPlan.code} onChange={(event) => setNewPlan((current) => ({ ...current, code: event.target.value }))} placeholder="Código (ej. enterprise)" className="h-11 rounded-lg border border-white/10 bg-[#07111a] px-3 text-sm outline-none" />
          <input required minLength={2} maxLength={80} value={newPlan.name} onChange={(event) => setNewPlan((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre comercial" className="h-11 rounded-lg border border-white/10 bg-[#07111a] px-3 text-sm outline-none" />
          <input required type="number" min="0" step="0.01" value={newPlan.monthlyPriceUsd} onChange={(event) => setNewPlan((current) => ({ ...current, monthlyPriceUsd: event.target.value }))} placeholder="Precio mensual USD" className="h-11 rounded-lg border border-white/10 bg-[#07111a] px-3 text-sm outline-none" />
          <input type="number" min="1" step="1" value={newPlan.connectionLimit} onChange={(event) => setNewPlan((current) => ({ ...current, connectionLimit: event.target.value }))} placeholder="Conexiones (vacío = ilimitadas)" className="h-11 rounded-lg border border-white/10 bg-[#07111a] px-3 text-sm outline-none" />
        </div>
        <button type="submit" disabled={saving === 'new'} className="mt-4 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#04130e] disabled:opacity-50">{saving === 'new' ? 'Creando…' : 'Crear plan'}</button>
      </form>

      {error ? <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{notice}</p> : null}

      {loading ? <p className="py-10 text-center text-sm text-slate-400">Cargando planes…</p> : plans.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-[#0b1721] p-6 text-sm text-slate-400">No hay planes registrados.</p>
      ) : plans.map((plan) => {
        const draft = drafts[plan.id];
        if (!draft) return null;

        return (
          <article key={plan.id} className="rounded-2xl border border-white/10 bg-[#0b1721] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-emerald-300">{plan.code}</p>
                <p className="mt-1 text-sm text-slate-400">{plan.current_subscriptions} suscripciones actuales</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={draft.isActive} onChange={(event) => patchDraft(plan.id, { isActive: event.target.checked })} />
                Plan activo
              </label>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="text-xs text-slate-400">Nombre
                <input value={draft.name} onChange={(event) => patchDraft(plan.id, { name: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#07111a] px-3 text-sm text-white" />
              </label>
              <label className="text-xs text-slate-400">Precio mensual USD
                <input type="number" min="0" step="0.01" value={draft.monthlyPriceUsd} onChange={(event) => patchDraft(plan.id, { monthlyPriceUsd: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#07111a] px-3 text-sm text-white" />
              </label>
              <label className="text-xs text-slate-400">Límite de conexiones (vacío = ilimitadas)
                <input type="number" min="1" step="1" value={draft.connectionLimit} onChange={(event) => patchDraft(plan.id, { connectionLimit: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#07111a] px-3 text-sm text-white" />
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
              <input value={draft.reason} onChange={(event) => patchDraft(plan.id, { reason: event.target.value })} placeholder="Motivo obligatorio para auditoría" className="h-10 rounded-lg border border-white/10 bg-[#07111a] px-3 text-sm outline-none" />
              <button type="button" onClick={() => void updatePlan(plan)} disabled={saving === plan.id} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-[#04130e] disabled:opacity-50">{saving === plan.id ? 'Guardando…' : 'Guardar cambios'}</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
