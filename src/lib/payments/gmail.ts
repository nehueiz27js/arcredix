export interface GoogleTokens {
  access_token: string; refresh_token?: string; expires_in?: number; scope?: string; token_type?: string;
}
export interface GmailCredential { access_token: string; refresh_token: string; scope?: string; }
export interface GmailMessageNotice {
  id: string; sender: string; subject: string; body: string; internalDate: string | null;
}
interface GmailHeader { name?: string; value?: string; }
interface GmailPart { mimeType?: string; body?: { data?: string }; headers?: GmailHeader[]; parts?: GmailPart[]; }
interface GmailHistoryResponse {
  historyId?: string; nextPageToken?: string; error?: { message?: string };
  history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }>;
}
interface GmailMessageResponse {
  id?: string; internalDate?: string; payload?: GmailPart; error?: { message?: string };
}

function googleConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error('Google OAuth no está configurado.');
  return { clientId, clientSecret };
}

export async function exchangeGoogleCode(code: string, redirectUri: string, verifier: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = googleConfig();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier }),
    cache: 'no-store',
  });
  const payload = await response.json() as GoogleTokens & { error?: string; error_description?: string };
  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(payload.error_description || payload.error || 'Google no devolvió credenciales offline.');
  }
  return payload;
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = googleConfig();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId,
      client_secret: clientSecret, grant_type: 'refresh_token' }), cache: 'no-store',
  });
  const payload = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) throw new Error('No se pudo renovar Gmail: ' + (payload.error || response.status));
  return payload.access_token;
}

export async function gmailProfile(accessToken: string): Promise<{ emailAddress: string; historyId: string }> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { authorization: 'Bearer ' + accessToken }, cache: 'no-store',
  });
  const payload = await response.json() as { emailAddress?: string; historyId?: string };
  if (!response.ok || !payload.emailAddress || !payload.historyId) throw new Error('No se pudo leer el perfil Gmail.');
  return { emailAddress: payload.emailAddress, historyId: payload.historyId };
}

export async function startGmailWatch(accessToken: string): Promise<{ historyId: string; expiration: string }> {
  const topicName = process.env.GOOGLE_PUBSUB_TOPIC?.trim();
  if (!topicName) throw new Error('Falta GOOGLE_PUBSUB_TOPIC.');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
    method: 'POST', headers: { authorization: 'Bearer ' + accessToken, 'content-type': 'application/json' },
    body: JSON.stringify({ topicName, labelIds: ['INBOX'], labelFilterBehavior: 'INCLUDE' }), cache: 'no-store',
  });
  const payload = await response.json() as { historyId?: string; expiration?: string; error?: { message?: string } };
  if (!response.ok || !payload.historyId || !payload.expiration) {
    throw new Error(payload.error?.message || 'No se pudo activar Gmail Watch.');
  }
  return { historyId: payload.historyId, expiration: payload.expiration };
}

function decodePart(data?: string): string {
  if (!data) return '';
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}
function collectText(payload: GmailPart | undefined): string {
  if (!payload) return '';
  let result = payload.mimeType === 'text/plain' && payload.body?.data ? decodePart(payload.body.data) + '\n' : '';
  for (const part of payload.parts ?? []) result += collectText(part);
  return result;
}

export async function getGmailHistoryMessages(accessToken: string, startHistoryId: string): Promise<{ historyId: string; messageIds: string[] }> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history');
  url.searchParams.set('startHistoryId', startHistoryId);
  url.searchParams.set('historyTypes', 'messageAdded');
  url.searchParams.set('maxResults', '100');
  const response = await fetch(url, { headers: { authorization: 'Bearer ' + accessToken }, cache: 'no-store' });
  const payload = await response.json() as GmailHistoryResponse;
  if (!response.ok) throw new Error(payload.error?.message || 'No se pudo consultar historial Gmail.');
  const ids = new Set<string>();
  for (const item of payload.history ?? []) for (const added of item.messagesAdded ?? []) {
    if (added.message?.id) ids.add(added.message.id);
  }
  let pageToken = payload.nextPageToken as string | undefined;
  let pages = 0;
  while (pageToken && pages < 10) {
    url.searchParams.set('pageToken', pageToken);
    const nextResponse = await fetch(url, { headers: { authorization: 'Bearer ' + accessToken }, cache: 'no-store' });
    const next = await nextResponse.json() as GmailHistoryResponse;
    if (!nextResponse.ok) throw new Error(next.error?.message || 'No se pudo paginar el historial Gmail.');
    for (const item of next.history ?? []) for (const added of item.messagesAdded ?? []) {
      if (added.message?.id) ids.add(added.message.id);
    }
    pageToken = next.nextPageToken;
    pages += 1;
  }
  return { historyId: String(payload.historyId || startHistoryId), messageIds: [...ids] };
}

export async function getGmailMessage(accessToken: string, messageId: string): Promise<GmailMessageNotice> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/' + encodeURIComponent(messageId) + '?format=full', {
    headers: { authorization: 'Bearer ' + accessToken }, cache: 'no-store',
  });
  const payload = await response.json() as GmailMessageResponse;
  if (!response.ok) throw new Error(payload.error?.message || 'No se pudo leer un mensaje Gmail.');
  const headers = payload.payload?.headers ?? [];
  const getHeader = (name: string) => String(headers.find((h) => String(h.name).toLowerCase() === name)?.value ?? '');
  return { id: String(payload.id), sender: getHeader('from'), subject: getHeader('subject'),
    body: collectText(payload.payload), internalDate: payload.internalDate ? new Date(Number(payload.internalDate)).toISOString() : null };
}

export function senderAddress(value: string): string {
  const match = value.match(/<([^<>]+)>/);
  return (match?.[1] || value).trim().toLowerCase();
}

export function parseBankNoticeAmount(body: string, subject: string): { amount: number; currency: string } | null {
  const text = subject + '\n' + body;
  const patterns = [
    /(?:ARS|AR\$|pesos)\s*([0-9][0-9.\s]*[,][0-9]{2}|[0-9][0-9.\s]*)/i,
    /([0-9][0-9.\s]*,[0-9]{2})\s*(?:ARS|pesos)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const amount = Number(match[1].replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(amount) && amount > 0) return { amount, currency: 'ARS' };
  }
  return null;
}
