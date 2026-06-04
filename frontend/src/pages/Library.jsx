import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import Footer from "../components/Footer";
import { apiGet, apiPost, apiDelete } from "../lib/api";

const PLACEHOLDER = "https://via.placeholder.com/200x300?text=Kapak+Yok";

function getCurrentUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* ─── Listeye Ekle Dropdown ─── */
function AddToListDropdown({ workId, onClose, anchorRef }) {
  const [lists,    setLists]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [adding,   setAdding]   = useState(null); // listId
  const [added,    setAdded]    = useState({});   // { listId: true }
  const [msg,      setMsg]      = useState(null);
  const dropRef = useRef(null);

  // Dışarı tıklayınca kapat
  useEffect(() => {
    function handleClick(e) {
      if (
        dropRef.current && !dropRef.current.contains(e.target) &&
        anchorRef.current && !anchorRef.current.contains(e.target)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose, anchorRef]);

  // Listeleri yükle
  useEffect(() => {
    apiGet("/reading-lists")
      .then(res => {
        const items = res.items || [];
        setLists(items);
        // Hangi listelerde bu eser zaten var?
        const alreadyIn = {};
        items.forEach(l => {
          if (l.works?.some(w => (w.work?._id || w.work) === workId)) {
            alreadyIn[l._id] = true;
          }
        });
        setAdded(alreadyIn);
      })
      .catch(() => setLists([]))
      .finally(() => setLoading(false));
  }, [workId]);

  async function handleAdd(listId) {
    if (adding || added[listId]) return;
    setAdding(listId);
    setMsg(null);
    try {
      await apiPost(`/reading-lists/${listId}/works`, { workId });
      setAdded(prev => ({ ...prev, [listId]: true }));
      setMsg({ ok: true, text: "Eklendi ✓" });
    } catch (e) {
      setMsg({ ok: false, text: e.message || "Eklenemedi." });
    } finally {
      setAdding(null);
      setTimeout(() => setMsg(null), 2000);
    }
  }

  return (
    <div ref={dropRef} className="lib-list-dropdown" onClick={e => e.stopPropagation()}>
      <p className="lib-list-dropdown-title">Okuma Listesine Ekle</p>

      {loading ? (
        <p className="lib-list-dropdown-empty">Yükleniyor…</p>
      ) : lists.length === 0 ? (
        <p className="lib-list-dropdown-empty">
          Henüz liste yok.{" "}
          <a href="/profile?tab=lists" className="lib-list-dropdown-link">Liste oluştur →</a>
        </p>
      ) : (
        <ul className="lib-list-dropdown-ul">
          {lists.map(l => {
            const isAdded = !!added[l._id];
            const isAdding = adding === l._id;
            return (
              <li key={l._id}>
                <button
                  className={`lib-list-dropdown-item ${isAdded ? "lib-list-dropdown-item--added" : ""}`}
                  onClick={() => handleAdd(l._id)}
                  disabled={isAdded || !!adding}
                >
                  <span className="lib-list-dropdown-icon">
                    {isAdded ? "✓" : isAdding ? "…" : "＋"}
                  </span>
                  <span className="lib-list-dropdown-name">{l.name}</span>
                  <span className="lib-list-dropdown-count">{l.works?.length ?? 0}</span>
                  {l.isPrivate && <span className="lib-list-dropdown-lock">🔒</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {msg && (
        <p className={`lib-list-dropdown-msg ${msg.ok ? "lib-list-dropdown-msg--ok" : "lib-list-dropdown-msg--err"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

/* ─── Kart ─── */
function LibCard({ w, onRemove, removingId }) {
  const navigate   = useNavigate();
  const [showDrop, setShowDrop] = useState(false);
  const btnRef = useRef(null);

  return (
    <div
      className="lib-card"
      onClick={() => navigate(`/story/${w._id}`)}
    >
      {/* Kaldır */}
      <button
        className="lib-card-remove"
        title="Kütüphaneden çıkar"
        disabled={removingId === String(w._id)}
        onClick={e => { e.stopPropagation(); onRemove(w._id); }}
      >
        {removingId === String(w._id) ? "…" : "✕"}
      </button>

      {/* Listeye Ekle */}
      <div className="lib-card-list-wrap" onClick={e => e.stopPropagation()}>
        <button
          ref={btnRef}
          className="lib-card-list-btn"
          title="Okuma listesine ekle"
          onClick={() => setShowDrop(d => !d)}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
        </button>

        {showDrop && (
          <AddToListDropdown
            workId={String(w._id)}
            onClose={() => setShowDrop(false)}
            anchorRef={btnRef}
          />
        )}
      </div>

      {/* Kapak */}
      <div className="lib-card-cover-wrap">
        <img
          className="lib-card-cover"
          src={w.coverImage || PLACEHOLDER}
          alt={w.title}
          loading="lazy"
          onError={e => { e.target.src = PLACEHOLDER; }}
        />
        <div className="lib-card-overlay">
          <button  className="lib-card-read-btn" onClick={(e) => {
              e.stopPropagation(); // 
              navigate(`/read/${w._id}`); // ReadPage rotanızı buraya yazın
            }}>Okumaya Devam Et</button>
        </div>
      </div>

      {/* Bilgiler */}
      <div className="lib-card-body">
        <div className="lib-card-title">{w.title}</div>
        <div className="lib-card-author">
          {w.author?.kullaniciAdi || w.author?.username || "Bilinmeyen Yazar"}
        </div>
        <div className="lib-card-meta">{w.chapterCount ?? 0} bölüm</div>
      </div>
    </div>
  );
}

/* ─── Ana Sayfa ─── */
export default function LibraryPage() {
  const navigate    = useNavigate();
  const token       = localStorage.getItem("token");
  const currentUser = getCurrentUser();

  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [removingId, setRemovingId] = useState(null);
  const [search,     setSearch]     = useState("");

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    setLoading(true);
    apiGet("/library")
      .then(res => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [token]);

  const handleRemove = async (workId) => {
    if (removingId) return;
    setRemovingId(workId);
    try {
      await apiDelete(`/library/${workId}`);
      setItems(prev => prev.filter(w => String(w._id) !== String(workId)));
    } catch (e) {
      console.error(e);
    } finally {
      setRemovingId(null);
    }
  };

  const filtered = items.filter(w =>
    w.title?.toLowerCase().includes(search.toLowerCase()) ||
    w.author?.username?.toLowerCase().includes(search.toLowerCase()) ||
    w.author?.kullaniciAdi?.toLowerCase().includes(search.toLowerCase())
  );

  const displayName = currentUser?.kullaniciAdi || currentUser?.username;

  return (
    <div className="lib-root">
      <TopBar />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=IM+Fell+English+SC&display=swap');

        :root {
          --ink:       #1a1209;
          --ink-light: #3d2f1a;
          --parchment: #f5f0e8;
          --parchment-dark: #ede6d4;
          --border:    #c9b98a;
          --accent:    #8b3a1c;
          --muted:     #7a6a50;
          --card-bg:   #faf7f1;
          --shadow:    0 2px 12px rgba(26,18,9,0.10);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .lib-root {
          min-height: 100vh;
          background: var(--parchment);
          font-family: 'Crimson Pro', Georgia, serif;
          color: var(--ink);
        }

        /* HEADER */
        .lib-header {
          background: var(--ink);
          padding: 48px 24px 36px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .lib-header::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 24px,
            rgba(255,255,255,0.03) 24px, rgba(255,255,255,0.03) 25px
          );
          pointer-events: none;
        }
        .lib-header-title {
          font-family: 'IM Fell English SC', serif;
          font-size: clamp(2rem, 5vw, 3.2rem);
          color: var(--parchment);
          letter-spacing: 0.04em;
          position: relative;
        }
        .lib-header-sub {
          margin-top: 8px;
          color: var(--border);
          font-size: 1.05rem;
          font-style: italic;
          position: relative;
        }
        .lib-header-ornament {
          display: block;
          margin: 16px auto 0;
          width: 80px;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--border), transparent);
          position: relative;
        }

        /* TOOLBAR */
        .lib-toolbar {
          max-width: 1100px;
          margin: 28px auto 0;
          padding: 0 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .lib-search {
          flex: 1;
          min-width: 200px;
          padding: 10px 16px;
          border: 1px solid var(--border);
          border-radius: 3px;
          background: var(--card-bg);
          font-family: 'Crimson Pro', serif;
          font-size: 1rem;
          color: var(--ink);
          outline: none;
          transition: border-color .2s;
        }
        .lib-search:focus { border-color: var(--accent); }
        .lib-count {
          font-size: 0.95rem;
          color: var(--muted);
          font-style: italic;
          white-space: nowrap;
        }

        /* STATES */
        .lib-loading, .lib-empty {
          text-align: center;
          padding: 80px 24px;
          color: var(--muted);
          font-size: 1.15rem;
          font-style: italic;
        }
        .lib-empty-icon { font-size: 3rem; display: block; margin-bottom: 16px; opacity: 0.4; }
        .lib-empty a { color: var(--accent); cursor: pointer; text-decoration: underline; }

        /* GRID */
        .lib-grid {
          max-width: 1100px;
          margin: 28px auto 60px;
          padding: 0 24px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 28px;
        }

        /* CARD */
        .lib-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 4px;
          overflow: visible;
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: transform .2s, box-shadow .2s;
          position: relative;
        }
        .lib-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(26,18,9,0.16);
        }

        .lib-card-cover-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 2/3;
          overflow: hidden;
          background: var(--parchment-dark);
          border-radius: 4px 4px 0 0;
        }
        .lib-card-cover {
          width: 100%; height: 100%;
          object-fit: cover; display: block;
          transition: transform .3s;
        }
        .lib-card:hover .lib-card-cover { transform: scale(1.04); }

        .lib-card-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(26,18,9,0.7) 0%, transparent 55%);
          opacity: 0; transition: opacity .2s;
          display: flex; align-items: flex-end; padding: 12px;
        }
        .lib-card:hover .lib-card-overlay { opacity: 1; }
        .lib-card-read-btn {
          width: 100%; padding: 7px 0;
          background: var(--accent); color: #fff;
          border: none; border-radius: 2px;
          font-family: 'Crimson Pro', serif;
          font-size: 0.95rem; font-weight: 600;
          cursor: pointer; letter-spacing: 0.04em;
        }

        .lib-card-body {
          padding: 12px 14px 14px;
          flex: 1; display: flex; flex-direction: column; gap: 4px;
        }
        .lib-card-title {
          font-size: 1.05rem; font-weight: 600;
          line-height: 1.3; color: var(--ink);
          display: -webkit-box;
          -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .lib-card-author { font-size: 0.88rem; color: var(--muted); font-style: italic; }
        .lib-card-meta { margin-top: 6px; font-size: 0.82rem; color: var(--muted); }

        /* REMOVE BTN */
        .lib-card-remove {
          position: absolute; top: 8px; right: 8px;
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(26,18,9,0.65); border: none;
          color: #fff; font-size: 14px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity .2s, background .2s; z-index: 3;
        }
        .lib-card:hover .lib-card-remove { opacity: 1; }
        .lib-card-remove:hover { background: var(--accent); }
        .lib-card-remove:disabled { opacity: 0.4; cursor: not-allowed; }

        /* LİSTEYE EKLE BUTONU */
        .lib-card-list-wrap {
          position: absolute; top: 8px; left: 8px;
          z-index: 10;
        }
        .lib-card-list-btn {
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(26,18,9,0.65); border: none;
          color: #fff; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity .2s, background .2s;
        }
        .lib-card:hover .lib-card-list-btn { opacity: 1; }
        .lib-card-list-btn:hover { background: #4a7c59; }

        /* DROPDOWN */
        .lib-list-dropdown {
          position: absolute;
          top: 36px; left: 0;
          width: 230px;
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 6px;
          box-shadow: 0 8px 28px rgba(26,18,9,0.18);
          z-index: 100;
          overflow: hidden;
        }
        .lib-list-dropdown-title {
          padding: 10px 14px 8px;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid var(--border);
          font-family: 'Crimson Pro', serif;
        }
        .lib-list-dropdown-empty {
          padding: 12px 14px;
          font-size: 0.88rem;
          color: var(--muted);
          font-style: italic;
          font-family: 'Crimson Pro', serif;
        }
        .lib-list-dropdown-link {
          color: var(--accent);
          text-decoration: underline;
          cursor: pointer;
          font-style: normal;
        }
        .lib-list-dropdown-ul {
          list-style: none;
          padding: 4px 0;
          max-height: 200px;
          overflow-y: auto;
        }
        .lib-list-dropdown-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'Crimson Pro', serif;
          font-size: 0.93rem;
          color: var(--ink-light);
          text-align: left;
          transition: background .12s;
        }
        .lib-list-dropdown-item:hover:not(:disabled) { background: var(--parchment-dark); }
        .lib-list-dropdown-item:disabled { cursor: default; }
        .lib-list-dropdown-item--added { color: var(--muted); }
        .lib-list-dropdown-icon {
          font-size: 0.85rem;
          width: 16px;
          text-align: center;
          flex-shrink: 0;
          color: var(--accent);
        }
        .lib-list-dropdown-item--added .lib-list-dropdown-icon { color: #4a7c59; }
        .lib-list-dropdown-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lib-list-dropdown-count {
          font-size: 0.78rem;
          color: var(--muted);
          flex-shrink: 0;
        }
        .lib-list-dropdown-lock { font-size: 0.72rem; flex-shrink: 0; }
        .lib-list-dropdown-msg {
          padding: 6px 14px 8px;
          font-size: 0.82rem;
          font-family: 'Crimson Pro', serif;
          border-top: 1px solid var(--border);
        }
        .lib-list-dropdown-msg--ok { color: #4a7c59; }
        .lib-list-dropdown-msg--err { color: var(--accent); }
      `}</style>

      {/* Header */}
      <header className="lib-header">
        <h1 className="lib-header-title">📚 Kütüphanem</h1>
        <p className="lib-header-sub">
          {displayName
            ? `${displayName} adlı okurun koleksiyonu`
            : "Kaydettiğin eserlerin koleksiyonu"}
        </p>
        <span className="lib-header-ornament" />
      </header>

      {/* Toolbar */}
      {!loading && items.length > 0 && (
        <div className="lib-toolbar">
          <input
            className="lib-search"
            type="text"
            placeholder="Eser veya yazar ara…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <span className="lib-count">{filtered.length} / {items.length} eser</span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <p className="lib-loading">Kütüphane yükleniyor…</p>
      ) : items.length === 0 ? (
        <div className="lib-empty">
          <span className="lib-empty-icon">📖</span>
          Kütüphanende henüz hiç eser yok.{" "}
          <a onClick={() => navigate("/")}>Keşfetmeye başla →</a>
        </div>
      ) : filtered.length === 0 ? (
        <div className="lib-empty">
          <span className="lib-empty-icon">🔍</span>
          Aramanla eşleşen eser bulunamadı.
        </div>
      ) : (
        <div className="lib-grid">
          {filtered.map(w => (
            <LibCard
              key={w._id}
              w={w}
              onRemove={handleRemove}
              removingId={removingId}
            />
          ))}
        </div>
      )}

      <Footer />
    </div>
  );
}