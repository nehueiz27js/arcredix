import 'server-only';

import { Pool } from '@neondatabase/serverless';

type WebhookQueryResult = {
  rows: Record<string, unknown>[];
  rowCount: number | null;
};
type WebhookSql = {
  query: (text: string, values?: unknown[]) => Promise<WebhookQueryResult>;
};

let webhookPool: Pool | undefined;

function getWebhookPool(): Pool {
  if (!webhookPool) {
    const configured = process.env.DATABASE_URL_UNPOOLED?.trim();
    if (!configured) throw new Error('Falta DATABASE_URL_UNPOOLED para procesar webhooks.');
    const url = new URL(configured);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname.includes('-pooler')) {
      throw new Error('DATABASE_URL_UNPOOLED debe ser una conexión PostgreSQL directa.');
    }
    // Role switching is transaction-local; startup role overrides are rejected by Neon.
    url.searchParams.delete('options');
    webhookPool = new Pool({
      connectionString: url.toString(),
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
      allowExitOnIdle: true,
    });
  }
  return webhookPool;
}

/** Dedicated least-privilege context for provider callbacks and cron jobs. */
export function getWebhookDatabase(): WebhookSql {
  return {
    async query(queryText: string, values: unknown[] = []) {
      const client = await getWebhookPool().connect();
      let transactionStarted = false;
      try {
        await client.query('BEGIN');
        transactionStarted = true;
        await client.query('SET LOCAL ROLE arcredix_webhook');
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
    },
  };
}
