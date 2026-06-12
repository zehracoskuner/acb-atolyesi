import { useState, useMemo, useRef, useEffect } from "react";
import { apiPost, apiPut } from "../lib/api";
import { useAICoach } from "../hooks/useAICoach";
import { CONSTRAINT_CATEGORIES, ALL_CONSTRAINTS, constraintForSkill } from "../data/writingConstraints";
import { getSkillScores, getTrajectory, skillLabel } from "../lib/pusula";
import { analyzeWords, analyzePhrases, setPref, getPref } from "../lib/kelimeCantasi";

/* ── SABİTLER ── */
const ATELIER_TABS = { ILHAM: "ilham", SOHBET: "sohbet", YORUM: "yorum", KOC: "koc" };

const ILHAM_NOTES = [
  "Sadece Başla: 300 kelime kötü yazmak, hiç yazmamaktan iyidir.",
  "Göster, Anlatma: 'Mutlu' deme — mutluluğun nasıl göründüğünü betimle.",
  "Başlık En Sona Kalır: Baskısını at, şimdilik [Taslak] yaz ve devam et.",
];


const REVIEW_FOCUS_OPTIONS = [
  { id: "genel",     label: "Genel" },
  { id: "karakter",  label: "Karakter" },
  { id: "diyalog",   label: "Diyalog" },
  { id: "duygu",     label: "Duygu" },
  { id: "ritim",     label: "Ritim" },
  { id: "betimleme", label: "Betimleme" },
  { id: "tekrar",    label: "Tekrar" },
];

