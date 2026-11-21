import 'server-only';

import { createHmac } from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

export const CLIENT_SESSION_COOKIE = 'arc_client_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function sessionKey() {
  const secret = process.env.ARCREDIX_CREDENTIALS_ENCRYPTION_KEY
    || process.env.NEON_AUTH_COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('Falta una clave segura de sesión de ARCREDIX (mínimo 32 caracteres).');
  }
  return createHmac('sha256', secret).update('arc-redix:client-session:v1').digest();
}

export async function createClientSession(subject: string) {
  const token = await new SignJWT({ role: 'client' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(sessionKey());

  (await cookies()).set(CLIENT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function readClientSession(): Promise<{ sub: string } | null> {
  const token = (await cookies()).get(CLIENT_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ['HS256'] });
    if (payload.role !== 'client' || typeof payload.sub !== 'string' || !payload.sub) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export async function destroyClientSession() {
  (await cookies()).delete(CLIENT_SESSION_COOKIE);
}
