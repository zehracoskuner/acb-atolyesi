import { EXPLORE_PATH } from "./routes.js";
const KEY = "acb_login_return";

export function safeReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return null;
  let url;
  try { url = new URL(value, window.location.origin); } catch { return null; }
  if (/^\/(login|register|auth|verify-email|profili-tamamla|sozlesme-kabul)(\/|$)/.test(url.pathname)) return null;
  return url.origin === window.location.origin ? url.pathname + url.search + url.hash : null;
}

export function rememberLoginReturn(path) {
  const safe = safeReturnPath(path);
  if (safe) sessionStorage.setItem(KEY, safe);
  return safe;
}

export function loginForReturn(path) {
  const safe = rememberLoginReturn(path);
  return safe ? `/login?returnTo=${encodeURIComponent(safe)}` : "/login";
}

export function consumeLoginReturn() {
  const safe = safeReturnPath(sessionStorage.getItem(KEY));
  sessionStorage.removeItem(KEY);
  return safe || EXPLORE_PATH;
}
