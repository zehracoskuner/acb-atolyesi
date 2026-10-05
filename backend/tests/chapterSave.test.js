import { readFileSync } from "node:fs";
import { describe, it, expect, vi } from "vitest";
import { apiPut, apiPatch, isChapterSaveReceipt } from "../../frontend/src/lib/api.js";

// Exercise the page's actual reducer and async handlers without a browser/DOM.
const source = readFileSync(new URL("../../frontend/src/pages/ChaptersPage.jsx", import.meta.url), "utf8");
const reducerText = source.slice(source.indexOf("function chaptersReducer"), source.indexOf("function chaptersReducer") + source.slice(source.indexOf("function chaptersReducer")).indexOf("\n}\n") + 2);
const reducer = new Function(reducerText + "; return chaptersReducer;")();
function harness() {
  const chaptersRef = { current: ["a", "b"].map(_id => ({ _id, title: _id, content: "old", status: "published", reviewNote: "", _edit: 0, _dirty: false })) };
  const dispatch = action => { chaptersRef.current = reducer(chaptersRef.current, action); };
  const request = vi.fn();
  const publishingIds = { current: new Set() };
  const savesInFlight = { current: new Map() };
  const names = ["useCallback", "chaptersRef", "savesInFlight", "publishingIds", "autoSaveTimers", "dispatch", "apiPut", "isChapterSaveReceipt"];
  const start = source.indexOf("  const saveChapter = useCallback(");
  const end = source.indexOf("\n  useEffect", start);
  const save = new Function(...names, source.slice(start, end) + "; return saveChapter;")(
    fn => fn, chaptersRef, savesInFlight, publishingIds, { current: {} }, dispatch, request, isChapterSaveReceipt);
  const edit = (id, value) => dispatch({ type: "UPDATE_CHAPTER_CONTENT", chapterId: id, content: value });
  const unload = new Function("chaptersRef", "return " + source.split("const h = ")[1].split(";\n    window.addEventListener")[0])(chaptersRef);
  const patch = vi.fn(), announce = vi.fn(), alert = vi.fn(), pending = vi.fn();
  const publishStart = source.indexOf("  const handlePublish = async () => {");
  const publishEnd = source.indexOf("  const restoreVersion", publishStart);
  const publish = new Function("chaptersRef", "activeChapterId", "publishingIds", "window", "alert", "setPublishing", "saveChapter", "autoSaveTimers", "apiPatch", "workId", "dispatch", "setReviewPending", "setTimeout", "setAnnounceModal",
    source.slice(publishStart, publishEnd) + "; return handlePublish;")(
    chaptersRef, "a", publishingIds, { confirm: () => true }, alert, vi.fn(), save,
    { current: {} }, patch, "work", dispatch, pending, vi.fn(), announce);
  const get = vi.fn(), recoveryError = vi.fn();
  const recoveryStart = source.indexOf("  const resolveLocal = async");
  const recoveryEnd = source.indexOf("  const jumpToChapter", recoveryStart);
  const resolveLocal = new Function("apiGet", "mounted", "dispatch", "chaptersRef", "DOMPurify", "setError",
    source.slice(recoveryStart, recoveryEnd) + "; return resolveLocal;")(
    get, { current: true }, dispatch, chaptersRef, { sanitize: text => text }, recoveryError);
  const undoStacksRef = { current: {} };
  const undoHelpers = source.slice(source.indexOf("function pushUndoSnapshot"), source.indexOf("/* ── Reducer"));
  const changeStart = source.indexOf("  const handleContentChange =");
  const changeEnd = source.indexOf("  const handleTitleChange", changeStart);
  const { change, undo } = new Function("useCallback", "chaptersRef", "dispatch", "undoStacksRef", "MAX_UNDO", "wcFromHtml",
    undoHelpers + source.slice(changeStart, changeEnd) + `; return { change: handleContentChange,
      undo: id => { const content = popUndoSnapshot(id, undoStacksRef); if (content !== null) dispatch({ type: "UNDO_CONTENT", chapterId: id, content }); } };`)(
      fn => fn, chaptersRef, dispatch, undoStacksRef, 50, html => html.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length);
  const remove = vi.fn();
  const deleteStart = source.indexOf("  const handleDeleteChapter =");
  const deleteEnd = source.indexOf("  const handlePublish", deleteStart);
  const deleteChapter = new Function("chaptersRef", "publishingIds", "window", "dispatch", "autoSaveTimers", "savesInFlight", "apiDelete", "activeChapterId", "setActiveChapterId", "setActivePageId", "alert",
    source.slice(deleteStart, deleteEnd) + "; return handleDeleteChapter;")(
      chaptersRef, publishingIds, { confirm: () => true }, dispatch, { current: {} },
      savesInFlight,
      remove, "a", vi.fn(), vi.fn(), alert);
  return { chaptersRef, dispatch, request, save, edit, unload, publish, patch, announce, alert, pending, get, resolveLocal, recoveryError, change, undo, remove, deleteChapter };
}
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const result = (id, revision = 1) => ({ revision, savedAt: "2026-09-20T00:00:00.000Z", item: { _id: id, revision, status: "draft", reviewNote: "" } });

