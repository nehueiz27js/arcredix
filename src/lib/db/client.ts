import 'server-only';

import { neon } from '@neondatabase/serverless';
import { auth } from '@/lib/auth/server';

type NeonClient = ReturnType<typeof neon>;
type Ed25519Jwk = {
  kty: 'OKP';
  crv: 'Ed25519';
  x: string;
  kid?: string;
  alg?: string;
  use?: string;
};
type JwksResponse = { keys?: Ed25519Jwk[] };

let databaseClient: NeonClient | undefined;
let systemDatabaseClient: NeonClient | undefined;
let jwksCache: { keys: Ed25519Jwk[]; expiresAt: number } | undefined;
let jwksRequest: Promise<Ed25519Jwk[]> | undefined;

function getDatabaseUrl(jwk?: Ed25519Jwk): string {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error('DATABASE_URL no está configurada.');
  }

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL no tiene un formato válido.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL debe ser una conexión PostgreSQL.');
  }

  const existingOptions = parsed.searchParams.get('options')?.trim() ?? '';
  const options = [existingOptions];

  if (!existingOptions.includes('role=arcredix_app')) {
    options.push('-c role=arcredix_app');
  }

  if (jwk) {
    // pg_session_jwt reads this startup parameter before validating auth.jwt_session_init().
    // pg_session_jwt matches the JWT header kid against the configured JWK.
    // Omitting kid here makes a valid Neon Auth token fail with `jwk not found`.
    options.push("-c pg_session_jwt.jwk='" + JSON.stringify({
      kty: jwk.kty,
      crv: jwk.crv,
      x: jwk.x,
      ...(jwk.kid ? { kid: jwk.kid } : {}),
      ...(jwk.alg ? { alg: jwk.alg } : {}),
      ...(jwk.use ? { use: jwk.use } : {}),
    }) + "'");
  }

  parsed.searchParams.set('options', options.filter(Boolean).join(' '));
  return parsed.toString();
}

async function getNeonAuthJwks(): Promise<Ed25519Jwk[]> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) {
    return jwksCache.keys;
  }

  if (!jwksRequest) {
    jwksRequest = (async () => {
      const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
      if (!baseUrl) {
        throw new Error('NEON_AUTH_BASE_URL no está configurada.');
      }

      const jwksUrl = process.env.NEON_AUTH_JWKS_URL?.trim()
        || baseUrl.replace(/\/$/, '') + '/.well-known/jwks.json';
      const response = await fetch(jwksUrl, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error('Neon Auth no pudo entregar las claves públicas para validar sesiones.');
      }

      const payload = await response.json() as JwksResponse;
      const keys = (payload.keys ?? []).filter((key) =>
        key.kty === 'OKP' && key.crv === 'Ed25519' && typeof key.x === 'string',
      );

      if (keys.length === 0) {
        throw new Error('Neon Auth no publicó una clave Ed25519 compatible con pg_session_jwt.');
      }

      jwksCache = { keys, expiresAt: Date.now() + 5 * 60 * 1000 };
      return keys;
    })().finally(() => {
      jwksRequest = undefined;
    });
  }

  return jwksRequest;
}

async function getJwkForToken(token: string): Promise<Ed25519Jwk> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Neon Auth devolvió un token de sesión con formato inválido.');
  }

  let header: { kid?: string; alg?: string };
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    throw new Error('No se pudo interpretar el encabezado del token de Neon Auth.');
  }

  if (header.alg && header.alg !== 'EdDSA') {
    throw new Error('El token de Neon Auth usa un algoritmo de firma no compatible con pg_session_jwt.');
  }

  const keys = await getNeonAuthJwks();
  const key = header.kid
    ? keys.find((candidate) => candidate.kid === header.kid)
    : keys.length === 1 ? keys[0] : undefined;

  if (!key) {
    // Refresh once in case Neon Auth rotated its signing key.
    jwksCache = undefined;
    const refreshedKeys = await getNeonAuthJwks();
    const refreshedKey = header.kid
      ? refreshedKeys.find((candidate) => candidate.kid === header.kid)
      : refreshedKeys.length === 1 ? refreshedKeys[0] : undefined;

    if (!refreshedKey) {
      throw new Error('No se encontró en Neon Auth la clave pública que corresponde al token de sesión.');
    }
    return refreshedKey;
  }

  return key;
}

/**
 * Application client. It switches the owner login to the restricted
 * arcredix_app role and forwards the authenticated JWT with its matching
 * public JWK in PostgreSQL's connection startup options.
 */
export function getDatabase(): NeonClient {
  if (!databaseClient) {
    databaseClient = neon(getDatabaseUrl());
  }

  return databaseClient;
}


/**
 * Privileged server-only client for the single credential-resolution query used
 * by client login. Never use this client for tenant business data.
 */
export function getSystemDatabase(): NeonClient {
  if (systemDatabaseClient) return systemDatabaseClient;

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL no está configurada.');

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL no tiene un formato válido.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL debe ser una conexión PostgreSQL.');
  }

  // This server-only connection intentionally retains the owner role.
  // It is restricted in code to a hash lookup; never expose it to user routes.
  parsed.searchParams.delete('options');
  systemDatabaseClient = neon(parsed.toString());
  return systemDatabaseClient;
}

export async function getAuthenticatedDatabase(): Promise<NeonClient> {
  const tokenEndpoint = auth.token as unknown as () => Promise<{
    data?: { token?: string } | null;
    error?: unknown;
  }>;
  const tokenResult = await tokenEndpoint();

  if (tokenResult.error || typeof tokenResult.data?.token !== 'string') {
    throw new Error('No se pudo obtener el token autenticado para consultar la base de datos.');
  }

  const token = tokenResult.data.token;
  const jwk = await getJwkForToken(token);
  // The neon-serverless authToken option authenticates transport requests; it
  // does not initialize pg_session_jwt. The extension requires both calls
  // below to run on the same connection and transaction as the protected SQL.
  const raw = neon(getDatabaseUrl(jwk));
  const authenticated = new Proxy(raw, {
    apply(target, thisArg, args: Parameters<NeonClient>) {
      const initializeJwk = target`SELECT auth.init()`;
      const initializeJwt = target`SELECT auth.jwt_session_init(${token})`;
      const protectedQuery = Reflect.apply(target, thisArg, args);

      return target.transaction([
        initializeJwk,
        initializeJwt,
        protectedQuery,
      ]).then((results) => results[2]);
    },
  });

  return authenticated as NeonClient;
}
