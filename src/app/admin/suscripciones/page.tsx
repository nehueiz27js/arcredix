import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth/server';
import { isSuperAdminEmail } from '@/lib/auth/superadmin';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { SubscriptionManager } from '@/components/admin/subscription-manager';

export const dynamic = 'force-dynamic';

export default async function AdminModulePage() {
  const { data: session } = await auth.getSession();
  const user = session?.user;

  if (!user?.id) redirect('/login');
  if (!isSuperAdminEmail(user.email)) redirect('/admin');

  return (
    <main className="min-h-screen bg-[#050b12] px-4 py-7 text-white sm:px-7">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-emerald-300">ARCREDIX · SUPERADMIN</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Suscripciones</h1>
            <p className="mt-1 text-sm text-slate-400">Consultá períodos, registrá extensiones y administrá estados con auditoría.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-sm text-emerald-300 hover:text-emerald-200">Centro de control</Link>
            <SignOutButton />
          </div>
        </header>
        <SubscriptionManager />
      </div>
    </main>
  );
}
