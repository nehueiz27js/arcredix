import 'server-only';

import { neon } from '@neondatabase/serverless';

type NeonClient = ReturnType<typeof neon>;
let webhookClient: NeonClient | undefined;

/**
 * A dedicated DB connection for authenticated provider callbacks and cron jobs.
 * The URL must use the arcredix_owner login with startup role arcredix_webhook.
 * That role can execute only narrowly scoped SECURITY DEFINER functions.
 */
export function getWebhookDatabase(): NeonClient {
  if (webhookClient) return webhookClient;
  const configured = process.env.ARCREDIX_WEBHOOK_DATABASE_URL?.trim();
  if (!configured) throw new Error('Falta ARCREDIX_WEBHOOK_DATABASE_URL.');
  const url = new URL(configured);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('ARCREDIX_WEBHOOK_DATABASE_URL no es PostgreSQL.');
  const options = (url.searchParams.get('options') || '').replace(/(?:^|\s)-c\s+role=[^\s]+/g, '').trim();
  url.searchParams.set('options', [options, '-c role=arcredix_webhook'].filter(Boolean).join(' '));
  webhookClient = neon(url.toString());
  return webhookClient;
}
