import 'server-only';

import { neon, Pool } from '@neondatabase/serverless';
import { readClientSession } from '@/lib/auth/client-session';

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

let databaseClient: NeonClient | undefined;
let systemDatabaseClient: NeonClient | undefined;
let authenticatedPool: Pool | undefined;

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

  parsed.searchParams.delete('options');
  return parsed.toString();
}

/** Direct owner connection; role switching is transaction-local, never a startup option. */
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

/** Public, non-tenant queries such as the public plan catalogue. */
export function getDatabase(): NeonClient {
  if (!databaseClient) databaseClient = neon(getDatabaseUrl());
  return databaseClient;
}

/**
 * Restricted lookup used only to resolve a client access identifier before
 * issuing its independent session. Never use it for tenant business data.
 */
export function getSystemDatabase(): NeonClient {
  if (systemDatabaseClient) return systemDatabaseClient;
  systemDatabaseClient = neon(getDatabaseUrl());
  return systemDatabaseClient;
}

/**
 * Resolve the tenant subject from either:
 * - ARCREDIX's signed client identifier cookie; or
 * - the verified Neon Auth session used only by the platform administrator.
 *
 * Neon Auth is not involved in customer creation, customer login, or customer
 * sessions. Both identities enter the same transaction-local RLS context.
 */
export async function getAuthenticatedDatabase(): Promise<AuthenticatedSql> {
  const clientSession = await readClientSession();
  let authenticatedSubject = clientSession?.sub;

  if (!authenticatedSubject) {
    const { auth } = await import('@/lib/auth/server');
    const { data: session } = await auth.getSession();
    authenticatedSubject = session?.user?.id ?? undefined;
  }

  if (!authenticatedSubject) {
    throw new Error('No hay una sesión autenticada para consultar los datos.');
  }

  const pool = getAuthenticatedPool();

  const execute = async (
    queryText: string,
    values: unknown[] = [],
  ): Promise<AuthenticatedQueryResult> => {
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
