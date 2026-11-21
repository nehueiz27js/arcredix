export const CLIENT_SESSION_COOKIE = 'cli_session';
export const CLIENT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function sessionKey() {
  const secret = process.env.ARCREDIX_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('ARCREDIX_SESSION_SECRET debe tener al menos 32 caracteres.');
  }
  return new TextEncoder().encode(secret);
}

export async function signClientSessionToken(subject: string) {
  const { SignJWT } = await import('jose');
  return new SignJWT({ role: 'client' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(`${CLIENT_SESSION_MAX_AGE_SECONDS}s`)
    .sign(sessionKey());
}

export async function verifyClientSessionToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { jwtVerify } = await import('jose');
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ['HS256'] });
    if (payload.role !== 'client' || typeof payload.sub !== 'string' || !payload.sub) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
