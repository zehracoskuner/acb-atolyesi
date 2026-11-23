import { clearCommunity, communityEpoch, communityRevision, receiveCommunity } from './communityStore';
export class ApiError extends Error {
  constructor(public status: number, message: string, public body: Record<string, unknown> = {}) { super(message); }
}
const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
let token: string | null = null;
let expired: (() => void) | undefined;
let membership: (() => void) | undefined;
let accountId: string | null = null;
export function setAccountId(value: string | null) { if (accountId !== value) { accountId = value; clearCommunity(); } }
export function activeAccountId() { return accountId; }
export function configureSession(value: string | null, onExpired?: () => void, onMembership?: () => void) {
  token = value; expired = onExpired; membership = onMembership;
}
export async function api<T>(path: string, method = 'GET', body?: unknown, timeout = 20000): Promise<T> {
  if (!base) throw new ApiError(0, 'API adresi ayarlanmamış. mobile/.env dosyasını yapılandırın.');
  if (!/^https?:\/\/[^\s]+\/api$/.test(base)) throw new ApiError(0, 'API adresi /api ile bitmeli.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const requestToken = token;
  const requestEpoch = communityEpoch(), requestRevision = communityRevision();
  const multipart = typeof FormData !== 'undefined' && body instanceof FormData;
  try {
    const response = await fetch(`${base}${path}`, { method, signal: controller.signal, credentials: 'omit',
      headers: { Accept: 'application/json', ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}),
        ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}) },
      ...(body ? { body: multipart ? body : JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && requestToken && token === requestToken && !path.startsWith('/auth/login')) expired?.();
      if (token === requestToken && ['PROFILE_INCOMPLETE', 'TERMS_ACCEPTANCE_REQUIRED'].includes(data.code)) membership?.();
      throw new ApiError(response.status, data.message || data.error || `İstek tamamlanamadı (${response.status}).`, data);
    }
    if (requestEpoch === communityEpoch() && requestToken === token && (method !== 'GET' || requestRevision === communityRevision())) receiveCommunity(path, method, data);
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.');
  } finally { clearTimeout(timer); }
}
export function message(error: unknown) { return error instanceof Error ? error.message : 'İşlem tamamlanamadı.'; }
