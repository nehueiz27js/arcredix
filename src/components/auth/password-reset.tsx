'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';

import { authClient } from '@/lib/auth/client';

type PasswordResetProps = { mode: 'request' | 'reset' };

export function PasswordReset({ mode }: PasswordResetProps) {
  const router = useRouter();
  const [email, setEmail] = useState('cryptoarg01@gmail.com');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isReset = mode === 'reset';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      if (!isReset) {
        const result = await authClient.requestPasswordReset({
          email: email.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/restablecer-clave`,
        });

        if (result.error) throw new Error(result.error.message || 'No se pudo solicitar el correo.');
        setMessage('Si la cuenta existe, recibirás un correo con el enlace para configurar tu contraseña. Revisá también Spam.');
        return;
      }

      const token = new URLSearchParams(window.location.search).get('token');
      if (!token) throw new Error('El enlace no contiene un token válido. Solicitá uno nuevo.');

      if (password.length < 12) throw new Error('La contraseña debe tener al menos 12 caracteres.');
      if (password !== confirmPassword) throw new Error('Las contraseñas no coinciden.');

      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) throw new Error(result.error.message || 'El enlace venció o ya fue utilizado.');

      setMessage('Contraseña configurada. Ya podés iniciar sesión.');
      window.setTimeout(() => router.replace('/login'), 1400);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ocurrió un error inesperado.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
          {isReset ? <ShieldCheck size={21} /> : <Mail size={21} />}
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-emerald-300">SEGURIDAD ARCREDIX</p>
          <h2 className="mt-1 text-lg font-semibold text-white">{isReset ? 'Configurá tu contraseña' : 'Recuperar acceso'}</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isReset ? (
          <label className="block text-sm text-slate-300">
            Correo electrónico
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#07111a] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60"
              placeholder="tu@comercio.com"
            />
          </label>
        ) : (
          <>
            <label className="block text-sm text-slate-300">
              Nueva contraseña
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#07111a] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60"
                placeholder="Mínimo 12 caracteres"
              />
            </label>
            <label className="block text-sm text-slate-300">
              Confirmar contraseña
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#07111a] px-4 py-3 text-white outline-none transition focus:border-emerald-300/60"
                placeholder="Repetí la contraseña"
              />
            </label>
          </>
        )}

        {error ? <p role="alert" className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
        {message ? <p role="status" className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">{message}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 font-semibold text-[#04120f] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="animate-spin" size={18} /> : null}
          {busy ? 'Procesando…' : isReset ? 'Guardar contraseña' : 'Enviar enlace de configuración'}
        </button>
      </form>

      <Link href="/login" className="mt-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-emerald-300">
        <ArrowLeft size={15} /> Volver al inicio de sesión
      </Link>
    </div>
  );
}
