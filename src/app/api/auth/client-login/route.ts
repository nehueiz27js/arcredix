import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';

import { createClientSession } from '@/lib/auth/client-session';
import { hashAccessKey, hashLegacyAccessKey, normalizeAccessIdentifier } from '@/lib/auth/access-keys';
import { getSystemDatabase } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LoginRow = { id: string; auth_subject: string | null };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { identifier?: unknown } | null;
  const rawIdentifier = typeof body?.identifier === 'string' ? body.identifier : '';
  const normalized = normalizeAccessIdentifier(rawIdentifier);
  const isNewCode = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{16}$/.test(normalized);
  const isLegacyCode = /^[A-Za-z0-9_-]{43}$/.test(rawIdentifier.trim());
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = (forwardedFor || request.headers.get('x-real-ip') || 'unknown').slice(0, 100);

  try {
    const sql = getSystemDatabase();
    const attempts = await sql`
      SELECT count(*)::int AS failures
      FROM public.login_attempts
      WHERE ip = ${ip} AND scope = 'client' AND success = false
        AND created_at > now() - interval '15 minutes'
    `;
    const attemptRows = Array.isArray(attempts) ? attempts : attempts.rows;
    if (Number(attemptRows[0]?.failures ?? 0) >= 5) {
      return NextResponse.json(
        { error: 'Demasiados intentos. El acceso quedó bloqueado durante 15 minutos.' },
        { status: 429 },
      );
    }

    if (!isNewCode && !isLegacyCode) {
      await sql`INSERT INTO public.login_attempts (ip, scope, success) VALUES (${ip}, 'client', false)`;
      return NextResponse.json({ error: 'Identificador inválido.' }, { status: 401 });
    }

    const identifierHash = isNewCode ? hashAccessKey(normalized) : hashLegacyAccessKey(rawIdentifier.trim());
    const result = await sql`
      SELECT mu.id, mu.auth_subject
      FROM public.merchant_users mu
      INNER JOIN public.merchants m ON m.id = mu.merchant_id
      WHERE mu.access_key_hash = ${identifierHash}
        AND mu.status = 'active'
        AND m.status = 'active'
      LIMIT 1
    `;
    const rows = Array.isArray(result) ? result : result.rows;
    const membership = rows[0] as LoginRow | undefined;

    if (!membership) {
      await sql`INSERT INTO public.login_attempts (ip, scope, success) VALUES (${ip}, 'client', false)`;
      return NextResponse.json({ error: 'Identificador inválido, vencido o desactivado.' }, { status: 401 });
    }

    const subject = membership.auth_subject || randomUUID();
    await sql`
      UPDATE public.merchant_users
      SET auth_subject = ${subject}, last_login_at = now(),
          access_key_hint = coalesce(access_key_hint, right(${rawIdentifier.trim()}, 4)), updated_at = now()
      WHERE id = ${membership.id}
    `;
    await sql`INSERT INTO public.login_attempts (ip, scope, success) VALUES (${ip}, 'client', true)`;
    await createClientSession(subject);

    return NextResponse.json({ success: true }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('ARCREDIX client identifier login failed:', error);
    return NextResponse.json(
      { error: 'No se pudo validar el identificador. Intentá nuevamente.' },
      { status: 500 },
    );
  }
}
