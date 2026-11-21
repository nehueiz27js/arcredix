import { loadEnvConfig } from '@next/env';
import { neon } from '@neondatabase/serverless';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { gitBlobSha1, splitSqlStatements } from './migrate-lib.mjs';

loadEnvConfig(process.cwd());

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'database', 'migrations');
const connectionString = process.env.DATABASE_URL_UNPOOLED?.trim();

if (!connectionString) {
  throw new Error('Configurá DATABASE_URL_UNPOOLED con la conexión directa de Neon antes de ejecutar migraciones.');
}

const parsedUrl = new URL(connectionString);
if (parsedUrl.hostname.includes('-pooler')) {
  throw new Error('DATABASE_URL_UNPOOLED no debe usar un endpoint -pooler.');
}

const sql = neon(connectionString);
const migrationFiles = (await readdir(migrationsDir))
  .filter((file) => /^\d{4}_[a-z0-9_]+\.sql$/.test(file))
  .sort();

if (!migrationFiles.length) throw new Error('No se encontraron archivos de migración.');

const migrations = await Promise.all(migrationFiles.map(async (file) => {
  const content = await readFile(path.join(migrationsDir, file), 'utf8');
  const match = file.match(/^(\d{4})_([a-z0-9_]+)\.sql$/);
  return {
    version: match[1],
    name: match[2],
    file,
    checksum: gitBlobSha1(content),
    statements: splitSqlStatements(content),
  };
}));

const versions = new Set();
for (const migration of migrations) {
  if (versions.has(migration.version)) {
    throw new Error('Hay más de una migración con la versión ' + migration.version + '. Cada versión debe ser única.');
  }
  versions.add(migration.version);
}

function ledgerInsert(migration) {
  return sql.query(
    'INSERT INTO public.schema_migrations (version, migration_name, checksum) VALUES ($1, $2, $3)',
    [migration.version, migration.name, migration.checksum],
  );
}

async function applyMigration(migration) {
  const queries = migration.statements.map((statement) => sql.query(statement, []));
  queries.push(ledgerInsert(migration));
  await sql.transaction(queries, { isolationMode: 'ReadCommitted' });
  console.log('Aplicada ' + migration.version + '_' + migration.name);
}

const ledgerCheck = await sql.query("SELECT to_regclass('public.schema_migrations') AS ledger", []);
const ledgerExists = Boolean(ledgerCheck[0]?.ledger);

if (!ledgerExists) {
  const bootstrap = migrations.find((migration) => migration.version === '0004' && migration.name === 'migration_ledger');
  if (!bootstrap) {
    throw new Error('No existe 0004_migration_ledger.sql para inicializar el ledger.');
  }
  await applyMigration(bootstrap);
}

const ledgerRows = await sql.query('SELECT version, migration_name, checksum FROM public.schema_migrations ORDER BY version', []);
const applied = new Map(ledgerRows.map((row) => [row.version, row]));

for (const migration of migrations) {
  const existing = applied.get(migration.version);
  if (existing) {
    if (existing.migration_name !== migration.name || existing.checksum.trim() !== migration.checksum) {
      throw new Error('Checksum o nombre diferente para migración registrada ' + migration.version + '. No se modificó la base.');
    }
    continue;
  }

  if (['0001', '0002', '0003'].includes(migration.version)) {
    throw new Error('Migración histórica ' + migration.version + ' no está registrada. No se ejecutará automáticamente sobre un esquema existente.');
  }

  await applyMigration(migration);
}

console.log('Ledger verificado. No quedan migraciones pendientes.');
