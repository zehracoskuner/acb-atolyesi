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

const DRAFT_KEY = "acb_write_draft_v1";

// İlham notları
const ILHAM_NOTES = [
  { id: 1, text: "Sadece Başla: 300 kelime kötü yazmak, hiç yazmamaktan iyidir. Hata yapma iznin var!" },
  { id: 2, text: "Göster, Anlatma: 'Mutlu' deme, mutluluğun nasıl göründüğünü betimle." },
  { id: 3, text: "Başlık En Sona Kalır: Başlık bulma baskısını at. Şimdilik [Taslak] yazıp devam et." },
];

const SWEET_COLORS = [
  "#FFCFDF", // Toz pembe
  "#FEF9A7", // Pastel sarı
  "#D9D7F1", // Lavanta
  "#E3F6F5", // Su yeşili
  "#FFD4B2", // Yavruağzı
  "#CEE5D0"  // Nane yeşili
];

const STORAGE_KEYS = {
  works: "acb-works",
  selectedWorkId: "acb-selected-work-id",
};

export default function Write() {
  const navigate = useNavigate();

  // AI koç
  const {
    title, setTitle, text, setText, msg,
    tab, setTab, loadingAI,
    tone, setTone, style, setStyle,
    chatInput, setChatInput, chat, sendChat,
    review, handleReview, liveAlert,setEditorFocus,
    coachNotes, setCoachNotes,
    chatBoxRef
  } = useAICoach();

  // === Daily Routine (sağ panel üst kart) ===
  const editorRef = useRef(null);

  const [routine, setRoutine] = useState({
    goalWords: 150,
    durationMin: 10,
    running: false,
    secondsLeft: 10 * 60,
    startedAtWordCount: 0,
    mode: "sprint", // sprint | warmup | edit
  });

  useEffect(() => {
    if (!routine.running) return;

    const t = setInterval(() => {
      setRoutine(prev => {
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
    if (!t) return 0;
    return t.split(/\s+/).filter(Boolean).length;
  }, [text]);

  const startRoutine = (mode = "sprint") => {
    const durationMin = mode === "warmup" ? 2 : mode === "edit" ? 5 : 10;
    const goalWords = mode === "warmup" ? 60 : mode === "edit" ? 0 : 150;

    setRoutine(prev => ({
      ...prev,
      mode,
      durationMin,
      goalWords,
      running: true,
      secondsLeft: durationMin * 60,
      startedAtWordCount: wordCount,
    }));

    // editöre fokus
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const pauseRoutine = () => setRoutine(prev => ({ ...prev, running: false }));

  const resetRoutine = () => setRoutine(prev => ({
    ...prev,
    running: false,
    secondsLeft: prev.durationMin * 60,
    startedAtWordCount: wordCount,
  }));

  const routineWordsDone = Math.max(0, wordCount - routine.startedAtWordCount);
  const routineProgress = routine.goalWords > 0
    ? Math.min(1, routineWordsDone / routine.goalWords)
    : 0;

  // Panel + notlar
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

  // Çalışmalar
  const [works, setWorks] = useState([]);
  useEffect(() => {
    if (!isLoggedIn()) return;

    apiGet("/works")
      .then(d => setWorks(d.items || []))
      .catch(err => {
        console.error("Çalışmalar yüklenemedi:", err);
      });
  }, []);

  const [saveMessage, setSaveMessage] = useState("");

  // Seçili çalışma
  const [selectedWorkId, setSelectedWorkId] = useState(() => {
    try { 
      return localStorage.getItem(STORAGE_KEYS.selectedWorkId) || null; 
    } catch { 
      return null; 
    }
  });

  const selectedWork = useMemo(
    () => works.find(w => (w.id || w._id) === selectedWorkId) || null,
    [selectedWorkId, works]
  );

  // TASLAK KISMINI OTOMATİK YÜKLEME
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);

      // Eğer henüz bir çalışma seçili DEĞİLSE (ilk giriş ise)
      if (!selectedWorkId) {
        if (parsed.title !== undefined) {
          setTitle(parsed.title);
        }
        if (parsed.content !== undefined) {
          setText(parsed.content);
        }
      }
    } catch {
      // bozuksa umursama
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kullanıcı yazdıkça taslağı localStorage'a kaydet
  useEffect(() => {
    const payload = JSON.stringify({
      title,
      content: text,
      noteId,
    });
    localStorage.setItem(DRAFT_KEY, payload);
  }, [title, text, noteId]);

  // Persist works & selection
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

  // Editörü seçili çalışmayla senkronla
  useEffect(() => {
    if (!selectedWork) return;
    setTitle(selectedWork.title || "");
    setText(selectedWork.content || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkId]);

  // Not özetlerini çek (login ise)
  useEffect(() => {
    if (!isLoggedIn()) return;
    apiGet("/notes")
      .then(d => setNotes(d.items || []))
      .catch(() => {});
  }, []);

  // Çalışma güncelle
  const updateSelectedWork = useCallback((patch) => {
    setWorks(prev => prev.map(w => (w.id === selectedWorkId ? { ...w, ...patch } : w)));
  }, [selectedWorkId]);

  // Başlık / Metin değişimleri
  const onChangeTitle = (v) => {
    setTitle(v);
    if (selectedWorkId) updateSelectedWork({ title: v });
  };

  const onChangeText = (v) => {
    setText(v);
    if (selectedWorkId) updateSelectedWork({ content: v });
  };

  const handleOpenWork = (work) => {
    const id = work?.id || work?._id;
    if (!id) return;
    navigate(`/work/${id}/studio`, { state: { backTo: `/work/${id}/write` } });
  };

  // Yeni çalışma oluştur (lokal)
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
      setWorks(prev => [newWork, ...prev]);
      setSelectedWorkId(newWork.id);
    } catch (err) {
      console.error("Yeni çalışma oluşturulamadı:", err);
    }
  }
  const editorCardRef = useRef(null);


// her yeni liveAlert geldiğinde rastgele "textarea tarafı"na konum seç

const [bubblePos, setBubblePos] = useState({ x: 24, y: 120 });
const [bubbleColor, setBubbleColor] = useState("#fde68a"); // ilk renk

const COLORS = useRef([
  "#fde68a", // sarı
  "#bfdbfe", // mavi
  "#e9d5ff", // mor
  "#bbf7d0", // yeşil
  "#fecaca", // pembe/kırmızı
  "#ddd6fe", // lila
]);

useEffect(() => {
  if (!liveAlert) return;

  // rastgele renk
  const c = COLORS.current[Math.floor(Math.random() * COLORS.current.length)];
  setBubbleColor(c);

  // rastgele konum (editör kartı içinde)
  const el = editorCardRef.current;
  if (!el) return;
  const r = el.getBoundingClientRect();

  const maxX = Math.max(16, r.width - 260);
  const maxY = Math.max(120, r.height - 160);

  const x = 16 + Math.random() * (maxX - 16);
  const y = 110 + Math.random() * (maxY - 110);

  setBubblePos({ x, y });
}, [liveAlert]);

  // İlham egzersizi
  const [promptConstraint, setPromptConstraint] = useState("");
  const constraintsRef = useRef([
    "Sadece diyalog yazarak aynı sahneyi anlat.",
    "Her cümle 7 kelime olsun.",
    "Bir koku metaforunu mutlaka kullan.",
    "Zaman kipini geçmişten şimdiki zamana çevir.",
    "Bir nesneyi karakter gibi konuştur.",
  ]);

  const startConstraint = () => {
    const pick = constraintsRef.current[Math.floor(Math.random() * constraintsRef.current.length)];
    setPromptConstraint(pick);
    setTab(TABS.SOHBET);
    setChatInput(`Bu kısıtla bir paragraf üretmeme yardımcı olur musun? Kısıt: ${pick}`);
  };

  // Not kaydet
  const autoSaveTimer = useRef(null);

  const saveNote = useCallback(async () => {
    setSaveMessage("");

    // her ihtimale karşı local taslak
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ title, content: text, noteId })
    );

    if (!isLoggedIn()) {
      navigate("/register", { state: { fromDraft: true } });
      return;
    }

    // boş kaydetmesin (istersen kaldır)
    if (!title.trim() && !text.trim()) {
      setSaveMessage("Boş not kaydetmiyorum 🙂");
      setTimeout(() => setSaveMessage(""), 2000);
      return;
    }

    try {
      if (!noteId) {
        // ✅ ilk kayıt
        const res = await apiPost("/notes", { title, content: text });
        const created = res.item;

        setNoteId(created.id || created._id || null);
        setNotes((prev) => [created, ...prev]);

        setSaveMessage("Notlarınıza kaydedildi ✅");
        setTimeout(() => setSaveMessage(""), 2500);
      } else {
        // ✅ güncelleme
        const res = await apiPut(`/notes/${noteId}`, { title, content: text });
        const updated = res.item;

        setNotes((prev) =>
          prev.map((n) => ((n.id || n._id) === (updated.id || updated._id) ? updated : n))
        );

        setSaveMessage("Güncellendi ✅");
        setTimeout(() => setSaveMessage(""), 2000);
      }
    } catch (err) {
      console.error("Kaydet hatası:", err);
      setSaveMessage(err?.message || "Kaydedilirken bir hata oluştu.");
      setTimeout(() => setSaveMessage(""), 3000);
    }
  }, [title, text, noteId, navigate]);

  useEffect(() => {
    // login değilse sadece local draft kaydı yeter
    if (!isLoggedIn()) return;

    // çok sık istek atmasın: 1200ms debounce
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(() => {
      // boşsa kaydetme
      if (!title.trim() && !text.trim()) return;

      // otomatik kaydet
      saveNote();
    }, 1200);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [title, text, saveNote]);

  // Sidebar'dan Notlarım'a git
  const goNotes = () => navigate("/notes");

  // Sekme butonu
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

      {/* Üst çubuk */}
      <div className="topbartwo" style={{ borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            className="btn"
            onClick={() => setPanelOpen(p => !p)}
            aria-label="Çalışmalarım panelini aç/kapat"
          >
            ☰
          </button>

          <strong>{"Atölyem"}</strong>
        </div>

        {/* AI ayarları */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            className="input"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            style={{ width: 160, height: 40 }}
            aria-label="Ton seçimi"
          >
            {TONES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
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
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Düzen */}
      <div className="editor-shell">
        {/* Sidebar */}
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

        {/* Editör */}
        <main className="editor-canvas">
          <div className="grid-2">
            {/* Sol: Editör */}
           <div className="card pad editor-card" ref={editorCardRef}>
              <input
                className="input title-input"
                placeholder="Taslak Başlık"
                value={title}
                onChange={(e) => onChangeTitle(e.target.value)}
                style={{ margin: "12px 0" }}
                aria-label="Başlık"
              />
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
                <button className="btn primary" onClick={saveNote}>💾 Kaydet</button>
                <button className="btn" onClick={handleReview} disabled={loadingAI || wordCount < 150}>
                  {loadingAI ? "…" : "AI Yorumla"}
                </button>
                <Link className="link" to="/landing">Ana sayfaya dön</Link>
              </div>
              { /*<div className="word-counter" aria-label="Kelime sayısı">
                {wordCount} kelime
              </div> */}

              {saveMessage && (
                <div style={{ marginTop: 8, fontSize: 13, color: "#2f855a" }}>
                  {saveMessage}
                </div>
              )}

              {msg && <div className="pill" style={{ marginTop: 10 }}>{msg}</div>}

              
{liveAlert && (
  <div
    className="live-bubble"
    style={{ left: bubblePos.x, top: bubblePos.y, background: bubbleColor }}
    role="status"
    aria-live="polite"
  >
    {liveAlert.message}
  </div>
)}


            </div>

            {/* Sağ: Yardımcı Panel */}
            <div className="card pad">
              {/* Daily Routine Card */}
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

                {/* progress */}
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

              <div role="tablist" aria-label="Yardımcı sekmeler" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <TabButton id="ilham" active={tab === TABS.ILHAM} onClick={() => setTab(TABS.ILHAM)}>İlham</TabButton>
                <TabButton id="yorum" active={tab === TABS.YORUM} onClick={() => setTab(TABS.YORUM)}>AI Yorum</TabButton>
                <TabButton id="sohbet" active={tab === TABS.SOHBET} onClick={() => setTab(TABS.SOHBET)}>AI Sohbet</TabButton>
                <TabButton id="koc" active={tab === TABS.KOC} onClick={() => setTab(TABS.KOC)}>Koç Notları</TabButton>
              </div>

              {tab === TABS.ILHAM && (
                <div id="panel-ilham" role="tabpanel" aria-labelledby="tab-ilham" className="postit">
                  <div className="muted">✨ İlham Köşesi</div>
                  <h3>İç Eleştirmeni Sustur!</h3>
                  <ul style={{ marginTop: 10, listStyleType: 'disc', paddingLeft: 20 }}>
                    {ILHAM_NOTES.map(note => (
                      <li key={note.id} dangerouslySetInnerHTML={{ __html: note.text }} />
                    ))}
                  </ul>
                  <button className="btn primary" style={{ marginTop: 15, width: '100%' }} onClick={startConstraint}>
                    📝 Rastgele Kısıtlama Egzersizi Başlat
                  </button>
                  {promptConstraint && <div className="pill" style={{ marginTop: 10 }}>{promptConstraint}</div>}
                </div>
              )}

              {tab === TABS.SOHBET && (
                <div id="panel-sohbet" role="tabpanel" aria-labelledby="tab-sohbet">
                  <div
                    ref={chatBoxRef}
                    className="chat-box"
                    style={{
                      height: 300,
                      overflow: "auto",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 12,
                      marginBottom: 10,
                      background: "var(--panel2)",
                    }}
                  >
                    {chat.length === 0 && <div className="muted">AI ile metnin hakkında sohbet edebilirsin.</div>}
                    {chat.map((m, i) => (
                      <div key={i} style={{ margin: "8px 0", whiteSpace: "pre-wrap" }}>
                        <strong style={{ color: m.role === "user" ? "#047857" : "#6b21a8" }}>
                          {m.role === "user" ? "Sen" : "AI"}
                        </strong>
                        {": "}
                        {m.content}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="input"
                      value={chatInput}
                      onKeyDown={(e) => { 
                        if (e.key === 'Enter') { 
                          e.preventDefault(); 
                          if (chatInput.trim()) sendChat(); 
                        } 
                      }}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="AI'ye sor..."
                      aria-label="Sohbet kutusu"
                    />
                    <button className="btn" onClick={sendChat} disabled={loadingAI || !chatInput.trim()}>
                      {loadingAI ? "…" : "Gönder"}
                    </button>
                  </div>
                </div>
              )}

              {tab === TABS.YORUM && (
                <div id="panel-yorum" role="tabpanel" aria-labelledby="tab-yorum">
                  {!review && (
                    <div className="muted">
                      Henüz yorum yok. Editör altındaki <b>AI Yorumla</b> butonuna bas.
                    </div>
                  )}
                  {review && (
                    <>
                      <div className="muted">🤖 AI Değerlendirme</div>
                      <p style={{ whiteSpace: "pre-wrap" }}>{review.analysis}</p>
                      {review.closingNote && (
                        <p className="muted" style={{ marginTop: 12 }}>— {review.closingNote}</p>
                      )}
                    </>
                  )}
                </div>
              )}
              {tab === TABS.KOC && (
  <div id="panel-koc" role="tabpanel" aria-labelledby="tab-koc">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div className="muted">🗒️ Koçun Not Defteri</div>
      <button className="btn" onClick={() => setCoachNotes([])} disabled={coachNotes.length === 0}>
        Temizle
      </button>
    </div>

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
                    n.severity === "medium" ? "rgba(245,158,11,.12)" : "rgba(16,185,129,.10)"
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