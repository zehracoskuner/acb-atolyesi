import { apiPost, apiPatch } from "./api";

export async function saveAtelierNote({ title, text, noteId }, { workId }) {
  const body = { title: title.trim() || "Egzersiz notu", content: text, workId };
  let response;
  try {
    response = noteId ? await apiPatch("/notes/" + noteId, body, { timeoutMs: 15000 })
      : await apiPost("/notes", body, { timeoutMs: 15000 });
  } catch (error) {
    throw new Error(error.status ? error.message : "Nota ulaşılamadı. Bağlantını kontrol edip tekrar dene; metnin korunuyor.");
  }
  const item = response?.item;
  if (!item?._id || (noteId && String(item._id) !== noteId)
    || String(item.workId) !== String(workId) || item.content !== text || item.title !== body.title) {
    throw new Error("Not kaydı doğrulanamadı. Metnin korunuyor; tekrar deneyebilirsin.");
  }
  return item;
}
