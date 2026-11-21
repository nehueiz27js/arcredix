import { NextResponse } from 'next/server';

import { getWebhookDatabase } from '@/lib/db/webhook-client';
import { decryptCredential, type EncryptedCredential } from '@/lib/payments/credential-vault';
import { refreshGoogleAccessToken, startGmailWatch, type GmailCredential } from '@/lib/payments/gmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WatchRow = {
  connection_id: string; ciphertext: string; iv: string; auth_tag: string;
  key_version: number; metadata: Record<string, unknown>;
};

export async function GET(request: Request) {
  const secret = process.env.ARCREDIX_CRON_SECRET?.trim();
  if (!secret || request.headers.get('authorization') !== 'Bearer ' + secret) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  try {
    const sql = getWebhookDatabase();
    const result = await sql.query('SELECT * FROM public.arcredix_list_gmail_watches()', []);
    const rows = (Array.isArray(result) ? result : result.rows) as WatchRow[];
    let renewed = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const credential = decryptCredential<GmailCredential>({
          ciphertext: row.ciphertext, iv: row.iv, authTag: row.auth_tag, keyVersion: row.key_version,
        } as EncryptedCredential);
        const accessToken = await refreshGoogleAccessToken(credential.refresh_token);
        const watch = await startGmailWatch(accessToken);
        await sql.query('SELECT public.arcredix_update_gmail_watch($1,$2,$3)',
          [row.connection_id, watch.historyId, watch.expiration]);
        renewed += 1;
      } catch (error) {
        failed += 1;
        console.error('ARCREDIX Gmail watch renewal failed for connection ' + row.connection_id, error);
      }
    }
    return NextResponse.json({ checked: rows.length, renewed, failed });
  } catch (error) {
    console.error('ARCREDIX Gmail watch renewal job failed:', error);
    return NextResponse.json({ error: 'No se pudo renovar Gmail Watch.' }, { status: 500 });
  }
}