describe("chapter save flow", () => {
  it("clears eligibility after analysis and ignores older save receipts", async () => {
    const h = harness();
    h.dispatch({ type: "DEVELOPMENT_STATUS", development: { analysisCount: 1, eligibleForDevelopmentReview: false } });
    h.change("a", "one two", true);
    h.request.mockResolvedValueOnce({ ...result("a"), development: { analysisCount: 0, eligibleForDevelopmentReview: true } });
    await h.save("a");
    expect(h.chaptersRef.current.find(c => c._id === "a")._developmentEligible).toBe(false);
    expect(h.chaptersRef.current.find(c => c._id === "a")._developmentSequence).toBe(1);
    h.dispatch({ type: "DEVELOPMENT_STATUS", development: { analysisCount: 1, eligibleForDevelopmentReview: true } });
    expect(h.chaptersRef.current.every(c => c._developmentEligible)).toBe(true);
  });
  it("counts eligible positive edits, excludes hydration and undo, acknowledges only the in-flight snapshot", async () => {
    const h = harness();
    h.change("a", "one two", true);
    const pending = deferred(); h.request.mockReturnValueOnce(pending.promise);
    const saving = h.save("a");
    expect(h.request.mock.calls[0][1].eligibleWordDelta).toBe(1);
    h.change("a", "one two three", true);
    pending.resolve(result("a")); await saving;
    h.request.mockResolvedValueOnce(result("a", 2)); await h.save("a");
    expect(h.request.mock.calls[1][1].eligibleWordDelta).toBe(1);
    h.change("a", "hydrated ".repeat(6000), false);
    h.undo("a");
    h.change("a", "short", true);
    h.request.mockResolvedValueOnce(result("a", 3)); await h.save("a");
    expect(h.request.mock.calls[2][1].eligibleWordDelta).toBe(0);
  });
  it("preserves a long formatted chapter across normal editing, focus editing and undo", () => {
    const h = harness();
    const original = "<h2>Başlık</h2><p>" + "uzun metin ".repeat(1400) + "</p><ul><li>Son satır</li></ul>";
    h.dispatch({ type: "SET", chapters: [{ ...h.chaptersRef.current[0], content: original }] });
    h.change("a", original.replace("Başlık", "Yeni başlık"));
    const normal = h.chaptersRef.current[0].content;
    const focusStart = source.indexOf("  function handleChange(html, eligible)", source.indexOf("function FocusOverlay"));
    const focusEnd = source.indexOf("  return (", focusStart);
    const focusInput = html => new Function("chapter", "onContentChange", source.slice(focusStart, focusEnd) + "; return handleChange;")(h.chaptersRef.current[0], h.change)(html);
    focusInput(normal + "<p>Odakta</p>");
    expect(h.chaptersRef.current[0].content).toBe(normal + "<p>Odakta</p>");
    h.undo("a"); expect(h.chaptersRef.current[0].content).toBe(normal);
    h.undo("a"); expect(h.chaptersRef.current[0].content).toBe(original);
  });
  it("a successful receipt never replaces live content with sanitizer-equivalent HTML", async () => {
    const h = harness();
    h.change("a", "text<br>");
    const content = h.chaptersRef.current[0].content;
    h.request.mockResolvedValue({ ...result("a"), item: { ...result("a").item, content: "text<br />", title: "a" } });
    await h.save("a");
    expect(h.chaptersRef.current[0].content).toBe(content);
    expect(h.chaptersRef.current[0]._dirty).toBe(false);
  });
  it("deletion waits for an in-flight save and blocks further writes to that chapter", async () => {
    const h = harness(), d = deferred();
    h.edit("a", "pending"); h.request.mockReturnValue(d.promise);
    const saving = h.save("a"), deleting = h.deleteChapter("a", "a");
    expect(h.remove).not.toHaveBeenCalled();
    h.change("a", "must not enter locked editor");
    expect(h.chaptersRef.current[0].content).toBe("pending");
    d.resolve(result("a")); await saving; await deleting;
    expect(h.remove).toHaveBeenCalledExactlyOnceWith("/chapters/a");
    expect(h.chaptersRef.current.map(c => c._id)).toEqual(["b"]);
    expect(await h.save("a")).toBe(false);
  });
  it("failed deletion unlocks the chapter and preserves text for retry", async () => {
    const h = harness(); h.edit("a", "keep after failed delete");
    h.remove.mockRejectedValue(new Error("offline"));
    await h.deleteChapter("a", "a");
    expect(h.chaptersRef.current[0]).toMatchObject({ _dirty: true, _deleting: false });
    expect(h.chaptersRef.current[0].content).toBe("keep after failed delete");
  });
  it("local recovery compares the latest server version before applying any draft", async () => {
    const h = harness();
    h.dispatch({ type: "SET", chapters: [{ ...h.chaptersRef.current[0], revision: 0, _recovery: [{ title: "offline", content: "offline text", baseRevision: 0 }] }] });
    const chapter = h.chaptersRef.current[0], draft = chapter._recovery[0];
    expect(await h.save("a")).toBe(false);
    h.get.mockResolvedValue({ item: { revision: 2, content: "remote changed" } });
    await h.resolveLocal(chapter, draft);
    expect(h.chaptersRef.current[0].content).toBe("old");
    expect(h.chaptersRef.current[0]._conflict.revision).toBe(2);
    expect(await h.save("a")).toBe(false);
    // Only a second explicit decision after seeing the changed server text rebases.
    await h.resolveLocal(h.chaptersRef.current[0], draft);
    expect(h.chaptersRef.current[0]).toMatchObject({ revision: 2, _dirty: true, _conflict: null, _recovery: null });
    expect(h.chaptersRef.current[0].content).toBe("offline text");
    expect(h.request).not.toHaveBeenCalled();
  });
  it("typing while recovery compares the server cannot be overwritten", async () => {
    const h = harness(), d = deferred();
    h.dispatch({ type: "SET", chapters: [{ ...h.chaptersRef.current[0], revision: 0 }] });
    h.get.mockReturnValue(d.promise);
    const recovery = h.resolveLocal(h.chaptersRef.current[0], { title: "old draft", content: "old" });
    h.edit("a", "new typing");
    d.resolve({ item: { revision: 0 } }); await recovery;
    expect(h.chaptersRef.current[0].content).toBe("new typing");
    expect(h.recoveryError).toHaveBeenCalled();
  });
  it("rejects old response tokens without overwriting newer text or save state", () => {
    const h = harness(); h.edit("a", "latest");
    h.dispatch({ type: "SAVE_START", id: "a", request: "new-request" });
    h.dispatch({ type: "SAVE_SUCCESS", id: "a", request: "old-request", edit: 0, item: { revision: 99, status: "published" } });
    h.dispatch({ type: "SAVE_ERROR", id: "a", request: "old-request" });
    expect(h.chaptersRef.current[0]).toMatchObject({ _saving: true, _dirty: true, _saveError: false });
    expect(h.chaptersRef.current[0].content).toBe("latest");
  });
  it("conflicts retain local text and stop further saves until explicitly resolved", async () => {
    const h = harness(); h.edit("a", "local text");
    h.request.mockRejectedValueOnce({ status: 409, data: { current: { revision: 2, content: "remote text" } } });
    expect(await h.save("a")).toBe(false);
    h.edit("a", "merged text");
    expect(await h.save("a")).toBe(false);
    expect(h.request).toHaveBeenCalledTimes(1);
    expect(h.chaptersRef.current[0]).toMatchObject({ _dirty: true, _conflict: { revision: 2 } });
    h.dispatch({ type: "RESOLVE", id: "a", title: "a", content: "merged text", revision: 2 });
    h.request.mockResolvedValue(result("a", 3));
    expect(await h.save("a")).toBe(true);
    expect(h.request.mock.calls[1][1]).toMatchObject({ expectedRevision: 2, content: "merged text" });
  });
  it("restoring a server version cannot discard edits made during the request", () => {
    const h = harness(); h.edit("a", "typed during restore");
    h.dispatch({ type: "RESTORED", id: "a", edit: 0, chapter: { revision: 8, savedAt: "server time", content: "old version" } });
    expect(h.chaptersRef.current[0]).toMatchObject({ revision: 8, _dirty: true });
    expect(h.chaptersRef.current[0].content).toBe("typed during restore");
  });
  it("debounces autosave and cancels timers on cleanup without retrying failed/in-flight saves", async () => {
    vi.useFakeTimers();
    try {
      const start = source.indexOf("  useEffect(() => {\n    const timers = autoSaveTimers.current;");
      const end = source.indexOf("  const handleContentChange", start);
      const save = vi.fn();
      const runEffect = chapters => new Function("useEffect", "autoSaveTimers", "chapters", "publishingIds", "saveChapter", "AUTOSAVE_DELAY", "publishing",
        "return " + source.slice(start, end).trim())(fn => fn(), { current: {} }, chapters, { current: new Set() }, save, 2000, false);
      const chapters = [{ _id: "a", _dirty: true }, { _id: "b", _dirty: true, _saving: true }, { _id: "c", _dirty: true, _saveError: true }];
      let cleanup = runEffect(chapters);
      await vi.advanceTimersByTimeAsync(1999); expect(save).not.toHaveBeenCalled();
      cleanup(); await vi.advanceTimersByTimeAsync(2000); expect(save).not.toHaveBeenCalled();
      cleanup = runEffect(chapters);
      await vi.advanceTimersByTimeAsync(2000); expect(save).toHaveBeenCalledExactlyOnceWith("a");
      cleanup();
    } finally { vi.useRealTimers(); }
  });
  it("keeps delayed saves dirty, deduplicates concurrent saves, then acknowledges server status", async () => {
    const h=harness(), d=deferred(); h.edit("a", "new"); h.request.mockReturnValue(d.promise);
    const first=h.save("a"); expect(h.save("a")).toBe(first);
    expect(h.chaptersRef.current[0]).toMatchObject({ _saving: true, _dirty: true });
    const event={ preventDefault: vi.fn() }; h.unload(event); expect(event.preventDefault).toHaveBeenCalled();
    d.resolve(result("a")); await first;
    expect(h.request).toHaveBeenCalledTimes(1);
    expect(h.chaptersRef.current[0]).toMatchObject({ status: "draft", _saving: false, _dirty: false });
    const cleanEvent={ preventDefault: vi.fn() }; h.unload(cleanEvent); expect(cleanEvent.preventDefault).not.toHaveBeenCalled();
  });
  it("does not acknowledge edits made during a save or another chapter's edits", async () => {
    const h=harness(), d=deferred(); h.edit("a", "sent"); h.request.mockReturnValueOnce(d.promise);
    const first=h.save("a"); h.edit("a", "newer"); h.edit("b", "other chapter");
    d.resolve(result("a")); await first;
    expect(h.chaptersRef.current.map(c=>c._dirty)).toEqual([true,true]);
    expect(h.chaptersRef.current[0].content).toBe("newer");
    h.request.mockResolvedValueOnce(result("a")); await h.save("a");
    expect(h.request.mock.calls[1][1].content).toBe("newer");
    expect(h.chaptersRef.current.map(c=>c._dirty)).toEqual([false,true]);
  });
  it("preserves text and leaving warning after failure, permits retry", async () => {
    const h=harness(); h.edit("a", "keep me"); h.request.mockRejectedValueOnce(new Error("offline"));
    expect(await h.save("a")).toBe(false);
    expect(h.chaptersRef.current[0]).toMatchObject({ _dirty: true, _saving: false, _saveError: true });
    expect(h.chaptersRef.current[0].content).toBe("keep me");
    const event={ preventDefault: vi.fn() }; h.unload(event); expect(event.preventDefault).toHaveBeenCalled();
    h.request.mockResolvedValueOnce(result("a")); expect(await h.save("a")).toBe(true);
  });
  it("does not report malformed successful responses as saved", async () => {
    const h=harness(); h.edit("a", "keep me"); h.request.mockResolvedValue({});
    expect(await h.save("a")).toBe(false); expect(h.chaptersRef.current[0]._dirty).toBe(true);
  });
  it.each(["pending_review", "rejected"])("updates %s and review note without discarding edits", status => {
    const h=harness(); h.edit("a", "local");
    h.dispatch({ type: "UPDATE_STATUS", id: "a", status, reviewNote: "server note" });
    expect(h.chaptersRef.current[0]).toMatchObject({ status, reviewNote: "server note", _dirty: true });
    expect(h.chaptersRef.current[0].content).toBe("local");
  });
  it.each(["pending_review", "rejected", "published"])("handles the actual publishing response: %s", async status => {
    const h = harness();
    h.dispatch({ type: "UPDATE_STATUS", id: "a", status: "draft" });
    h.edit("a", "submitted"); h.request.mockResolvedValue(result("a"));
    const payload = { item: { _id: "a", status, reviewNote: "server note" } };
    if (status === "rejected") h.patch.mockRejectedValue({ status: 422, data: payload });
    else h.patch.mockResolvedValue(payload);
    await h.publish();
    expect(h.chaptersRef.current[0]).toMatchObject({ status, reviewNote: "server note", _dirty: false });
    expect(h.announce).toHaveBeenCalledTimes(status === "published" ? 1 : 0);
    expect(h.pending).toHaveBeenCalledTimes(status === "pending_review" ? 1 : 0);
  });
  it("does not publish after save failure or typing during the prerequisite save", async () => {
    for (const failed of [true, false]) {
      const h = harness(), d = deferred();
      h.dispatch({ type: "UPDATE_STATUS", id: "a", status: "draft" });
      h.edit("a", "submitted"); h.request.mockReturnValue(d.promise);
      const publishing = h.publish();
      if (failed) d.reject(new Error("offline"));
      else { h.edit("a", "newer"); d.resolve(result("a")); }
      await publishing;
      expect(h.patch).not.toHaveBeenCalled();
      expect(h.chaptersRef.current[0]._dirty).toBe(true);
    }
  });
  it("keeps edits during moderation dirty and prevents a competing PUT", async () => {
    const h = harness(), d = deferred();
    h.dispatch({ type: "UPDATE_STATUS", id: "a", status: "draft" });
    h.patch.mockReturnValue(d.promise);
    const publishing = h.publish();
    await Promise.resolve();
    h.edit("a", "typed during moderation");
    expect(await h.save("a")).toBe(false);
    expect(h.request).not.toHaveBeenCalled();
    d.resolve({ item: { _id: "a", status: "published" } }); await publishing;
    expect(h.chaptersRef.current[0]._dirty).toBe(true);
    h.request.mockResolvedValue(result("a")); await h.save("a");
    expect(h.chaptersRef.current[0]).toMatchObject({ status: "draft", _dirty: false });
  });
});

