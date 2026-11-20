import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { MerchantManager } from '@/components/admin/merchant-manager';
import { auth } from '@/lib/auth/server';
import { isSuperAdminEmail } from '@/lib/auth/superadmin';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const { data: session } = await auth.getSession();
  const user = session?.user;

  if (!user?.id) redirect('/login');

  if (!isSuperAdminEmail(user.email)) {
    const configured = Boolean(process.env.ARCREDIX_SUPERADMIN_EMAILS?.trim());

    return (
      <main className="min-h-screen bg-[#050b12] px-5 py-12 text-white">
        <section className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-[#0b1721] p-8">
          <ShieldAlert className="mb-5 text-amber-300" size={34} />
          <p className="text-xs font-semibold tracking-[0.2em] text-emerald-300">ARCREDIX · CONTROL DE PLATAFORMA</p>
          <h1 className="mt-3 text-3xl font-bold">Acceso restringido</h1>
          <p className="mt-3 leading-7 text-slate-300">
            Esta cuenta no está habilitada como superadministrador. El acceso se concede mediante una lista privada de correos autorizados.
          </p>
          {!configured ? (
            <p className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">
              Falta configurar ARCREDIX_SUPERADMIN_EMAILS en las variables de entorno del proyecto.
            </p>
          ) : null}
          <div className="mt-7 flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-emerald-300 hover:text-emerald-200">Volver al panel</Link>
            <SignOutButton />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050b12] px-4 py-7 text-white sm:px-7">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-300">
              <ShieldCheck size={18} />
              <span className="text-xs font-semibold tracking-[0.2em]">ARCREDIX · SUPERADMIN</span>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Centro de control</h1>
            <p className="mt-1 text-sm text-slate-400">Gestión de comercios, estados y actividad de la plataforma.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">{user.email}</span>
            <SignOutButton />
          </div>
        </header>
        <nav aria-label="Módulos de administración" className="mb-6 flex flex-wrap gap-2">
          <Link href="/admin" className="rounded-lg border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 text-sm text-emerald-200">Comercios</Link>
          <Link href="/admin/planes" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:border-emerald-300/40">Planes</Link>
          <Link href="/admin/suscripciones" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:border-emerald-300/40">Suscripciones</Link>
        </nav>
        <MerchantManager />
      </div>
    </main>
  );
}
