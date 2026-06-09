const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

const ADMIN_BASE = `${API_BASE}/${import.meta.env.VITE_ADMIN_SECRET_PATH || "admin"}`;

const ADMIN_PREFIX = `/${import.meta.env.VITE_ADMIN_SECRET_PATH || "admin"}`;

export const adminGet    = (path)       => apiGet(ADMIN_PREFIX + path);
export const adminPost   = (path, body) => apiPost(ADMIN_PREFIX + path, body);
export const adminPut    = (path, body) => apiPut(ADMIN_PREFIX + path, body);
export const adminPatch  = (path, body) => apiPatch(ADMIN_PREFIX + path, body);
export const adminDelete = (path)       => apiDelete(ADMIN_PREFIX + path);

// 401 alındığında — token gerçekten geçersiz mi önce kontrol et
async function handleAuthError() {
  try {
    const res = await fetch(API_BASE + "/auth/me", {
      method: "GET",
      headers: getHeaders(false),
      credentials: "include",
    });
    // Token hâlâ geçerliyse (geçici hata, ağ sorunu vs.) çıkış yapma
    if (res.ok) return;
  } catch {
    // Ağ hatası — sunucuya ulaşılamıyor, çıkış yapma
    return;
  }

  // /me de 401 döndü → token gerçekten geçersiz, temizle
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
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

export async function apiGet(path) {
  const res = await fetch(API_BASE + path, {
    method: "GET",
    headers: getHeaders(false),
    credentials: "include",
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Sunucu beklenen JSON yerine başka bir şey döndürdü (status ${res.status}).`);
  }

  if (!res.ok) {
    if (res.status === 401) handleAuthError(); // await yok — arka planda çalışsın
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
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
    if (res.status === 401) handleAuthError();
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

export async function apiPut(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "PUT",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify(body || {}),
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401) handleAuthError();
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

export async function apiDelete(path) {
  const res = await fetch(API_BASE + path, {
    method: "DELETE",
    headers: getHeaders(false),
    credentials: "include",
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401) handleAuthError();
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

export async function apiPatch(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "PATCH",
    headers: getHeaders(),
    credentials: "include",
    body: JSON.stringify(body || {}),
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401) handleAuthError();
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}