describe("API response contract", () => {
  it("requires matching chapter/revision and a real server timestamp", () => {
    expect(isChapterSaveReceipt(result("a"), "a", 0)).toBe(true);
    expect(isChapterSaveReceipt(result("a"), "b", 0)).toBe(false);
    expect(isChapterSaveReceipt(result("a"), "a", 4)).toBe(false);
    expect(isChapterSaveReceipt({ ...result("a"), savedAt: "invalid" }, "a", 0)).toBe(false);
    expect(isChapterSaveReceipt({ ...result("a"), revision: 2 }, "a", 1)).toBe(false);
  });
  it("returns 202 and preserves 422 response payload on the error", async () => {
    vi.stubGlobal("localStorage", { getItem: () => null });
    const payload={ item: { _id: "a", status: "pending_review", reviewNote: "review" }, pending: true };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...payload, item: { ...payload.item, status: "rejected" } }), { status: 422 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "failed" }), { status: 500 })));
    try {
      expect(await apiPatch("/chapters/a/status", {})).toEqual(payload);
      await expect(apiPatch("/chapters/a/status", {})).rejects.toMatchObject({ status: 422, data: { item: { status: "rejected", reviewNote: "review" } } });
      await expect(apiPut("/chapters/a", {})).rejects.toMatchObject({ status: 500 });
    } finally { vi.unstubAllGlobals(); }
  });
});
