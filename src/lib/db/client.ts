import 'server-only';

import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { neon, Pool } from '@neondatabase/serverless';
import { auth } from '@/lib/auth/server';

type NeonClient = ReturnType<typeof neon>;
type AuthenticatedQueryResult = {
  rows: Record<string, unknown>[];
  rowCount: number | null;
};
type AuthenticatedSql = ((
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<AuthenticatedQueryResult>) & {
  query: (text: string, values?: unknown[]) => Promise<AuthenticatedQueryResult>;
};
type Ed25519Jwk = {
  kty: 'OKP';
  crv: 'Ed25519';
  x: string;
  kid?: string;
  alg?: string;
  use?: string;
};
type JwksResponse = { keys?: Ed25519Jwk[] };
type JwtClaims = Record<string, unknown> & {
  sub: string;
  iss: string;
  exp: number;
  nbf?: number;
};

let databaseClient: NeonClient | undefined;
let systemDatabaseClient: NeonClient | undefined;
let authenticatedPool: Pool | undefined;
const jwksCache = new Map<string, { keys: Ed25519Jwk[]; expiresAt: number }>();
const jwksRequests = new Map<string, Promise<Ed25519Jwk[]>>();

function getDatabaseUrl(): string {
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

  return parsed.toString();
}

/**
 * The direct owner connection is used only to SET LOCAL ROLE inside each
 * transaction. Never send a role override in startup options: Neon rejects it.
 */
function getDirectConnectionString(): string {
  const configured = process.env.DATABASE_URL_UNPOOLED?.trim();
  if (!configured) throw new Error('DATABASE_URL_UNPOOLED no está configurada.');

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error('DATABASE_URL_UNPOOLED no tiene un formato válido.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL_UNPOOLED debe ser una conexión PostgreSQL.');
  }
  if (parsed.hostname.includes('-pooler')) {
    throw new Error('DATABASE_URL_UNPOOLED debe usar el endpoint directo de Neon.');
  }

  // Older previews stored role/JWK overrides in the connection string.
  // Session context is now established transaction-locally after connecting.
  parsed.searchParams.delete('options');
  return parsed.toString();
}

function getAuthenticatedPool(): Pool {
  if (!authenticatedPool) {
    authenticatedPool = new Pool({
      connectionString: getDirectConnectionString(),
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
      allowExitOnIdle: true,
    });
  }
  return authenticatedPool;
}

async function getNeonAuthJwks(issuer: string): Promise<Ed25519Jwk[]> {
  const cached = jwksCache.get(issuer);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  let request = jwksRequests.get(issuer);
  if (!request) {
    request = (async () => {
      const configuredBaseUrl = process.env.NEON_AUTH_BASE_URL?.trim();
      if (!configuredBaseUrl) throw new Error('NEON_AUTH_BASE_URL no está configurada.');

      // An explicit JWKS URL can only be used for the primary configured issuer.
      // For another trusted branch issuer, derive the JWKS endpoint from that issuer.
      const primaryIssuer = configuredBaseUrl.replace(/\/$/, '');
      const jwksUrl = issuer === primaryIssuer && process.env.NEON_AUTH_JWKS_URL?.trim()
        ? process.env.NEON_AUTH_JWKS_URL.trim()
        : issuer + '/.well-known/jwks.json';
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
      if (!keys.length) {
        throw new Error('Neon Auth no publicó una clave Ed25519 compatible.');
      }

      jwksCache.set(issuer, { keys, expiresAt: Date.now() + 5 * 60 * 1000 });
      return keys;
    })().finally(() => {
      jwksRequests.delete(issuer);
    });
    jwksRequests.set(issuer, request);
  }

  return request;
}

