import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth/server';
import { hashAccessKey } from '@/lib/auth/access-keys';
import { getSystemDatabase } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type NeonAuthApi = {
  signInEmail(options: {
    body: { email: string; password: string };
    headers: Headers;
    asResponse: true;
  }): Promise<Response>;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { identifier?: unknown } | null;
  const identifier = typeof body?.identifier === 'string' ? body.identifier.trim() : '';

  // 32 random bytes encoded as base64url produce exactly 43 characters.
  if (!/^[A-Za-z0-9_-]{43}$/.test(identifier)) {
    return NextResponse.json({ error: 'Identificador inválido.' }, { status: 400 });
  }

  try {
    const sql = getSystemDatabase();
    const result = await sql`
      SELECT mu.auth_subject, mu.email
      FROM public.merchant_users mu
      INNER JOIN public.merchants m ON m.id = mu.merchant_id
      WHERE mu.access_key_hash = ${hashAccessKey(identifier)}
        AND mu.status = 'active'
        AND m.status = 'active'
      LIMIT 1
    `;
    const rows = Array.isArray(result) ? result : result.rows;
    const membership = rows[0] as { auth_subject: string | null; email: string } | undefined;

    if (!membership?.auth_subject || !membership.email) {
      return NextResponse.json({ error: 'El identificador no es válido o el comercio está suspendido.' }, { status: 401 });
    }

    // The access identifier is the hidden Neon Auth password. The customer
    // only submits the identifier; the email and password never reach the UI.
    const api = (auth as unknown as { api: NeonAuthApi }).api;
    const authResponse = await api.signInEmail({
      body: { email: membership.email, password: identifier },
      headers: request.headers,
      asResponse: true,
    });

    if (!authResponse.ok) {
      console.error('ARCREDIX client access sign-in rejected:', authResponse.status);
      return NextResponse.json({ error: 'No se pudo validar el acceso. Contactá al administrador.' }, { status: 401 });
    }

    const authPayload = await authResponse.clone().json().catch(() => null) as {
      user?: { id?: string };
      data?: { user?: { id?: string } };
    } | null;
    const authenticatedUserId = authPayload?.user?.id ?? authPayload?.data?.user?.id;

    if (!authenticatedUserId || authenticatedUserId !== membership.auth_subject) {
      console.error('ARCREDIX client access identity mismatch.');
      return NextResponse.json({ error: 'No se pudo validar la identidad vinculada al comercio.' }, { status: 401 });
    }

    const headers = new Headers(authResponse.headers);
    headers.delete('content-length');
    headers.set('cache-control', 'no-store');
    return new NextResponse(JSON.stringify({ success: true }), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('ARCREDIX client login failed:', error);
    return NextResponse.json({ error: 'No se pudo validar el identificador. Intentá nuevamente.' }, { status: 500 });
  }
}
