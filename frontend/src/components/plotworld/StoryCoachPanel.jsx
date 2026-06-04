// components/plotworld/StoryCoachPanel.jsx
// PlotWorld — Hikâye Koçu Paneli
// "AI Analiz" butonuyla açılır, tüm bağlamı gönderir

import { useState }  from "react";
import { apiPost, apiGet }   from "../../lib/api";

const SECTIONS = [
  { key: "momentum",  label: "Dramatik İvme",       icon: "▲" },
  { key: "arcs",      label: "Karakter Yayları",     icon: "◎" },
  { key: "rhythm",    label: "Tempo & Ritim",        icon: "≈" },
  { key: "direction", label: "Hikâye Nereye Gidiyor", icon: "→" },
  { key: "next",      label: "Sıradaki Adımın",      icon: "✦" },
  { key: "watchOut",  label: "Dikkat Et",            icon: "⚠" },
];

/**
 * Props:
 *  nodes       — ReactFlow node'ları
 *  actOrder    — string[]
 *  actMeta     — { [actId]: { label, color } }
 *  characters  — [{ _id, name, role, notes }]
 *  workId      — string
 *  onClose     — () => void
 */
export default function StoryCoachPanel({
  nodes,
  actOrder,
  actMeta,
  characters,
  workId,
  onClose,
}) {
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [open,    setOpen]    = useState(null); // açık seksiyon

  async function runCoach() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Dünya notlarını da çek
      let world = {};
      try {
        const worldRes = await apiGet(`/world/${workId}`);
        world = worldRes?.world || {};
      } catch { /* dünya yoksa devam */ }

      const scenes = nodes.map(n => ({
        title:       n.data.label,
        act:         n.data.act,
        goal:        n.data.goal        || "",
        description: n.data.desc        || "",
        status:      n.data.status      || "idea",
      }));

      const res = await apiPost("/ai/plotworld/story-coach", {
        scenes,
        characters: characters.map(c => ({
          name:  c.name,
          role:  c.role  || "",
          notes: c.notes || "",
        })),
        world,
        actOrder,
        allActLabels: Object.fromEntries(
          Object.entries(actMeta).map(([k, v]) => [k, v.label])
        ),
      });

      setResult(res);
      setOpen("momentum"); // ilk seksiyon açık gelsin
    } catch {
      setError("Analiz yapılamadı. Tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="coach-panel">

      {/* Header */}
      <div className="coach-header">
        <div className="coach-title">
          <span className="coach-icon">✦</span>
          Hikâye Koçu
        </div>
        <button className="coach-close" onClick={onClose}>×</button>
      </div>

      {/* Body */}
      <div className="coach-body">

        {/* Boş durum */}
        {!result && !loading && !error && (
          <div className="coach-idle">
            <div className="coach-idle-desc">
              Tüm sahneler, karakterler ve dünya notları okunarak
              hikâyenin dramatik ivmesi, karakter yayları, temposu
              ve nereye gittiği analiz edilecek.
            </div>
            <div className="coach-idle-stats">
              <span>{nodes.length} sahne</span>
              <span className="coach-sep">·</span>
              <span>{characters.length} karakter</span>
              <span className="coach-sep">·</span>
              <span>{actOrder.length} perde</span>
            </div>
            {nodes.length < 2 ? (
              <div className="coach-warn">Analiz için en az 2 sahne gerekli.</div>
            ) : (
              <button className="coach-run-btn" onClick={runCoach}>
                ✦ Koç Analizini Başlat
              </button>
            )}
          </div>
        )}

        {/* Yükleniyor */}
        {loading && (
          <div className="coach-loading">
            <div className="coach-spinner" />
            <div className="coach-loading-lines">
              <span>Sahneler okunuyor…</span>
              <span>Karakterler değerlendiriliyor…</span>
              <span>Dramatik ivme hesaplanıyor…</span>
            </div>
          </div>
        )}

        {/* Hata */}
        {error && (
          <div className="coach-error">
            {error}
            <button onClick={runCoach}>Tekrar Dene</button>
          </div>
        )}

        {/* Sonuçlar — accordion */}
        {result && (
          <div className="coach-result">
            {SECTIONS.map(s => {
              const text    = result[s.key];
              const isOpen  = open === s.key;
              const isEmpty = !text;
              if (isEmpty) return null;

              // watchOut özel stili
              const isWarn = s.key === "watchOut";
              const isNext = s.key === "next";

              return (
                <div
                  key={s.key}
                  className={`coach-section ${isWarn ? "coach-section--warn" : ""} ${isNext ? "coach-section--next" : ""}`}
                >
                  <button
                    className="coach-section-header"
                    onClick={() => setOpen(isOpen ? null : s.key)}
                  >
                    <span className="coach-section-icon">{s.icon}</span>
                    <span className="coach-section-label">{s.label}</span>
                    <span className="coach-section-chevron">{isOpen ? "▴" : "▾"}</span>
                  </button>
                  {isOpen && (
                    <div className="coach-section-body">
                      {text}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              className="coach-rerun"
              onClick={runCoach}
              disabled={loading}
            >
              ↺ Yeniden Analiz Et
            </button>
          </div>
        )}
      </div>
    </div>
  );
}