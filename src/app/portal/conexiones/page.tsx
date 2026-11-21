import { redirect } from 'next/navigation';
import { Cable, ShieldCheck } from 'lucide-react';

import { getCurrentMerchantMembership } from '@/lib/auth/authorization';
import { authorizeMerchant } from '@/lib/auth/authorization';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { ConnectionManager } from '@/components/merchant/connection-manager';

export const dynamic = 'force-dynamic';

export default async function ConnectionsPage() {
  const currentMembership = await getCurrentMerchantMembership();
  if (!currentMembership) redirect('/login');
  const membership = await authorizeMerchant('settings.manage');
  if (!membership) redirect('/portal');

  return (
    <main className="min-h-screen bg-[#050b12] px-4 py-8 text-white sm:px-7">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div><div className="flex items-center gap-2 text-emerald-300"><Cable size={18} /><span className="text-xs font-semibold tracking-[0.2em]">ARCREDIX · CONFIGURACIÓN</span></div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Conexiones financieras</h1>
            <p className="mt-1 text-sm text-slate-400">Administrá billeteras y notificaciones bancarias desde un solo lugar.</p></div>
          <div className="flex items-center gap-3"><a href="/portal" className="text-sm text-emerald-300 hover:text-emerald-200">Volver al panel</a><SignOutButton mode='client' /></div>
        </header>
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/5 p-4 text-sm text-emerald-100"><ShieldCheck size={18} className="mt-0.5 shrink-0" /><p>Las credenciales se almacenan cifradas. ARCREDIX nunca solicita ni guarda contraseñas bancarias o de Google.</p></div>
        <ConnectionManager />
      </div>
    </main>
  );
}
