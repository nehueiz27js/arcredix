import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ACCESS_KEY_CONTEXT = 'arc-redix:merchant-access-key:v1';

function encryptionKey(): Buffer {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('NEON_AUTH_COOKIE_SECRET debe tener al menos 32 caracteres para proteger identificadores.');
  }

  return createHash('sha256')
    .update(secret)
    .update(':')
    .update(ACCESS_KEY_CONTEXT)
    .digest();
}

export function hashAccessKey(identifier: string): string {
  return createHash('sha256').update(identifier, 'utf8').digest('hex');
}

export function createAccessKey() {
  const identifier = randomBytes(32).toString('base64url');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(identifier, 'utf8'), cipher.final()]);

  return {
    identifier,
    hash: hashAccessKey(identifier),
    ciphertext: ciphertext.toString('base64url'),
    nonce: nonce.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
  };
}

export function decryptAccessKey(input: {
  ciphertext: string | null;
  nonce: string | null;
  tag: string | null;
}): string | null {
  if (!input.ciphertext || !input.nonce || !input.tag) return null;

  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(input.nonce, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(input.tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(input.ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
