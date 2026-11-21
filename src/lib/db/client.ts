import 'server-only';

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

let databaseClient: NeonClient | undefined;
let systemDatabaseClient: NeonClient | undefined;
let jwksCache: { keys: Ed25519Jwk[]; expiresAt: number } | undefined;
let jwksRequest: Promise<Ed25519Jwk[]> | undefined;

function getDatabaseUrl(): string {
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

  return parsed.toString();
}

/**
 * Direct connection using the least-privileged application role.
 * Neon poolers reject startup role overrides, while pg_session_jwt requires
 * its JWK to be sent in PostgreSQL's startup packet.
 */
function getAuthenticatedDatabaseUrl(jwk: Ed25519Jwk): string {
  const connectionString = process.env.DATABASE_URL_UNPOOLED?.trim();

  if (!connectionString) {
    throw new Error('DATABASE_URL_UNPOOLED no está configurada para sesiones RLS autenticadas.');
  }

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL_UNPOOLED no tiene un formato válido.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('DATABASE_URL_UNPOOLED debe ser una conexión PostgreSQL.');
  }

  const existingOptions = parsed.searchParams.get('options')?.trim() ?? '';
  const publicJwk = {
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    ...(jwk.kid ? { kid: jwk.kid } : {}),
    ...(jwk.alg ? { alg: jwk.alg } : {}),
    ...(jwk.use ? { use: jwk.use } : {}),
  };
  const jwkOption = "-c pg_session_jwt.jwk='" + JSON.stringify(publicJwk) + "'";

  parsed.searchParams.set('options', [existingOptions, jwkOption].filter(Boolean).join(' '));
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
 * Public database client for queries that do not require an authenticated RLS session.
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

/**
 * Authenticated PostgreSQL queries must use a real startup packet because
 * pg_session_jwt.jwk is a startup-only parameter. The HTTP neon() query function
 * cannot provide session startup parameters, so each query gets a short
 * WebSocket-backed transaction with the JWK already supplied by Pool.
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

  const token = tokenResult.data.token;
  const jwk = await getJwkForToken(token);
  const connectionString = getAuthenticatedDatabaseUrl(jwk);

  const execute = async (queryText: string, values: unknown[] = []): Promise<AuthenticatedQueryResult> => {
    const pool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 1000,
    });

    try {
      const client = await pool.connect();
      let transactionStarted = false;

      try {
        await client.query('BEGIN');
        transactionStarted = true;

        // JWK is already present in the WebSocket connection startup packet.
        await client.query('SELECT auth.init()');
        await client.query('SELECT auth.jwt_session_init($1)', [token]);

        const result = await client.query(queryText, values);
        await client.query('COMMIT');
        transactionStarted = false;

        return {
          rows: result.rows as Record<string, unknown>[],
          rowCount: result.rowCount,
        };
      } catch (error) {
        if (transactionStarted) {
          await client.query('ROLLBACK').catch(() => undefined);
        }
        throw error;
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  };

  const taggedQuery = async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<AuthenticatedQueryResult> => {
    const queryText = strings.reduce(
      (query, part, index) => query + (index === 0 ? '' : `$${index}`) + part,
      '',
    );
    return execute(queryText, values);
  };

  return Object.assign(taggedQuery, {
    query: (queryText: string, values: unknown[] = []) => execute(queryText, values),
  });
}
