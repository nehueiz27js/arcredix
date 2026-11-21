import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authorizeMerchant } from '@/lib/auth/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const membership = await authorizeMerchant('settings.manage');
  if (!membership) return NextResponse.json({ error: 'No tenés permisos para administrar conexiones.' }, { status: 403 });
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID?.trim();
  const redirectUri = process.env.MERCADO_PAGO_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri || !process.env.ARCREDIX_CREDENTIALS_ENCRYPTION_KEY) {
    return NextResponse.redirect(new URL('/dashboard/conexiones?result=mercado-pago-not-configured', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }
  const callback = new URL(redirectUri);
  if (callback.protocol !== 'https:' && callback.hostname !== 'localhost') {
    return NextResponse.json({ error: 'La URL de retorno debe usar HTTPS.' }, { status: 500 });
  }
  const state = randomBytes(32).toString('hex');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const jar = await cookies();
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const, path: '/api/merchant/connections/mercado-pago/callback', maxAge: 600 };
  jar.set('arcredix_mp_oauth_state', state, options);
  jar.set('arcredix_mp_oauth_verifier', verifier, options);
  const url = new URL('https://auth.mercadopago.com/authorization');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return NextResponse.redirect(url);
}
