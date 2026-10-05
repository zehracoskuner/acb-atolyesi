export const atelierDraftKey = (userId, workId) => `acb:atelier:v1:${encodeURIComponent(userId)}:${encodeURIComponent(workId)}`;
export function readAtelierDraft(storage, key) {
  const raw = storage.getItem(key) || storage.getItem(key + ":saved");
  if (!raw) return { title: "", text: "", noteId: null };
  const value = JSON.parse(raw);
  if (typeof value.title !== "string" || typeof value.text !== "string") throw new Error("Egzersiz taslağı okunamadı.");
  return { title: value.title, text: value.text, noteId: typeof value.noteId === "string" ? value.noteId : null };
}
export function writeAtelierDraft(storage, key, draft) {
  storage.setItem(key, JSON.stringify({ title: draft.title, text: draft.text, noteId: draft.noteId }));
}

// Keep the last editor text available after refresh, but clear the pending draft
// only when the server acknowledged that exact text. Newer typing stays pending.
export function acknowledgeAtelierDraft(storage, key, saved, current) {
  writeAtelierDraft(storage, key + ":saved", saved);
  if (current.title === saved.title && current.text === saved.text) storage.removeItem(key);
  else writeAtelierDraft(storage, key, current);
}
