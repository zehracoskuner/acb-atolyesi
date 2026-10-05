import { useSyncExternalStore } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "http://localhost:5000/api";
let state = { status: "checking", user: null, error: null };
const listeners = new Set();
let generation = 0;
let pending;
function publish(next) { state = next; listeners.forEach(fn => fn()); }
export const getSession = () => state;
export function useSession() { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, getSession); }
function clearLocalSession() {
  generation++;
  pending = null;
  for (const key of ["token", "user", "acb_tour_done", "acb_tour_pending"]) localStorage.removeItem(key);
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('token');
  publish({ status: "guest", user: null, error: null });
}
export function refreshSession({ force = false } = {}) {
  if (pending && !force) return pending;
  const version = ++generation;
  publish({ ...state, status: "checking", error: null });
  const token = localStorage.getItem("token");
  pending = (async () => {
    try {
      const res = await fetch(API_BASE + "/auth/me", { credentials: "include", cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (version !== generation) return;
      if (res.status === 401) { clearLocalSession(); return; }
      if (!res.ok) throw new Error("Oturum doğrulanamadı. Lütfen tekrar dene.");
      const { user } = await res.json();
      if (!user) throw new Error("Oturum yanıtı geçersiz.");
      if (version !== generation) return;
      localStorage.setItem("user", JSON.stringify(user));
      publish({ status: "authenticated", user, error: null });
    } catch (error) {
      if (version === generation) publish({ ...state, status: "error", error: error.message });
    } finally { if (version === generation) pending = null; }
  })();
  return pending;
}
export async function forgetSession() {
  const token = localStorage.getItem("token");
  const res = await fetch(API_BASE + "/auth/logout", { method: "POST", credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Çıkış yapılamadı. Tekrar dene.");
  clearLocalSession();
  localStorage.setItem("acb_session_changed", String(Date.now()));
}
export const logoutSession = forgetSession;
if (typeof window !== "undefined") window.addEventListener("storage", e => { if (e.key === "acb_session_changed" || e.key === "token" || e.key === null) refreshSession({ force: true }); });
