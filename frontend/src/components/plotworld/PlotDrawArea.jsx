// components/plotworld/PlotDrawArea.jsx
import { useEffect, useRef, useCallback } from "react";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import DrawingController from "./DrawingController";
import { CharacterShapeUtil } from "./CharacterShape";
import { CHAR_PALETTE } from "./constants";

const CUSTOM_SHAPE_UTILS = [CharacterShapeUtil];

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
        onMount={editor => { editor.updateInstanceState({ isReadonly: true }); }}
      >
        <DrawingController workId={workId} editorRef={editorRef} />
      </Tldraw>

      {characters.length > 0 && (
        <div className="pw-draw-hint">
          Sol paneldeki karakterleri buraya sürükle
        </div>
      )}
    </div>
  );
}