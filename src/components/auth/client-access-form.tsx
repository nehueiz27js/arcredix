'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LoaderCircle, KeyRound, ShieldCheck } from 'lucide-react';

export function ClientAccessForm() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/client-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No se pudo validar el identificador.');

      router.replace('/dashboard');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo conectar con el servicio de acceso.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className='w-full space-y-5' onSubmit={handleSubmit}>
      <div className='flex items-center gap-2 text-xs font-semibold tracking-wide text-emerald-300'>
        <ShieldCheck size={16} />
        ACCESO POR IDENTIFICADOR
      </div>

      <div className='space-y-2'>
        <label htmlFor='access-identifier' className='block text-sm font-medium text-slate-200'>Identificador de acceso</label>
        <div className='relative'>
          <KeyRound size={17} className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500' />
          <input
            id='access-identifier'
            name='identifier'
            type='text'
            autoComplete='off'
            autoCapitalize='none'
            spellCheck={false}
            required
            minLength={16}
            maxLength={43}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value.replace(/\s/g, ''))}
            placeholder='Pegá tu identificador de ARCREDIX'
            className='w-full rounded-lg border border-white/10 bg-slate-950/70 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-emerald-400'
          />
        </div>
        <p className='text-xs text-slate-500'>Ingresá el código de 16 caracteres que te entregó el administrador.</p>
      </div>

      {error ? (
        <p role='alert' className='rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300'>
          {error}
        </p>
      ) : null}

      <button
        type='submit'
        disabled={busy || !(identifier.replace(/[^A-Z0-9]/g, '').length === 16 || /^[A-Za-z0-9_-]{43}$/.test(identifier))}
        className='flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60'
      >
        {busy ? <LoaderCircle size={17} className='animate-spin' /> : <ArrowRight size={17} />}
        {busy ? 'Validando acceso…' : 'Ingresar a ARCREDIX'}
      </button>
    </form>
  );
}
