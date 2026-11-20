import 'server-only';

import { neon } from '@neondatabase/serverless';
import { auth } from '@/lib/auth/server';

type NeonClient = ReturnType<typeof neon>;

let databaseClient: NeonClient | undefined;

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

  const existingOptions = parsed.searchParams.get('options')?.trim() ?? '';
  if (!existingOptions.includes('role=arcredix_app')) {
    parsed.searchParams.set(
      'options',
      [existingOptions, '-c role=arcredix_app'].filter(Boolean).join(' '),
    );
  }

  return parsed.toString();
}

/**
 * Application client. It switches the owner login to the restricted
 * arcredix_app role and optionally forwards the verified Neon Auth JWT.
 */
export function getDatabase(authToken?: string): NeonClient {
  const connectionString = getDatabaseUrl();

  if (authToken) {
    return neon(connectionString, { authToken });
  }

  if (!databaseClient) {
    databaseClient = neon(connectionString);
  }

  return databaseClient;
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

  return getDatabase(tokenResult.data.token);
}
