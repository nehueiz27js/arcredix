import { createPublicKey, createVerify } from 'node:crypto';
import { NextResponse } from 'next/server';

import { getWebhookDatabase } from '@/lib/db/webhook-client';
import { decryptCredential, type EncryptedCredential } from '@/lib/payments/credential-vault';
import { getGmailHistoryMessages, getGmailMessage, parseBankNoticeAmount,
  refreshGoogleAccessToken, senderAddress, type GmailCredential } from '@/lib/payments/gmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ConnectionRow = {
  connection_id: string; merchant_id: string; ciphertext: string; iv: string;
  auth_tag: string; key_version: number; metadata: Record<string, unknown>;
};

async function verifyPubSubToken(request: Request): Promise<boolean> {
  const match = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  const audience = process.env.GOOGLE_PUBSUB_AUDIENCE?.trim();
  const expectedEmail = process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL?.trim().toLowerCase();
  if (!match || !audience || !expectedEmail) return false;
  const parts = match[1].split('.');
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as { alg?: string; kid?: string };
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>;
    if (header.alg !== 'RS256' || !header.kid) return false;
    const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', { cache: 'no-store' });
    if (!response.ok) return false;
    const jwks = await response.json() as { keys?: Array<Record<string, unknown>> };
    const jwk = jwks.keys?.find((key) => key.kid === header.kid && key.kty === 'RSA');
    if (!jwk) return false;
    const verifier = createVerify('RSA-SHA256');
    verifier.update(parts[0] + '.' + parts[1]);
    verifier.end();
    if (!verifier.verify(createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) return false;
    const now = Math.floor(Date.now() / 1000);
    return Number(claims.exp || 0) > now && Number(claims.iat || 0) <= now + 60 &&
      claims.aud === audience && ['accounts.google.com', 'https://accounts.google.com'].includes(String(claims.iss || '')) &&
      claims.email_verified === true && String(claims.email || '').toLowerCase() === expectedEmail;
  } catch { return false; }
}

function decodePubSubData(value: string): { emailAddress?: string; historyId?: string } | null {
  try {
    return JSON.parse(Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch { return null; }
}
function allowedSender(sender: string, allowed: unknown): boolean {
  if (!Array.isArray(allowed)) return false;
  const address = senderAddress(sender);
  return allowed.some((item) => typeof item === 'string' && item.trim().toLowerCase() === address);
}

export async function POST(request: Request) {
  if (!await verifyPubSubToken(request)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  const raw = await request.text();
  if (raw.length > 64_000) return NextResponse.json({ error: 'Payload demasiado grande.' }, { status: 413 });
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }
  const expectedSubscription = process.env.GOOGLE_PUBSUB_SUBSCRIPTION?.trim();
  if (expectedSubscription && body?.subscription !== expectedSubscription) {
    return NextResponse.json({ error: 'Suscripción Pub/Sub no válida.' }, { status: 403 });
  }
  const data = typeof body?.message?.data === 'string' ? decodePubSubData(body.message.data) : null;
  if (!data?.emailAddress || !data.historyId) return NextResponse.json({ error: 'Notificación Gmail inválida.' }, { status: 400 });

  try {
    const sql = getWebhookDatabase();
    const resolved = await sql.query('SELECT * FROM public.arcredix_resolve_gmail_push($1)', [data.emailAddress]);
    const rows = (Array.isArray(resolved) ? resolved : resolved.rows) as ConnectionRow[];
    const connection = rows[0];
    if (!connection) return NextResponse.json({ received: true, ignored: true });

    const encrypted: EncryptedCredential = { ciphertext: connection.ciphertext, iv: connection.iv,
      authTag: connection.auth_tag, keyVersion: connection.key_version };
    const credential = decryptCredential<GmailCredential>(encrypted);
    const accessToken = await refreshGoogleAccessToken(credential.refresh_token);
    const startHistoryId = String(connection.metadata.gmail_history_id || '');
    if (!startHistoryId) return NextResponse.json({ error: 'Falta historyId inicial.' }, { status: 409 });

    const history = await getGmailHistoryMessages(accessToken, startHistoryId);
    const allowed = connection.metadata.allowed_senders;
    for (const messageId of history.messageIds) {
      const message = await getGmailMessage(accessToken, messageId);
      if (!allowedSender(message.sender, allowed)) continue;
      const parsed = parseBankNoticeAmount(message.body, message.subject);
      if (!parsed) continue;
      await sql.query(
        'SELECT public.arcredix_record_gmail_notice($1,$2,$3,$4,$5,$6,$7)',
        [connection.connection_id, message.id, parsed.amount, parsed.currency,
          senderAddress(message.sender), message.subject, message.internalDate]);
    }
    await sql.query(
      'SELECT public.arcredix_update_gmail_watch($1,$2,$3)',
      [connection.connection_id, history.historyId, String(connection.metadata.gmail_watch_expiration || '')]);
    return NextResponse.json({ received: true, processed: history.messageIds.length });
  } catch (error) {
    console.error('ARCREDIX Gmail Pub/Sub processing failed:', error);
    return NextResponse.json({ error: 'No se pudo procesar la notificación.' }, { status: 500 });
  }
}
