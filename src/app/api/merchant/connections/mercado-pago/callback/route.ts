import { randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { authorizeMerchant } from '@/lib/auth/authorization';
import { getAuthenticatedDatabase } from '@/lib/db/client';
import { encryptCredential } from '@/lib/payments/credential-vault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectResult(result: string) {
  return NextResponse.redirect(new URL('/dashboard/conexiones?result=' + encodeURIComponent(result),
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
function rowsOf<T>(result: T[] | { rows: T[] }): T[] { return Array.isArray(result) ? result : result.rows; }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const state = jar.get('arcredix_mp_oauth_state')?.value ?? '';
  const verifier = jar.get('arcredix_mp_oauth_verifier')?.value ?? '';
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const, path: '/api/merchant/connections/mercado-pago/callback', maxAge: 0 };
  jar.set('arcredix_mp_oauth_state', '', options);
  jar.set('arcredix_mp_oauth_verifier', '', options);
  if (url.searchParams.has('error')) return redirectResult('mercado-pago-denied');

  const code = url.searchParams.get('code') ?? '';
  const returnedState = url.searchParams.get('state') ?? '';
  if (!code || !state || !verifier || state.length !== returnedState.length ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(returnedState))) return redirectResult('mercado-pago-invalid-state');
  const membership = await authorizeMerchant('settings.manage');
  if (!membership) return redirectResult('unauthorized');

  const clientId = process.env.MERCADO_PAGO_CLIENT_ID?.trim();
  const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET?.trim();
  const redirectUri = process.env.MERCADO_PAGO_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri || !process.env.ARCREDIX_CREDENTIALS_ENCRYPTION_KEY) {
    return redirectResult('mercado-pago-server-not-configured');
  }

  try {
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ grant_type: 'authorization_code', client_id: clientId,
        client_secret: clientSecret, code, redirect_uri: redirectUri, code_verifier: verifier }),
      cache: 'no-store',
    });
    const token = await tokenResponse.json() as {
      access_token?: string; refresh_token?: string; user_id?: string | number;
      public_key?: string; live_mode?: boolean; expires_in?: number; scope?: string; error?: string;
    };
    if (!tokenResponse.ok || !token.access_token || !token.refresh_token || !token.user_id) {
      console.error('Mercado Pago OAuth token exchange failed:', token.error || tokenResponse.status);
      return redirectResult('mercado-pago-token-exchange-failed');
    }
    const profileResponse = await fetch('https://api.mercadopago.com/users/me', {
      headers: { authorization: 'Bearer ' + token.access_token }, cache: 'no-store',
    });
    const profile = profileResponse.ok ? await profileResponse.json() as { id?: string | number; nickname?: string } : {};
    const providerUserId = String(profile.id ?? token.user_id);
    const encrypted = encryptCredential({ access_token: token.access_token, refresh_token: token.refresh_token,
      expires_in: token.expires_in, live_mode: token.live_mode, scope: token.scope,
      provider_user_id: providerUserId, expires_at: Date.now() + Number(token.expires_in || 21600) * 1000 });
    const sql = await getAuthenticatedDatabase();
    const provider = await sql.query("SELECT id FROM public.payment_providers WHERE code='mercado_pago' AND is_active=true LIMIT 1", []);
    const providerRows = rowsOf(provider);
    if (!providerRows.length) return redirectResult('mercado-pago-provider-unavailable');
    const metadata = JSON.stringify({ method: 'oauth_authorization_code', provider_user_id: providerUserId,
      live_mode: token.live_mode ?? null, webhook_status: 'pending_global_app_configuration' });
    const existing = await sql.query(
      'SELECT id FROM public.payment_connections WHERE merchant_id=$1 AND provider_id=$2 AND account_reference=$3 ORDER BY created_at DESC LIMIT 1',
      [membership.merchantId, providerRows[0].id, providerUserId]);
    const existingRows = rowsOf(existing);
    let connectionId: string;
    if (existingRows.length) {
      connectionId = String(existingRows[0].id);
      await sql.query(
        "UPDATE public.payment_connections SET display_name=$1,status='active',last_verified_at=now(),metadata=coalesce(metadata,'{}'::jsonb) || $2::jsonb,updated_at=now() WHERE id=$3 AND merchant_id=$4",
        ['Mercado Pago' + (profile.nickname ? ' · ' + profile.nickname : ''), metadata, connectionId, membership.merchantId]);
    } else {
      const connection = await sql.query(
        "INSERT INTO public.payment_connections (merchant_id,provider_id,display_name,account_reference,status,last_verified_at,metadata) VALUES ($1,$2,$3,$4,'active',now(),$5::jsonb) RETURNING id",
        [membership.merchantId, providerRows[0].id, 'Mercado Pago' + (profile.nickname ? ' · ' + profile.nickname : ''), providerUserId, metadata]);
      const connectionRows = rowsOf(connection);
      if (!connectionRows.length) throw new Error('No se pudo crear la conexión de Mercado Pago.');
      connectionId = String(connectionRows[0].id);
    }
    await sql.query(
      'INSERT INTO public.payment_connection_secrets (id,merchant_id,payment_connection_id,ciphertext,iv,auth_tag,key_version) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (payment_connection_id) DO UPDATE SET ciphertext=EXCLUDED.ciphertext,iv=EXCLUDED.iv,auth_tag=EXCLUDED.auth_tag,key_version=EXCLUDED.key_version,updated_at=now()',
      [randomUUID(), membership.merchantId, connectionId, encrypted.ciphertext,
        encrypted.iv, encrypted.authTag, encrypted.keyVersion]);
    return redirectResult('mercado-pago-authorized-webhook-pending');
  } catch (error) {
    console.error('ARCREDIX Mercado Pago OAuth callback failed:', error);
    return redirectResult('mercado-pago-connection-failed');
  }
}
