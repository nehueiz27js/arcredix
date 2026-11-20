import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, Clock3, ShieldCheck } from 'lucide-react';

import { SignOutButton } from '@/components/auth/sign-out-button';
import { auth } from '@/lib/auth/server';
import { getDatabase } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { data: session } = await auth.getSession();
  const user = session?.user;

  if (!user?.id) redirect('/login');

  const sql = getDatabase();
  const result = await sql`
    SELECT
      m.id,
      m.legal_name,
      m.trade_name,
      m.status,
      m.email,
      m.whatsapp_phone,
      mu.role,
      s.status AS subscription_status,
      s.billing_interval,
      s.current_period_end,
      s.plan_name
    FROM public.merchant_users mu
    INNER JOIN public.merchants m ON m.id = mu.merchant_id
    LEFT JOIN LATERAL (
      SELECT subscriptions.status, subscriptions.billing_interval,
        subscriptions.current_period_end, plans.name AS plan_name
      FROM public.subscriptions
      INNER JOIN public.plans ON plans.id = subscriptions.plan_id
      WHERE subscriptions.merchant_id = m.id
      ORDER BY subscriptions.created_at DESC
      LIMIT 1
    ) s ON true
    WHERE mu.auth_subject = ${user.id}
      AND mu.status = 'active'
    LIMIT 1
  `;
  const rows = Array.isArray(result) ? result : result.rows;
  const merchant = rows[0] as {
    id: string;
    legal_name: string;
    t¶»§q«^