import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet, apiPatch, apiPost, describeAiError } from "../lib/api";
import VoiceInputButton from "../components/VoiceInputButton";
import {
  BADGE_STYLES, STATUS_META, CHAR_PALETTE,
  buildActMeta, buildActOrder,
  STRUCTURE_TEMPLATES, DEFAULT_TEMPLATE,
} from "../components/plotworld/constants";
import "../styles/SceneDetailPage.css";

const SAVE_DEBOUNCE_MS = 1200;

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function charCount(text) {
  return text.length;
}

/* ══════════════════════════════════════════════════════════
   AI PANEL
══════════════════════════════════════════════════════════ */
function AiPanel({ scene, allScenes, characters, onClose }) {
  const [mode,    setMode]    = useState(null);
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  function enrichedChars() {
    return (scene?.characters || []).map(c => {
      if (typeof c === "object" && c.name) {
        const full = characters.find(ch => String(ch._id) === String(c._id));
        return full
          ? { name: full.name, role: full.role || "", notes: full.notes || "" }
          : { name: c.name, role: c.role || "", notes: "" };
      }
      const found = characters.find(ch => String(ch._id) === String(c));
      return found ? { name: found.name, role: found.role || "", notes: found.notes || "" } : null;
    }).filter(Boolean);
  }

  async function call(endpoint, body, m) {
    setMode(m);
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await apiPost(endpoint, body, { timeoutMs: 25000 });
      setResult({ mode: m, ...data });
    } catch (e) {
      setError(describeAiError(e, { fallback: "AI şu an yanıt veremiyor. Tekrar dene." }));
    } finally {
      setLoading(false);
    }
  }

  function sceneCoach() {
    call("/ai/plotworld/scene-coach", {
      scene: {
        title:       scene.title,
        act:         scene.act         || "",
        goal:        scene.goal        || "",
        description: scene.description || "",
        draftText:   scene.draftText   || "",
      },
      allScenes: (allScenes || [])
        .filter(s => String(s._id) !== String(scene._id))
        .map(s => ({ title: s.title, act: s.act, goal: s.goal || "" })),
      characters: enrichedChars(),
      actLabel: scene.act || "",
    }, "coach");
  }

  function butterfly() {
    call("/ai/plotworld/scene-butterfly", {
      title:       scene.title,
      description: scene.description || "",
      goal:        scene.goal        || "",
      act:         scene.act         || "",
      draftText:   scene.draftText   || "",
      characters:  enrichedChars().map(c => c.name),
    }, "butterfly");
  }

  function strengthen() {
    call("/ai/plotworld/scene-strengthen", {
      title:       scene.title,
      description: scene.description || "",
      goal:        scene.goal        || "",
      draftText:   scene.draftText   || "",
    }, "strengthen");
  }

  function retry() {
    if (mode === "coach")          sceneCoach();
    else if (mode === "butterfly") butterfly();
    else if (mode === "strengthen") strengthen();
  }

  function renderResult() {
    if (!result) return null;

    if (result.mode === "coach") {
      const rows = [
        { label: "Hikâyedeki Rolü",         icon: "◎", key: "role"       },
        { label: "Gerilim & Duygu",          icon: "⚡", key: "tension"    },
        { label: "Karakter Dinamiği",        icon: "◈", key: "characters" },
        { label: "Sonrasında Ne Beklenmeli", icon: "→", key: "after"      },
        { label: "Güçlendirme Önerisi",      icon: "✦", key: "strengthen" },
      ];
      return (
        <div className="sd-ai-coach">
          {rows.map(r => result[r.key] ? (
            <div key={r.key} className="sd-ai-coach-row">
              <div className="sd-ai-coach-label">
                <span className="sd-ai-coach-icon">{r.icon}</span>
                {r.label}
              </div>
              <p className="sd-ai-coach-text">{result[r.key]}</p>
            </div>
          ) : null)}
        </div>
      );
    }

    if (result.mode === "butterfly") {
      const branches = result.branches || [];
      if (!branches.length) return <p className="sd-ai-empty">Dal üretilemedi. Sahneye açıklama ekle.</p>;
      return (
        <div className="sd-ai-branches">
          {branches.map((b, i) => (
            <div key={i} className="sd-ai-branch">
              <div className="sd-ai-branch-header">
                <span className="sd-ai-branch-num">{["Ⅰ","Ⅱ","Ⅲ"][i]}</span>
                <span className="sd-ai-branch-title">{b.title}</span>
              </div>
              <p className="sd-ai-branch-consequence">{b.consequence}</p>
              <div className="sd-ai-branch-shift">
                <span className="sd-ai-shift-label">Ton →</span>
                {b.emotionalShift}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (result.mode === "strengthen") {
      const tips = result.tips || [];
      if (!tips.length) return <p className="sd-ai-empty">Öneri üretilemedi.</p>;
      return (
        <div className="sd-ai-tips">
          {tips.map((t, i) => (
            <div key={i} className="sd-ai-tip">
              <div className="sd-ai-tip-aspect">{t.aspect}</div>
              <p className="sd-ai-tip-text">{t.suggestion}</p>
            </div>
          ))}
        </div>
      );
    }

    return null;
  }

  return (
    <div className="sd-ai-panel">
      <div className="sd-ai-header">
        <span className="sd-ai-icon">✦</span>
        <span className="sd-ai-title">AI Koçu</span>
        <button className="sd-ai-close" onClick={onClose}>×</button>
      </div>
      <div className="sd-ai-btns">
        <button
          className={`sd-ai-btn sd-ai-btn--primary ${mode === "coach" ? "sd-ai-btn--active" : ""}`}
          onClick={sceneCoach}
          disabled={loading}
        >
          ✦ Sahne Koçu
        </button>
        <button
          className={`sd-ai-btn ${mode === "butterfly" ? "sd-ai-btn--active" : ""}`}
          onClick={butterfly}
          disabled={loading}
        >
          🦋 Kelebek Etkisi
        </button>
        <button
          className={`sd-ai-btn ${mode === "strengthen" ? "sd-ai-btn--active" : ""}`}
          onClick={strengthen}
          disabled={loading}
        >
          ⚡ Güçlendir
        </button>
      </div>

      {loading && (
        <div className="sd-ai-result">
          <div className="sd-ai-loading"><span /><span /><span /></div>
        </div>
      )}
      {error && (
        <div className="sd-ai-result">
          <div className="sd-ai-error">
            {error.message}
            {error.retryable && <button onClick={retry}>Tekrar Dene</button>}
          </div>
        </div>
      )}
      {!loading && !error && result && (
        <div className="sd-ai-result">{renderResult()}</div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   BAĞLI SAHNELER
══════════════════════════════════════════════════════════ */
function ConnectedScenes({ scene, allScenes, actMeta, onNavigate }) {
  const targetId = c => (c && typeof c === "object" ? c.target : c);
  const incoming = allScenes.filter(s =>
    (s.connections || []).some(c => String(targetId(c)) === String(scene._id))
  );
  const outgoing = allScenes.filter(s =>
    (scene.connections || []).some(c => String(targetId(c)) === String(s._id))
  );
  if (!incoming.length && !outgoing.length) return (
    <p className="sd-empty-sub">Henüz bağlantı yok.</p>
  );

  return (
    <div className="sd-connections">
      {incoming.length > 0 && (
        <>
          <div className="sd-conn-label">← Gelen</div>
          {incoming.map(s => (
            <button key={s._id} className="sd-conn-item" onClick={() => onNavigate(s._id)}>
              <span className="sd-conn-dot" style={{ background: actMeta[s.act]?.color || "#888" }} />
              {s.title}
            </button>
          ))}
        </>
      )}
      {outgoing.length > 0 && (
        <>
          <div className="sd-conn-label">→ Giden</div>
          {outgoing.map(s => (
            <button key={s._id} className="sd-conn-item" onClick={() => onNavigate(s._id)}>
              <span className="sd-conn-dot" style={{ background: actMeta[s.act]?.color || "#888" }} />
              {s.title}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ANA SAYFA
══════════════════════════════════════════════════════════ */
export default function SceneDetailPage() {
  const { workId, sceneId } = useParams();
  const navigate = useNavigate();

  const [scene,      setScene]      = useState(null);
  const [allScenes,  setAllScenes]  = useState([]);
  const [characters, setCharacters] = useState([]);
  const [worldData,  setWorldData]  = useState(null);
  const [actMeta,    setActMeta]    = useState({});
  const [actOrder,   setActOrder]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  const [draftText, setDraftText] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const timerRef = useRef(null);
  const draftRef = useRef("");
  const dirtyRef = useRef(false);

  const [showAI,     setShowAI]     = useState(false);
  const [rightPanel, setRightPanel] = useState("chars");

  /* ── Veri yükle ── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [plotRes, charRes, worldRes] = await Promise.all([
          apiGet(`/plots/${workId}`),
          apiGet(`/characters?workId=${workId}`),
          apiGet(`/world/${workId}`),
        ]);
        if (cancelled) return;

        // Yapı çözümleme
        const savedStructure = worldRes?.world?.structure;
        const acts = savedStructure?.acts?.length
          ? savedStructure.acts
          : STRUCTURE_TEMPLATES[DEFAULT_TEMPLATE].acts;

        const currentActMeta  = buildActMeta(acts);
        const currentActOrder = buildActOrder(acts);
        setActMeta(currentActMeta);
        setActOrder(currentActOrder);

        // Sahneleri düzleştir
        let flat = [];
        if (plotRes.plot?.scenes?.length > 0) {
          flat = plotRes.plot.scenes.map(s => ({ ...s }));
        } else {
          const allActs = plotRes.plot?.acts || {};
          flat = currentActOrder.flatMap(act =>
            (allActs[act] || []).map(s => ({ ...s, act }))
          );
        }

        const found = flat.find(s => String(s._id) === sceneId);
        if (!found) { setError("Sahne bulunamadı."); return; }

        setScene(found);
        setDraftText(found.draftText || "");
        setAllScenes(flat);
        setCharacters(charRes.items || []);
        setWorldData(worldRes.world);
      } catch {
        if (!cancelled) setError("Veri yüklenemedi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [workId, sceneId]);

  /* ── Otomatik kayıt ── */
  const saveDraft = useCallback(async (text) => {
    setSaveState("saving");
    try {
      await apiPatch(`/plots/${workId}/scenes/${sceneId}`, { draftText: text });
      setSaveState("saved");
      dirtyRef.current = false;
    } catch {
      setSaveState("unsaved");
    }
  }, [workId, sceneId]);

  function applyDraftText(text) {
    setDraftText(text);
    setSaveState("unsaved");
    draftRef.current = text;
    dirtyRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveDraft(text), SAVE_DEBOUNCE_MS);
  }

  function handleDraftChange(e) {
    applyDraftText(e.target.value);
  }
  /* Bekleyen taslağı kaybetme — sahne değişimi / sekme kapanışı */
  useEffect(() => {
    const flush = () => { if (dirtyRef.current) saveDraft(draftRef.current); };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      clearTimeout(timerRef.current);
      flush();
    };
  }, [saveDraft]);

  async function updateMeta(patch) {
    try {
      const res = await apiPatch(`/plots/${workId}/scenes/${sceneId}`, patch);
      setScene(prev => ({ ...prev, ...res.scene }));
    } catch {
      // sessiz fail
    }
  }

  const sceneCharIds = (scene?.characters || []).map(c =>
    typeof c === "object" ? String(c._id) : String(c)
  );
  const sceneChars = characters.filter(c => sceneCharIds.includes(String(c._id)));

  /* ── Loading / Error ── */
  if (loading) return (
    <div className="sd-loading">
      <div className="sd-loading-ring"><div /><div /><div /><div /></div>
      <span>Sahne yükleniyor…</span>
    </div>
  );

  if (error) return (
    <div className="sd-error">
      <div className="sd-error-icon">⚠</div>
      <div>{error}</div>
      <button onClick={() => navigate(`/work/${workId}/plot`)}>← Geri dön</button>
    </div>
  );

  const rawActLabel  = scene.act
    ? scene.act.charAt(0).toUpperCase() + scene.act.slice(1)
    : "Perde";
  const sceneActMeta = actMeta[scene.act] || { label: rawActLabel, color: "#6d28d9", roman: "" };
  const sceneTitle   = scene.title
    ? scene.title.charAt(0).toUpperCase() + scene.title.slice(1)
    : "";
  const badge  = BADGE_STYLES[scene.badge] || BADGE_STYLES.act1;
  const words  = wordCount(draftText);
  const chars  = charCount(draftText);

  return (
    <div className="sd-root">

      {/* ─── ÜST BAR ─── */}
      <div className="sd-topbar">
        <button className="sd-back" onClick={() => navigate(`/work/${workId}/plot`)}>
          ← Plot Board
        </button>
        <div className="sd-breadcrumb">
          <span style={{ color: sceneActMeta?.color }}>{sceneActMeta?.label} Perdesi</span>
          <span className="sd-bc-sep">›</span>
          <span>{sceneTitle}</span>
        </div>
        <div className={`sd-save-state sd-save-state--${saveState}`}>
          {saveState === "saving"  && <><span className="sd-save-spin" /> Kaydediliyor…</>}
          {saveState === "saved"   && <>✓ Kaydedildi</>}
          {saveState === "unsaved" && <>● Kaydedilmedi</>}
        </div>
        <button
          className={`sd-ai-toggle ${showAI ? "sd-ai-toggle--on" : ""}`}
          onClick={() => setShowAI(v => !v)}
        >
          ✦ AI
        </button>
      </div>

      <div className="sd-body">

        {/* ─── SOL META ─── */}
        <aside className="sd-left">
          <div className="sd-left-title">
            <div className="sd-left-accent" style={{ background: sceneActMeta?.color }} />
            <div>
              <span className="sd-badge" style={{ background: badge.bg, color: badge.text }}>
                {badge.label}
              </span>
              <div className="sd-scene-name">{sceneTitle}</div>
              <div className="sd-scene-act" style={{ color: sceneActMeta?.color }}>
                {sceneActMeta?.label} Perdesi
              </div>
            </div>
          </div>

          <div className="sd-divider" />

          <div className="sd-meta-section">
            <div className="sd-meta-label">Yazım Durumu</div>
            <div className="sd-status-btns">
              {Object.entries(STATUS_META).map(([k, v]) => (
                <button
                  key={k}
                  className={`sd-status-btn ${scene.status === k ? "sd-status-btn--on" : ""}`}
                  style={scene.status === k ? { borderColor: v.color, color: v.color } : {}}
                  onClick={() => updateMeta({ status: k })}
                >
                  <span className="sd-status-dot" style={{ background: v.color }} />
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {scene.time && (
            <div className="sd-meta-section">
              <div className="sd-meta-label">Zaman / Konum</div>
              <div className="sd-meta-value">{scene.time}</div>
            </div>
          )}

          {scene.goal && (
            <div className="sd-meta-section">
              <div className="sd-meta-label">Sahnenin Amacı</div>
              <div className="sd-meta-value sd-meta-goal">
                <span className="sd-goal-icon">◎</span>
                {scene.goal}
              </div>
            </div>
          )}

          {scene.description && (
            <div className="sd-meta-section">
              <div className="sd-meta-label">Özet</div>
              <div className="sd-meta-value sd-meta-desc">{scene.description}</div>
            </div>
          )}

          <div className="sd-divider" />

          {sceneChars.length > 0 && (
            <div className="sd-meta-section">
              <div className="sd-meta-label">Sahnedeki Karakterler</div>
              <div className="sd-char-chips">
                {sceneChars.map((c, i) => (
                  <div key={c._id} className="sd-char-chip">
                    <span
                      className="sd-char-dot"
                      style={{ background: c.color || CHAR_PALETTE[i % CHAR_PALETTE.length] }}
                    />
                    {c.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="sd-divider" />

          <div className="sd-meta-section">
            <div className="sd-meta-label">Bağlı Sahneler</div>
            <ConnectedScenes
              scene={scene}
              allScenes={allScenes}
              actMeta={actMeta}
              onNavigate={id => navigate(`/work/${workId}/scene/${id}`)}
            />
          </div>

          <button
            className="sd-plotboard-btn"
            onClick={() => navigate(`/work/${workId}/plot`)}
          >
            🗺 Plot Board'da Gör
          </button>
        </aside>

        {/* ─── ORTA: YAZI ALANI ─── */}
        <main className="sd-editor">
          <div className="sd-editor-title-row">
            <div className="sd-editor-title">{sceneTitle}</div>
            <VoiceInputButton
              onResult={(t) => applyDraftText(draftText ? `${draftText} ${t}` : t)}
            />
          </div>
          <textarea
            className="sd-textarea"
            placeholder={
              `"${scene.title}" sahnesi için taslak yaz…\n\n` +
              `Bu sahne nerede geçiyor? Karakterler ne yapıyor?\n` +
              `Diyaloglar, duygular, gerilim — aklına geleni dök.`
            }
            value={draftText}
            onChange={handleDraftChange}
            spellCheck={false}
          />
          <div className="sd-editor-footer">
            <span>{words.toLocaleString("tr")} kelime</span>
            <span className="sd-footer-sep">·</span>
            <span>{chars.toLocaleString("tr")} karakter</span>
            {scene.chapter && (
              <>
                <span className="sd-footer-sep">·</span>
                <span>Bölüm bağlı</span>
              </>
            )}
            {chars > 600 && (
              <>
                <span className="sd-footer-sep">·</span>
                <span>AI analizleri taslağın yalnızca ilk ~600-900 karakterini okur</span>
              </>
            )}
          </div>
        </main>

        {/* ─── SAĞ PANEL ─── */}
        <aside className={`sd-right ${showAI ? "sd-right--ai" : ""}`}>
          {showAI ? (
            <AiPanel
              key={scene._id}
              scene={{ ...scene, draftText }}
              allScenes={allScenes}
              characters={characters}
              onClose={() => setShowAI(false)}
            />
          ) : (
            <>
              <div className="sd-right-tabs">
                <button
                  className={`sd-right-tab ${rightPanel === "chars" ? "sd-right-tab--active" : ""}`}
                  onClick={() => setRightPanel("chars")}
                >
                  Karakterler
                </button>
                <button
                  className={`sd-right-tab ${rightPanel === "world" ? "sd-right-tab--active" : ""}`}
                  onClick={() => setRightPanel("world")}
                >
                  Dünya
                </button>
              </div>

              {rightPanel === "chars" && (
                <div className="sd-right-body">
                  {sceneChars.length === 0 ? (
                    <p className="sd-empty-sub">Bu sahnede karakter yok.</p>
                  ) : (
                    sceneChars.map((c, i) => (
                      <div key={c._id} className="sd-char-note-card">
                        <div className="sd-char-note-header">
                          <span
                            className="sd-char-note-dot"
                            style={{ background: c.color || CHAR_PALETTE[i % CHAR_PALETTE.length] }}
                          />
                          <span className="sd-char-note-name">{c.name}</span>
                          <span className="sd-char-note-role">{c.role || "—"}</span>
                        </div>
                        {c.notes ? (
                          <div className="sd-char-note-text">{c.notes}</div>
                        ) : (
                          <div className="sd-char-note-empty">Not eklenmemiş.</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {rightPanel === "world" && (
                <div className="sd-right-body">
                  {["locations", "rules", "notes"].map(cat => {
                    const items = worldData?.[cat] || [];
                    if (!items.length) return null;
                    const labels = { locations: "Mekanlar", rules: "Kurallar", notes: "Notlar" };
                    return (
                      <div key={cat} className="sd-world-section">
                        <div className="sd-world-cat">{labels[cat]}</div>
                        {items.slice(0, 4).map(item => (
                          <div key={item._id} className="sd-world-item">
                            <div className="sd-world-name">{item.name}</div>
                            {item.description && (
                              <div className="sd-world-desc">
                                {item.description.slice(0, 80)}
                                {item.description.length > 80 ? "…" : ""}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {!worldData?.locations?.length && !worldData?.rules?.length && !worldData?.notes?.length && (
                    <p className="sd-empty-sub">Henüz dünya notu yok.</p>
                  )}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}