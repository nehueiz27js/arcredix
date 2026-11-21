import { ShieldCheck } from 'lucide-react';

import { MerchantManager } from '@/components/admin/merchant-manager';

export const dynamic = 'force-dynamic';

export default function AdminPage() {
  return (
    <main className="min-h-screen px-4 py-7 sm:px-7">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-7 border-b border-white/10 pb-6">
          <div className="flex items-center gap-2 text-emerald-300">
            <ShieldCheck size={18} />
            <span className="text-xs font-semibold tracking-[0.2em]">ARCREDIX · SUPERADMIN</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Comercios</h1>
          <p className="mt-1 text-sm text-slate-400">Alta, clasificación, estado y métricas de cada cliente.</p>
        </header>
        <MerchantManager />
      </div>
    </main>
  );
}
