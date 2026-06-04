// src/services/readingProgressService.js
// TEK ve geçerli versiyon — diğer tüm dosyaları silin
import { apiDelete } from "../lib/api";

const API_BASE  = import.meta.env?.VITE_API_URL ?? "/api";
const LS_KEY    = "acb_reading_progress";

/* ─── localStorage yardımcıları ─── */
const lsAll   = ()          => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } };
const lsGet   = (sid)       => lsAll()[sid] || null;
const lsSave  = (sid, data) => { const a = lsAll(); a[sid] = { ...data, savedAt: Date.now() }; localStorage.setItem(LS_KEY, JSON.stringify(a)); };
const lsClear = (sid)       => { const a = lsAll(); delete a[sid]; localStorage.setItem(LS_KEY, JSON.stringify(a)); };
const lsList  = ()          => Object.entries(lsAll()).map(([storyId, d]) => ({ storyId, ...d }));

/* ─── Token ─── */
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token") || "";

/* ─── HTTP yardımcısı ─── */
async function apiFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ════════════════════════════════════════
   İlerlemeyi kaydet
   — Giriş yoksa localStorage, varsa DB
════════════════════════════════════════ */
export async function trackReadingProgress(
  storyId, chapterId, chapterNumber, chapterTitle, scrollPosition, currentUser
) {
  const data = { chapterId, chapterNumber, chapterTitle, scrollPosition };

  if (!currentUser) {
    lsSave(storyId, data);
    return;
  }

  try {
    await apiFetch("/reading-progress", {
      method: "POST",
      body: JSON.stringify({ storyId, chapterId, scrollPosition }),
    });
  } catch (err) {
    // DB başarısız → localStorage'a düş
    lsSave(storyId, data);
    console.warn("Progress DB'ye kaydedilemedi, localStorage'a yazıldı:", err.message);
  }
}

/* ════════════════════════════════════════
   Belirli hikayenin ilerlemesini getir
   Dönen format:
     Giriş yapılmış  → { found: true,  chapterId, scrollPosition }  (backend)
     Giriş yapılmamış → { chapterId, chapterNumber, chapterTitle, scrollPosition, savedAt }  (LS)
     Yok             → null
════════════════════════════════════════ */
export async function getProgressForStory(storyId, currentUser) {
  if (!currentUser) return lsGet(storyId);

  try {
    const data = await apiFetch(`/reading-progress/${storyId}`);
    // Backend { found: false } → null
    if (!data || data.found === false) return null;
    // Backend { found: true, chapterId, scrollPosition }
    return data;
  } catch {
    // Ağ hatası → localStorage fallback
    return lsGet(storyId);
  }
}

/* ════════════════════════════════════════
   Giriş sonrası localStorage → DB sync
   login() fonksiyonunun sonunda çağır
════════════════════════════════════════ */
export async function syncLocalProgressToServer() {
  const entries = lsList();
  if (!entries.length) return;

  const results = await Promise.allSettled(
    entries.map(async (e) => {
      await apiFetch("/reading-progress", {
        method: "POST",
        body: JSON.stringify({
          storyId:        e.storyId,
          chapterId:      e.chapterId,
          scrollPosition: e.scrollPosition,
        }),
      });
      lsClear(e.storyId);
    })
  );

  const failed = results.filter(r => r.status === "rejected").length;
  if (failed) console.warn(`${failed} progress kaydı sync edilemedi.`);
}
export async function clearProgressForStory(workId, user) {
  if (user?.id || user?._id) {
    await apiDelete(`/reading-progress/${workId}`);
  }
}

/* ════════════════════════════════════════
   Kullanıcının tüm devam eden okumaları
   ContinueReading bileşeni için
════════════════════════════════════════ */
export async function getMyReadingProgress() {
  return apiFetch("/reading-progress");
}