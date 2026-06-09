// components/plotworld/CharacterArcPanel.jsx

import { useMemo, useState, useCallback } from "react";
import { STATUS_META, CHAR_PALETTE }      from "./constants";
import { apiPost, describeAiError }        from "../../lib/api";
import "./Characterarc.css";

/* ─── Duygusal ısı renkleri ─── */
const HEAT_COLORS = {
  catisma:  { bg: "#fdf2f8", text: "#9d174d", label: "Çatışma"   },
  kayip:    { bg: "#fef2f2", text: "#991b1b", label: "Kayıp"      },
  kazanim:  { bg: "#f0fdf4", text: "#166534", label: "Kazanım"    },
  kacis:    { bg: "#eff6ff", text: "#1e40af", label: "Kaçış"      },
  yuzlesme: { bg: "#fff7ed", text: "#9a3412", label: "Yüzleşme"   },
  donum:    { bg: "#f5f3ff", text: "#5b21b6", label: "Dönüm"      },
  kesfet:   { bg: "#ecfeff", text: "#0e7490", label: "Keşif"      },
  neutral:  { bg: "#f8fafc", text: "#475569", label: "Nötr"       },
};

function HeatBadge({ type }) {
  const h = HEAT_COLORS[type] || HEAT_COLORS.neutral;
  return (
    <span
      className="arc-heat-badge"
      style={{ background: h.bg, color: h.text }}
      title={h.label}
    >
      {h.label}
    </span>
  );
}

function ArcSceneCard({ scene, charColor, isBreakpoint, heatType, onClick }) {
  const status = STATUS_META[scene.status] || STATUS_META.idea;
  return (
    <div className={`arc-scene-wrap${isBreakpoint ? " arc-scene-wrap--breakpoint" : ""}`}>
      <button
        className={`arc-scene-card${isBreakpoint ? " arc-scene-card--breakpoint" : ""}`}
        onClick={onClick}
        aria-label={`${scene.label} sahnesine git`}
        style={isBreakpoint ? { borderColor: charColor, boxShadow: `0 0 0 2px ${charColor}33` } : {}}
      >
        {isBreakpoint && (
          <div
            className="arc-breakpoint-marker"
            style={{ background: charColor }}
            aria-label="Kırılma noktası"
          >
            ✦
          </div>
        )}
        <div className="arc-scene-dot" style={{ background: charColor }} aria-hidden="true" />
        <div className="arc-scene-body">
          <div className="arc-scene-title">{scene.label}</div>
          <div className="arc-scene-meta">
            <span className="arc-scene-status-dot" style={{ background: status.color }} aria-hidden="true" />
            <span className="arc-scene-status-label">{status.label}</span>
            {heatType && <HeatBadge type={heatType} />}
          </div>
          {scene.goal && (
            <div className="arc-scene-goal">◎ {scene.goal}</div>
          )}
        </div>
      </button>
    </div>
  );
}

