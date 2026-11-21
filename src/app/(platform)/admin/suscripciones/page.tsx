import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/server';
import { isSuperAdminEmail } from '@/lib/auth/superadmin';
import { SubscriptionManager } from '@/components/admin/subscription-manager';

export const dynamic = 'force-dynamic';

export default async function AdminSubscriptionsPage() {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  if (!user?.id) redirect('/login');
  if (!isSuperAdminEmail(user.email)) redirect('/dashboard');

  return (
    <main className="min-h-screen px-4 py-7 sm:px-7">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-7 border-b border-white/10 pb-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-emerald-300">ARCREDIX · SUPERADMIN</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Suscripciones</h1>
          <p className="mt-1 text-sm text-slate-400">Consultá períodos, registrá extensiones y administrá estados con auditoría.</p>
        </header>
        <SubscriptionManager />
      </div>
    </main>
  );
}
