import { useState, useMemo, useRef, useEffect } from "react";
import { saveAtelierNote } from "../lib/atelierNotes";
import { useWritingHints } from "../hooks/useWritingHints";
import { CONSTRAINT_CATEGORIES, ALL_CONSTRAINTS, constraintForSkill } from "../data/writingConstraints";
import { getSkillScores, getTrajectory, skillLabel } from "../lib/pusula";
import { analyzeWords, analyzePhrases, setPref, getPref } from "../lib/kelimeCantasi";
import "../styles/AtelierTab.css";
import { atelierDraftKey, readAtelierDraft, writeAtelierDraft, acknowledgeAtelierDraft } from "../lib/atelierDraft";

/* ── SABİTLER ── */
const ATELIER_TABS = { ILHAM: "ilham", SOHBET: "sohbet", KOC: "koc" };

const ILHAM_NOTES = [
  "Sadece Başla: 300 kelime kötü yazmak, hiç yazmamaktan iyidir.",
  "Göster, Anlatma: 'Mutlu' deme — mutluluğun nasıl göründüğünü betimle.",
  "Başlık En Sona Kalır: Baskısını at, şimdilik [Taslak] yaz ve devam et.",
];


export default function AtelierTab({ workId, userId }) {
  if (!workId || !userId) return <p role="status">Atölye için oturum ve eser bilgisi gerekiyor.</p>;
  return <AtelierWorkspace key={atelierDraftKey(userId, workId)} workId={workId} userId={userId} />;
}

