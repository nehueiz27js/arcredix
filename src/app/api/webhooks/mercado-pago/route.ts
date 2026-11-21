import { NextResponse } from 'next/server';

import { getWebhookDatabase } from '@/lib/db/webhook-client';
import { decryptCredential, encryptCredential, type EncryptedCredential } from '@/lib/payments/credential-vault';
import { validateMercadoPagoWebhookSignature } from '@/lib/payments/mercado-pago-signature';
import { refreshMercadoPagoCredential, type MercadoPagoCredential } from '@/lib/payments/mercado-pago';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MercadoPagoWebhookBody = {
  data?: { id?: string | number };
  type?: string; topic?: string; user_id?: string | number; collector_id?: string | number;
};
type MercadoPagoPayment = {
  id?: string | number; collector_id?: string | number; live_mode?: boolean; status?: string;
  date_created?: string; date_approved?: string; external_reference?: string | null;
  transaction_amount?: number; currency_id?: string; payment_method_id?: string;
  payer?: { email?: string }; status_detail?: string;
};

type ConnectionRow = {
  connection_id: string; ciphertext: string; iv: string; auth_tag: string;
  key_version: number; metadata: Record<string, unknown>;
};

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 64_000) return NextResponse.json({ error: 'Payload demasiado grande.' }, { status: 413 });
  let body: MercadoPagoWebhookBody;
  try { body = JSON.parse(raw) as MercadoPagoWebhookBody; } catch { return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 }); }

  const dataId = String(new URL(request.url).searchParams.get('data.id') || body?.data?.id || '');
  const topic = String(body?.type || body?.topic || '');
  const requestId = request.headers.get('x-request-id');
  const signature = request.headers.get('x-signature');
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (topic !== 'payment' || !dataId || !validateMercadoPagoWebhookSignature({
    signature, requestId, dataId, secret,
  })) return NextResponse.json({ error: 'Firma o tipo de evento no válido.' }, { status: 401 });

  const providerUserId = String(body?.user_id || body?.collector_id || '');
  if (!providerUserId) return NextResponse.json({ error: 'Evento sin identificador de cuenta.' }, { status: 400 });

  try {
    const sql = getWebhookDatabase();
    const resolved = await sql.query('SELECT * FROM public.arcredix_resolve_mp_connection($1)', [providerUserId]);
    const rows = (Array.isArray(resolved) ? resolved : resolved.rows) as ConnectionRow[];
    const connection = rows[0];
    if (!connection) return NextResponse.json({ received: true, ignored: true });

    let credential = decryptCredential<MercadoPagoCredential>({
      ciphertext: connection.ciphertext, iv: connection.iv, authTag: connection.auth_tag,
      keyVersion: connection.key_version,
    } as EncryptedCredential);
    const refreshed = await refreshMercadoPagoCredential(credential);
    if (refreshed !== credential) {
      const encrypted = encryptCredential(refreshed);
      await sql.query('SELECT public.arcredix_update_mp_secret($1,$2,$3,$4,$5)',
        [connection.connection_id, encrypted.ciphertext, encrypted.iv, encrypted.authTag, encrypted.keyVersion]);
    }
    credential = refreshed;
    const paymentResponse = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(dataId), {
      headers: { authorization: 'Bearer ' + credential.access_token, accept: 'application/json' },
      cache: 'no-store',
    });
    const payment = await paymentResponse.json() as MercadoPagoPayment;
    if (!paymentResponse.ok || !payment.id || !payment.collector_id || !Number.isFinite(payment.transaction_amount) || Number(payment.transaction_amount) <= 0) throw new Error('Mercado Pago no devolvió un pago válido.');
    if (String(payment.collector_id) !== providerUserId) {
      return NextResponse.json({ error: 'La cuenta receptora no coincide con la conexión.' }, { status: 409 });
    }
    if (typeof credential.live_mode === 'boolean' && Boolean(payment.live_mode) !== credential.live_mode) {
      return NextResponse.json({ error: 'El pago pertenece a un entorno distinto al de la cuenta conectada.' }, { status: 409 });
    }
    const statuses: Record<string, string> = {
      approved: 'approved', pending: 'pending', in_process: 'pending',
      rejected: 'rejected', cancelled: 'cancelled', refunded: 'refunded',
      charged_back: 'unknown',
    };
    const status = statuses[String(payment.status)] || 'unknown';
    const occurredAt = payment.date_created ? new Date(payment.date_created) : null;
    const confirmedAt = payment.date_approved ? new Date(payment.date_approved) : null;
    await sql.query(
      'SELECT public.arcredix_record_mp_payment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [connection.connection_id, String(payment.id), String(payment.external_reference || ''),
        Number(payment.transaction_amount), String(payment.currency_id || 'ARS'), status,
        String(payment.payment_method_id || ''), String(payment.payer?.email || ''),
        String(payment.status_detail || payment.status || ''), occurredAt, confirmedAt]);
    return NextResponse.json({ received: true, verified: true });
  } catch (error) {
    console.error('ARCREDIX Mercado Pago webhook processing failed:', error);
    return NextResponse.json({ error: 'No se pudo validar el pago en Mercado Pago.' }, { status: 500 });
  }
}