function EmptyActSlot({ actLabel, charColor }) {
  return (
    <div
      className="arc-act-empty-slot"
      style={{ borderColor: charColor + "30" }}
      aria-label={`${actLabel} perdesinde sahne yok`}
    >
      <span className="arc-act-empty-icon" aria-hidden="true">·</span>
      <span className="arc-act-empty-text">Bu perdede sahne yok</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ANA BİLEŞEN
══════════════════════════════════════════════════════════ */
export default function CharacterArcPanel({
  characters,
  nodes,
  actOrder,
  actMeta,
  workId,
  onSceneClick,
}) {
  const [activeCharId, setActiveCharId] = useState(
    characters.length > 0 ? String(characters[0]._id) : null
  );

  const [arcAnalysis, setArcAnalysis] = useState({});
  const [loadingArc,  setLoadingArc]  = useState(null);
  const [arcError,    setArcError]    = useState({});

  /* ── Her karakter için ark verisi ── */
  const arcs = useMemo(() => {
    return characters.map((char, ci) => {
      const charId = String(char._id);
     // YENİ — her iki tarafı da String'e zorla
      const scenes = nodes
      .filter(n => (n.data.charIds || []).map(String).includes(String(charId)))
        .map(n => ({
          id:     n.id,
          label:  n.data.label,
          act:    n.data.act,
          status: n.data.status,
          desc:   n.data.desc  || "",
          goal:   n.data.goal  || "",
          posX:   n.position?.x || 0,
        }))
        .sort((a, b) => {
          const ai = actOrder.indexOf(a.act);
          const bi = actOrder.indexOf(b.act);
          const an = ai === -1 ? 9999 : ai;
          const bn = bi === -1 ? 9999 : bi;
          return an !== bn ? an - bn : a.posX - b.posX;
        });

      return {
        char,
        charId,
        color:  char.color || CHAR_PALETTE[ci % CHAR_PALETTE.length],
        scenes,
      };
    });
  }, [characters, nodes, actOrder]);

  const activeArc = arcs.find(a => a.charId === activeCharId);

  /* ── AI Analiz ── */
  const runArcAnalysis = useCallback(async (arc) => {
    if (loadingArc) return;
    setLoadingArc(arc.charId);
    setArcError(prev => ({ ...prev, [arc.charId]: null }));

    try {
      const res = await apiPost("/ai/plotworld/arc-analysis", {
        character: {
          name:  arc.char.name,
          role:  arc.char.role  || "",
          notes: arc.char.notes || "",
        },
        scenes: arc.scenes.map(s => ({
          id:          s.id,
          title:       s.label,
          act:         s.act,
          goal:        s.goal,
          description: s.desc,
          status:      s.status,
        })),
        actOrder,
        allActLabels: Object.fromEntries(
          actOrder.map(id => [id, actMeta[id]?.label || id])
        ),
      }, { timeoutMs: 25000 });

      setArcAnalysis(prev => ({
        ...prev,
        [arc.charId]: {
          breakpoints:     res.breakpoints     || [],
          missingQuestion: res.missingQuestion || "",
          heatMap:         res.heatMap         || {},
          arcSummary:      res.arcSummary      || "",
          woundQuestion:   res.woundQuestion   || "",
        },
      }));
    } catch (e) {
      setArcError(prev => ({
        ...prev,
        [arc.charId]: describeAiError(e),
      }));
    } finally {
      setLoadingArc(null);
    }
  }, [loadingArc, actOrder, actMeta]);

  /* ── Boş durum ── */
  if (characters.length === 0) {
    return (
      <div className="arc-empty" role="status">
        <div className="arc-empty-icon" aria-hidden="true">👤</div>
        <div className="arc-empty-title">Henüz karakter yok</div>
        <div className="arc-empty-sub">Karakterler sayfasından ekleyebilirsin.</div>
      </div>
    );
  }

  const analysis  = activeArc ? arcAnalysis[activeArc.charId]  : null;
  const isLoading = activeArc ? loadingArc === activeArc.charId : false;
  const arcErr    = activeArc ? arcError[activeArc.charId]      : null;

  return (
    <div className="arc-root">

      {/* ── Karakter seçici ── */}
      <div className="arc-char-bar" role="tablist" aria-label="Karakter seçici">
        {arcs.map(({ char, charId, color, scenes }) => (
          <button
            key={charId}
            role="tab"
            aria-selected={activeCharId === charId}
            className={`arc-char-btn${activeCharId === charId ? " arc-char-btn--active" : ""}`}
            style={activeCharId === charId ? { borderColor: color, color } : {}}
            onClick={() => setActiveCharId(charId)}
          >
            <span className="arc-char-dot" style={{ background: color }} aria-hidden="true" />
            <span className="arc-char-name">{char.name}</span>
            <span className="arc-char-cnt">{scenes.length}</span>
          </button>
        ))}
      </div>

      {/* ── Aktif karakter paneli ── */}
      {activeArc && (
        <div className="arc-body" role="tabpanel">

          {/* Karakter başlık */}
          <div className="arc-header">
            <div className="arc-header-left">
              <span
                className="arc-header-avatar"
                style={{
                  background:  activeArc.color + "22",
                  color:       activeArc.color,
                  borderColor: activeArc.color + "44",
                }}
                aria-hidden="true"
              >
                {activeArc.char.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <div className="arc-header-name">{activeArc.char.name}</div>
                <div className="arc-header-sub">
                  {activeArc.char.role || "—"} · {activeArc.scenes.length} sahne
                </div>
              </div>
            </div>

            {/* Perde dağılımı */}
            <div className="arc-act-stats" aria-label="Perde dağılımı">
              {actOrder.map(actId => {
                const cnt  = activeArc.scenes.filter(s => s.act === actId).length;
                const meta = actMeta[actId] || {};
                return (
                  <div key={actId} className="arc-act-stat">
                    <span
                      className="arc-act-stat-dot"
                      style={{ background: meta.color }}
                      aria-hidden="true"
                    />
                    <span className="arc-act-stat-n">{cnt}</span>
                    <span className="arc-act-stat-label">{meta.roman}.</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── AI Analiz Kartı ── */}
          <div className="arc-ai-card">

            {!analysis && !isLoading && !arcErr && (
              <div className="arc-ai-idle">
                <div className="arc-ai-idle-left">
                  <div className="arc-ai-idle-title">
                    <span className="arc-ai-icon" aria-hidden="true">✦</span>
                    Karakter Yolculuğu Analizi
                  </div>
                  <div className="arc-ai-idle-desc">
                    {activeArc.char.name} hangi sahnede kırılıyor?
                    Neyi hâlâ yaşamadı? Dramatik eksiği nerede?
                  </div>
                </div>
                {activeArc.scenes.length < 2 ? (
                  <div className="arc-ai-warn">En az 2 sahne gerekli.</div>
                ) : (
                  <button
                    className="arc-ai-run-btn"
                    onClick={() => runArcAnalysis(activeArc)}
                  >
                    ✦ Analiz Et
                  </button>
                )}
              </div>
            )}

            {isLoading && (
              <div className="arc-ai-loading" aria-live="polite">
                <div className="arc-ai-spinner" aria-hidden="true" />
                <div className="arc-ai-loading-text">
                  <span>{activeArc.char.name}'in yolculuğu okunuyor…</span>
                  <span>Kırılma noktaları aranıyor…</span>
                  <span>Dramatik eksikler tespit ediliyor…</span>
                </div>
              </div>
            )}

            {arcErr && (
              <div className="arc-ai-error" role="alert">
                <span>{arcErr.message}</span>
                {arcErr.retryable && (
                  <button onClick={() => runArcAnalysis(activeArc)}>Tekrar Dene</button>
                )}
              </div>
            )}

            {analysis && !isLoading && (
              <div className="arc-ai-result">
                {analysis.arcSummary && (
                  <div className="arc-ai-summary">
                    <span className="arc-ai-summary-icon" aria-hidden="true">◎</span>
                    <p>{analysis.arcSummary}</p>
                  </div>
                )}

                {analysis.woundQuestion && (
                  <div className="arc-ai-wound">
                    <span className="arc-ai-wound-label" aria-hidden="true">✦</span>
                    <blockquote className="arc-ai-wound-text">
                      "{analysis.woundQuestion}"
                    </blockquote>
                  </div>
                )}

                {analysis.missingQuestion && (
                  <div className="arc-ai-missing">
                    <span className="arc-ai-missing-icon" aria-hidden="true">⬡</span>
                    <div>
                      <div className="arc-ai-missing-label">Bu karakter henüz yaşamadı:</div>
                      <div className="arc-ai-missing-text">{analysis.missingQuestion}</div>
                    </div>
                  </div>
                )}

                <button
                  className="arc-ai-rerun"
                  onClick={() => runArcAnalysis(activeArc)}
                  disabled={isLoading}
                >
                  ↺ Yeniden Analiz Et
                </button>
              </div>
            )}
          </div>

          {/* ── Timeline ── */}
          {activeArc.scenes.length === 0 ? (
            <div className="arc-no-scenes" role="status">
              {activeArc.char.name} henüz hiçbir sahneye eklenmemiş.
            </div>
          ) : (
            <div className="arc-timeline">
              <div className="arc-acts">
                {actOrder.map(actId => {
                  const meta        = actMeta[actId] || {};
                  const actScenes   = activeArc.scenes.filter(s => s.act === actId);
                  const heatMap     = analysis?.heatMap     || {};
                  const breakpoints = analysis?.breakpoints || [];

                  return (
                    <div key={actId} className="arc-act-col">
                      <div
                        className="arc-act-header"
                        style={{ borderBottomColor: meta.color + "60" }}
                      >
                        <span
                          className="arc-act-header-dot"
                          style={{ background: meta.color }}
                          aria-hidden="true"
                        />
                        <span
                          className="arc-act-header-label"
                          style={{ color: meta.color }}
                        >
                          {meta.roman ? `${meta.roman}. Perde` : ""} {meta.label}
                        </span>
                        <span className="arc-act-header-cnt">{actScenes.length}</span>
                      </div>

                      <div className="arc-act-scenes">
                        {actScenes.length === 0 ? (
                          <EmptyActSlot
                            actLabel={meta.label}
                            charColor={activeArc.color}
                          />
                        ) : (
                          actScenes.map(scene => (
                            <ArcSceneCard
                              key={scene.id}
                              scene={scene}
                              charColor={activeArc.color}
                              isBreakpoint={breakpoints.includes(scene.id)}
                              heatType={heatMap[scene.id] || null}
                              onClick={() => onSceneClick?.(scene.id)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Durum ilerleme barı ── */}
          {activeArc.scenes.length > 0 && (
            <div className="arc-status-bar-wrap">
              <div className="arc-status-bar-label">Yazım İlerlemesi</div>
              <div className="arc-status-bar" role="progressbar">
                {Object.entries(STATUS_META).map(([key, meta]) => {
                  const cnt = activeArc.scenes.filter(s => s.status === key).length;
                  const pct = (cnt / activeArc.scenes.length) * 100;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={key}
                      className="arc-status-segment"
                      style={{ width: `${pct}%`, background: meta.color }}
                      title={`${meta.label}: ${cnt}`}
                    />
                  );
                })}
              </div>
              <div className="arc-status-legend">
                {Object.entries(STATUS_META).map(([key, meta]) => {
                  const cnt = activeArc.scenes.filter(s => s.status === key).length;
                  if (!cnt) return null;
                  return (
                    <div key={key} className="arc-status-legend-item">
                      <span
                        className="arc-status-legend-dot"
                        style={{ background: meta.color }}
                        aria-hidden="true"
                      />
                      {meta.label} ({cnt})
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}