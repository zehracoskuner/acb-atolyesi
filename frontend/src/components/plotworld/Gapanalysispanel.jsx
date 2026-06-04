// components/plotworld/GapAnalysisPanel.jsx
import { useState } from "react";
import { apiPost }  from "../../lib/api";

const GAP_TYPE_LABELS = {
  missing_act:    { icon: "⬜", label: "Eksik Perde",            color: "#dc2626" },
  causality:      { icon: "⛓",  label: "Nedensellik Kopukluğu", color: "#d97706" },
  tempo:          { icon: "⏱",  label: "Tempo Sorunu",          color: "#7c3aed" },
  isolated_scene: { icon: "◎",  label: "İzole Sahne",           color: "#0891b2" },
  unclear_goal:   { icon: "?",  label: "Belirsiz Amaç",         color: "#6b7280" },
};

export default function GapAnalysisPanel({
  nodes,
  actOrder,
  actMeta,
  characters,
  workId,
  onAddScene,
  onClose,
}) {
  const [tab,        setTab]        = useState("gap");
  const [gapResult,  setGapResult]  = useState(null);
  const [suggestions,setSuggestions]= useState({});
  const [loadingGap, setLoadingGap] = useState(false);
  const [loadingSug, setLoadingSug] = useState(null);
  const [errorGap,   setErrorGap]   = useState(null);
  const [errorSug,   setErrorSug]   = useState({});

  /* ── Gap Analizi ── */
  async function runGapAnalysis() {
    setLoadingGap(true);
    setErrorGap(null);
    setGapResult(null);
    try {
      const scenes = nodes.map(n => ({
        id:          n.id,
        title:       n.data.label,
        act:         n.data.act,
        goal:        n.data.goal  || "",
        description: n.data.desc  || "",
      }));
      const res = await apiPost("/ai/plotworld/gap-analysis", {
        scenes,
        actOrder,
        allActLabels: Object.fromEntries(
          Object.entries(actMeta).map(([k, v]) => [k, v.label])
        ),
      });
      setGapResult(res);
    } catch {
      setErrorGap("Analiz yapılamadı. Tekrar dene.");
    } finally {
      setLoadingGap(false);
    }
  }

  /* ── Sahne Önerisi ── */
  async function runSceneSuggest(actId) {
    setLoadingSug(actId);
    setErrorSug(prev => ({ ...prev, [actId]: null }));
    try {
      const existingScenes = nodes
        .filter(n => n.data.act === actId)
        .map(n => ({ title: n.data.label, goal: n.data.goal || "" }));

      const res = await apiPost("/ai/plotworld/scene-suggest", {
        actId,
        actLabel:    actMeta[actId]?.label || actId,
        existingScenes,
        characters:  characters.map(c => ({ name: c.name, role: c.role || "" })),
      });
      setSuggestions(prev => ({ ...prev, [actId]: res.suggestions || [] }));
    } catch {
      setErrorSug(prev => ({ ...prev, [actId]: "Öneri alınamadı." }));
    } finally {
      setLoadingSug(null);
    }
  }

  return (
    <div className="gap-panel">
      {/* Header */}
      <div className="gap-panel-header">
        <div className="gap-panel-title">
          <span className="gap-panel-icon">◈</span>
          AI Plot Analizi
        </div>
        <button className="gap-panel-close" onClick={onClose}>×</button>
      </div>

      {/* Tab bar */}
      <div className="gap-tabs">
        <button
          className={`gap-tab ${tab === "gap" ? "gap-tab--active" : ""}`}
          onClick={() => setTab("gap")}
        >
          Boşluk Tespiti
        </button>
        <button
          className={`gap-tab ${tab === "suggest" ? "gap-tab--active" : ""}`}
          onClick={() => setTab("suggest")}
        >
          Sahne Önerisi
        </button>
      </div>

      {/* ── GAP TAB ── */}
      {tab === "gap" && (
        <div className="gap-body">
          {!gapResult && !loadingGap && (
            <div className="gap-idle">
              <p className="gap-idle-text">
                {nodes.length} sahne + {actOrder.length} perde okunacak.
                Nedensellik kopukluğu, eksik perde ve tempo sorunları işaretlenecek.
              </p>
              {nodes.length < 2 ? (
                <div className="gap-warn">Analiz için en az 2 sahne gerekli.</div>
              ) : (
                <button className="gap-run-btn" onClick={runGapAnalysis}>
                  ✦ Analizi Başlat
                </button>
              )}
            </div>
          )}

          {loadingGap && (
            <div className="gap-loading">
              <div className="gap-spinner" />
              <span>Plot okunuyor, boşluklar tespit ediliyor…</span>
            </div>
          )}

          {errorGap && (
            <div className="gap-error">
              {errorGap}
              <button onClick={runGapAnalysis}>Tekrar Dene</button>
            </div>
          )}

          {gapResult && (
            <div className="gap-result">
              <div className="gap-summary">{gapResult.summary}</div>

              {gapResult.gaps?.length === 0 ? (
                <div className="gap-all-good">
                  ✓ Belirgin bir yapısal sorun bulunamadı.
                </div>
              ) : (
                <div className="gap-list">
                  {(gapResult.gaps || []).map((g, i) => {
                    const meta     = GAP_TYPE_LABELS[g.type] || { icon: "•", label: g.type, color: "#888" };
                    const actColor = g.actId ? (actMeta[g.actId]?.color || "#888") : null;
                    return (
                      <div key={i} className="gap-item" style={{ borderLeftColor: meta.color }}>
                        <div className="gap-item-header">
                          <span className="gap-item-icon">{meta.icon}</span>
                          <span className="gap-item-type" style={{ color: meta.color }}>
                            {meta.label}
                          </span>
                          {g.actId && actColor && (
                            <span
                              className="gap-item-act"
                              style={{ background: actColor + "22", color: actColor }}
                            >
                              {actMeta[g.actId]?.label || g.actId}
                            </span>
                          )}
                        </div>
                        <p className="gap-item-msg">{g.message}</p>
                        <div className="gap-item-suggestion">
                          <span className="gap-sug-icon">→</span>
                          {g.suggestion}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                className="gap-rerun"
                onClick={runGapAnalysis}
                disabled={loadingGap}
              >
                ↺ Yeniden Analiz Et
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── SUGGEST TAB ── */}
      {tab === "suggest" && (
        <div className="gap-body">
          {actOrder.map(actId => {
            const meta    = actMeta[actId] || {};
            const count   = nodes.filter(n => n.data.act === actId).length;
            const sugs    = suggestions[actId];
            const loading = loadingSug === actId;
            const err     = errorSug[actId];

            return (
              <div key={actId} className="sug-act-block">
                <div className="sug-act-header">
                  <span className="sug-act-dot" style={{ background: meta.color }} />
                  <span className="sug-act-label">{meta.label}</span>
                  <span className="sug-act-count">{count} sahne</span>
                  <button
                    className="sug-act-btn"
                    onClick={() => runSceneSuggest(actId)}
                    disabled={loading}
                  >
                    {loading ? "…" : "Öneri Al"}
                  </button>
                </div>

                {err && <div className="sug-error">{err}</div>}

                {sugs && sugs.length > 0 && (
                  <div className="sug-list">
                    {sugs.map((s, i) => (
                      <div key={i} className="sug-item">
                        <div className="sug-item-title">{s.title}</div>
                        {s.goal && (
                          <div className="sug-item-goal">{s.goal}</div>
                        )}
                        {s.dramaticFunction && (
                          <div className="sug-item-function">◎ {s.dramaticFunction}</div>
                        )}
                        {s.hint && (
                          <div className="sug-item-hint">💡 {s.hint}</div>
                        )}
                        <button
                          className="sug-add-btn"
                          onClick={() => onAddScene(actId, s)}
                        >
                          + Bu Sahneyi Ekle
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {sugs && sugs.length === 0 && (
                  <div className="sug-empty">Öneri üretilemedi.</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}