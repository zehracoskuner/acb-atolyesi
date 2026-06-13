//lib/auth
import { syncLocalProgressToServer } from "../services/readingProgressService";

export function setToken(token) {
  if (!token) return;
  localStorage.setItem("token", token);
  
  // Token kaydedildikten sonra senkronizasyonu başlat
  // await kullanmıyoruz, arka planda çalışmaya devam eder
  syncLocalProgressToServer(); 
}

export function getToken() {
  return localStorage.getItem("token");
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  // Tur durumu hesaba özel değil — başka bir hesap aynı tarayıcıda
  // tekrar giriş yaptığında tur tekrar gösterilebilsin.
  localStorage.removeItem("acb_tour_done");
  localStorage.removeItem("acb_tour_pending");
}

export function isLoggedIn() {
  return !!getToken();
}