function AtelierWorkspace({ workId, userId }) {
  const key = atelierDraftKey(userId, workId);
  const [initial] = useState(() => { try { return readAtelierDraft(localStorage, key); } catch { return { title: "", text: "", noteId: null, error: "Yerel taslak okunamadı. Tarayıcı depolamasını kontrol edin." }; } });
  const [draft, setDraft] = useState(initial);
  const draftRef = useRef(initial);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [draftError, setDraftError] = useState(initial.error || "");
  const [saveMsg, setSaveMsg] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { title, text } = draft;
  const updateDraft = patch => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next; setDraft(next);
    try { writeAtelierDraft(localStorage, key, next); setDraftError(""); }
    catch { setDraftError("Yerel taslak saklanamadı. Sekmeyi kapatmadan metninizi nota kaydedin veya kopyalayın."); }
  };
  const setTitle = title => { updateDraft({ title }); setSaveMsg(""); setSaveFailed(false); };
  const setText = text => { updateDraft({ text }); setSaveMsg(""); setSaveFailed(false); };
  const { tab, setTab, liveAlert, coachNotes, setCoachNotes, coachEnabled, setCoachEnabled } = useWritingHints(text);
  useEffect(() => {
    window.__acbTourTrigger = window.__acbTourTrigger || {};
    const prepare = target => { setTab(target === "atelier-bag" ? ATELIER_TABS.SOHBET : target === "atelier-compass" ? ATELIER_TABS.KOC : ATELIER_TABS.ILHAM); };
    window.__acbTourTrigger.prepareAtelierTool = prepare;
    return () => { if (window.__acbTourTrigger.prepareAtelierTool === prepare) delete window.__acbTourTrigger.prepareAtelierTool; };
  }, [setTab]);
  /* Rutin zamanlayıcı */
  const [routine, setRoutine] = useState({
    mode: "sprint",
    durationMin: 10,
    goalWords: 150,
    running: false,
    paused: false,
    secondsLeft: 600,
    startedAtWordCount: 0,
  });

  const editorRef = useRef(null);

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
      paused: false,
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
    setPusulaScores(getSkillScores({ source: ["rule", "wordbag"] }));
  }, [coachNotes, liveAlert, tab, text]);
  const weakest = pusulaScores[0] || null;

  const practiceWeakSkill = () => {
    if (!weakest) return;
    const c = constraintForSkill(weakest.skill);
    if (!c) return;
    setSelectedCategory(c.category);
    setPickedConstraint(c);
  };

  /* Kelime Çantası */
  const [, setBagTick] = useState(0);
  // Preferences live outside React; recompute after tagTerm triggers a render.
  const bagWords = tab === ATELIER_TABS.SOHBET ? analyzeWords(text) : [];
  const bagPhrases = tab === ATELIER_TABS.SOHBET ? analyzePhrases(text) : [];
  const tagTerm = (term, pref) => {
    const current = getPref(term);
    setPref(term, current === pref ? null : pref);
    setBagTick((t) => t + 1);
  };

  const saveNote = async () => {
    if (savingRef.current || (!title.trim() && !text.trim())) return;
    savingRef.current = true; setSaving(true); setSaveMsg(""); setSaveFailed(false);
    const snapshot = { ...draftRef.current };
    try {
      const item = await saveAtelierNote(snapshot, { workId });
      if (!mounted.current) return;
      const current = { ...draftRef.current, noteId: String(item._id) };
      draftRef.current = current; setDraft(current);
      try {
        acknowledgeAtelierDraft(localStorage, key, { ...snapshot, noteId: current.noteId }, current);
        setDraftError("");
      } catch { setDraftError("Not sunucuya kaydedildi; bu tarayıcıdaki kopya güncellenemedi. Metni kapatmadan kopyalayabilirsin."); }
      setSaveMsg(draftRef.current.text === snapshot.text && draftRef.current.title === snapshot.title ? "Eserine bağlı nota kaydedildi" : "Önceki metin kaydedildi; yeni değişiklikleri de kaydet.");
    } catch (err) { setSaveFailed(true); setSaveMsg(err.message || "Nota kaydedilemedi. Taslağınız korunuyor."); }
    finally { savingRef.current = false; setSaving(false); }
  };
  /* Yerel yazım ipuçlarını aynı esere bağlı notlara kaydet. */
  const [hintNoteSaveState, setHintNoteSaveState] = useState({});

  const hintSaves = useRef(new Set());
  const saveHintToNotes = async (key, noteTitle, content) => {
    if (hintSaves.current.has(key)) return;
    hintSaves.current.add(key);
    setHintNoteSaveState(p => ({ ...p, [key]: "saving" }));
    try {
      await saveAtelierNote({ title: noteTitle, text: content }, { workId });
      setHintNoteSaveState((p) => ({ ...p, [key]: "ok" }));
    } catch {
      setHintNoteSaveState((p) => ({ ...p, [key]: "err" }));
    }
    finally { hintSaves.current.delete(key); }
  };

  const hintNoteSaveLabel = (key) =>
    hintNoteSaveState[key] === "saving" ? "Kaydediliyor…"
      : hintNoteSaveState[key] === "ok"
      ? "Notlarına kaydedildi ✓"
      : hintNoteSaveState[key] === "err"
      ? "Kaydedilemedi."
      : "📌 Notlarıma kaydet";

  return (
    <div className="atelier-layout" data-tour="atelier-intro">
      {/* Sol: bağımsız egzersiz taslağı */}
      <div className="atelier-editor-wrap">
        <p className="atelier-muted">Bölüm metninden ayrı bir egzersiz alanı. Taslağın bu tarayıcıda korunur.</p>
        <div className="atelier-editor-top">
          <input
            className="atelier-title-input"
            aria-label="Egzersiz başlığı"
            placeholder="Egzersiz başlığı (isteğe bağlı)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button
            className={`coach-toggle ${coachEnabled ? "active" : ""}`}
            onClick={() => setCoachEnabled((v) => !v)}
            aria-pressed={coachEnabled}
            title="Yerel yazım ipuçları"
          >
            {coachEnabled ? "İpuçları: Açık" : "İpuçları: Kapalı"}
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
          aria-label="Egzersiz metni"
          placeholder="Bir beyaz kağıda her şey yazılabilir…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="atelier-editor-footer">
          <span className="atelier-wordcount">{wordCount} kelime</span>
          <div className="atelier-save-actions">
            <span className="atelier-save-msg" role={saveFailed ? "alert" : "status"}>{saving ? "Nota kaydediliyor…" : saveMsg || "Egzersiz taslağı bu tarayıcıda"}{draftError && <span role="alert">{draftError}</span>}</span>
            <button className="btn-atelier-save" data-tour="atelier-save" onClick={saveNote} disabled={saving}>Nota Kaydet</button>
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
        <div className="routine-card" data-tour="atelier-routine">
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
            {routine.paused ? <>
              <button className="btn-routine primary" onClick={() => setRoutine(p => ({ ...p, running: true, paused: false }))}>▶ Devam et</button>
              <button className="btn-routine" onClick={() => setRoutine(p => ({ ...p, paused: false, running: false, secondsLeft: p.durationMin * 60, startedAtWordCount: wordCount }))}>↺ Sıfırla</button>
            </> : !routine.running ? (
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
                  onClick={() => setRoutine((p) => ({ ...p, running: false, paused: true }))}
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

        {/* Sekmeler */}
        <div className="atelier-tabs" role="tablist">
            {[
              { id: ATELIER_TABS.ILHAM, label: "🏋️ Antrenman" },
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
          <div className="atelier-panel" data-tour="atelier-training">
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

        {/* Kelime Çantası (eski Sohbet slotu) */}
        {tab === ATELIER_TABS.SOHBET && (
          <div className="atelier-panel" data-tour="atelier-bag">
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

        {/* Pusula */}
        {tab === ATELIER_TABS.KOC && (
          <div className="atelier-panel" data-tour="atelier-compass">
            <div className="pusula-box">
              <div className="pusula-title">🧭 Pusula</div>

              {pusulaScores.length === 0 ? (
                <p className="atelier-muted">
                  Henüz yeterli gözlem yok. Pusula, yazarken oluşan yerel egzersiz ipuçlarını toplar; bir başarı notu değildir.
                </p>
              ) : (
                <>
                  {weakest && (() => {
                    const traj = getTrajectory(weakest.skill, { source: ["rule", "wordbag"] });
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
              <span className="atelier-muted">Yerel yazım ipuçları</span>
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
                Yazım ipuçları kapalı. Üstteki İpuçları düğmesinden açabilirsin.
              </p>
            )}

            {coachNotes.length === 0 ? (
              <p className="atelier-muted">Yazdıkça yerel kurallardan gelen ipuçları burada görünür. AI değerlendirmesi yapılmaz.</p>
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
                      className="btn-hint-save-note"
                      onClick={() => saveHintToNotes(n.key, n.title || "Yazım ipucu", n.message)}
                      disabled={["saving", "ok"].includes(hintNoteSaveState[n.key])}
                    >
                      {hintNoteSaveLabel(n.key)}
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