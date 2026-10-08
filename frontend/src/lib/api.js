import { refreshSession, getSession } from "./session";
import { rememberLoginReturn } from "./loginReturn";

function handleMembershipError(data) {
  const destination = data.code === "TERMS_ACCEPTANCE_REQUIRED" ? "/sozlesme-kabul"
    : data.code === "PROFILE_INCOMPLETE" ? "/profili-tamamla" : null;
  // Background sync during sign-in must not race with the sign-in redirect.
  const exempt = ["/login", "/register", "/auth/callback", "/sozlesme-kabul", "/profili-tamamla", "/kullanim-sartlari", "/gizlilik", "/etik-kurallar"];
  if (destination && !exempt.includes(window.location.pathname)) {
    rememberLoginReturn(window.location.pathname + window.location.search);
    window.location.assign(destination);
  }
}
import { API_BASE } from "./apiBase";
const pendingMaturePrompts = new Map();
function requestMatureAcknowledgement(workId) {
  if (!pendingMaturePrompts.has(workId)) {
    const prompt = new Promise(resolve => window.dispatchEvent(new CustomEvent("acb-mature-acknowledgement", { detail: { workId, resolve } })));
    pendingMaturePrompts.set(workId, prompt.finally(() => pendingMaturePrompts.delete(workId)));
  }
  return pendingMaturePrompts.get(workId);
}

const ADMIN_BASE = `${API_BASE}/${import.meta.env.VITE_ADMIN_SECRET_PATH || "admin"}`;

const ADMIN_PREFIX = `/${import.meta.env.VITE_ADMIN_SECRET_PATH || "admin"}`;

export const adminGet    = (path)       => apiGet(ADMIN_PREFIX + path);
export const adminPost   = (path, body) => apiPost(ADMIN_PREFIX + path, body);
export const adminPut    = (path, body) => apiPut(ADMIN_PREFIX + path, body);
export const adminPatch  = (path, body) => apiPatch(ADMIN_PREFIX + path, body);
export const adminDelete = (path)       => apiDelete(ADMIN_PREFIX + path);

// 401 alındığında — token gerçekten geçersiz mi önce kontrol et
async function handleAuthError() {
  await refreshSession();
  if (getSession().status === "guest") window.dispatchEvent(new Event("acb-membership-required"));
}

export function describeAiError(e, { fallback = "Analiz yapılamadı. Tekrar dene.", timeoutMessage = "Analiz uzun sürdü, tekrar dene." } = {}) {
  if (e?.timeout) return { message: timeoutMessage, retryable: true };
  if (e?.status === 401) return { message: "Oturumun düşmüş, yeniden giriş yapman gerekiyor.", retryable: false };
  if (e?.status === 429) return { message: "Çok fazla istek var, az sonra tekrar dene.", retryable: true };
  if (e?.status === 400) return { message: "Bu içerikle analiz yapılamıyor.", retryable: false };
  return { message: fallback, retryable: true };
}

function getHeaders(includeContentType = true) {
  const token = localStorage.getItem("token");
  const headers = {};
  if (includeContentType) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function apiGet(path, { timeoutMs, matureRetry = false } = {}) {
  const res = await fetch(API_BASE + path, {
    method: "GET",
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    headers: getHeaders(false),
    credentials: "include",
    cache: "no-store",
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Sunucu beklenen JSON yerine başka bir şey döndürdü (status ${res.status}).`);
  }

  if (!res.ok) {
    if (!matureRetry && res.status === 428 && data.code === "MATURE_ACKNOWLEDGEMENT_REQUIRED") {
      if (await requestMatureAcknowledgement(data.workId)) return apiGet(path, { timeoutMs, matureRetry: true });
      const err = new Error("Okuma iptal edildi."); err.status = 428; err.code = "MATURE_CANCELLED"; throw err;
    }
    if (res.status === 403) handleMembershipError(data);
    if (res.status === 401) handleAuthError(); // await yok — arka planda çalışsın
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function apiDownloadBook(workId, format) {
  const res = await fetch(`${API_BASE}/works/${encodeURIComponent(workId)}/download?format=${encodeURIComponent(format)}`, {
    headers: getHeaders(false), credentials: "include", cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 403) handleMembershipError(data);
    if (res.status === 401) handleAuthError();
    throw new Error(data.message || "Kitap indirilemedi.");
  }
  const expectedType = format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain";
  if (!res.headers.get("Content-Type")?.startsWith(expectedType)) throw new Error("Geçersiz dosya yanıtı; indirme durduruldu.");
  const blob = await res.blob();
  if (!blob.size) throw new Error("Boş dosya yanıtı; indirme durduruldu.");
  const encodedName = (res.headers.get("Content-Disposition") || "").match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  let filename = `Kitabim.${format}`;
  if (encodedName) { try { filename = decodeURIComponent(encodedName); } catch { /* safe fallback */ } }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
}

export async function apiPost(path, body, { timeoutMs } = {}) {
  const controller = timeoutMs ? new AbortController() : null;
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method: "POST",
      headers: getHeaders(),
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify(body || {}),
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (e) {
    if (e.name === "AbortError") {
      const err = new Error("İstek zaman aşımına uğradı.");
      err.timeout = true;
      throw err;
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 403) handleMembershipError(data);
    if (res.status === 401) handleAuthError();
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function apiPut(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "PUT",
    headers: getHeaders(),
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(body || {}),
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    throw new Error(`Sunucu beklenen JSON yerine başka bir şey döndürdü (status ${res.status}).`);
  }

  if (!res.ok) {
    if (res.status === 403) handleMembershipError(data);
    if (res.status === 401) handleAuthError();
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// A 2xx alone is not a durable chapter-save receipt. The caller must also
// associate this receipt with the exact local edit snapshot it submitted.
export function isChapterSaveReceipt(result, chapterId, baseRevision) {
  return result?.item?._id === chapterId && !!result.item.status
    && Number.isSafeInteger(result.revision)
    && result.revision >= baseRevision && result.revision <= baseRevision + 1
    && result.item.revision === result.revision
    && typeof result.savedAt === "string" && Number.isFinite(Date.parse(result.savedAt));
}

export async function apiDelete(path) {
  const res = await fetch(API_BASE + path, {
    method: "DELETE",
    headers: getHeaders(false),
    credentials: "include",
    cache: "no-store",
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 403) handleMembershipError(data);
    if (res.status === 401) handleAuthError();
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function apiPatch(path, body, { timeoutMs, signal } = {}) {
  const res = await fetch(API_BASE + path, {
    method: "PATCH",
    ...(signal ? { signal } : timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    headers: getHeaders(),
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify(body || {}),
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    throw new Error(`Sunucu beklenen JSON yerine başka bir şey döndürdü (status ${res.status}).`);
  }

  if (!res.ok) {
    if (res.status === 403) handleMembershipError(data);
    if (res.status === 401) handleAuthError();
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
