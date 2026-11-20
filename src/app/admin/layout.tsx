import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, CreditCard, LayoutDashboard, Tags } from 'lucide-react';

import { auth } from '@/lib/auth/server';
import { isSuperAdminEmail } from '@/lib/auth/superadmin';
import { SignOutButton } from '@/components/auth/sign-out-button';

export const dynamic = 'force-dynamic';

const sections = [
  { href: '/admin', label: 'Comercios', icon: Building2 },
  { href: '/admin/planes', label: 'Planes y límites', icon: Tags },
  { href: '/admin/suscripciones', label: 'Suscripciones', icon: CreditCard },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = await auth.getSession();
  const user = session?.user;

  if (!user?.id) redirect('/login');
  if (!isSuperAdminEmail(user.email)) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-[#050b12] text-white lg:flex">
      <aside className="w-full border-b border-white/10 bg-[#08121b] p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-5">
        <Link href="/admin" className="flex items-center gap-3 rounded-xl px-2 py-3">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300">
            <LayoutDashboard size={20} />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-wide">ARCREDIX</span>
            <span className="block text-xs text-slate-500">Superadministración</span>
          </span>
        </Link>
        <nav aria-label="Secciones del superadmin" className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-1">
          {sections.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-lg border border-white/5 px-3 py-3 text-sm text-slate-300 transition hover:border-emerald-300/30 hover:bg-emerald-300/5 hover:text-white">
              <Icon size={17} className="text-emerald-300" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-5 border-t border-white/10 pt-4 lg:absolute lg:inset-x-5 lg:bottom-5">
          <p className="mb-3 truncate px-2 text-xs text-slate-500">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
