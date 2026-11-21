import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { authorizeMerchant } from '@/lib/auth/authorization';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const membership = await authorizeMerchant('settings.manage');
  if (!membership) return NextResponse.json({ error: 'No tenés permisos para administrar conexiones.' }, { status: 403 });

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL('/dashboard/conexiones?result=google-not-configured', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  }

  const state = randomBytes(32).toString('hex');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const jar = await cookies();
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const, path: '/api/merchant/connections/gmail/callback', maxAge: 600 };
  jar.set('arcredix_google_oauth_state', state, options);
  jar.set('arcredix_google_oauth_verifier', verifier, options);

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email https://www.googleapis.com/auth/gmail.readonly');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return NextResponse.redirect(url);
}
