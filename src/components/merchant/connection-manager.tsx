'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, CircleAlert, Mail, RefreshCw, Wallet } from 'lucide-react';

type Connection = {
  id: string;
  display_name: string;
  account_reference: string | null;
  status: string;
  last_verified_at: string | null;
  metadata: Record<string, unknown>;
  provider_code: string;
  provider_name: string;
};

const resultMessages: Record<string, string> = {
  'google-not-configured': 'Faltan las credenciales OAuth de Google en el servidor.',
  'google-access-denied': 'No autorizaste el acceso a Gmail.',
  'google-invalid-state': 'La validación de seguridad de Google no coincidió. Volvé a iniciar la conexión.',
  'google-server-not-configured': 'Falta configurar Google OAuth o la clave de cifrado.',
  'gmail-connected': 'Gmail quedó conectado y el seguimiento de cambios está activo.',
  'gmail-authorized-watch-pending': 'Google autorizó Gmail, pero falta configurar correctamente Pub/Sub.',
  'gmail-authorized-pubsub-pending': 'Gmail quedó autorizado. Falta configurar Pub/Sub para recibir avisos automáticos.',
  'gmail-connection-failed': 'No se pudo completar la conexión Gmail. Revisá los registros del servidor.',
  'mercado-pago-not-configured': 'Faltan las credenciales OAuth de Mercado Pago.',
  'mercado-pago-denied': 'No autorizaste Mercado Pago.',
  'mercado-pago-invalid-state': 'La validación de seguridad de Mercado Pago falló.',
  'mercado-pago-server-not-configured': 'Falta configurar Mercado Pago o la clave de cifrado.',
  'mercado-pago-authorized-webhook-pending': 'Mercado Pago quedó autorizado. Falta configurar la URL webhook de la aplicación.',
  'mercado-pago-connection-failed': 'No se pudo completar la conexión con Mercado Pago.',
};

