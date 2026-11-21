import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface EncryptedCredential {
  ciphertext: string; iv: string; authTag: string; keyVersion: number;
}

function encryptionKey(): Buffer {
  const configured = process.env.ARCREDIX_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!configured) throw new Error('Falta ARCREDIX_CREDENTIALS_ENCRYPTION_KEY.');
  const key = /^[a-f0-9]{64}$/i.test(configured)
    ? Buffer.from(configured, 'hex') : Buffer.from(configured, 'base64');
  if (key.length !== 32) throw new Error('La clave debe representar exactamente 32 bytes.');
  return key;
}

export function encryptCredential(value: unknown): EncryptedCredential {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'), keyVersion: 1 };
}

export function decryptCredential<T>(encrypted: EncryptedCredential): T {
  if (encrypted.keyVersion !== 1) throw new Error('Versión de clave no soportada.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')), decipher.final(),
  ]).toString('utf8');
  return JSON.parse(plaintext) as T;
}
