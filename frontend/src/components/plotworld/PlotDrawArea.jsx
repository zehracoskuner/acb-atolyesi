// components/plotworld/PlotDrawArea.jsx
import { useEffect, useRef, useCallback } from "react";
import { Tldraw, useEditor } from "tldraw";
import "tldraw/tldraw.css";
import { apiGet, apiPatch } from "../../lib/api";
import { CharacterShapeUtil } from "./CharacterShape";
import { CHAR_PALETTE } from "./constants";

const SAVE_DEBOUNCE_MS = 5000;
const MAX_SNAPSHOT_KB  = 15360;
const CUSTOM_SHAPE_UTILS = [CharacterShapeUtil];

function DrawingController({ workId }) {
  const editor   = useEditor();
  const timerRef = useRef(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!editor) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await apiGet(`/drawing/${workId}`);
        if (cancelled || !res?.snapshotUrl) return;

        // Basit retry — CDN invalidate gecikebilir
        let snapshot = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const jsonRes = await fetch(res.snapshotUrl + `?t=${Date.now()}`);
            if (!jsonRes.ok) throw new Error("fetch failed");
            snapshot = await jsonRes.json();
            break;
          } catch {
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
          }
        }

        if (!cancelled && snapshot) editor.loadSnapshot(snapshot);
      } catch (err) {
        console.warn("Çizim yüklenemedi:", err.message);
      } finally {
        if (!cancelled) readyRef.current = true;
      }
    }

    load();
    return () => { cancelled = true; };
  }, [editor, workId]);

  useEffect(() => {
    if (!editor) return;

    const unsub = editor.store.listen(
      () => {
        if (!readyRef.current) return;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
          try {
            const snapshot    = editor.getSnapshot();
            const snapshotStr = JSON.stringify(snapshot);
            const sizeKB      = new Blob([snapshotStr]).size / 1024;
            if (sizeKB > MAX_SNAPSHOT_KB) {
              console.warn(`Snapshot çok büyük: ${Math.round(sizeKB)}KB`);
              return;
            }
            await apiPatch(`/drawing/${workId}`, { snapshot });
          } catch (err) {
            console.warn("Çizim kaydedilemedi:", err.message);
          }
        }, SAVE_DEBOUNCE_MS);
      },
      { source: "user", scope: "document" }
    );

    return () => {
      unsub();
      clearTimeout(timerRef.current);
    };
  }, [editor, workId]);

  return null;
}

export default function PlotDrawArea({ workId, characters = [] }) {
  const containerRef = useRef(null);
  const editorRef    = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const editor = editorRef.current;
    if (!editor) return;

    try {
      const raw = e.dataTransfer.getData("application/character");
      if (!raw) return; // Tldraw'un kendi sürüklemeleri — sessizce çık
      const data = JSON.parse(raw);
      if (!data?.charId) return;

      const rect  = containerRef.current.getBoundingClientRect();
      const point = editor.screenToPage({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });

      editor.createShape({
        type: "character",
        x:    point.x - 40,
        y:    point.y - 48,
        props: {
          name:   data.name,
          color:  data.color,
          role:   data.role   || "",
          charId: data.charId || "",
          w:      80,
          h:      96,
        },
      });
    } catch (err) {
      console.warn("Drop hatası:", err.message);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // Native event listener — Tldraw'un capture phase'ini bypass etmez
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("drop",     handleDrop,     false);
    el.addEventListener("dragover", handleDragOver, false);
    return () => {
      el.removeEventListener("drop",     handleDrop);
      el.removeEventListener("dragover", handleDragOver);
    };
  }, [handleDrop, handleDragOver]);

  return (
    <div
      ref={containerRef}
      className="pw-draw-container"
      // onDropCapture / onDragOverCapture kaldırıldı
    >
      <Tldraw
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}
        shapeUtils={CUSTOM_SHAPE_UTILS}
        // inferDarkMode kaldırıldı — light theme zorunlu
        forceDarkMode={false}
        onMount={editor => { editorRef.current = editor; }}
      >
        <DrawingController workId={workId} />
      </Tldraw>

      {characters.length > 0 && (
        <div className="pw-draw-hint">
          Sol paneldeki karakterleri buraya sürükle
        </div>
      )}
    </div>
  );
}