import "server-only";

import { neon } from "@neondatabase/serverless";

type NeonClient = ReturnType<typeof neon>;

let databaseClient: NeonClient | undefined;

function getDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL no tiene un formato válido.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL debe ser una conexión PostgreSQL.");
  }

  return connectionString;
}

/**
 * Server-only Neon HTTP client. Use the pooled DATABASE_URL for app traffic.
 * Keep DATABASE_URL_UNPOOLED reserved for future migration tooling.
 */
export function getDatabase(): NeonClient {
  if (!databaseClient) {
    databaseClient = neon(getDatabaseUrl());
  }

  return databaseClient;
}
