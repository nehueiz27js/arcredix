import 'server-only';

export interface MercadoPagoCredential {
  access_token: string;
  refresh_token: string;
  provider_user_id: string;
  expires_at?: number;
  live_mode?: boolean | null;
}

export async function refreshMercadoPagoCredential(
  credential: MercadoPagoCredential,
): Promise<MercadoPagoCredential> {
  if (credential.expires_at && credential.expires_at > Date.now() + 60_000) return credential;
  const clientId = process.env.MERCADO_PAGO_CLIENT_ID?.trim();
  const clientSecret = process.env.MERCADO_PAGO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error('Faltan credenciales de aplicación de Mercado Pago.');
  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ grant_type: 'refresh_token', client_id: clientId,
      client_secret: clientSecret, refresh_token: credential.refresh_token }),
    cache: 'no-store',
  });
  const payload = await response.json() as {
    access_token?: string; refresh_token?: string; user_id?: string | number;
    expires_in?: number; live_mode?: boolean; error?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error('Mercado Pago rechazó la renovación del token: ' + (payload.error || response.status));
  }
  if (payload.user_id && String(payload.user_id) !== credential.provider_user_id) {
    throw new Error('La renovación devolvió una cuenta de Mercado Pago diferente.');
  }
  return {
    ...credential,
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || credential.refresh_token,
    expires_at: Date.now() + Number(payload.expires_in || 21_600) * 1000,
    live_mode: payload.live_mode ?? credential.live_mode,
  };
}
