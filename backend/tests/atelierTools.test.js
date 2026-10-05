import { describe, it, expect, vi, afterEach } from "vitest";
import { getSkillScores, getTrajectory, recordSignal } from "../../frontend/src/lib/pusula.js";
import { analyzeWords, getPrefs, setPref } from "../../frontend/src/lib/kelimeCantasi.js";
vi.mock("../../frontend/src/lib/api", () => ({ apiPost: vi.fn(), apiPatch: vi.fn() }));
import { apiPost, apiPatch } from "../../frontend/src/lib/api";
import { saveAtelierNote } from "../../frontend/src/lib/atelierNotes.js";
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("Atelier local tools", () => {
  it.each(["null", "{}", "42", '"bad"', "[null, {}, 3]", "not json"])("survives corrupt storage %s", raw => {
    vi.stubGlobal("localStorage", { getItem: () => raw, setItem: vi.fn() });
    expect(getSkillScores()).toEqual([]);
    expect(getTrajectory("duygu").direction).toBe("yetersiz");
    expect(() => recordSignal({ skill: "duygu" })).not.toThrow();
    expect(getPrefs()).toEqual({});
    expect(analyzeWords("deniz deniz")[0].count).toBe(2);
    expect(() => setPref("deniz", "voice")).not.toThrow();
  });
  it("ignores legacy AI review signals while retaining rules and word bag signals", () => {
    const timestamp = Date.now();
    const signals = ["rule", "wordbag", "review"].map((source, i) => ({ source, skill: ["duygu", "tekrar", "kurgu"][i], severity: "medium", ts: timestamp }));
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(signals) });
    expect(getSkillScores({ source: ["rule", "wordbag"] }).map(s => s.skill)).toEqual(["duygu", "tekrar"]);
  });
});

describe("Atelier note receipt", () => {
  const draft = { title: "  Egzersiz  ", text: "metin" }, context = { workId: "work" };
  const item = { _id: "note", title: "Egzersiz", content: "metin", workId: "work" };
  it("creates with POST then updates the same linked note with PATCH", async () => {
    apiPost.mockResolvedValue({ item }); apiPatch.mockResolvedValue({ item });
    expect(await saveAtelierNote(draft, context)).toEqual(item);
    await saveAtelierNote({ ...draft, noteId: "note" }, context);
    expect(apiPost).toHaveBeenCalledWith("/notes", { title: "Egzersiz", content: "metin", workId: "work" }, { timeoutMs: 15000 });
    expect(apiPatch.mock.calls[0][0]).toBe("/notes/note");
  });
  it.each([{ item: {} }, { item: { ...item, workId: "other" } }, { item: { ...item, content: "stale" } }, { item: { ...item, title: "wrong" } }])("rejects a mismatched receipt", async response => {
    apiPost.mockResolvedValue(response);
    await expect(saveAtelierNote(draft, context)).rejects.toThrow("doğrulanamadı");
  });
  it("does not claim success after server or network failure", async () => {
    apiPost.mockRejectedValue(new Error("Failed to fetch"));
    await expect(saveAtelierNote(draft, context)).rejects.toThrow("metnin korunuyor");
    apiPost.mockRejectedValue(Object.assign(new Error("Not oluşturulamadı."), { status: 500 }));
    await expect(saveAtelierNote(draft, context)).rejects.toThrow("Not oluşturulamadı");
  });
});
