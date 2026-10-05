import { useEffect, useRef, useState } from "react";
import { useEditor, getSnapshot, loadSnapshot } from "tldraw";
import { apiGet, apiPatch } from "../../lib/api";
import { DrawingSaver, drawingError, readDrawingDraft, waitForDrawing, discardDrawingDraft } from "../../lib/drawingPersistence";

export default function DrawingController({ workId, editorRef }) {
  const editor = useEditor();
  const saverRef = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [view, setView] = useState({ loading: true, status: "Kaydedilmedi" });
  const [recovery, setRecovery] = useState(null);
  useEffect(() => {
    let cancelled = false, unsubscribe, saver;
    setView({ loading: true, status: "Kaydedilmedi" }); setRecovery(null);
    editorRef.current = null;
    editor.updateInstanceState({ isReadonly: true });
    async function load() {
      try {
        await waitForDrawing(workId);
        const metadata = await apiGet(`/drawing/${workId}`, { timeoutMs: 30000 });
        if (!metadata.userId || !Number.isSafeInteger(metadata.revision) || metadata.revision < 0 || !(metadata.snapshotUrl === null || typeof metadata.snapshotUrl === "string")) throw new Error("Sunucudan geçerli çizim bilgisi alınamadı. Tekrar deneyin.");
        let snapshot = null;
        if (metadata.snapshotUrl) {
          const response = await fetch(metadata.snapshotUrl, { cache: "no-store", signal: AbortSignal.timeout(30000) });
          if (!response.ok) throw new Error("Çizim dosyası yüklenemedi. Tekrar deneyin.");
          snapshot = await response.json();
          // Existing larger drawings remain readable; the limit applies to new saves.
          if (!(snapshot?.document?.store || snapshot?.store)) throw new Error("Çizim dosyası geçersiz.");
        }
        if (cancelled) return;
        if (snapshot) loadSnapshot(editor.store, snapshot);
        let draft = null, localError = "";
        try { draft = readDrawingDraft(localStorage, metadata.userId, workId, metadata); }
        catch { localError = "Yerel taslak okunamadı. Tarayıcı depolamasını kontrol edin."; }
        saver = new DrawingSaver({ userId: metadata.userId, workId, revision: metadata.revision,
          storage: localStorage, request: (path, body) => apiPatch(path, body, { timeoutMs: 45000 }),
          notify: state => { if (!cancelled) setView(v => ({ ...v, ...state })); },
        });
        saverRef.current = saver;
        setView({ loading: false, status: snapshot && !draft ? "Kaydedildi" : "Kaydedilmedi", serverStatus: snapshot ? "Kaydedildi" : "Kaydedilmedi", localError });
        if (draft) setRecovery(draft);
        else { editor.updateInstanceState({ isReadonly: false }); editorRef.current = editor; }
        unsubscribe = editor.store.listen(() => saver.edit(getSnapshot(editor.store)), { source: "user", scope: "document" });
      } catch (error) {
        if (!cancelled) setView({ loading: false, loadError: true, status: "Kaydedilemedi", error: drawingError(error) });
      }
    }
    load();
    // Store listeners are frame-batched in 4.5.10; drain them before leaving,
    // so a stroke made just before navigation reaches the synchronous draft write.
    const capture = () => { editor.store._flushHistory(); };
    const flush = () => { capture(); saver?.save(); };
    const leave = event => {
      capture();
      if (saver && saver.version !== saver.savedVersion) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", leave);
    document.addEventListener("visibilitychange", flush);
    return () => {
      capture(); unsubscribe?.(); cancelled = true; editorRef.current = null; saverRef.current = null;
      if (saver) { saver.notify = () => {}; saver.save(); }
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", leave);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [editor, workId, attempt, editorRef]);
  const recover = () => {
    try {
      loadSnapshot(editor.store, recovery.snapshot);
      saverRef.current.key = recovery.key;
      saverRef.current.edit(getSnapshot(editor.store));
      setRecovery(null); editor.updateInstanceState({ isReadonly: false }); editorRef.current = editor;
    } catch { setView(v => ({ ...v, error: "Yerel taslak yüklenemedi. Sunucu kaydı değiştirilmedi." })); }
  };
  return <div className="drawing-save-panel">
    <span role="status" aria-live="polite">{view.loading ? "Çizim yükleniyor…" : view.status}</span>{" "}
    <button className="acb-action" disabled={view.loading || view.loadError || !!recovery} onClick={() => { editor.store._flushHistory(); saverRef.current?.save(); }}>Kaydet</button>
    {(view.loadError || view.status === "Kaydedilemedi") && <button className="acb-action" onClick={() => view.loadError ? setAttempt(a => a + 1) : saverRef.current?.save()}>Tekrar dene</button>}
    {view.error && <div role="alert">{view.error}</div>}
    {view.localError && <div role="alert">{view.localError}</div>}
    {recovery && <div>Bu cihazda sunucuya kaydedilmemiş bir taslak var. {recovery.revision !== saverRef.current?.revision && "Sunucu sürümü de değişmiş; taslağı kullanmak sunucu çiziminin yerini alır."}
      <button className="acb-action" onClick={recover}>Yerel taslağı kullan</button>
      <button className="acb-action" onClick={() => {
        try { discardDrawingDraft(localStorage, recovery.key); } catch { /* retain recovery */ }
        setView(v => ({ ...v, status: v.serverStatus }));
        setRecovery(null); editor.updateInstanceState({ isReadonly: false }); editorRef.current = editor;
      }}>Sunucu çizimini kullan</button>
    </div>}
  </div>;
}
