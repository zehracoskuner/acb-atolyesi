import { describe, it, expect } from "vitest";
import { atelierDraftKey, readAtelierDraft, writeAtelierDraft, acknowledgeAtelierDraft } from "../../frontend/src/lib/atelierDraft.js";
describe("exercise draft persistence", () => {
  it("restores title, text and note identity while isolating accounts and works", () => {
    const data = new Map();
    const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
    const key = atelierDraftKey("author", "novel");
    const draft = { title: "Egzersiz", text: "Türkçe metin\nİkinci satır", noteId: "saved-note" };
    writeAtelierDraft(storage, key, draft);
    expect(readAtelierDraft(storage, key)).toEqual(draft);
    expect(readAtelierDraft(storage, atelierDraftKey("other", "novel")).text).toBe("");
    expect(readAtelierDraft(storage, atelierDraftKey("author", "other")).text).toBe("");
  });
  it("surfaces storage failures and damaged drafts instead of claiming protection", () => {
    expect(() => writeAtelierDraft({ setItem() { throw Error("full"); } }, "key", {})).toThrow("full");
    expect(() => readAtelierDraft({ getItem: () => '{"title":42}' }, "key")).toThrow();
  });
  it("clears only an acknowledged pending draft, retaining the editor snapshot for remount", () => {
    const data = new Map();
    const storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
    const saved = { title: "Başlık", text: "Kaydedilen", noteId: "note" };
    writeAtelierDraft(storage, "work", saved);
    acknowledgeAtelierDraft(storage, "work", saved, saved);
    expect(data.has("work")).toBe(false);
    expect(readAtelierDraft(storage, "work")).toEqual(saved);
    const newer = { ...saved, text: "Kayıt sırasında yazılan" };
    acknowledgeAtelierDraft(storage, "work", saved, newer);
    expect(data.has("work")).toBe(true);
    expect(readAtelierDraft(storage, "work")).toEqual(newer);
  });
  it("does not clear pending text if storing the saved snapshot fails", () => {
    const removeItem = () => { throw Error("must not delete"); };
    expect(() => acknowledgeAtelierDraft({ setItem() { throw Error("quota"); }, removeItem }, "work", {}, {})).toThrow("quota");
  });
});
