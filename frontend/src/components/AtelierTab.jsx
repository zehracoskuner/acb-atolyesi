// src/components/AtelierTab.jsx
// Atölye sekmesi — ChaptersPage'den bağımsız, hiç dokunulmadı.
// Orijinal mantık korundu, sadece kendi dosyasına taşındı.

import { useState, useMemo, useRef, useEffect } from "react";
import { apiPost, apiPut } from "../lib/api";
import { useAICoach } from "../hooks/useAICoach";

/* ── SABİTLER ── */
const ATELIER_TABS = { ILHAM: "ilham", SOHBET: "sohbet", YORUM: "yorum", KOC: "koc" };

const ILHAM_NOTES = [
  "Sadece Başla: 300 kelime kötü yazmak, hiç yazmamaktan iyidir.",
  "Göster, Anlatma: 'Mutlu' deme — mutluluğun nasıl göründüğünü betimle.",
  "Başlık En Sona Kalır: Baskısını at, şimdilik [Taslak] yaz ve devam et.",
];

const CONSTRAINTS = [
  "Sadece diyalog yazarak aynı sahneyi anlat.",
  "Her cümle tam 7 kelime olsun.",
  "Bir koku metaforunu mutlaka kullan.",
  "Zaman kipini geçmişten şimdiye çevir.",
  "Bir nesneyi karakter gibi konuştur.",
];

/* ── ANA BİLEŞEN ── */
export default function AtelierTab({ workId }) {
  const {
    text, setText,
    title, setTitle,
    tab, setTab,
    loadingAI,
    tone, setTone,
    style, setStyle,
    chatInput, setChatInput,
    chat, sendChat,
    review, handleReview,
    liveAlert,
    coachNotes, setCoachNotes,
    chatBoxRef,
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

  /* Kısıtlama egzersizi */
  const [constraint, setConstraint] = useState("");
  const pickConstraint = () => {
    const c = CONSTRAINTS[Math.floor(Math.random() * CONSTRAINTS.length)];
    setConstraint(c);
    setTab(ATELIER_TABS.SOHBET);
    setChatInput(`Bu kısıtla bir paragraf üretmeme yardımcı olur musun? Kısıt: ${c}`);
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

  /* Bubble */
  const [bubblePos, setBubblePos] = useState({ x: 24, y: 120 });
  const [bubbleColor, setBubbleColor] = useState("#fde68a");
  const BUBBLE_COLORS = ["#fde68a", "#bfdbfe", "#e9d5ff", "#bbf7d0", "#fecaca"];

  useEffect(() => {
    if (!liveAlert || !coachEnabled) return;
    setBubbleColor(BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)]);
    const el = editorCardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBubblePos({
      x: 16 + Math.random() * Math.max(16, r.width - 260),
      y: 110 + Math.random() * Math.max(110, r.height - 160),
    });
  }, [liveAlert, coachEnabled]);

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
          <div
            className="live-bubble"
            style={{ left: bubblePos.x, top: bubblePos.y, background: bubbleColor }}
            role="status"
          >
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
            { id: ATELIER_TABS.ILHAM, label: "✨ İlham" },
            { id: ATELIER_TABS.YORUM, label: "📋 Yorum" },
            { id: ATELIER_TABS.SOHBET, label: "💬 Sohbet" },
            { id: ATELIER_TABS.KOC, label: "🗒️ Koç" },
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

        {/* İlham */}
        {tab === ATELIER_TABS.ILHAM && (
          <div className="atelier-panel">
            <div className="ilham-card">
              <h4 className="ilham-title">İç Eleştirmeni Sustur!</h4>
              <ul className="ilham-list">
                {ILHAM_NOTES.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
              <button className="btn-constraint" onClick={pickConstraint}>
                📝 Rastgele Kısıtlama Egzersizi
              </button>
              {constraint && <div className="constraint-pill">{constraint}</div>}
            </div>
          </div>
        )}

        {/* AI Yorum */}
        {tab === ATELIER_TABS.YORUM && (
          <div className="atelier-panel">
            {!review ? (
              <p className="atelier-muted">
                Henüz yorum yok. Editör altındaki <strong>AI Yorumla</strong> butonuna bas.
              </p>
            ) : (
              <>
                <div className="atelier-muted" style={{ marginBottom: 8 }}>
                  🤖 AI Değerlendirme
                </div>
                <p className="atelier-review-text">{review.analysis}</p>
                {review.closingNote && (
                  <p className="atelier-muted" style={{ marginTop: 10 }}>
                    — {review.closingNote}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Sohbet */}
        {tab === ATELIER_TABS.SOHBET && (
          <div className="atelier-panel">
            <div ref={chatBoxRef} className="atelier-chat-box">
              {chat.length === 0 && (
                <p className="atelier-muted">AI ile metni hakkında sohbet edebilirsin.</p>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`chat-msg chat-msg--${m.role}`}>
                  <strong>{m.role === "user" ? "Sen" : "AI"}</strong>
                  {": "}
                  {m.content}
                </div>
              ))}
            </div>
            <div className="atelier-chat-input-row">
              <input
                className="atelier-chat-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && chatInput.trim()) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                placeholder="AI'ye sor…"
              />
              <button
                className="btn-chat-send"
                onClick={sendChat}
                disabled={loadingAI || !chatInput.trim()}
              >
                {loadingAI ? "…" : "↑"}
              </button>
            </div>
          </div>
        )}

        {/* Koç Notları */}
        {tab === ATELIER_TABS.KOC && (
          <div className="atelier-panel">
            <div className="koc-header">
              <span className="atelier-muted">Koçun not defteri</span>
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
                    className={`koc-note ${
                      n.severity === "medium" ? "koc-note--medium" : "koc-note--low"
                    }`}
                  >
                    <div className="koc-note-head">
                      <span className="koc-note-icon">{n.icon || "📝"}</span>
                      <span className="koc-note-title">{n.title || "Not"}</span>
                      {n.count > 1 && (
                        <span className="koc-note-count">{n.count}×</span>
                      )}
                      <span
                        className={`koc-note-badge ${
                          n.severity === "medium" ? "badge--medium" : "badge--low"
                        }`}
                      >
                        {n.severity === "medium" ? "Orta" : "Hafif"}
                      </span>
                    </div>
                    <p className="koc-note-msg">{n.message}</p>
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