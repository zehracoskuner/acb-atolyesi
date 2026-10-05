import { apiDelete } from "../lib/api";
import { getSession } from "../lib/session";
const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "http://localhost:5000/api";
// Legacy unscoped records cannot safely be attributed to an account.
const storageKey = user => `acb_reading_progress:${user?._id || user?.id || "guest"}`;
function all(user) { try { return JSON.parse(localStorage.getItem(storageKey(user)) || "{}"); } catch { return {}; } }
function save(user, storyId, data) { try { const entries = all(user); if (data) entries[storyId] = data; else delete entries[storyId]; localStorage.setItem(storageKey(user), JSON.stringify(entries)); } catch { /* Storage may be unavailable. */ } }
async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, keepalive: opts.method === "POST" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
const queues = new Map();
export async function trackReadingProgress(storyId, chapterId, chapterNumber, chapterTitle, scrollPosition, currentUser) {
  if (!storyId || !chapterId || !Number.isFinite(scrollPosition)) return;
  const data = { chapterId: String(chapterId), chapterNumber, chapterTitle, scrollPosition: Math.min(100, Math.max(0, scrollPosition)), savedAt: Date.now() };
  save(currentUser, storyId, data);
  if (!currentUser) return;
  const key = `${storageKey(currentUser)}:${storyId}`;
  // Serialize saves so a slower previous chapter cannot overwrite the next one.
  const pending = (queues.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
    const active = getSession().user;
    if (String(active?._id || active?.id) !== String(currentUser._id || currentUser.id)) return;
    await apiFetch("/reading-progress", { method: "POST", body: JSON.stringify({ storyId, ...data }) });
    const latest = all(currentUser)[storyId];
    if (latest?.savedAt === data.savedAt && latest?.chapterId === data.chapterId) save(currentUser, storyId, { ...latest, synced: true });
  });
  queues.set(key, pending);
  try { await pending; } catch { /* The account-scoped local copy remains available. */ }
  finally { if (queues.get(key) === pending) queues.delete(key); }
}
export async function getProgressForStory(storyId, currentUser) {
  const local = all(currentUser)[storyId] || null;
  if (!currentUser) return local;
  try {
    const remote = await apiFetch(`/reading-progress/${storyId}`);
    if (local && !local.synced && (!remote?.updatedAt || local.savedAt > Date.parse(remote.updatedAt))) return local;
    return remote?.found ? remote : null;
  } catch { return local; }
}
export async function syncLocalProgressToServer() {
  const user = getSession().user;
  if (!user) return;
  // Do not transfer guest or another account's progress into this account.
  await Promise.all(Object.entries(all(user)).filter(([, item]) => !item.synced).map(async ([storyId, item]) => {
    try {
      const remote = await apiFetch(`/reading-progress/${storyId}`);
      if (remote.found && Date.parse(remote.updatedAt) >= item.savedAt) {
        if (all(user)[storyId]?.savedAt === item.savedAt) save(user, storyId, null);
        return;
      }
      // Reading may have continued while the server response was in flight.
      if (all(user)[storyId]?.savedAt !== item.savedAt) return;
      await trackReadingProgress(storyId, item.chapterId, item.chapterNumber, item.chapterTitle, item.scrollPosition, user);
    } catch { /* Retry on the next authenticated session. */ }
  }));
}
export async function clearProgressForStory(workId, user) {
  const pending = queues.get(`${storageKey(user)}:${workId}`);
  if (pending) await pending.catch(() => {});
  if (user) await apiDelete(`/reading-progress/${workId}`);
  save(user, workId, null);
}
export async function getMyReadingProgress() { return apiFetch("/reading-progress"); }

// A position is meaningful only for its saved chapter within this work's list.
export function resolveReadingResume(chapters, saved, { chapterId, restart = false } = {}) {
  const savedIndex = chapters.findIndex(ch => String(ch._id) === String(saved?.chapterId));
  const requestedIndex = chapterId ? chapters.findIndex(ch => String(ch._id) === String(chapterId)) : -1;
  if (chapterId && requestedIndex < 0) throw new Error("İstediğin bölüm bulunamadı veya artık yayında değil.");
  const index = chapterId ? requestedIndex : restart ? 0 : Math.max(0, savedIndex);
  const resume = !restart && savedIndex >= 0 && savedIndex === index;
  return { index, scrollPosition: resume ? Math.min(100, Math.max(0, Number(saved.scrollPosition) || 0)) : 0, resume };
}