/* ── ANA BİLEŞEN ── */
export default function AtelierTab({ workId }) {
  const {
    text, setText,
    title, setTitle,
    tab, setTab,
    loadingAI,
    msg,
    tone, setTone,
    style, setStyle,
    review, handleReview,
    reviewFocus, setReviewFocus,
    liveAlert,
    coachNotes, setCoachNotes,
    coachEnabled, setCoachEnabled,
  } = useAICoach();

  /* Rutin zamanlayıcı */
  const [routine, setRoutine] = useState({
    mode: "sprint",
    durationMin: 10,
    goalWords: 150,
    running: false,
    secondsLeft: 600,
    startedAtWordCount: 0,
  });

  const editorRef = useRef(null);
  const editorCardRef = useRef(null);

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

  const wordCount = useMemo(() => {
    const t = (text || "").trim();
    return t ? t.split(/\s+/).filter(Boolean).length : 0;
  }, [text]);

  const fmt = (s) => {
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const startRoutine = (mode) => {
    const cfg = { sprint: [10, 150], warmup: [2, 60], edit: [5, 0] }[mode];
    setRoutine({
      mode,
      durationMin: cfg[0],
      goalWords: cfg[1],
      running: true,
      secondsLeft: cfg[0] * 60,
      startedAtWordCount: wordCount,
    });
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const routineWordsDone = Math.max(0, wordCount - routine.startedAtWordCount);
  const routineProgress =
    routine.goalWords > 0 ? Math.min(1, routineWordsDone / routine.goalWords) : 0;

  /* Antrenman: kategori + kısıt */
  const [selectedCategory, setSelectedCategory] = useState("karakter");
  const [pickedConstraint, setPickedConstraint] = useState(() => {
    const pool = ALL_CONSTRAINTS.filter((x) => x.category === "karakter");
    return pool[Math.floor(Math.random() * pool.length)];
  });
  const [activeTask, setActiveTask] = useState(null);

  const rollConstraint = (categoryId = selectedCategory) => {
    const pool = ALL_CONSTRAINTS.filter((x) => x.category === categoryId);
    const src = pool.length ? pool : ALL_CONSTRAINTS;
    setPickedConstraint(src[Math.floor(Math.random() * src.length)]);
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

  /* Pusula — sinyal değiştikçe yeniden hesapla */
  const [pusulaScores, setPusulaScores] = useState([]);
  useEffect(() => {
    setPusulaScores(getSkillScores());
  }, [review, coachNotes, tab]);
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
    () => (tab === ATELIER_TABS.SOHBET ? analyzeWords(text) : []),
    [text, bagTick, tab]
  );
  const bagPhrases = useMemo(
    () => (tab === ATELIER_TABS.SOHBET ? analyzePhrases(text) : []),
    [text, bagTick, tab]
  );
  const tagTerm = (term, pref) => {
    const current = getPref(term);
    setPref(term, current === pref ? null : pref);
    setBagTick((t) => t + 1);
  };

  /* Not kaydet */
  const [saveMsg, setSaveMsg] = useState("");
  const [noteId, setNoteId] = useState(null);

  const saveNote = async () => {
    if (!title.trim() && !text.trim()) return;
    try {
      if (!noteId) {
        const res = await apiPost("/notes", {
          title: title || "Egzersiz notu",
          content: text,
          workId,
        });
        setNoteId(res.item?.id || res.item?._id);
        setSaveMsg("Notlara kaydedildi ✓");
      } else {
        await apiPut(`/notes/${noteId}`, {
          title: title || "Egzersiz notu",
          content: text,
        });
        setSaveMsg("Güncellendi ✓");
      }
      setTimeout(() => setSaveMsg(""), 2000);
    } catch {
      setSaveMsg("Kaydedilemedi.");
      setTimeout(() => setSaveMsg(""), 2000);
    }
  };

  /* AI notlarını genel Notlarım'a kaydet */
  const [aiNoteSaveState, setAiNoteSaveState] = useState({});

  const saveAiNoteToNotes = async (key, noteTitle, content) => {
    try {
      await apiPost("/notes", { title: noteTitle, content });
      setAiNoteSaveState((p) => ({ ...p, [key]: "ok" }));
    } catch {
      setAiNoteSaveState((p) => ({ ...p, [key]: "err" }));
    }
    setTimeout(() => {
      setAiNoteSaveState((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }, 2000);
  };

  const aiNoteSaveLabel = (key) =>
    aiNoteSaveState[key] === "ok"
      ? "Notlarına kaydedildi ✓"
      : aiNoteSaveState[key] === "err"
      ? "Kaydedilemedi."
      : "📌 Notlarıma kaydet";

  return (
    <div className="atelier-layout">
      {/* Sol: Editör */}
      <div className="atelier-editor-wrap" ref={editorCardRef}>
        <div className="atelier-editor-top">
          <input
            className="atelier-title-input"
            placeholder="Egzersiz başlığı (isteğe bağlı)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            className={`coach-toggle ${coachEnabled ? "active" : ""}`}
            onClick={() => setCoachEnabled((v) => !v)}
            title={coachEnabled ? "Koç modunu kapat" : "Koç modunu aç"}
          >
            {coachEnabled ? "🧠 Koç: Açık" : "🧠 Koç: Kapalı"}
          </button>
        </div>

        {activeTask && (
          <div className="atelier-task-banner">
            <div className="task-banner-head">
              <span className="task-banner-cat">🏋️ {activeTask.title}</span>
              <button
                className="task-banner-close"
                onClick={() => setActiveTask(null)}
                title="Görevi kaldır"
              >
                ✕
              </button>
            </div>
            <p className="task-banner-text">{activeTask.text}</p>
            <span className="task-banner-focus">Odak: {activeTask.focus}</span>
          </div>
        )}

        <textarea
          ref={editorRef}
          className="atelier-textarea"
          placeholder="Bir beyaz kağıda her şey yazılabilir…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="atelier-editor-footer">
          <span className="atelier-wordcount">{wordCount} kelime</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {saveMsg && <span className="atelier-save-msg">{saveMsg}</span>}
            {msg && <span className="atelier-save-msg">{msg}</span>}
            {!msg && wordCount < 50 && (
              <span className="atelier-save-msg">AI yorum için en az 50 kelime</span>
            )}
            <button className="btn-atelier-save" onClick={saveNote}>
              💾 Nota Kaydet
            </button>
            <button
              className="btn-atelier-ai"
              onClick={handleReview}
              disabled={loadingAI || wordCount < 50}
            >
              {loadingAI ? "…" : "AI Yorumla"}
            </button>
          </div>
        </div>

        {coachEnabled && liveAlert && (
          <div className={`live-bubble live-bubble--${liveAlert.severity || "medium"}`} role="status">
            {liveAlert.message}
          </div>
        )}
      </div>

      {/* Sağ: Araçlar */}
      <div className="atelier-tools">
        {/* Rutin Kartı */}
        <div className="routine-card">
          <div className="routine-card-top">
            <div>
              <div className="routine-label">🔥 Bugünün Rutini</div>
              <div className="routine-title">
                {{ sprint: "Sprint", warmup: "Isınma", edit: "Düzenleme" }[routine.mode]}
                {" · "}
                {routine.durationMin} dk
              </div>
            </div>
            <div className="routine-timer">
              <div className="routine-time">{fmt(routine.secondsLeft)}</div>
              {routine.goalWords > 0 ? (
                <div className="routine-sub">
                  {routineWordsDone}/{routine.goalWords} kelime
                </div>
              ) : (
                <div className="routine-sub">düzenleme modu</div>
              )}
            </div>
          </div>

          {routine.goalWords > 0 && (
            <div className="routine-progress-wrap">
              <div
                className="routine-progress-fill"
                style={{ width: `${routineProgress * 100}%` }}
              />
            </div>
          )}

          <div className="routine-actions">
            {!routine.running ? (
              <>
                <button
                  className="btn-routine primary"
                  onClick={() => startRoutine("sprint")}
                >
                  ▶ Sprint (10 dk)
                </button>
                <button className="btn-routine" onClick={() => startRoutine("warmup")}>
                  Isınma
                </button>
                <button className="btn-routine" onClick={() => startRoutine("edit")}>
                  Düzenle
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-routine"
                  onClick={() => setRoutine((p) => ({ ...p, running: false }))}
                >
                  ❚❚ Duraklat
                </button>
                <button
                  className="btn-routine"
                  onClick={() =>
                    setRoutine((p) => ({
                      ...p,
                      running: false,
                      secondsLeft: p.durationMin * 60,
                      startedAtWordCount: wordCount,
                    }))
                  }
                >
                  ↺ Sıfırla
                </button>
              </>
            )}
          </div>

          <div className="routine-hint">
            {
              {
                sprint: "İç eleştirmeni sustur. Durma, düzeltme yok.",
                warmup: "Akışı aç. Sadece yaz.",
                edit: "1 paragrafı sadeleştir: 2 kelime at, 1 güçlü fiil ekle.",
              }[routine.mode]
            }
          </div>
        </div>

        {/* AI Ayarları */}
        {coachEnabled && (
          <div className="coach-settings">
            <select
              className="coach-select"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            >
              <option value="">— Ton yok —</option>
              <option value="lirik">Lirik</option>
              <option value="sert">Sert &amp; Gerçekçi</option>
              <option value="fantastik">Fantastik</option>
              <option value="noir">Noir</option>
            </select>
            <select
              className="coach-select"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              <option value="coach">Yazar Koçu (dengeli)</option>
              <option value="harsh">Sert Eleştirmen</option>
              <option value="friendly">Destekleyici</option>
            </select>
          </div>
        )}

        {/* Sekmeler */}
        <div className="atelier-tabs" role="tablist">
            {[
              { id: ATELIER_TABS.ILHAM, label: "🏋️ Antrenman" },
              { id: ATELIER_TABS.YORUM, label: "📋 Yorum" },
              { id: ATELIER_TABS.SOHBET, label: "🎒 Kelime Çantası" },
              { id: ATELIER_TABS.KOC, label: "🧭 Pusula" },
            ].map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`atelier-tab-btn ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Antrenman */}
        {tab === ATELIER_TABS.ILHAM && (
          <div className="atelier-panel">
            {weakest && (
              <div className="antrenman-suggestion">
                🧭 Pusula'nın önerisi: <strong>{skillLabel(weakest.skill)}</strong>
                <button className="btn-antrenman-suggest" onClick={practiceWeakSkill}>
                  Bunu çalış
                </button>
              </div>
            )}

            <div className="antrenman-q">Bugün ne çalışmak istiyorsun?</div>

            <div className="antrenman-cats">
              {CONSTRAINT_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className={`antrenman-cat ${selectedCategory === c.id ? "active" : ""}`}
                  onClick={() => selectCategory(c.id)}
                >
                  {c.title}
                </button>
              ))}
            </div>

            {pickedConstraint && (
              <div className="antrenman-exercise">
                <div className="antrenman-ex-focus">{pickedConstraint.focus}</div>
                <p className="antrenman-ex-text">{pickedConstraint.text}</p>
                <div className="antrenman-ex-actions">
                  <button className="btn-antrenman primary" onClick={() => sendTaskToEditor(false)}>
                    ↧ Editöre Aktar
                  </button>
                  <button className="btn-antrenman" onClick={() => rollConstraint()}>
                    🎲 Başka Kısıt
                  </button>
                  <button className="btn-antrenman" onClick={() => sendTaskToEditor(true)}>
                    ▶ Aktar + Sprint
                  </button>
                </div>
              </div>
            )}

            <ul className="ilham-list antrenman-tips">
              {ILHAM_NOTES.map((n, i) => (<li key={i}>{n}</li>))}
            </ul>
          </div>
        )}

        {/* AI Yorum */}
        {tab === ATELIER_TABS.YORUM && (
          <div className="atelier-panel">
            <div className="review-focus-row">
              {REVIEW_FOCUS_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  className={`review-focus-chip ${reviewFocus === o.id ? "active" : ""}`}
                  onClick={() => setReviewFocus(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {!review ? (
              <p className="atelier-muted">
                Bir odak seç, sonra editör altındaki <strong>AI Yorumla</strong> butonuna bas.
              </p>
            ) : (
              <>
                <div className="atelier-muted" style={{ marginBottom: 8 }}>
                  🤖 {review.focusLabel || "AI Değerlendirme"}
                </div>
                <p className="atelier-review-text">{review.analysis}</p>
                {review.closingNote && (
                  <p className="atelier-muted" style={{ marginTop: 10 }}>
                    — {review.closingNote}
                  </p>
                )}
                <p className="atelier-review-disclaimer">
                  Not: Buradaki AI bir editör gibi çalışır; işi seni övmek değil, geliştirebileceğin
                  noktaları göstermektir. Bu yüzden her zaman söyleyecek bir şey bulabilir. Bu, metnin
                  kötü olduğu anlamına gelmez. Eserin sana yeterince tamam geliyorsa son onayı AI'dan
                  bekleme; karar senin, yayınla gitsin.
                </p>
                <button
                  className="btn-ai-save-note"
                  onClick={() =>
                    saveAiNoteToNotes(
                      "review",
                      review.focusLabel || "AI Yorum",
                      review.analysis + (review.closingNote ? `\n\n— ${review.closingNote}` : "")
                    )
                  }
                  disabled={aiNoteSaveState.review === "ok"}
                >
                  {aiNoteSaveLabel("review")}
                </button>
              </>
            )}
          </div>
        )}

        {/* Kelime Çantası (eski Sohbet slotu) */}
        {tab === ATELIER_TABS.SOHBET && (
          <div className="atelier-panel">
            {bagWords.length === 0 && bagPhrases.length === 0 ? (
              <p className="atelier-muted">
                Editöre yazdıkça sık kullandığın kelimeler burada belirir (en az 2 kez geçenler).
              </p>
            ) : (
              <>
                {bagWords.length > 0 && (
                  <div className="bag-section">
                    <div className="bag-section-title">Sık kullandıkların</div>
                    {bagWords.map((w) => (
                      <div key={w.term} className={`bag-row ${w.pref ? `bag-row--${w.pref}` : ""}`}>
                        <span className="bag-term">{w.term}</span>
                        <span className="bag-count">×{w.count}</span>
                        <div className="bag-tags">
                          <button className={`bag-tag ${w.pref === "voice" ? "on" : ""}`} onClick={() => tagTerm(w.term, "voice")}>Sesim</button>
                          <button className={`bag-tag ${w.pref === "crutch" ? "on" : ""}`} onClick={() => tagTerm(w.term, "crutch")}>Değnek</button>
                          <button className={`bag-tag ${w.pref === "ignore" ? "on" : ""}`} onClick={() => tagTerm(w.term, "ignore")}>Yok say</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {bagPhrases.length > 0 && (
                  <div className="bag-section">
                    <div className="bag-section-title">İfade izleri</div>
                    {bagPhrases.map((p) => (
                      <div key={p.term} className={`bag-row ${p.pref ? `bag-row--${p.pref}` : ""}`}>
                        <span className="bag-term">{p.term}</span>
                        <span className="bag-count">×{p.count}</span>
                        <div className="bag-tags">
                          <button className={`bag-tag ${p.pref === "voice" ? "on" : ""}`} onClick={() => tagTerm(p.term, "voice")}>Sesim</button>
                          <button className={`bag-tag ${p.pref === "crutch" ? "on" : ""}`} onClick={() => tagTerm(p.term, "crutch")}>Değnek</button>
                          <button className={`bag-tag ${p.pref === "ignore" ? "on" : ""}`} onClick={() => tagTerm(p.term, "ignore")}>Yok say</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="bag-hint">
                  <strong>Sesim</strong> = üslubun, az uyarılır. <strong>Değnek</strong> = fazla yaslandığın, Pusula takip eder. <strong>Yok say</strong> = isim/terim (Mehmet, İstanbul gibi), hiç sayılmaz.
                </p>
              </>
            )}
          </div>
        )}

        {/* Gelişim Pusulası */}
        {tab === ATELIER_TABS.KOC && (
          <div className="atelier-panel">
            <div className="pusula-box">
              <div className="pusula-title">🧭 Gelişim Pusulası</div>

              {pusulaScores.length === 0 ? (
                <p className="atelier-muted">
                  Henüz yeterli sinyal yok. Yazdıkça ve AI yorumlattıkça pusula şekillenecek.
                </p>
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
                      <div className="pusula-weakest">
                        <span className="pusula-weakest-label">En çok çalışman gereken alan</span>
                        <div className="pusula-weakest-skill">
                          {skillLabel(weakest.skill)}
                          {trajLabel && <span className="pusula-traj">{trajLabel}</span>}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pusula-bars">
                    {pusulaScores.slice(0, 4).map((s) => (
                      <div className="pusula-bar-row" key={s.skill}>
                        <span className="pusula-bar-label">{skillLabel(s.skill)}</span>
                        <div className="pusula-bar-track">
                          <div
                            className="pusula-bar-fill"
                            style={{ width: `${(s.score / (pusulaScores[0].score || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {weakest && (
                    <button
                      className="btn-pusula-practice"
                      onClick={() => { practiceWeakSkill(); setTab(ATELIER_TABS.ILHAM); }}
                    >
                      🏋️ Bu beceriyi Antrenman'da çalış
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="koc-header" style={{ marginTop: 16 }}>
              <span className="atelier-muted">Canlı koç notları</span>
              <button
                className="btn-koc-clear"
                onClick={() => setCoachNotes([])}
                disabled={coachNotes.length === 0}
              >
                Temizle
              </button>
            </div>

            {!coachEnabled && (
              <p className="atelier-muted" style={{ marginBottom: 10 }}>
                Koç modu kapalı — notlar gelmez. Üstteki toggle'dan aç.
              </p>
            )}

            {coachNotes.length === 0 ? (
              <p className="atelier-muted">Yazdıkça koç buraya sessizce not düşecek.</p>
            ) : (
              <div className="koc-notes-list">
                {coachNotes.map((n) => (
                  <div
                    key={n.key}
                    className={`koc-note ${n.severity === "medium" ? "koc-note--medium" : "koc-note--low"}`}
                  >
                    <div className="koc-note-head">
                      <span className="koc-note-icon">{n.icon || "📝"}</span>
                      <span className="koc-note-title">{n.title || "Not"}</span>
                      {n.count > 1 && <span className="koc-note-count">{n.count}×</span>}
                      <span className={`koc-note-badge ${n.severity === "medium" ? "badge--medium" : "badge--low"}`}>
                        {n.severity === "medium" ? "Orta" : "Hafif"}
                      </span>
                    </div>
                    <p className="koc-note-msg">{n.message}</p>
                    <button
                      className="btn-ai-save-note"
                      onClick={() => saveAiNoteToNotes(n.key, n.title || "Koç Notu", n.message)}
                      disabled={aiNoteSaveState[n.key] === "ok"}
                    >
                      {aiNoteSaveLabel(n.key)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}