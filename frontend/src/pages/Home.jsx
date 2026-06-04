import { useEffect, useState, useCallback, useMemo } from "react";
import useExperience from "../store/useExperience";


export default function Home() {
  const { level, loading } = useExperience();

  const [draft, setDraft] = useState("");
  const [notes, setNotes] = useState(() => {
    try {
      const raw = localStorage.getItem("plus1_notes");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // SOL PANEL: Çalışmalarım içinde “Notlarım” accordion
  const [openNotes, setOpenNotes] = useState(true);

  useEffect(() => {
    const cached = localStorage.getItem("plus1_draft");
    if (cached) setDraft(cached);
  }, []);

  useEffect(() => {
    const i = setInterval(() => {
      try { localStorage.setItem("plus1_draft", draft); } catch {
        <div> hata </div>
      }
    }, 2000);
    return () => clearInterval(i);
  }, [draft]);

  const handleSave = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    const n = {
      id: crypto.randomUUID(),
      title: t.split("\n")[0].slice(0, 60) || "Adsız Not",
      body: t,
      createdAt: Date.now()
    };
    const next = [n, ...notes];
    setNotes(next);
    localStorage.setItem("plus1_notes", JSON.stringify(next));
    setDraft("");
    localStorage.removeItem("plus1_draft");
    // Notlarım zaten solda; kaydedince kullanıcı oradan açıp görebilir
  }, [draft, notes]);

  const deleteNote = useCallback((id) => {
    const next = notes.filter(n => n.id !== id);
    setNotes(next);
    localStorage.setItem("plus1_notes", JSON.stringify(next));
  }, [notes]);

  const loadNote = useCallback((id) => {
    const n = notes.find(x => x.id === id);
    if (n) setDraft(n.body);
  }, [notes]);

  const rightBox = useMemo(() => {
    if (loading) return (
      <div className="card postit">
        <div className="sk sk-title"/><div className="sk sk-line"/><div className="sk sk-line"/>
      </div>
    );
    const isPro = ["advanced","professional"].includes(level);

    if (!isPro) {
      return (
        <div className="card postit">
          <h3 className="postit-title">İpuçları</h3>
          <ul className="tips">
            <li>Karakteri bir hedefle başlat.</li>
            <li>Sahneyi tek bir çatışmaya odakla.</li>
            <li>“Göster, söyleme”.</li>
          </ul>
        </div>
      );
    }
    return (
      <div className="card postit">
        <h3 className="postit-title">Yazar Özeti</h3>
        <ul className="stats">
          <li>Bu ay yazılan bölüm: —</li>
          <li>Toplam kelime: —</li>
          <li>En çok not alınan proje: —</li>
        </ul>
        <p className="muted">(Backend bağlanınca gerçek veriler)</p>
      </div>
    );
  }, [level, loading]);

  return (
    <div className="ws-shell light">
      <header className="ws-topbar light">
        <div className="brand">PLUS1</div>
        <button className="icon-btn" title="Discover (yakında)">📖</button>
      </header>

      <div className="ws-grid">
        {/* SOL YAN PANEL */}
        <aside className="ws-left light">
          <h4 className="section-title">Çalışmalarım</h4>

          {/* Diğer seçeneklerin için yer tutucu */}
          <div className="option muted">• Projelerim (yakında)</div>
          <div className="option muted">• Kitaplarım (yakında)</div>

          {/* Notlarım - accordion */}
          <button
            className={"accordion-head" + (openNotes ? " open" : "")}
            onClick={() => setOpenNotes(v => !v)}
            aria-expanded={openNotes}
            aria-controls="notes-accordion"
          >
            <span>Notlarım</span>
            <span className="chev">{openNotes ? "▾" : "▸"}</span>
          </button>

          <div
            id="notes-accordion"
            className={"accordion-body" + (openNotes ? " open" : "")}
          >
            <ul className="note-list">
              {notes.length === 0 && <li className="muted">Henüz not yok.</li>}
              {notes.map(n => (
                <li key={n.id} className="note-item">
                  <button className="note-title" onClick={() => loadNote(n.id)}>{n.title}</button>
                  <time className="note-time">{new Date(n.createdAt).toLocaleString()}</time>
                  <button className="note-del" onClick={() => deleteNote(n.id)}>✕</button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ORTA: YAZMA ALANI (geniş) */}
        <main className="ws-main light">
          <div className="editor-header light">
            <h1>Yeni Yazı / Fikir</h1>
            <button className="btn light" onClick={handleSave} title="Kaydet">Kaydet</button>
          </div>
          <textarea
            className="ws-textarea light"
            placeholder="Küçük bir sahne, fikir, bölüm taslağı..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </main>

        {/* SAĞ: POST-IT İPUÇLARI (textarea ile aynı yükseklikte uzar) */}
        <aside className="ws-right light">
          {rightBox}
        </aside>
      </div>

      <button className="profile-fab light" title="Profil">Z</button>
    </div>
  );
}
