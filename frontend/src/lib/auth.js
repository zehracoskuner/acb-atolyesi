import { forgetSession, refreshSession, getSession } from "./session";
//lib/auth
import { syncLocalProgressToServer } from "../services/readingProgressService";

export function setToken(token) {
  if (!token) return;
  localStorage.setItem("token", token);
  // Resolve the account identity before syncing its offline records.
  refreshSession({ force: true }).then(() => syncLocalProgressToServer());
}

export function getToken() {
  return localStorage.getItem("token");
}

export function clearAuth() {
  return forgetSession();
}

export function isLoggedIn() {
  return getSession().status === "authenticated";
}

export async function completeWebLogin() {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
  await refreshSession({ force: true });
  if (getSession().status !== "authenticated") throw new Error("Oturum doğrulanamadı. Lütfen tekrar giriş yapın.");
  localStorage.setItem("acb_session_changed", String(Date.now()));
  syncLocalProgressToServer().catch(() => {});
}
