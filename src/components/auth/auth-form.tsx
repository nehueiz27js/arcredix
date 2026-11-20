'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react';

import { authClient } from '@/lib/auth/client';

type AuthFormProps = { mode: 'login' | 'register' };

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === 'register';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [hasSession, setHasSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(isRegister);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isRegister) return;
    let active = true;

    authClient.getSession()
      .then(({ data }) => {
        if (!active || !data?.user) return;
        setHasSession(true);
        setEmail(data.user.email ?? '');
        setOwnerName(data.user.name ?? '');
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => { active = false; };
  }, [isRegis¶»§q«^