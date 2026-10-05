import { describe, it, expect } from "vitest";
import { draftKey, readDrafts, persistDraft } from "../../frontend/src/lib/chapterDrafts.js";
function storage() {
  const data = new Map();
  return { get length() { return data.size; }, key: i => [...data.keys()][i], getItem: key => data.get(key),
    setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const chapter = { title: "Offline", content: "recover me", revision: 3, _dirty: true };
describe("local chapter drafts", () => {
  it("survives a failed save and is isolated by user, work, chapter and tab", () => {
    const store = storage();
    persistDraft(store, draftKey("alice", "book", "chapter", "tab1"), chapter);
    persistDraft(store, draftKey("alice", "book", "chapter", "tab2"), { ...chapter, title: "Other tab" });
    expect(readDrafts(store, "bob", "book", "chapter")).toEqual([]);
    expect(readDrafts(store, "alice", "other book", "chapter")).toEqual([]);
    expect(readDrafts(store, "alice", "book", "other chapter")).toEqual([]);
    expect(readDrafts(store, "alice", "book", "chapter")).toHaveLength(2);
    expect(readDrafts(store, "alice", "book", "chapter")[0]).toMatchObject({ baseRevision: 3, content: "recover me" });
    persistDraft(store, draftKey("alice", "book", "chapter", "tab1"), { ...chapter, _dirty: false });
    expect(readDrafts(store, "alice", "book", "chapter")).toHaveLength(1);
  });
  it("invalid drafts are ignored and failed storage writes are observable", () => {
    const store = storage();
    store.setItem(draftKey("a", "w", "c", "t"), "{broken");
    expect(readDrafts(store, "a", "w", "c")).toEqual([]);
    expect(() => persistDraft({ setItem() { throw new Error("quota"); } }, "key", chapter)).toThrow("quota");
    expect(() => draftKey(null, "w", "c", "t")).toThrow();
  });
  it("reload and returning to a work recover the newest full chapter text after offline/auth failures", () => {
    const store = storage(), key = draftKey("alice", "book", "chapter", "old-editor");
    const content = "<p>first</p><p>middle</p><p>last</p>";
    persistDraft(store, key, { ...chapter, content });
    persistDraft(store, key, { ...chapter, content: content + "typed while saving", _saving: true });
    persistDraft(store, key, { ...chapter, content: content + "typed while saving", _saveError: true });
    // A newly mounted editor only knows the user/work/chapter, not the previous editor ID.
    const [recovered] = readDrafts(store, "alice", "book", "chapter");
    expect(recovered.content).toBe("<p>first</p><p>middle</p><p>last</p>typed while saving");
    expect(recovered.baseRevision).toBe(3);
    persistDraft(store, draftKey("alice", "book", "other", "new-editor"), { ...chapter, _dirty: false });
    expect(readDrafts(store, "alice", "book", "chapter")).toHaveLength(1);
  });
});
