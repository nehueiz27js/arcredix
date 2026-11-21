import 'server-only';

import { createHash, createHmac, randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function pepper(): string {
  const value = process.env.ARCREDIX_CREDENTIALS_ENCRYPTION_KEY
    || process.env.NEON_AUTH_COOKIE_SECRET;
  if (!value || value.length < 32) {
    throw new Error('Falta una clave segura para generar identificadores de ARCREDIX.');
  }
  return value;
}

/** Four groups of four characters: easy to dictate, 80 bits of entropy. */
export function generateAccessIdentifier(): string {
  const groups: string[] = [];
  for (let group = 0; group < 4; group += 1) {
    let value = '';
    for (let index = 0; index < 4; index += 1) {
      value += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(value);
  }
  return groups.join('-');
}

export function normalizeAccessIdentifier(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Only a keyed HMAC is persisted; the clear identifier is returned once. */
export function hashLegacyAccessKey(identifier: string): string {
  return createHash('sha256').update(identifier, 'utf8').digest('hex');
}

export function hashAccessKey(identifier: string): string {
  const derivedKey = createHmac('sha256', pepper()).update('arc-redix:access-code:v1').digest();
  return createHmac('sha256', derivedKey)
    .update(normalizeAccessIdentifier(identifier), 'utf8')
    .digest('hex');
}

export function createAccessKey() {
  const identifier = generateAccessIdentifier();
  return {
    identifier,
    hash: hashAccessKey(identifier),
    hint: identifier.slice(-4),
  };
}
