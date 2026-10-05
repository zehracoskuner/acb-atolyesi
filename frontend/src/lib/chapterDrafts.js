const prefix = (user, work, chapter) => `acb:draft:v1:${encodeURIComponent(user)}:${encodeURIComponent(work)}:${encodeURIComponent(chapter)}:`;
export function draftKey(user, work, chapter, editor) {
  if (!user || !work || !chapter || !editor) throw new Error("Taslak kimliği eksik.");
  return prefix(user, work, chapter) + editor;
}
export function readDrafts(storage, user, work, chapter) {
  if (!user) return [];
  const items = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(prefix(user, work, chapter))) continue;
    try {
      const draft = JSON.parse(storage.getItem(key));
      if (typeof draft?.title === "string" && typeof draft.content === "string" && typeof draft.localAt === "string" && Number.isSafeInteger(draft.baseRevision)) items.push({ ...draft, key });
    } catch { /* Ignore damaged drafts, never inject raw data into the editor. */ }
  }
  return items.sort((a, b) => b.localAt.localeCompare(a.localAt));
}
export function persistDraft(storage, key, chapter) {
  if (!chapter._dirty) { storage.removeItem(key); return; }
  storage.setItem(key, JSON.stringify({ title: chapter.title,
    content: chapter.content,
    baseRevision: chapter.revision ?? 0, localAt: new Date().toISOString() }));
}
