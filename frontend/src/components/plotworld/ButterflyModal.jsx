// components/plotworld/ButterflyModal.jsx
// Kelebek Etkisi — seçili sahne için AI alternatif dal analizi

import { useState } from "react";
import { apiPost, describeAiError } from "../../lib/api";

/**
 * Props:
 *  node        — seçili ReactFlow node (data.raw, data.label, data.act, etc.)
 *  edges       — tüm kenarlar (bağlı sahneleri bulmak için)
 *  nodes       — tüm node'lar
 *  actMeta     — { [actId]: { label, color } }
 *  onClose     — () => void
 */
export default function ButterflyModal({ node, edges, nodes, actMeta, onClose }) {
  const [branches, setBranches] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const scene = node?.data;

  /* Bağlı sahneleri hesapla (kaynak veya hedef olarak) */
  function getConnectedScenes() {
    if (!edges || !nodes) return [];
    const connectedIds = new Set([
      ...edges.filter(e => e.source === node.id).map(e => e.target),
      ...edges.filter(e => e.target === node.id).map(e => e.source),
    ]);
    return nodes
      .filter(n => connectedIds.has(n.id))
      .map(n => ({ title: n.data.label, act: n.data.act }));
  }

  async function analyze() {
    setLoading(true);
    setError(null);
    setBranches(null);
    try {
      const res = await apiPost("/ai/plotworld/butterfly", {
        scene: {
          title:       scene.label,
          description: scene.desc        || "",
          goal:        scene.goal        || "",
          act:         scene.act         || "",
          status:      scene.status      || "",
        },
        connectedScenes: getConnectedScenes(),
        allActLabels: Object.fromEntries(
          Object.entries(actMeta).map(([k, v]) => [k, v.label])
        ),
      }, { timeoutMs: 25000 });
      setBranches(res.branches || []);
    } catch (e) {
      setError(describeAiError(e));
    } finally {
      setLoading(false);
    }
  }

  const actColor = actMeta[scene?.act]?.color || "#888";
  const actLabel = actMeta[scene?.act]?.label || scene?.act || "";

  return (
    <div className="wm-overlay" onClick={onClose}>
      <div
        className="wm-modal butterfly-modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        {/* Header */}
        <div className="wm-header">
          <div className="wm-header-left">
            <span className="butterfly-icon">🦋</span>
            <span className="wm-title">Kelebek Etkisi</span>
            <span className="butterfly-scene-tag" style={{ borderColor: actColor, color: actColor }}>
              {actLabel}
            </span>
          </div>
          <button className="wm-close" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="wm-body">
          <p className="butterfly-premise">
            <strong>{scene?.label}</strong> sahnesi farklı sonuçlansaydı hikâye nereye giderdi?
          </p>

          {/* Boş durum — analiz yapılmamış */}
          {!branches && !loading && !error && (
            <div className="butterfly-idle">
              <div className="butterfly-idle-text">
                AI bu sahnenin bağlı olduğu sahneleri okuyarak 3 alternatif dal önerecek.
              </div>
              <button className="butterfly-analyze-btn" onClick={analyze}>
                ✦ Analiz Et
              </button>
            </div>
          )}

          {/* Yükleniyor */}
          {loading && (
            <div className="butterfly-loading">
              <div className="butterfly-spinner" />
              <span>Alternatif dallar hesaplanıyor…</span>
            </div>
          )}

          {/* Hata */}
          {error && (
            <div className="butterfly-error">
              <span>{error.message}</span>
              {error.retryable && <button onClick={analyze}>Tekrar Dene</button>}
            </div>
          )}

          {/* Sonuçlar */}
          {branches && branches.length > 0 && (
            <div className="butterfly-branches">
              {branches.map((b, i) => (
                <div key={i} className="butterfly-branch">
                  <div className="butterfly-branch-header">
                    <span className="butterfly-branch-num">{["Ⅰ", "Ⅱ", "Ⅲ"][i]}</span>
                    <span className="butterfly-branch-title">{b.title}</span>
                  </div>
                  <div className="butterfly-branch-body">
                    <p className="butterfly-branch-consequence">{b.consequence}</p>
                    <div className="butterfly-branch-shift">
                      <span className="butterfly-shift-label">Duygusal ton →</span>
                      {b.emotionalShift}
                    </div>
                  </div>
                </div>
              ))}
              <button
                className="butterfly-reanalyze"
                onClick={analyze}
                disabled={loading}
              >
                ↺ Yeniden Analiz Et
              </button>
            </div>
          )}

          {branches && branches.length === 0 && (
            <div className="butterfly-empty">
              Bu sahne için dal üretilemedi. Sahne hedefi ve özeti ekleyerek tekrar dene.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wm-footer">
          <button className="wm-btn wm-btn--ghost" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}