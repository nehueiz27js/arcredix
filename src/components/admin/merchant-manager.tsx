'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Copy, Plus, RefreshCw, Search, ShieldCheck, Tag } from 'lucide-react';

type MerchantStatus = 'pending' | 'active' | 'suspended' | 'cancelled';
type LabelColor = 'emerald' | 'blue' | 'violet' | 'amber' | 'rose' | 'cyan' | 'slate';
type Plan = { id: string; code: string; name: string; monthly_price_usd: string | number; connection_limit: number | null; is_active: boolean };
type Merchant = {
  id: string; legal_name: string; trade_name: string | null; owner_name: string | null;
  email: string; phone: string | null; whatsapp_phone: string | null; tax_id: string | null;
  status: MerchantStatus; created_at: string; metadata: Record<string, unknown>;
  plan_name: string | null; plan_code: string | null; subscription_status: string | null;
  billing_interval: string | null; price_usd: string | number | null;
  current_period_start: string | null; current_period_end: string | null;
  connection_limit: number | null; plan_features: Record<string, unknown> | null;
  users_count: number; connections_count: number; registers_count: number; qr_count: number;
};
type Stats = { merchants_total: number; merchants_pending: number; merchants_active: number; merchants_suspended: number; merchants_cancelled: number };
const emptyStats: Stats = { merchants_total: 0, merchants_pending: 0, merchants_active: 0, merchants_suspended: 0, merchants_cancelled: 0 };
const colorClasses: Record<LabelColor, string> = {
  emerald: 'bg-emerald-400', blue: 'bg-blue-400', violet: 'bg-violet-400',
  amber: 'bg-amber-400', rose: 'bg-rose-400', cyan: 'bg-cyan-400', slate: 'bg-slate-400',
};
const statusLabels: Record<MerchantStatus, string> = { pending: 'Pendiente', active: 'Activo', suspended: 'Suspendido', cancelled: 'Cancelado' };

