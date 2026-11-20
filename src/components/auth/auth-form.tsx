'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react';

import { authClient } from '@/lib/auth/client';

type AuthFormProps = { mode: 'login' | 'register' };

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message || 'No se pudo iniciar sesión. Revisá tus credenciales.');
        return;
      }

      router.replace('/admin');
      router.refresh();
    } catch {
      setError('No se pudo conectar con el servicio de autenticación. Intentá nuevamente.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'register') {
    return (
      <div className='w-full rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100'>
        El alta de comercios está administrada exclusivamente desde ARCREDIX Superadmin.
      </div>
    );
  }

  return (
    <form className='w-full space-y-5' onSubmit={handleSubmit}>
      <div className='flex items-center gap-2 text-xs font-semibold tracking-wide text-emerald-300'>
        <ShieldCheck size={16} />
        ACCESO SEGURO
      </div>

      <div className='space-y-2'>
        <label htmlFor='auth-email' className='block text-sm font-medium text-slate-200'>Correo electrónico</label>
        <input
          id='auth-email'
          name='email'
          type='email'
          autoComplete='username'
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder='nombre@empresa.com'
          className='w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400'
        />
      </div>

      <div className='space-y-2'>
        <label htmlFor='auth-password' className='block text-sm font-medium text-slate-200'>Contraseña</label>
        <input
          id='auth-password'
          name='password'
          type='password'
          autoComplete='current-password'
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder='Ingresá tu contraseña'
          className='w-full rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-400'
        />
      </div>

      {error ? (
        <p role='alert' className='rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300'>
          {error}
        </p>
      ) : null}

      <button
        type='submit'
        disabled={busy || !email.trim() || !password}
        className='flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-5 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60'
      >
        {busy ? <LoaderCircle size={17} className='animate-spin' /> : <ArrowRight size={17} />}
        {busy ? 'Ingresando…' : 'Ingresar a ARCREDIX'}
      </button>
    </form>
  );
}
