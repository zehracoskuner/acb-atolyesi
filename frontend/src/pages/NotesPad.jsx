// src/pages/NotesPad.jsx
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";
import VoiceInputButton from "../components/VoiceInputButton";
import "../styles/NotesPad.css";

const FILTERS = { ALL: "all", FREE: "free", LINKED: "linked" };

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMs / 3600000);
  const diffD   = Math.floor(diffMs / 86400000);
  if (diffMin < 2)  return "az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  if (diffH   < 24) return `${diffH} sa önce`;
  if (diffD   < 7)  return `${diffD} gün önce`;
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export default function NotesPad() {
  const [notes,   setNotes]   = useState([]);
  const [works,   setWorks]   = useState([]);
  const [sel,     setSel]     = useState(null);
  const [title,   setTitle]   = useState("");
  const [content, setContent] = useState("");
  const [workId,  setWorkId]  = useState("");   // bağlı eser
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [query,   setQuery]   = useState("");
  const [filter,  setFilter]  = useState(FILTERS.ALL);

  const autoSaveRef = useRef(null);
  const isDirtyRef  = useRef(false);

  /* ── Verileri çek ── */
  const fetchNotes = useCallback(async () => {
    try {
      const d = await apiGet("/notes");
      setNotes(d.items || []);
    } catch (err) { console.error("Notlar yüklenemedi:", err); }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  useEffect(() => {
    apiGet("/works")
      .then(d => setWorks(d.items || []))
      .catch(() => {});
  }, []);

  /* ── Not seç ── */
  const openNote = (n) => {
    if (isDirtyRef.current) flushSave();
    setSel(n);
    setTitle(n.title || "");
    setContent(n.content || "");
    setWorkId(n.workId || n.work || "");
    isDirtyRef.current = false;
  };

  /* ── Yeni not ── */
  async function newNote() {
    try {
      const res = await apiPost("/notes", { title: "Yeni Not", content: "" });
      setNotes(prev => [res.item, ...prev]);
      openNote(res.item);
    } catch { alert("Not oluşturulamadı."); }
  }

  /* ── Kaydet ── */
  const flushSave = useCallback(async () => {
    const id = sel?._id;
    if (!id) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    setSaving(true);
    try {
      const res = await apiPatch(`/notes/${id}`, {
        title,
        content,
        ...(workId ? { workId } : { workId: null }),
      });
      setNotes(prev => prev.map(x => x._id === res.item._id ? res.item : x));
      setSel(res.item);
      setSaveMsg("Kaydedildi ✓");
      setTimeout(() => setSaveMsg(""), 2000);
      isDirtyRef.current = false;
    } catch { setSaveMsg("Kaydedilemedi."); setTimeout(() => setSaveMsg(""), 2000); }
    finally { setSaving(false); }
  }, [sel, title, content, workId]);

  /* ── Otosave (debounce 1.4s) ── */
  const markDirty = () => { isDirtyRef.current = true; };

  useEffect(() => {
    if (!sel?._id) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(flushSave, 1400);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [title, content, workId]); // eslint-disable-line

  /* ── Sil ── */
  async function deleteNote(id) {
    if (!window.confirm("Bu notu silmek istediğine emin misin?")) return;
    try {
      await apiDelete(`/notes/${id}`);
      setNotes(prev => prev.filter(n => n._id !== id));
      if (sel?._id === id) { setSel(null); setTitle(""); setContent(""); setWorkId(""); }
    } catch { alert("Silme işlemi başarısız."); }
  }

  /* ── Filtrelenmiş liste ── */
  const filtered = useMemo(() => {
    let list = notes;
    if (filter === FILTERS.FREE)   list = list.filter(n => !n.workId && !n.work);
    if (filter === FILTERS.LINKED) list = list.filter(n =>  n.workId ||  n.work);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(n =>
        (n.title || "").toLowerCase().includes(q) ||
        (n.content || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [notes, filter, query]);

  /* ── Seçili nota bağlı eser adı ── */
  const linkedWorkName = useMemo(() => {
    if (!workId) return null;
    const w = works.find(w => (w.id || w._id) === workId);
    return w?.title || null;
  }, [workId, works]);

  return (
    <div className="np-layout">
      {/* ── Sol Panel ── */}
      <aside className="np-sidebar">
        <div className="np-sidebar-head">
          <div className="np-logo-row">
            <span className="np-logo-icon">𝒩</span>
            <h2 className="np-sidebar-title">Notlarım</h2>
          </div>
          <button className="np-btn-new" onClick={newNote} title="Yeni not">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Arama */}
        <div className="np-search-wrap">
          <svg className="np-search-icon" width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M8.5 8.5L11.5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            className="np-search"
            placeholder="Notlarda ara…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="np-search-clear" onClick={() => setQuery("")}>✕</button>
          )}
        </div>

        {/* Filtreler */}
        <div className="np-filters">
          {[
            { key: FILTERS.ALL,    label: "Tümü" },
            { key: FILTERS.FREE,   label: "Serbest" },
            { key: FILTERS.LINKED, label: "Esere Bağlı" },
          ].map(f => (
            <button
              key={f.key}
              className={`np-filter-btn ${filter === f.key ? "active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Not listesi */}
        <div className="np-list">
          {filtered.length === 0 && (
            <div className="np-empty-list">
              {query ? "Sonuç bulunamadı." : "Henüz not yok."}
            </div>
          )}
          {filtered.map(n => {
            const linkedWork = works.find(w => (w.id || w._id) === (n.workId || n.work));
            return (
              <div
                key={n._id}
                className={`np-item ${sel?._id === n._id ? "active" : ""}`}
                onClick={() => openNote(n)}
              >
                <div className="np-item-body">
                  <span className="np-item-title">{n.title || "Başlıksız"}</span>
                  {linkedWork && (
                    <span className="np-item-work-tag">📖 {linkedWork.title}</span>
                  )}
                  <span className="np-item-excerpt">
                    {(n.content || "").slice(0, 55) || "—"}
                  </span>
                </div>
                <div className="np-item-meta">
                  <span className="np-item-date">{formatDate(n.updatedAt || n.createdAt)}</span>
                  <button
                    className="np-btn-del"
                    onClick={e => { e.stopPropagation(); deleteNote(n._id); }}
                    title="Sil"
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Editör ── */}
      <main className="np-editor">
        {sel ? (
          <div className="np-editor-inner">
            {/* Üst bar */}
            <div className="np-editor-topbar">
              <div className="np-save-status">
                {saving  && <span className="status-saving">kaydediliyor…</span>}
                {!saving && saveMsg && <span className="status-saved">{saveMsg}</span>}
              </div>

              <VoiceInputButton
                onResult={(t) => {
                  setContent(c => c ? `${c} ${t}` : t);
                  markDirty();
                }}
              />

              {/* Esere bağla */}
              <div className="np-link-wrap">
                <label className="np-link-label">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M4 5.5h3M5.5 1v1M5.5 9v1M1 5.5h1M9 5.5h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    <circle cx="5.5" cy="5.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
                  </svg>
                  Esere bağla
                </label>
                <select
                  className="np-work-select"
                  value={workId}
                  onChange={e => { setWorkId(e.target.value); markDirty(); }}
                >
                  <option value="">— Serbest not —</option>
                  {works.map(w => (
                    <option key={w.id || w._id} value={w.id || w._id}>
                      {w.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Başlık */}
            <input
              className="np-title-input"
              value={title}
              onChange={e => { setTitle(e.target.value); markDirty(); }}
              placeholder="Not başlığı…"
            />

            {/* Eser etiketi (varsa) */}
            {linkedWorkName && (
              <div className="np-linked-tag">
                <span>📖 {linkedWorkName}</span>
                <button onClick={() => { setWorkId(""); markDirty(); }}>✕</button>
              </div>
            )}

            {/* İçerik */}
            <textarea
              className="np-content-input"
              value={content}
              onChange={e => { setContent(e.target.value); markDirty(); }}
              placeholder="Fikirlerini buraya dök…"
            />
          </div>
        ) : (
          <div className="np-empty-state">
            <div className="np-empty-ornament">𝒩</div>
            <p className="np-empty-title">Karalama Defteri</p>
            <p className="np-empty-sub">
              Soldan bir not seç ya da yeni bir tane oluştur.<br />
              Notlar bir esere bağlanabilir ya da serbest kalabilir.
            </p>
            <button className="np-btn-empty-new" onClick={newNote}>
              + Yeni Not
            </button>
          </div>
        )}
      </main>
    </div>
  );
}