async function verifyNeonAuthToken(token: string): Promise<JwtClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('El token de Neon Auth tiene un formato inválido.');

  let header: { kid?: string; alg?: string };
  let claims: JwtClaims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('No se pudo interpretar el token de Neon Auth.');
  }

  if (header.alg !== 'EdDSA' || typeof claims.sub !== 'string' ||
      typeof claims.iss !== 'string' || typeof claims.exp !== 'number') {
    throw new Error('El token de Neon Auth no contiene los claims requeridos.');
  }

  const baseUrl = process.env.NEON_AUTH_BASE_URL?.trim().replace(/\/$/, '');
  const issuer = claims.iss.replace(/\/$/, '');
  const allowedIssuers = new Set([
    baseUrl,
    ...(process.env.NEON_AUTH_ALLOWED_ISSUERS ?? '')
      .split(',')
      .map((value) => value.trim().replace(/\/$/, ''))
      .filter(Boolean),
  ]);

  if (!baseUrl || !allowedIssuers.has(issuer)) {
    // Only log issuer URLs (never the JWT, subject, cookies, or signature).
    console.error('ARCREDIX Neon Auth issuer rejected:', {
      issuer,
      configuredIssuer: baseUrl,
      allowedIssuers: [...allowedIssuers],
    });
    throw new Error('El emisor del token no está autorizado para esta instancia de ARCREDIX.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now || (typeof claims.nbf === 'number' && claims.nbf > now + 30)) {
    throw new Error('La sesión de Neon Auth expiró o todavía no es válida.');
  }

  let keys = await getNeonAuthJwks(issuer);
  let jwk = header.kid
    ? keys.find((candidate) => candidate.kid === header.kid)
    : keys.length === 1 ? keys[0] : undefined;

  if (!jwk) {
    jwksCache.delete(issuer);
    keys = await getNeonAuthJwks(issuer);
    jwk = header.kid
      ? keys.find((candidate) => candidate.kid === header.kid)
      : keys.length === 1 ? keys[0] : undefined;
  }
  if (!jwk) throw new Error('No se encontró la clave pública que firmó la sesión de Neon Auth.');

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const signature = Buffer.from(parts[2], 'base64url');
  const signedContent = Buffer.from(parts[0] + '.' + parts[1], 'utf8');
  if (!verifySignature(null, signedContent, publicKey, signature)) {
    throw new Error('La firma del token de Neon Auth no es válida.');
  }

  return claims;
}

/** Public client for non-tenant queries such as the public plan catalogue. */
export function getDatabase(): NeonClient {
  if (!databaseClient) databaseClient = neon(getDatabaseUrl());
  return databaseClient;
}

/**
 * Restricted privileged lookup used only to resolve an ARCREDIX identifier
 * before the internal Neon Auth sign-in. Never use it for tenant business data.
 */
export function getSystemDatabase(): NeonClient {
  if (systemDatabaseClient) return systemDatabaseClient;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL no está configurada.');

  const parsed = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL debe ser una conexión PostgreSQL.');
  }
  parsed.searchParams.delete('options');
  systemDatabaseClient = neon(parsed.toString());
  return systemDatabaseClient;
}

/**
 * Every authenticated query verifies the Neon Auth EdDSA token in Node,
 * switches to the NOLOGIN/NOBYPASSRLS application role, and injects verified
 * claims transaction-locally for pg_session_jwt's PostgREST-compatible mode.
 *
 * This avoids startup-only pg_session_jwt.jwk parameters, which are unreliable
 * with Neon WebSocket connections because the extension loads lazily.
 */
export async function getAuthenticatedDatabase(): Promise<AuthenticatedSql> {
  const tokenEndpoint = auth.token as unknown as () => Promise<{
    data?: { token?: string } | null;
    error?: unknown;
  }>;
  const tokenResult = await tokenEndpoint();
  if (tokenResult.error || typeof tokenResult.data?.token !== 'string') {
    throw new Error('No se pudo obtener el token autenticado para consultar la base de datos.');
  }

  const claims = await verifyNeonAuthToken(tokenResult.data.token);
  const authenticatedSubject = claims.sub;
  const pool = getAuthenticatedPool();

  const execute = async (queryText: string, values: unknown[] = []): Promise<AuthenticatedQueryResult> => {
    const client = await pool.connect();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      await client.query('SET LOCAL ROLE arcredix_app');
      await client.query("SELECT set_config('arc.auth_subject', $1, true)", [authenticatedSubject]);
      const result = await client.query(queryText, values);
      await client.query('COMMIT');
      transactionStarted = false;
      return {
        rows: result.rows as Record<string, unknown>[],
        rowCount: result.rowCount,
      };
    } catch (error) {
      if (transactionStarted) await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  };

  const taggedQuery = async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<AuthenticatedQueryResult> => {
    const queryText = strings.reduce(
      (query, part, index) => query + (index === 0 ? '' : '$' + index) + part,
      '',
    );
    return execute(queryText, values);
  };

  return Object.assign(taggedQuery, {
    query: (queryText: string, values: unknown[] = []) => execute(queryText, values),
  });
}
