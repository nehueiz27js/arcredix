import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBankNoticeAmount, senderAddress } from '../../src/lib/payments/gmail.ts';

test('extracts Argentine peso amounts from bank notifications', () => {
  assert.deepEqual(parseBankNoticeAmount('Se acreditó una transferencia por AR$ 15.250,00', 'Transferencia recibida'),
    { amount: 15250, currency: 'ARS' });
});

test('extracts amounts written with ARS prefix', () => {
  assert.deepEqual(parseBankNoticeAmount('Importe: ARS 2500', 'Aviso de transferencia'),
    { amount: 2500, currency: 'ARS' });
});

test('does not infer a currency from an ambiguous dollar sign', () => {
  assert.equal(parseBankNoticeAmount('Transferencia por $ 15.250,00', 'Aviso bancario'), null);
});

test('does not invent an amount when no supported amount is present', () => {
  assert.equal(parseBankNoticeAmount('Se recibió una transferencia', 'Aviso bancario'), null);
});

test('normalizes sender address from display name format', () => {
  assert.equal(senderAddress('Banco Ejemplo <avisos@banco.com>'), 'avisos@banco.com');
});
