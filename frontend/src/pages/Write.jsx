// src/pages/Write.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import WorksSidebar from "../components/WorkSidebar";
import "../styles/ui.css";
import "../styles/AppEditor.css";
import { TABS, TONES, STYLES } from "../constants/constants";
import { useAICoach } from "../hooks/useAICoach";
import { apiGet, apiPost, apiPut } from "../lib/api";
import { isLoggedIn } from "../lib/auth";
import {
  CONSTRAINT_CATEGORIES,
  ALL_CONSTRAINTS,
  constraintForSkill,
} from "../data/writingConstraints";
import { getSkillScores, getTrajectory, skillLabel } from "../lib/pusula";
import {
  analyzeWords,
  analyzePhrases,
  setPref,
  getPref,
} from "../lib/kelimeCantasi";

const DRAFT_KEY = "acb_write_draft_v1";

const ILHAM_NOTES = [
  "Sadece Başla: 300 kelime kötü yazmak, hiç yazmamaktan iyidir.",
  "Göster, Anlatma: 'Mutlu' deme — mutluluğun nasıl göründüğünü betimle.",
  "Başlık En Sona Kalır: Baskısını at, şimdilik [Taslak] yaz ve devam et.",
];

const REVIEW_FOCUS_OPTIONS = [
  { id: "genel", label: "Genel" },
  { id: "karakter", label: "Karakter" },
  { id: "diyalog", label: "Diyalog" },
  { id: "altmetin", label: "Alt Metin" },
  { id: "duygu", label: "Duygu" },
  { id: "ritim", label: "Ritim" },
  { id: "betimleme", label: "Betimleme" },
  { id: "atmosfer", label: "Atmosfer" },
  { id: "bakis", label: "Bakış" },
  { id: "kurgu", label: "Sahne" },
  { id: "etki", label: "Okur Etkisi" },
  { id: "tekrar", label: "Tekrar" },
];

const BUBBLE_TONE = {
  low: "#fef3c7",
  medium: "#e9d5ff",
  high: "#fecaca",
};

const STORAGE_KEYS = {
  works: "acb-works",
  selectedWorkId: "acb-selected-work-id",
};

function safeId(item) {
  return item?.id || item?._id || null;
}