function dateLabel(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(date);
}
function labelOf(merchant: Merchant) {
  const label = merchant.metadata?.admin_label as { name?: string | null; color?: LabelColor } | undefined;
  return { name: label?.name ?? '', color: label?.color ?? 'emerald' };
}
function money(value: string | number | null) {
  return value === null ? 'Sin plan' : 'USD ' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function MerchantManager() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [labelNames, setLabelNames] = useState<Record<string, string>>({});
  const [labelColors, setLabelColors] = useState<Record<string, LabelColor>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    legalName: '', tradeName: '', ownerName: '', email: '', phone: '', whatsappPhone: '', taxId: '',
    planCode: 'starter', billingInterval: 'month', status: 'pending',
    labelName: '', labelColor: 'emerald',
  });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ q: search, status: statusFilter });
      const response = await fetch('/api/admin/merchants?' + params.toString(), { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo cargar la cartera.');
      setMerchants(payload.data ?? []); setStats(payload.stats ?? emptyStats);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error inesperado.');
    } finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    fetch('/api/admin/plans', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json();
      if (response.ok) setPlans((payload.data ?? []).filter((plan: Plan) => plan.is_active));
    }).catch(() => setPlans([]));
  }, []);

  async function createMerchant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCreating(true); setError(''); setNotice(''); setInviteUrl('');
    try {
      const response = await fetch('/api/admin/merchants', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo dar de alta.');
      setInviteUrl(payload.invitation?.url ?? '');
      setNotice('Comercio creado. La vinculación de la cuenta del titular queda pendiente de invitación.');
      setShowCreate(false);
      setForm({ legalName: '', tradeName: '', ownerName: '', email: '', phone: '', whatsappPhone: '', taxId: '', planCode: 'starter', billingInterval: 'month', status: 'pending', labelName: '', labelColor: 'emerald' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error inesperado.');
    } finally { setCreating(false); }
  }

  async function updateStatus(merchant: Merchant, status: MerchantStatus) {
    const reason = (reasons[merchant.id] ?? '').trim();
    if (reason.length < 4) { setError('Indicá el motivo para activar o desactivar el comercio (mínimo 4 caracteres).'); return; }
    setPendingId(merchant.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/merchants', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json },
        body: JSON.stringify({ merchantId: merchant.id, status, reason }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo actualizar el estado.');
      setNotice(merchant.legal_name + ': estado guardado como ' + statusLabels[status] + '.');
      setReasons((current) => ({ ...current, [merchant.id]: '' }));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error inesperado.');
    } finally { setPendingId(null); }
  }

  async function saveLabel(merchant: Merchant) {
    setPendingId(merchant.id); setError(''); setNotice('');
    const oldLabel = labelOf(merchant);
    try {
      const response = await fetch('/api/admin/merchants', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json },
        body: JSON.stringify({ merchantId: merchant.id, labelName: labelNames[merchant.id] ?? oldLabel.name, labelColor: labelColors[merchant.id] ?? oldLabel.color }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? 'No se pudo guardar la etiqueta.');
      setNotice('Etiqueta guardada para ' + (merchant.trade_name || merchant.legal_name) + '.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error inesperado.');
    } finally { setPendingId(null); }
  }

  const cards = [
    { label: 'Clientes', value: stats.merchants_total },
    { label: 'Pendientes', value: stats.merchants_pending },
    { label: 'Activos', value: stats.merchants_active },
    { label: 'Suspendidos', value: stats.merchants_suspended },
  ];

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => <article key={card.label} className="rounded-xl border border-white/10 bg-[#0b1721] p-4">
          <p className="text-sm text-slate-400">{card.label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{card.value}</p>
        </article>)}
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-[#0b1721] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Cartera de clientes</h2><p className="mt-1 text-sm text-slate-400">Buscá por comercio, titular, contacto o etiqueta.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowCreate((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-300 px-3 py-2 text-sm font-semibold text-[#04130e] hover:bg-emerald-200"><Plus size={16} /> Alta de cliente</button>
            <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:border-emerald-300/50 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar</button>
          </div>
        </div>

        {showCreate && <form onSubmit={createMerchant} className="mt-5 rounded-xl border border-emerald-300/20 bg-[#07111a] p-4">
          <h3 className="font-semibold">Nuevo comercio y plan</h3>
          <p className="mt-1 text-xs text-slate-400">El registro comercial se crea ahora. El acceso del titular se vincula mediante invitación segura.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {([
              ['legalName','Razón social / nombre legal'],['tradeName','Nombre comercial'],['ownerName','Titular'],['email','Email de acceso'],['phone','Teléfono'],['whatsappPhone','WhatsApp'],['taxId','CUIT / identificación'],['labelName','Etiqueta (opcional)'],
            ] as const).map(([key, label]) => <label key={key} className="text-xs text-slate-400">{label}<input required={['legalName','ownerName','email'].includes(key)} type={key === 'email' ? 'email' : 'text'} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#0b1721] px-3 text-sm text-white outline-none focus:border-emerald-300/50" /></label>)}
            <label className="text-xs text-slate-400">Plan<select value={form.planCode} onChange={(event) => setForm((current) => ({ ...current, planCode: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#0b1721] px-3 text-sm text-white">{plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name} · {money(plan.monthly_price_usd)}/mes</option>)}</select></label>
            <label className="text-xs text-slate-400">Facturación<select value={form.billingInterval} onChange={(event) => setForm((current) => ({ ...current, billingInterval: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#0b1721] px-3 text-sm text-white"><option value="month">Mensual</option><option value="year">Anual</option><option value="one_time">Pago único · USD 390</option></select></label>
            <label className="text-xs text-slate-400">Estado inicial<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#0b1721] px-3 text-sm text-white"><option value="pending">Pendiente</option><option value="active">Activo</option></select></label>
            <label className="text-xs text-slate-400">Color etiqueta<select value={form.labelColor} onChange={(event) => setForm((current) => ({ ...current, labelColor: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#0b1721] px-3 text-sm text-white">{Object.keys(colorClasses).map((color) => <option key={color} value={color}>{color}</option>)}</select></label>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-white/15 px-4 py-2 text-sm">Cancelar</button><button disabled={creating || plans.length === 0} className="rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-[#04130e] disabled:opacity-50">{creating ? 'Creando…' : 'Crear cliente'}</button></div>
        </form>}

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_200px]">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#07111a] px-3"><Search size={16} className="text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar comercio, titular, email, WhatsApp o etiqueta" className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-slate-600" /></label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 rounded-lg border border-white/10 bg-[#07111a] px-3 text-sm text-white outline-none"><option value="all">Todos los estados</option><option value="pending">Pendientes</option><option value="active">Activos</option><option value="suspended">Suspendidos</option><option value="cancelled">Cancelados</option></select>
        </div>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-emerald-200">{notice}</p>}
        {inviteUrl && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-sm"><span className="text-amber-100">Invitación generada · vence en 7 días</span><button type="button" onClick={() => void navigator.clipboard.writeText(inviteUrl)} className="inline-flex items-center gap-2 text-amber-200 hover:text-white"><Copy size={15} /> Copiar enlace</button></div>}

        {loading ? <p className="py-12 text-center text-sm text-slate-400">Cargando clientes…</p> : merchants.length === 0 ? <div className="py-12 text-center"><Building2 className="mx-auto text-slate-600" size={30} /><p className="mt-3 text-sm text-slate-300">No hay clientes con estos filtros.</p></div> : <div className="mt-5 space-y-3">
          {merchants.map((merchant) => {
            const label = labelOf(merchant);
            const active = merchant.status === 'active';
            return <article key={merchant.id} className="rounded-xl border border-white/10 bg-[#07111a] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{merchant.trade_name || merchant.legal_name}</h3>
                    <span className={'rounded-full px-2.5 py-1 text-xs ' + (active ? 'bg-emerald-400/10 text-emerald-300' : merchant.status === 'suspended' || merchant.status === 'cancelled' ? 'bg-red-400/10 text-red-300' : 'bg-amber-300/10 text-amber-200')}>{statusLabels[merchant.status]}</span>
                    {label.name && <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-1 text-xs text-slate-300"><span className={'size-2 rounded-full ' + colorClasses[label.color]} />{label.name}</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{merchant.legal_name} · {merchant.owner_name || 'Titular sin informar'}</p>
                  <p className="mt-1 break-all text-sm text-slate-300">{merchant.email}{merchant.whatsapp_phone ? ' · WhatsApp ' + merchant.whatsapp_phone : ''}</p>
                </div>
                <div className="text-left sm:text-right"><p className="text-sm font-medium">{merchant.plan_name ?? 'Sin plan asignado'}</p><p className="mt-1 text-xs text-slate-400">{money(merchant.price_usd)} / {merchant.billing_interval === 'year' ? 'año' : merchant.billing_interval === 'one_time' ? 'único' : 'mes'}</p><p className="mt-1 text-xs text-slate-500">Límite conexiones: {merchant.connection_limit ?? 'Ilimitado'}</p></div>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2 xl:grid-cols-4">
                <p>Alta: <span className="text-slate-200">{dateLabel(merchant.created_at)}</span></p><p>Vencimiento: <span className="text-slate-200">{dateLabel(merchant.current_period_end)}</span></p><p>Usuarios: <span className="text-slate-200">{merchant.users_count}</span> · Conexiones: <span className="text-slate-200">{merchant.connections_count}</span></p><p>Cajas: <span className="text-slate-200">{merchant.registers_count}</span> · QRs: <span className="text-slate-200">{merchant.qr_count}</span></p>
              </div>
              <div className="mt-4 rounded-lg border border-white/5 bg-[#0b1721] p-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-300"><Tag size={14} /> Etiqueta del cliente</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px_auto]">
                  <input value={labelNames[merchant.id] ?? label.name} onChange={(event) => setLabelNames((current) => ({ ...current, [merchant.id]: event.target.value }))} placeholder="Ej. Plan Growth, prioridad, soporte…" className="h-9 min-w-0 rounded-md border border-white/10 bg-[#07111a] px-3 text-sm outline-none" />
                  <select value={labelColors[merchant.id] ?? label.color} onChange={(event) => setLabelColors((current) => ({ ...current, [merchant.id]: event.target.value as LabelColor }))} className="h-9 rounded-md border border-white/10 bg-[#07111a] px-2 text-sm text-white">{Object.keys(colorClasses).map((color) => <option key={color} value={color}>{color}</option>)}</select>
                  <button type="button" disabled={pendingId === merchant.id} onClick={() => void saveLabel(merchant)} className="h-9 rounded-md border border-white/15 px-3 text-sm hover:border-emerald-300/40 disabled:opacity-50">Guardar etiqueta</button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                <input value={reasons[merchant.id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [merchant.id]: event.target.value }))} placeholder="Motivo obligatorio para activar / desactivar" className="h-9 min-w-0 rounded-md border border-white/10 bg-[#0b1721] px-3 text-sm outline-none placeholder:text-slate-600" />
                <button type="button" disabled={pendingId === merchant.id || active} onClick={() => void updateStatus(merchant, 'active')} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-emerald-300 px-3 text-sm font-semibold text-[#04130e] disabled:opacity-40"><ShieldCheck size={14} /> Activar</button>
                <button type="button" disabled={pendingId === merchant.id || !active} onClick={() => void updateStatus(merchant, 'suspended')} className="h-9 rounded-md border border-red-300/20 px-3 text-sm text-red-200 hover:bg-red-300/5 disabled:opacity-40">Desactivar</button>
              </div>
            </article>;
          })}
        </div>}
      </div>
    </section>
  );
}