function statusLabel(status: string) {
  return ({ active: 'Activa', pending: 'Pendiente de configuración', error: 'Error', disconnected: 'Desconectada' } as Record<string, string>)[status] || status;
}
function date(value: string | null) {
  if (!value) return 'Sin verificación';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

export function ConnectionManager() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [senders, setSenders] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/merchant/connections', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar las conexiones.');
      const items = (payload.data || []) as Connection[];
      setConnections(items);
      setSenders(Object.fromEntries(items.filter((x) => x.provider_code === 'bank_gmail')
        .map((x) => [x.id, Array.isArray(x.metadata.allowed_senders) ? (x.metadata.allowed_senders as string[]).join('\n') : ''])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error inesperado.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const result = new URLSearchParams(window.location.search).get('result');
    if (result && resultMessages[result]) setNotice(resultMessages[result]);
  }, [load]);

  async function saveSenders(event: FormEvent, connectionId: string) {
    event.preventDefault();
    setSavingId(connectionId); setError(''); setNotice('');
    const list = (senders[connectionId] || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    try {
      const response = await fetch('/api/merchant/connections/gmail/senders', {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connectionId, senders: list }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar.');
      setNotice('Remitentes bancarios guardados. Los correos de otras direcciones serán ignorados.');
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Error inesperado.'); }
    finally { setSavingId(''); }
  }

  const wallets = connections.filter((x) => x.provider_code !== 'bank_gmail');
  const banks = connections.filter((x) => x.provider_code === 'bank_gmail');

  return (
    <div className="space-y-6">
      {(error || notice) && <div role="status" className={'rounded-xl border p-4 text-sm ' + (error ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-emerald-300/20 bg-emerald-300/5 text-emerald-100')}>{error || notice}</div>}

      <section className="rounded-2xl border border-white/10 bg-[#0b1721] p-5 sm:p-6">
        <div className="flex items-center gap-3"><Wallet className="text-emerald-300" /><div><h2 className="text-xl font-semibold">1. Billeteras y plataformas de pago</h2><p className="mt-1 text-sm text-slate-400">Conexión directa, webhooks y consulta autenticada del pago original.</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <article className="rounded-xl border border-white/10 bg-[#07111a] p-4">
            <h3 className="font-semibold">Mercado Pago</h3>
            <p className="mt-1 text-sm text-slate-400">OAuth por comercio. La recepción se realiza en una URL webhook central de ARCREDIX.</p>
            <a href="/api/merchant/connections/mercado-pago/start" className="mt-4 inline-flex rounded-lg bg-emerald-300 px-4 py-2 text-sm font-semibold text-[#04130e]">Conectar Mercado Pago</a>
          </article>
          <article className="rounded-xl border border-white/10 bg-[#07111a] p-4">
            <h3 className="font-semibold">Ualá Bis</h3>
            <p className="mt-1 text-sm text-slate-400">Pendiente de validar el acceso por comercio y el alcance de consulta de pagos entrantes. No se presenta como conexión lista.</p>
            <span className="mt-4 inline-flex rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-500">Integración en evaluación</span>
          </article>
        </div>
        <div className="mt-5 rounded-lg border border-white/10 bg-[#07111a] p-4">
          <p className="text-sm font-medium text-slate-200">Webhook central de Mercado Pago</p>
          <code className="mt-2 block break-all rounded bg-black/30 p-2 text-xs text-emerald-200">/api/webhooks/mercado-pago</code>
          <p className="mt-2 text-xs text-slate-500">Se configura una sola vez en la aplicación de ARCREDIX en Mercado Pago Developers. La cuenta del vendedor se identifica mediante el user_id del evento.</p>
        </div>
        <div className="mt-5 space-y-3">
          {wallets.map((item) => <ConnectionCard key={item.id} item={item} />)}
          {!loading && wallets.length === 0 && <p className="text-sm text-slate-500">Todavía no conectaste billeteras.</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0b1721] p-5 sm:p-6">
        <div className="flex items-center gap-3"><Mail className="text-sky-300" /><div><h2 className="text-xl font-semibold">2. Bancos por correo electrónico</h2><p className="mt-1 text-sm text-slate-400">Conectá Gmail con Google OAuth y definí los remitentes oficiales de tus bancos.</p></div></div>
        <div className="mt-4 rounded-lg border border-sky-300/15 bg-sky-300/5 p-3 text-sm text-sky-100">ARCREDIX solo registra el aviso como evidencia no verificada. No aprueba una transferencia basándose únicamente en un correo.</div>
        <a href="/api/merchant/connections/gmail/start" className="mt-4 inline-flex rounded-lg border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-sm font-semibold text-sky-100">Conectar cuenta Gmail con Google</a>
        <div className="mt-5 space-y-4">
          {banks.map((item) => <article key={item.id} className="rounded-xl border border-white/10 bg-[#07111a] p-4">
            <ConnectionCard item={item} />
            <form onSubmit={(event) => void saveSenders(event, item.id)} className="mt-4 border-t border-white/10 pt-4">
              <label htmlFor={'senders-' + item.id} className="block text-sm font-medium">Remitentes bancarios autorizados</label>
              <textarea id={'senders-' + item.id} value={senders[item.id] || ''} onChange={(event) => setSenders((old) => ({ ...old, [item.id]: event.target.value }))} rows={3} placeholder={'notificaciones@banco.com\navisos@otro-banco.com'} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:border-sky-300/50" />
              <p className="mt-1 text-xs text-slate-500">Una dirección exacta por línea. Solo esos remitentes se procesarán.</p>
              <button disabled={savingId === item.id} className="mt-3 rounded-lg border border-sky-300/30 px-4 py-2 text-sm text-sky-100 disabled:opacity-50">{savingId === item.id ? 'Guardando…' : 'Guardar remitentes'}</button>
            </form>
          </article>)}
          {!loading && banks.length === 0 && <p className="text-sm text-slate-500">Todavía no conectaste una cuenta Gmail.</p>}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>Las conexiones pertenecen exclusivamente a este comercio.</span>
        <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-slate-300"><RefreshCw size={14} /> Actualizar</button>
      </div>
      {loading && <p className="text-center text-sm text-slate-500">Cargando conexiones…</p>}
    </div>
  );
}

function ConnectionCard({ item }: { item: Connection }) {
  const active = item.status === 'active';
  return <article className="rounded-xl border border-white/10 bg-[#07111a] p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="font-medium">{item.display_name}</h3><p className="mt-1 text-xs text-slate-500">{item.account_reference || item.provider_name}</p></div>
      <span className={'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ' + (active ? 'border-emerald-300/30 text-emerald-200' : 'border-amber-300/30 text-amber-200')}>
        {active ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />}{statusLabel(item.status)}
      </span>
    </div>
    <p className="mt-2 text-xs text-slate-500">Última verificación: {date(item.last_verified_at)}</p>
  </article>;
}