export default function Write() {
  const navigate = useNavigate();

  const {
    title,
    setTitle,
    text,
    setText,
    msg,
    tab,
    setTab,
    loadingAI,
    tone,
    setTone,
    style,
    setStyle,
    review,
    handleReview,
    reviewFocus,
    setReviewFocus,
    liveAlert,
    coachNotes,
    setCoachNotes,
    coachEnabled,
    setCoachEnabled,
    setEditorFocus,
  } = useAICoach();

  const editorRef = useRef(null);
  const editorCardRef = useRef(null);
  const autoSaveTimer = useRef(null);

  const [routine, setRoutine] = useState({
    goalWords: 150,
    durationMin: 10,
    running: false,
    secondsLeft: 10 * 60,
    startedAtWordCount: 0,
    mode: "sprint",
  });

  useEffect(() => {
    if (!routine.running) return;

    const t = setInterval(() => {
      setRoutine((prev) => {
        const next = Math.max(0, prev.secondsLeft - 1);
        if (next === 0) return { ...prev, secondsLeft: 0, running: false };
        return { ...prev, secondsLeft: next };
      });
    }, 1000);

    return () => clearInterval(t);
  }, [routine.running]);

  const formatMMSS = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const wordCount = useMemo(() => {
    const t = (text || "").trim();
    return t ? t.split(/\s+/).filter(Boolean).length : 0;
  }, [text]);

  const startRoutine = (mode = "sprint") => {
    const durationMin = mode === "warmup" ? 2 : mode === "edit" ? 5 : 10;
    const goalWords = mode === "warmup" ? 60 : mode === "edit" ? 0 : 150;

    setRoutine((prev) => ({
      ...prev,
      mode,
      durationMin,
      goalWords,
      running: true,
      secondsLeft: durationMin * 60,
      startedAtWordCount: wordCount,
    }));

    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const pauseRoutine = () => setRoutine((prev) => ({ ...prev, running: false }));

  const resetRoutine = () =>
    setRoutine((prev) => ({
      ...prev,
      running: false,
      secondsLeft: prev.durationMin * 60,
      startedAtWordCount: wordCount,
    }));

  const routineWordsDone = Math.max(0, wordCount - routine.startedAtWordCount);
  const routineProgress =
    routine.goalWords > 0 ? Math.min(1, routineWordsDone / routine.goalWords) : 0;

  const [panelOpen, setPanelOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [noteId, setNoteId] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      return parsed.noteId || null;
    } catch {
      return null;
    }
  });

  const [works, setWorks] = useState([]);
  useEffect(() => {
    if (!isLoggedIn()) return;

    apiGet("/works")
      .then((d) => setWorks(d.items || []))
      .catch((err) => {
        console.error("Çalışmalar yüklenemedi:", err);
      });
  }, []);

  const [saveMessage, setSaveMessage] = useState("");

  const [selectedWorkId, setSelectedWorkId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.selectedWorkId) || null;
    } catch {
      return null;
    }
  });

  const selectedWork = useMemo(
    () => works.find((w) => safeId(w) === selectedWorkId) || null,
    [selectedWorkId, works]
  );

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);

      if (!selectedWorkId) {
        if (parsed.title !== undefined) setTitle(parsed.title);
        if (parsed.content !== undefined) setText(parsed.content);
      }
    } catch {
      // bozuksa umursama
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const payload = JSON.stringify({
      title,
      content: text,
      noteId,
    });
    localStorage.setItem(DRAFT_KEY, payload);
  }, [title, text, noteId]);

  useEffect(() => {
    try {
      if (selectedWorkId) {
        localStorage.setItem(STORAGE_KEYS.selectedWorkId, selectedWorkId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.selectedWorkId);
      }
    } catch {
      // ignore
    }
  }, [selectedWorkId]);

  useEffect(() => {
    if (!selectedWork) return;
    setTitle(selectedWork.title || "");
    setText(selectedWork.content || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkId]);

  useEffect(() => {
    if (!isLoggedIn()) return;
    apiGet("/notes")
      .then((d) => setNotes(d.items || []))
      .catch(() => {});
  }, []);

  const updateSelectedWork = useCallback(
    (patch) => {
      setWorks((prev) =>
        prev.map((w) => (safeId(w) === selectedWorkId ? { ...w, ...patch } : w))
      );
    },
    [selectedWorkId]
  );

  const onChangeTitle = (v) => {
    setTitle(v);
    if (selectedWorkId) updateSelectedWork({ title: v });
  };

  const onChangeText = (v) => {
    setText(v);
    if (selectedWorkId) updateSelectedWork({ content: v });
  };

  const handleOpenWork = (work) => {
    const id = safeId(work);
    if (!id) return;
    navigate(`/work/${id}/studio`, { state: { backTo: `/work/${id}/write` } });
  };

  async function createWork() {
    const newTitle = prompt("Yeni çalışma başlığı?");
    if (!newTitle) return;

    if (!isLoggedIn()) {
      navigate("/register");
      return;
    }

    try {
      const res = await apiPost("/works", {
        title: newTitle,
        description: "",
      });
      const newWork = res.item;
      setWorks((prev) => [newWork, ...prev]);
      setSelectedWorkId(safeId(newWork));
    } catch (err) {
      console.error("Yeni çalışma oluşturulamadı:", err);
    }
  }

  /* Antrenman: kategori + kısıt */
  const [selectedCategory, setSelectedCategory] = useState("karakter");
  const [pickedConstraint, setPickedConstraint] = useState(() => {
    const pool = ALL_CONSTRAINTS.filter((x) => x.category === "karakter");
    return pool[Math.floor(Math.random() * pool.length)] || ALL_CONSTRAINTS[0] || null;
  });
  const [activeTask, setActiveTask] = useState(null);

  const rollConstraint = (categoryId = selectedCategory) => {
    const pool = ALL_CONSTRAINTS.filter((x) => x.category === categoryId);
    const src = pool.length ? pool : ALL_CONSTRAINTS;
    setPickedConstraint(src[Math.floor(Math.random() * src.length)] || null);
  };

  const selectCategory = (categoryId) => {
    setSelectedCategory(categoryId);
    rollConstraint(categoryId);
  };

  const sendTaskToEditor = (withSprint = false) => {
    if (!pickedConstraint) return;
    setActiveTask(pickedConstraint);
    requestAnimationFrame(() => editorRef.current?.focus());
    if (withSprint) startRoutine("sprint");
  };

  /* Pusula */
  const [pusulaScores, setPusulaScores] = useState([]);
  const refreshPusula = useCallback(() => {
    setPusulaScores(getSkillScores());
  }, []);

  useEffect(() => {
    refreshPusula();
  }, [refreshPusula, review, coachNotes, tab]);

  useEffect(() => {
    if (tab !== TABS.KOC) return;
    const t = setInterval(refreshPusula, 1500);
    return () => clearInterval(t);
  }, [refreshPusula, tab]);

  const weakest = pusulaScores[0] || null;

  const practiceWeakSkill = () => {
    if (!weakest) return;
    const c = constraintForSkill(weakest.skill);
    if (!c) return;
    setSelectedCategory(c.category);
    setPickedConstraint(c);
  };

  /* Kelime Çantası */
  const [bagTick, setBagTick] = useState(0);
  const bagWords = useMemo(
    () => (tab === TABS.SOHBET ? analyzeWords(text) : []),
    [text, bagTick, tab]
  );
  const bagPhrases = useMemo(
    () => (tab === TABS.SOHBET ? analyzePhrases(text) : []),
    [text, bagTick, tab]
  );

  const tagTerm = (term, pref) => {
    const current = getPref(term);
    setPref(term, current === pref ? null : pref);
    setBagTick((t) => t + 1);
  };

  const saveNote = useCallback(async () => {
    setSaveMessage("");

    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, content: text, noteId }));

    if (!isLoggedIn()) {
      navigate("/register", { state: { fromDraft: true } });
      return;
    }

    if (!title.trim() && !text.trim()) {
      setSaveMessage("Boş not kaydetmiyorum 🙂");
      setTimeout(() => setSaveMessage(""), 2000);
      return;
    }

    try {
      const payload = {
        title: title || "Egzersiz notu",
        content: text,
        ...(selectedWorkId ? { workId: selectedWorkId } : {}),
      };

      if (!noteId) {
        const res = await apiPost("/notes", payload);
        const created = res.item;

        setNoteId(safeId(created));
        setNotes((prev) => [created, ...prev]);

        setSaveMessage("Notlarınıza kaydedildi ✅");
        setTimeout(() => setSaveMessage(""), 2500);
      } else {
        const res = await apiPut(`/notes/${noteId}`, payload);
        const updated = res.item;

        setNotes((prev) =>
          prev.map((n) => (safeId(n) === safeId(updated) ? updated : n))
        );

        setSaveMessage("Güncellendi ✅");
        setTimeout(() => setSaveMessage(""), 2000);
      }
    } catch (err) {
      console.error("Kaydet hatası:", err);
      setSaveMessage(err?.message || "Kaydedilirken bir hata oluştu.");
      setTimeout(() => setSaveMessage(""), 3000);
    }
  }, [title, text, noteId, navigate, selectedWorkId]);

  useEffect(() => {
    if (!isLoggedIn()) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(() => {
      if (!title.trim() && !text.trim()) return;
      saveNote();
    }, 1200);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [title, text, saveNote]);

  const goNotes = () => navigate("/notes");

  const TabButton = ({ id, active, onClick, children }) => (
    <button
      id={`tab-${id}`}
      role="tab"
      aria-selected={active}
      aria-controls={`panel-${id}`}
      className={`btn ${active ? "primary" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );

  return (
    <div className="container-page">
      <TopBar />

      <div className="topbartwo" style={{ borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="btn"
            onClick={() => setPanelOpen((p) => !p)}
            aria-label="Çalışmalarım panelini aç/kapat"
          >
            ☰
          </button>

          <strong>Atölyem</strong>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            className="input"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            style={{ width: 160, height: 40 }}
            aria-label="Ton seçimi"
          >
            {TONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            style={{ width: 210, height: 40 }}
            aria-label="AI davranışı"
          >
            {STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <button
            className={`btn ${coachEnabled ? "primary" : ""}`}
            onClick={() => setCoachEnabled((v) => !v)}
            title={coachEnabled ? "Koç modunu kapat" : "Koç modunu aç"}
          >
            {coachEnabled ? "🧠 Koç: Açık" : "🧠 Koç: Kapalı"}
          </button>
        </div>
      </div>

      <div className="editor-shell">
        <WorksSidebar
          isOpen={panelOpen}
          onClose={() => setPanelOpen(false)}
          works={works}
          selectedWork={selectedWork}
          notes={notes}
          onOpenWork={handleOpenWork}
          onCreateNew={createWork}
          onGoBack={() => setSelectedWorkId(null)}
          onOpenNotes={goNotes}
        />

        {panelOpen && (
          <div
            className="sidebar-overlay"
            onClick={() => setPanelOpen(false)}
            aria-hidden="true"
          />
        )}

        <main className="editor-canvas">
          <div className="grid-2">
            <div className="card pad editor-card" ref={editorCardRef} style={{ position: "relative" }}>
              <input
                className="input title-input"
                placeholder="Egzersiz başlığı (isteğe bağlı)"
                value={title}
                onChange={(e) => onChangeTitle(e.target.value)}
                style={{ margin: "12px 0" }}
                aria-label="Başlık"
              />

              {activeTask && (
                <div
                  className="pill"
                  style={{
                    display: "block",
                    margin: "0 0 12px",
                    padding: 12,
                    lineHeight: 1.45,
                    whiteSpace: "normal",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong>🏋️ {activeTask.title}</strong>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => setActiveTask(null)}
                      style={{ padding: "2px 8px" }}
                      title="Görevi kaldır"
                    >
                      ✕
                    </button>
                  </div>
                  <div style={{ marginTop: 6 }}>{activeTask.text}</div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Odak: {activeTask.focus}
                  </div>
                </div>
              )}

              <textarea
                ref={editorRef}
                className="textarea"
                placeholder="Bir beyaz kağıda her şey yazılabilir..."
                value={text}
                onChange={(e) => onChangeText(e.target.value)}
                aria-label="Metin"
                onFocus={() => setEditorFocus(true)}
                onBlur={() => setEditorFocus(false)}
              />

              <div className="actions" style={{ marginTop: 14 }}>
                <button className="btn primary" onClick={saveNote}>
                  💾 Kaydet
                </button>
                <button
                  className="btn"
                  onClick={() => handleReview(reviewFocus)}
                  disabled={loadingAI || wordCount < 50}
                  title={wordCount < 50 ? "AI yorum için en az 50 kelime yaz." : undefined}
                >
                  {loadingAI ? "…" : "AI Yorumla"}
                </button>
                <Link className="link" to="/landing">
                  Ana sayfaya dön
                </Link>
              </div>

              <div className="word-counter" aria-label="Kelime sayısı" style={{ marginTop: 8 }}>
                {wordCount} kelime
                {wordCount < 50 && (
                  <span className="muted" style={{ marginLeft: 10 }}>
                    AI yorum için en az 50 kelime
                  </span>
                )}
              </div>

              {saveMessage && (
                <div style={{ marginTop: 8, fontSize: 13, color: "#2f855a" }}>
                  {saveMessage}
                </div>
              )}

              {msg && <div className="pill" style={{ marginTop: 10 }}>{msg}</div>}

              {coachEnabled && liveAlert && (
                <div
                  className="live-bubble"
                  style={{
                    right: 18,
                    bottom: 70,
                    background: BUBBLE_TONE[liveAlert.severity] || BUBBLE_TONE.medium,
                  }}
                  role="status"
                  aria-live="polite"
                >
                  {liveAlert.message}
                </div>
              )}
            </div>

            <div className="card pad">
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 12,
                  background: "var(--panel2)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>🔥 Bugünün Rutini</div>
                    <div style={{ fontWeight: 800, marginTop: 2 }}>
                      {routine.mode === "warmup" ? "Isınma" : routine.mode === "edit" ? "Düzenleme" : "Sprint"} • {routine.durationMin} dk
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>{formatMMSS(routine.secondsLeft)}</div>
                    {routine.goalWords > 0 ? (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {routineWordsDone}/{routine.goalWords} kelime
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: 12 }}>
                        Düzenleme modu
                      </div>
                    )}
                  </div>
                </div>

                {routine.goalWords > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ height: 8, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                      <div style={{ width: `${routineProgress * 100}%`, height: "100%", background: "var(--accent)" }} />
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {!routine.running ? (
                    <>
                      <button className="btn primary" style={{ flex: 1 }} onClick={() => startRoutine("sprint")}>Başlat (10 dk)</button>
                      <button className="btn" onClick={() => startRoutine("warmup")}>Isınma</button>
                      <button className="btn" onClick={() => startRoutine("edit")}>Düzenle</button>
                    </>
                  ) : (
                    <>
                      <button className="btn" style={{ flex: 1 }} onClick={pauseRoutine}>Duraklat</button>
                      <button className="btn" onClick={resetRoutine}>Sıfırla</button>
                    </>
                  )}
                </div>

                <div className="muted" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.4 }}>
                  {routine.mode === "warmup" && "30 sn serbest giriş → 90 sn devam. Amaç: akışı aç."}
                  {routine.mode === "sprint" && "İç eleştirmeni sustur. Durdurma, düzeltme yok."}
                  {routine.mode === "edit" && "1 paragrafı sadeleştir: gereksiz 2 kelimeyi at, 1 güçlü fiil ekle."}
                </div>
              </div>

              <div role="tablist" aria-label="Yardımcı sekmeler" style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <TabButton id="ilham" active={tab === TABS.ILHAM} onClick={() => setTab(TABS.ILHAM)}>🏋️ Antrenman</TabButton>
                <TabButton id="yorum" active={tab === TABS.YORUM} onClick={() => setTab(TABS.YORUM)}>📋 Yorum</TabButton>
                <TabButton id="sohbet" active={tab === TABS.SOHBET} onClick={() => setTab(TABS.SOHBET)}>🎒 Kelime Çantası</TabButton>
                <TabButton id="koc" active={tab === TABS.KOC} onClick={() => setTab(TABS.KOC)}>🧭 Pusula</TabButton>
              </div>

              {tab === TABS.ILHAM && (
                <div id="panel-ilham" role="tabpanel" aria-labelledby="tab-ilham" className="postit">
                  {weakest && (
                    <div className="pill" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span>🧭 Pusula önerisi: <strong>{skillLabel(weakest.skill)}</strong></span>
                      <button className="btn" onClick={practiceWeakSkill}>Bunu çalış</button>
                    </div>
                  )}

                  <div className="muted">🏋️ Antrenman Masası</div>
                  <h3>Bugün ne çalışmak istiyorsun?</h3>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    {CONSTRAINT_CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        className={`btn ${selectedCategory === c.id ? "primary" : ""}`}
                        onClick={() => selectCategory(c.id)}
                        type="button"
                      >
                        {c.title}
                      </button>
                    ))}
                  </div>

                  {pickedConstraint && (
                    <div
                      className="card"
                      style={{
                        marginTop: 14,
                        padding: 12,
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                        background: "var(--panel2)",
                      }}
                    >
                      <div className="muted">{pickedConstraint.focus}</div>
                      <p style={{ marginTop: 8, lineHeight: 1.5 }}>{pickedConstraint.text}</p>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        <button className="btn primary" onClick={() => sendTaskToEditor(false)}>
                          ↧ Görevi Aç
                        </button>
                        <button className="btn" onClick={() => rollConstraint()}>
                          🎲 Başka Kısıt
                        </button>
                        <button className="btn" onClick={() => sendTaskToEditor(true)}>
                          ▶ Görev + Sprint
                        </button>
                      </div>
                    </div>
                  )}

                  <ul style={{ marginTop: 14, listStyleType: "disc", paddingLeft: 20 }}>
                    {ILHAM_NOTES.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === TABS.SOHBET && (
                <div id="panel-sohbet" role="tabpanel" aria-labelledby="tab-sohbet">
                  {bagWords.length === 0 && bagPhrases.length === 0 ? (
                    <div className="muted">
                      Editöre yazdıkça sık kullandığın kelimeler burada belirir. En az 2 kez geçenleri gösteriyorum.
                    </div>
                  ) : (
                    <>
                      {bagWords.length > 0 && (
                        <div style={{ display: "grid", gap: 8 }}>
                          <div className="muted">Sık kullandıkların</div>
                          {bagWords.map((w) => (
                            <div
                              key={w.term}
                              className="card"
                              style={{
                                padding: 10,
                                borderRadius: 12,
                                border: "1px solid var(--border)",
                                background: "var(--panel2)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                <strong>{w.term}</strong>
                                <span className="pill">×{w.count}</span>
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                                <button className={`btn ${w.pref === "voice" ? "primary" : ""}`} onClick={() => tagTerm(w.term, "voice")}>Sesim</button>
                                <button className={`btn ${w.pref === "crutch" ? "primary" : ""}`} onClick={() => tagTerm(w.term, "crutch")}>Değnek</button>
                                <button className={`btn ${w.pref === "ignore" ? "primary" : ""}`} onClick={() => tagTerm(w.term, "ignore")}>Yok say</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {bagPhrases.length > 0 && (
                        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                          <div className="muted">İfade izleri</div>
                          {bagPhrases.map((p) => (
                            <div
                              key={p.term}
                              className="card"
                              style={{
                                padding: 10,
                                borderRadius: 12,
                                border: "1px solid var(--border)",
                                background: "var(--panel2)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                <strong>{p.term}</strong>
                                <span className="pill">×{p.count}</span>
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                                <button className={`btn ${p.pref === "voice" ? "primary" : ""}`} onClick={() => tagTerm(p.term, "voice")}>Sesim</button>
                                <button className={`btn ${p.pref === "crutch" ? "primary" : ""}`} onClick={() => tagTerm(p.term, "crutch")}>Değnek</button>
                                <button className={`btn ${p.pref === "ignore" ? "primary" : ""}`} onClick={() => tagTerm(p.term, "ignore")}>Yok say</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <p className="muted" style={{ marginTop: 14, lineHeight: 1.45 }}>
                        <strong>Sesim</strong> = üslubun. <strong>Değnek</strong> = fazla yaslandığın, Pusula takip eder. <strong>Yok say</strong> = isim/terim, sayılmaz.
                      </p>
                    </>
                  )}
                </div>
              )}

              {tab === TABS.YORUM && (
                <div id="panel-yorum" role="tabpanel" aria-labelledby="tab-yorum">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    {REVIEW_FOCUS_OPTIONS.map((o) => (
                      <button
                        key={o.id}
                        className={`btn ${reviewFocus === o.id ? "primary" : ""}`}
                        onClick={() => setReviewFocus(o.id)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>

                  {!review && (
                    <div className="muted">
                      Bir odak seç, sonra editör altındaki <b>AI Yorumla</b> butonuna bas.
                    </div>
                  )}

                  {review && (
                    <>
                      <div className="muted">🤖 {review.focusLabel || "AI Değerlendirme"}</div>
                      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{review.analysis}</p>
                      {review.closingNote && (
                        <p className="muted" style={{ marginTop: 12 }}>
                          — {review.closingNote}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {tab === TABS.KOC && (
                <div id="panel-koc" role="tabpanel" aria-labelledby="tab-koc">
                  <div
                    className="card"
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      border: "1px solid var(--border)",
                      background: "var(--panel2)",
                      marginBottom: 14,
                    }}
                  >
                    <div className="muted">🧭 Gelişim Pusulası</div>

                    {pusulaScores.length === 0 ? (
                      <div className="muted" style={{ marginTop: 8 }}>
                        Henüz yeterli sinyal yok. Yazdıkça ve AI yorumlattıkça pusula şekillenecek.
                      </div>
                    ) : (
                      <>
                        {weakest && (() => {
                          const traj = getTrajectory(weakest.skill);
                          const trajLabel = {
                            iyilesiyor: "↗ ilerliyorsun",
                            kotulesiyor: "↘ dikkat",
                            sabit: "→ sabit",
                            yetersiz: "",
                          }[traj.direction];

                          return (
                            <div style={{ marginTop: 10 }}>
                              <div className="muted">En çok çalışman gereken alan</div>
                              <div style={{ fontSize: 20, fontWeight: 900 }}>
                                {skillLabel(weakest.skill)}
                                {trajLabel && (
                                  <span className="pill" style={{ marginLeft: 8 }}>
                                    {trajLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                          {pusulaScores.slice(0, 4).map((s) => (
                            <div key={s.skill}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <span>{skillLabel(s.skill)}</span>
                                <span className="muted">{s.count} sinyal</span>
                              </div>
                              <div style={{ height: 7, borderRadius: 99, background: "rgba(255,255,255,.08)", overflow: "hidden", marginTop: 4 }}>
                                <div
                                  style={{
                                    width: `${(s.score / (pusulaScores[0]?.score || 1)) * 100}%`,
                                    height: "100%",
                                    background: "var(--accent)",
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {weakest && (
                          <button
                            className="btn primary"
                            style={{ width: "100%", marginTop: 12 }}
                            onClick={() => {
                              practiceWeakSkill();
                              setTab(TABS.ILHAM);
                            }}
                          >
                            🏋️ Bu beceriyi Antrenman'da çalış
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div className="muted">Canlı koç notları</div>
                    <button className="btn" onClick={() => setCoachNotes([])} disabled={coachNotes.length === 0}>
                      Temizle
                    </button>
                  </div>

                  {!coachEnabled && (
                    <div className="muted" style={{ marginBottom: 10 }}>
                      Koç modu kapalı. Notlar ve canlı uyarılar için üstten aç.
                    </div>
                  )}

                  {coachNotes.length === 0 ? (
                    <div className="muted">
                      Şimdilik not yok. Yazdıkça koç, sessizce buraya not düşecek.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {coachNotes.map((n) => (
                        <div
                          key={n.key}
                          className="card"
                          style={{
                            padding: 12,
                            borderRadius: 14,
                            border: "1px solid var(--border)",
                            background: "var(--panel2)",
                            boxShadow: "var(--shadow-1)",
                            outline: n?.meta?.highlight ? "2px solid rgba(37,99,235,.25)" : "none",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ fontSize: 18 }}>{n.icon || "📝"}</div>
                              <div style={{ fontWeight: 800 }}>{n.title || "Not"}</div>
                              {n.count > 1 && (
                                <span className="pill" style={{ padding: "2px 8px", fontSize: 12 }}>
                                  {n.count}×
                                </span>
                              )}
                            </div>

                            <span
                              className="pill"
                              style={{
                                padding: "2px 10px",
                                fontSize: 12,
                                borderColor:
                                  n.severity === "medium" ? "rgba(245,158,11,.35)" : "rgba(16,185,129,.35)",
                                color:
                                  n.severity === "medium" ? "#92400e" : "#047857",
                                background:
                                  n.severity === "medium" ? "rgba(245,158,11,.12)" : "rgba(16,185,129,.10)",
                              }}
                            >
                              {n.severity === "medium" ? "Orta" : "Hafif"}
                            </span>
                          </div>

                          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45, color: "var(--text)" }}>
                            {n.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
