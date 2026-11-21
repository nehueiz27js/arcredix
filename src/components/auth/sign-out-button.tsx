'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';


type SignOutButtonProps = { mode?: 'admin' | 'client' };

export function SignOutButton({ mode = 'admin' }: SignOutButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'client') {
        const response = await fetch('/api/auth/client-logout', {
          method: 'POST',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('No se pudo cerrar la sesión.');
      } else {
        const { authClient } = await import('@/lib/auth/client');
        await authClient.signOut();
      }
      router.replace(mode === 'admin' ? '/admin/login' : '/portal/login');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className='dashboard-signout' type='button' onClick={signOut} disabled={busy}>
      <LogOut size={16} />
      {busy ? 'Saliendo...' : 'Cerrar sesión'}
    </button>
  );
}
