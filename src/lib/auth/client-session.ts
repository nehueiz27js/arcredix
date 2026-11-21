import 'server-only';

import { cookies } from 'next/headers';
import {
  CLIENT_SESSION_COOKIE,
  CLIENT_SESSION_MAX_AGE_SECONDS,
  signClientSessionToken,
  verifyClientSessionToken,
} from '@/lib/auth/session-token';

export { CLIENT_SESSION_COOKIE, verifyClientSessionToken };

export async function createClientSession(subject: string) {
  const token = await signClientSessionToken(subject);
  (await cookies()).set(CLIENT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: CLIENT_SESSION_MAX_AGE_SECONDS,
  });
}

export async function readClientSession(): Promise<{ sub: string } | null> {
  const token = (await cookies()).get(CLIENT_SESSION_COOKIE)?.value;
  return verifyClientSessionToken(token);
}

export async function destroyClientSession() {
  (await cookies()).delete(CLIENT_SESSION_COOKIE);
}
