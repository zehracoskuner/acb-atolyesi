import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiDelete } from "../lib/api";
import "../styles/WorkNotes.css";

// Basit ikonlar (SVG)
const IconMenu = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const IconPlus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconTrash = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const IconClose = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconEmpty = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export default function WorkNotesPage() {
  const { workId } = useParams();
  const navigate = useNavigate();

  const [works, setWorks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);

  // drawer & edit
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [draft, setDraft] = useState("");
  const [saveState, setSaveState] = useState("idle"); // idle | dirty | saving | saved | error
  const saveTimerRef = useRef(null);

  const getId = (x) => x?._id || x?.id;

  const normalizeNote = (n) => ({
    ...n,
    _id: getId(n),
    content: n?.content ?? n?.body ?? "",
    createdAt: n?.createdAt ?? null,
    updatedAt: n?.updatedAt ?? null,
  });

  const activeNote = useMemo(
    () => notes.find((n) => String(getId(n)) === String(activeNoteId)) || null,
    [notes, activeNoteId]
  );

  const currentWork = useMemo(() => {
    const id = String(workId || "");
    return works.find((w) => String(getId(w)) === id) || null;
  }, [works, workId]);

  // --- Fetch Works ---
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiGet(`/works`);
        if (!alive) return;
        setWorks(res.items || []);
      } catch (e) {
        console.error("Works load error:", e);
        if (!alive) return;
        setWorks([]);
      }
    })();
    return () => (alive = false);
  }, []);

  // --- Fetch Notes ---
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiGet(`/works/${workId}/notes`);
        if (!alive) return;
        setNotes((res.items || []).map(normalizeNote));
      } catch (e) {
        console.error("Notes load error:", e);
        if (!alive) return;
        setNotes([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => (alive = false);
  }, [workId]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("tr-TR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // --- Open/Close Drawer ---
  const openNote = (note) => {
    const id = getId(note);
    if (!id) return;
    setActiveNoteId(id);
    setDraft(note?.content ?? note?.body ?? "");
    setSaveState("idle");
  };

  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    // dirty ise hemen kaydet
    if (activeNoteId && saveState === "dirty") {
      // draft boş bile olsa kaydedebilirsin; istemiyorsan trim + kontrol ekle
      void saveNow(activeNoteId, draft);
    }
  }, [activeNoteId, saveState, draft]);

  const closeNote = useCallback(() => {
    flushPendingSave();
    setActiveNoteId(null);
    setDraft("");
    setSaveState("idle");
  }, [flushPendingSave]);

  // --- Add ---
  const handleAddNote = async (e) => {
    e.preventDefault();
    const text = newNote.trim();
    if (!text) return;

    try {
      const res = await apiPost(`/works/${workId}/notes`, { content: text, body: text });
      const item = normalizeNote(res.item);
      setNotes((prev) => [item, ...prev]);
      setNewNote("");
      openNote(item);
    } catch (err) {
      console.error(err);
      alert("Not eklenemedi.");
    }
  };

  // --- Delete ---
  const handleDeleteNote = async (noteId, e) => {
    if (e) e.stopPropagation();
    if (!noteId) return;
    if (!window.confirm("Bu notu kalıcı olarak silmek istiyor musun?")) return;

    try {
      await apiDelete(`/works/${workId}/notes/${noteId}`);
      setNotes((prev) => prev.filter((n) => String(getId(n)) !== String(noteId)));
      if (String(activeNoteId) === String(noteId)) {
        setActiveNoteId(null);
        setDraft("");
        setSaveState("idle");
      }
    } catch (err) {
      console.error(err);
      alert("Silme işlemi başarısız.");
    }
  };

  // --- Save (autosave + manual) ---
  const saveNow = useCallback(
    async (noteId, text) => {
      if (!noteId) return;
      setSaveState("saving");

      // optimistic update (kart preview güncellensin)
      const optimisticUpdatedAt = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) =>
          String(getId(n)) === String(noteId)
            ? { ...n, content: text, body: text, updatedAt: optimisticUpdatedAt }
            : n
        )
      );

      try {
        const res = await apiPut(`/works/${workId}/notes/${noteId}`, { content: text, body: text });
        if (res?.item) {
          const normalized = normalizeNote(res.item);
          setNotes((prev) => prev.map((n) => (String(getId(n)) === String(noteId) ? normalized : n)));
        }
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1200);
      } catch (e) {
        console.error(e);
        setSaveState("error");
      }
    },
    [workId]
  );

  const onDraftChange = (v) => {
    setDraft(v);
    setSaveState("dirty");

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveNow(activeNoteId, v);
    }, 800);
  };

  // ESC close + Ctrl/Cmd+S save
  useEffect(() => {
    const onKeyDown = (e) => {
      const isOpen = !!activeNoteId;
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        closeNote();
      }

      const isSave = (e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S");
      if (isSave) {
        e.preventDefault();
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        void saveNow(activeNoteId, draft);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeNoteId, draft, closeNote, saveNow]);

  // cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // save status text
  const saveLabel = useMemo(() => {
    if (saveState === "saving") return "Kaydediliyor…";
    if (saveState === "saved") return "Kaydedildi";
    if (saveState === "dirty") return "Değişiklik var";
    if (saveState === "error") return "Kaydedilemedi";
    return "";
  }, [saveState]);

  return (
    <div className="work-layout">
      <main className="work-content">
        <header className="top-nav">
          <div className="nav-left">

            <div className="breadcrumbs">
              <span className="crumb-link" onClick={() => navigate(`/work/${workId}`)}>
                Proje
              </span>
              <span className="crumb-sep">/</span>
              <span className="crumb-current">Notlar</span>
            </div>
          </div>
        </header>

        <div className="content-container">
          <div className="page-header">
            <div>
              <h1 className="page-title">Notlar & Fikirler</h1>
              <p className="page-subtitle">
                {currentWork?.title ? (
                  <>
                    <span className="highlight">{currentWork.title}</span> projesi için aklındakileri dök.
                  </>
                ) : (
                  "İlham geldiğinde kaybetme, buraya not et."
                )}
              </p>
            </div>
          </div>

          {/* Quick Add */}
          <div className="quick-add">
            <form onSubmit={handleAddNote} className="add-form">
              <input
                type="text"
                placeholder="Hızlıca bir not al... (Enter ile ekle)"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="add-input"
              />
              <button type="submit" disabled={!newNote.trim()} className="add-btn">
                <IconPlus /> <span>Ekle</span>
              </button>
            </form>
          </div>

          {/* Notes Grid */}
          {loading ? (
            <div className="notes-masonry">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="skeleton-card" />
              ))}
            </div>
          ) : (
            <div className="notes-masonry">
              {notes.length === 0 ? (
                <div className="empty-state">
                  <IconEmpty />
                  <h3>Henüz not yok</h3>
                  <p>Aklına gelen ilk fikri yukarıya yazarak başla.</p>
                </div>
              ) : (
                notes.map((note) => (
                  <div key={getId(note)} className="note-card" onClick={() => openNote(note)} role="button" tabIndex={0}>
                    <div className="card-body">
                      <p className="card-text">{note.content}</p>
                    </div>
                    <div className="card-footer">
                      <span className="card-date">{formatDate(note.updatedAt || note.createdAt)}</span>
                      <button className="btn-icon-danger" onClick={(e) => handleDeleteNote(getId(note), e)} title="Notu sil" type="button">
                        <IconTrash />
                      </button>
                      {note.source === "sceneSpark" && <span className="tag tag-spark">Kıvılcım</span>}

                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Drawer */}
      <div className={`drawer-overlay ${activeNote ? "active" : ""}`} onClick={closeNote}>
        <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
          {activeNote && (
            <>
              <header className="drawer-header">
                {/* ✅ saveState class fix */}
                <div className={`save-status ${saveState}`}>
                  {saveLabel}
                </div>

                <button className="btn-close" onClick={closeNote} type="button" aria-label="Kapat">
                  <IconClose />
                </button>
              </header>

              <div className="drawer-content">
                <textarea
                  className="big-editor"
                  value={draft}
                  onChange={(e) => onDraftChange(e.target.value)}
                  placeholder="Notunu yazmaya başla..."
                  autoFocus
                />
              </div>

              <footer className="drawer-footer">
                <div className="meta-info">
                  {activeNote.updatedAt
                    ? `Son güncelleme: ${formatDate(activeNote.updatedAt)}`
                    : activeNote.createdAt
                    ? `Oluşturma: ${formatDate(activeNote.createdAt)}`
                    : ""}
                  {saveState === "dirty" ? " • Ctrl+S ile kaydet" : ""}
                </div>

                <button className="btn-text-danger" onClick={() => handleDeleteNote(activeNoteId)} type="button">
                  Bu notu sil
                </button>
              </footer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
