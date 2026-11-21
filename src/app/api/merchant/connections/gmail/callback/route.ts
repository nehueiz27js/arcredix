import { randomUUID, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { authorizeMerchant } from '@/lib/auth/authorization';
import { getAuthenticatedDatabase } from '@/lib/db/client';
import { encryptCredential } from '@/lib/payments/credential-vault';
import { exchangeGoogleCode, gmailProfile, startGmailWatch } from '@/lib/payments/gmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectResult(result: string) {
  return NextResponse.redirect(new URL('/dashboard/conexiones?result=' + encodeURIComponent(result),
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
function rowsOf<T>(result: T[] | { rows: T[] }): T[] {
  return Array.isArray(result) ? result : result.rows;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const state = jar.get('arcredix_google_oauth_state')?.value ?? '';
  const verifier = jar.get('arcredix_google_oauth_verifier')?.value ?? '';
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const, path: '/api/merchant/connections/gmail/callback', maxAge: 0 };
  jar.set('arcredix_google_oauth_state', '', options);
  jar.set('arcredix_google_oauth_verifier', '', options);

  if (url.searchParams.has('error')) return redirectResult('google-access-denied');
  const code = url.searchParams.get('code') ?? '';
  const returnedState = url.searchParams.get('state') ?? '';
  if (!code || !state || !verifier || state.length !== returnedState.length ||
      !timingSafeEqual(Buffer.from(state), Buffer.from(returnedState))) return redirectResult('google-invalid-state');

  const membership = await authorizeMerchant('settings.manage');
  if (!membership) return redirectResult('unauthorized');
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!redirectUri || !process.env.ARCREDIX_CREDENTIALS_ENCRYPTION_KEY) return redirectResult('google-server-not-configured');

  try {
    const token = await exchangeGoogleCode(code, redirectUri, verifier);
    const profile = await gmailProfile(token.access_token);
    const encrypted = encryptCredential({ access_token: token.access_token,
      refresh_token: token.refresh_token, scope: token.scope });
    const sql = await getAuthenticatedDatabase();
    const provider = await sql.query(
      "SELECT id FROM public.payment_providers WHERE code='bank_gmail' AND is_active=true LIMIT 1", []);
    const providerRows = rowsOf(provider);
    if (!providerRows.length) return redirectResult('gmail-provider-unavailable');

    const metadata = JSON.stringify({ method: 'google_oauth', gmail_watch_status: 'pending',
      gmail_history_id: profile.historyId, allowed_senders: [] });
    const existing = await sql.query(
      'SELECT id,metadata FROM public.payment_connections WHERE merchant_id=$1 AND provider_id=$2 AND lower(account_reference)=lower($3) ORDER BY created_at DESC LIMIT 1',
      [membership.merchantId, providerRows[0].id, profile.emailAddress]);
    const existingRows = rowsOf(existing);
    let connectionId: string;
    if (existingRows.length) {
      connectionId = String(existingRows[0].id);
      await sql.query(
        "UPDATE public.payment_connections SET display_name=$1,status='pending',metadata=coalesce(metadata,'{}'::jsonb) || $2::jsonb,updated_at=now() WHERE id=$3 AND merchant_id=$4",
        ['Gmail · ' + profile.emailAddress, metadata, connectionId, membership.merchantId]);
    } else {
      const inserted = await sql.query(
        "INSERT INTO public.payment_connections (merchant_id,provider_id,display_name,account_reference,status,metadata) VALUES ($1,$2,$3,$4,'pending',$5::jsonb) RETURNING id",
        [membership.merchantId, providerRows[0].id, 'Gmail · ' + profile.emailAddress, profile.emailAddress, metadata]);
      const rows = rowsOf(inserted);
      if (!rows.length) throw new Error('No se pudo crear la conexión Gmail.');
      connectionId = String(rows[0].id);
    }
    await sql.query(
      'INSERT INTO public.payment_connection_secrets (id,merchant_id,payment_connection_id,ciphertext,iv,auth_tag,key_version) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (payment_connection_id) DO UPDATE SET ciphertext=EXCLUDED.ciphertext,iv=EXCLUDED.iv,auth_tag=EXCLUDED.auth_tag,key_version=EXCLUDED.key_version,updated_at=now()',
      [randomUUID(), membership.merchantId, connectionId, encrypted.ciphertext,
        encrypted.iv, encrypted.authTag, encrypted.keyVersion]);

    if (process.env.GOOGLE_PUBSUB_TOPIC?.trim()) {
      try {
        const watch = await startGmailWatch(token.access_token);
        await sql.query(
          "UPDATE public.payment_connections SET status='active',last_verified_at=now(),updated_at=now(),metadata=metadata || $1::jsonb WHERE id=$2 AND merchant_id=$3",
          [JSON.stringify({ gmail_history_id: watch.historyId, gmail_watch_expiration: watch.expiration,
            gmail_watch_status: 'active' }), connectionId, membership.merchantId]);
        return redirectResult('gmail-connected');
      } catch (watchError) {
        console.error('ARCREDIX Gmail watch setup failed:', watchError);
        return redirectResult('gmail-authorized-watch-pending');
      }
    }
    return redirectResult('gmail-authorized-pubsub-pending');
  } catch (error) {
    console.error('ARCREDIX Gmail OAuth callback failed:', error);
    return redirectResult('gmail-connection-failed');
  }
}
