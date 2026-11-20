import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validateMercadoPagoWebhookSignature } from '../../src/lib/payments/mercado-pago-signature.ts';

const secret = 'test-webhook-secret';
const requestId = 'request-123';
const dataId = 'payment-456';
const timestamp = '1742505638683';
const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
const digest = createHmac('sha256', secret).update(manifest).digest('hex');
const signature = `ts=${timestamp},v1=${digest}`;

test('accepts a valid Mercado Pago HMAC signature', () => {
  assert.equal(validateMercadoPagoWebhookSignature({ signature, requestId, dataId, secret }), true);
});

test('rejects a modified signature', () => {
  const tampered = `ts=${timestamp},v1=${'0'.repeat(64)}`;
  assert.equal(validateMercadoPagoWebhookSignature({ signature: tampered, requestId, dataId, secret }), false);
});

test('rejects a signature bound to a different request id', () => {
  assert.equal(validateMercadoPagoWebhookSignature({ signature, requestId: 'other-request', dataId, secret }), false);
});

test('rejects missing or malformed signature inputs', () => {
  assert.equal(validateMercadoPagoWebhookSignature({ signature: null, requestId, dataId, secret }), false);
  assert.equal(validateMercadoPagoWebhookSignature({ signature: 'invalid', requestId, dataId, secret }), false);
});
