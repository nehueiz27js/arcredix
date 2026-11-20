"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

import { authClient } from '@/lib/auth/client';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await authClient.signOut();
      router.replace('/login');
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
