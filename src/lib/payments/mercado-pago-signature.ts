import { createHmac, timingSafeEqual } from 'node:crypto';

export interface MercadoPagoSignatureInput {
  signature: string | null | undefined;
  requestId: string | null | undefined;
  dataId: string | null | undefined;
  secret: string | null | undefined;
}

interface ParsedSignature {
  timestamp: string;
  digest: string;
}

function parseSignature(value: string): ParsedSignature | null {
  const parts = value.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('ts='))?.slice(3);
  const digest = parts.find((part) => part.startsWith('v1='))?.slice(3);

  if (!timestamp || !/^\d+$/.test(timestamp)) return null;
  if (!digest || !/^[a-fA-F0-9]{64}$/.test(digest)) return null;

  return { timestamp, digest };
}

/**
 * Validates Mercado Pago's documented x-signature manifest:
 * id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * This validates authenticity only. The caller must still retrieve the
 * original payment from Mercado Pago and reconcile its amount and status.
 */
export function validateMercadoPagoWebhookSignature(
  input: MercadoPagoSignatureInput,
): boolean {
  const { signature, requestId, dataId, secret } = input;

  if (!signature || !requestId || !dataId || !secret) return false;

  const parsed = parseSignature(signature);
  if (!parsed) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${parsed.timestamp};`;
  const expected = createHmac('sha256', secret).update(manifest).digest();
  const received = Buffer.from(parsed.digest, 'hex');

  return expected.length === received.length && timingSafeEqual(expected, received);
}
