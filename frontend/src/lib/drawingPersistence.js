import { validateDrawing } from "../../../shared/drawingProtocol.js";

export function drawingError(error) {
  if (error?.name === "TimeoutError" || error?.name === "AbortError") return "Bağlantı zaman aşımına uğradı. Tekrar deneyin; yerel taslağınız korunuyor.";
  if (error instanceof TypeError) return "Sunucuya ulaşılamadı. İnternet bağlantısını kontrol edip tekrar deneyin.";
  if (error?.status === 401) return "Oturumunuz sona erdi. Yeniden giriş yapın; yerel taslağınız korunuyor.";
  if (error?.status === 403) return "Bu çizime erişilemiyor. Oturumunuzu ve eser yetkinizi kontrol edin.";
  if (error?.status === 413) return "Çizim 9 MiB sınırını aşıyor. Büyük görselleri küçültüp tekrar deneyin.";
  if (error?.status === 409) return "Sunucudaki çizim değişti. Yenileyip yerel taslağı inceleyin; otomatik üzerine yazılmadı.";
  return error?.message || "Bağlantı kurulamadı. Tekrar deneyin.";
}
const queues = new Map();
const memoryDrafts = new Map();
export async function waitForDrawing(workId) { await queues.get(workId); }
export function draftKey(userId, workId) { return `acb:drawing:v1:${userId}:${workId}`; }

// Network state outlives the editor. Each edit is persisted before scheduling a request.
export class DrawingSaver {
  constructor({ userId, workId, revision, storage, request, notify = () => {} }) {
    Object.assign(this, { workId, revision, storage, request, notify });
    // Separate editing sessions (including browser tabs) never erase each other's drafts.
    this.key = `${draftKey(userId, workId)}:${crypto.randomUUID()}`;
    this.version = 0; this.savedVersion = 0; this.snapshot = null;
    this.localError = ""; this.status = "Kaydedilmedi";
  }
  emit(error = "") { this.notify({ status: this.status, error, localError: this.localError }); }
  persist() {
    const draft = { snapshot: this.snapshot, revision: this.revision, pendingId: this.pendingId, version: this.version, sentVersion: this.sentVersion, updatedAt: Date.now() };
    memoryDrafts.set(this.key, draft);
    try {
      this.storage.setItem(this.key, JSON.stringify(draft));
      this.localError = "";
    } catch { this.localError = "Yerel taslak saklanamadı (tarayıcı alanı dolu veya kapalı). Kaydetmeden sayfadan ayrılmayın."; }
  }
  edit(snapshot) {
    this.snapshot = snapshot; this.version++;
    this.persist();
    this.status = this.running ? "Kaydediliyor" : "Kaydedilmedi";
    this.emit();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(), 1200);
  }
  save() {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    if (this.version === this.savedVersion) return Promise.resolve();
    const previous = queues.get(this.workId) || Promise.resolve();
    this.running = previous.then(async () => {
      while (this.savedVersion < this.version) {
        const snapshot = this.snapshot, version = this.version;
        try {
          validateDrawing(snapshot);
          // Reuse the id only for the identical edit after a lost acknowledgement.
          if (this.sentVersion !== version || !this.pendingId) this.pendingId = crypto.randomUUID();
          this.sentVersion = version; this.persist();
          this.status = "Kaydediliyor"; this.emit();
          const result = await this.request(`/drawing/${this.workId}`, { snapshot, expectedRevision: this.revision, mutationId: this.pendingId });
          if (result?.ok !== true || result.workId !== this.workId || result.mutationId !== this.pendingId || result.revision !== this.revision + 1) throw new Error("Sunucu kayıt onayı doğrulanamadı. Tekrar deneyin.");
          this.revision = result.revision; this.savedVersion = version;
          this.pendingId = null;
          if (this.version === version) {
            memoryDrafts.delete(this.key);
            try { this.storage.removeItem(this.key); this.localError = ""; } catch { /* stale draft is offered explicitly on reload */ }
          } else this.persist();
        } catch (error) { this.status = "Kaydedilemedi"; this.emit(drawingError(error)); return; }
      }
      this.status = "Kaydedildi"; this.emit();
    }).finally(() => { this.running = null; if (queues.get(this.workId) === task) queues.delete(this.workId); });
    const task = this.running;
    queues.set(this.workId, task);
    return task;
  }
}

export function readDrawingDraft(storage, userId, workId, metadata) {
  const prefix = draftKey(userId, workId);
  const keys = new Set([prefix, ...memoryDrafts.keys()]);
  for (let i = 0; i < storage.length; i++) keys.add(storage.key(i));
  const drafts = [];
  for (const key of keys) {
    if (key !== prefix && !key?.startsWith(prefix + ":")) continue;
    const raw = storage.getItem(key);
    const draft = memoryDrafts.get(key) || (raw ? JSON.parse(raw) : null);
    if (!draft) continue;
    // An oversized edit is still recoverable, even though it cannot be uploaded yet.
    if (!(draft.snapshot?.document?.store || draft.snapshot?.store)) throw new Error("Geçersiz taslak");
    if (draft.pendingId && draft.pendingId === metadata.mutationId) {
      if (draft.version === draft.sentVersion) { discardDrawingDraft(storage, key); continue; }
      draft.revision = metadata.revision;
    }
    drafts.push({ ...draft, key });
  }
  return drafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null;
}
export function discardDrawingDraft(storage, key) {
  storage.removeItem(key);
  memoryDrafts.delete(key);
}
