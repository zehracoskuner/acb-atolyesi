/* ════════════════════════════════════════════════════════
   AddFromLibraryModal.jsx
   Kullanım:
     <AddFromLibraryModal
       listId="..."
       listName="Okumak İstediklerim"
       alreadyIn={["workId1", "workId2"]}   // zaten listede olanlar
       onAdd={(workId, workObj) => ...}      // ekleme sonrası callback — workObj artık geçiliyor
       onClose={() => ...}
     />
════════════════════════════════════════════════════════ */

import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost } from "../lib/api";

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='80' viewBox='0 0 60 80'%3E%3Crect width='60' height='80' fill='%23e8e3d8'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23a09070' font-size='10'%3E📖%3C/text%3E%3C/svg%3E";

export default function AddFromLibraryModal({ listId, listName, alreadyIn = [], onAdd, onClose }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [adding,  setAdding]  = useState(null);   // workId
  const [added,   setAdded]   = useState(() => {  // local eklenenler seti
    const s = new Set();
    alreadyIn.forEach(id => s.add(String(id)));
    return s;
  });
  const [msg, setMsg] = useState(null);

  // Kütüphaneyi yükle
  useEffect(() => {
    apiGet("/library")
      .then(res => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(w => {
    const q = search.toLowerCase();
    return (
      w.title?.toLowerCase().includes(q) ||
      w.author?.kullaniciAdi?.toLowerCase().includes(q) ||
      w.author?.username?.toLowerCase().includes(q)
    );
  });

  const handleAdd = useCallback(async (workId) => {
    if (adding || added.has(String(workId))) return;
    setAdding(workId);
    setMsg(null);

    // Eser objesini şimdiden bul (backend çağrısı öncesi)
    const workObj = items.find(w => String(w._id) === String(workId)) || null;

    try {
      await apiPost(`/reading-lists/${listId}/works`, { workId });
      setAdded(prev => new Set([...prev, String(workId)]));
      // FIX: workObj'i de callback'e geçir — ProfilePage optimistic update yapabilsin
      onAdd?.(workId, workObj);
      setMsg({ ok: true, text: "Listeye eklendi ✓" });
    } catch (e) {
      setMsg({ ok: false, text: e.message || "Eklenemedi." });
    } finally {
      setAdding(null);
      setTimeout(() => setMsg(null), 2500);
    }
  }, [adding, added, listId, items, onAdd]);

  // Escape ile kapat
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="alm-overlay" onClick={onClose}>
      <div className="alm-modal" onClick={e => e.stopPropagation()}>

        {/* Başlık */}
        <div className="alm-header">
          <div>
            <h3 className="alm-title">Kütüphaneden Ekle</h3>
            <p className="alm-subtitle">
              <span className="alm-list-badge">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                {listName}
              </span>
              listesine eser ekle
            </p>
          </div>
          <button className="alm-close" onClick={onClose} aria-label="Kapat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Arama */}
        <div className="alm-search-wrap">
          <svg className="alm-search-icon" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="alm-search"
            type="text"
            placeholder="Eser veya yazar ara…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button className="alm-search-clear" onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        {/* Mesaj bandı */}
        {msg && (
          <div className={`alm-msg ${msg.ok ? "alm-msg--ok" : "alm-msg--err"}`}>
            {msg.text}
          </div>
        )}

        {/* Liste */}
        <div className="alm-list">
          {loading ? (
            <div className="alm-state">
              <div className="alm-spinner" />
              <span>Kütüphane yükleniyor…</span>
            </div>
          ) : items.length === 0 ? (
            <div className="alm-state">
              <span className="alm-state-icon">📖</span>
              <p>Kütüphanende henüz eser yok.</p>
              <a href="/" className="alm-state-link">Keşfetmeye başla →</a>
            </div>
          ) : filtered.length === 0 ? (
            <div className="alm-state">
              <span className="alm-state-icon">🔍</span>
              <p>Aramanla eşleşen eser bulunamadı.</p>
            </div>
          ) : (
            filtered.map(w => {
              const wId      = String(w._id);
              const isAdded  = added.has(wId);
              const isAdding = adding === wId;
              const authorName = w.author?.kullaniciAdi || w.author?.username || "Bilinmeyen";

              return (
                <div key={wId} className={`alm-item ${isAdded ? "alm-item--added" : ""}`}>
                  {/* Kapak */}
                  <div className="alm-item-cover">
                    <img
                      src={w.coverImage || PLACEHOLDER}
                      alt={w.title}
                      onError={e => { e.target.src = PLACEHOLDER; }}
                    />
                  </div>

                  {/* Bilgi */}
                  <div className="alm-item-info">
                    <p className="alm-item-title">{w.title}</p>
                    <p className="alm-item-author">{authorName}</p>
                    <p className="alm-item-meta">{w.chapterCount ?? 0} bölüm</p>
                  </div>

                  {/* Ekle butonu */}
                  <button
                    className={`alm-add-btn ${isAdded ? "alm-add-btn--done" : ""}`}
                    onClick={() => handleAdd(wId)}
                    disabled={isAdded || !!adding}
                    title={isAdded ? "Zaten listede" : "Listeye ekle"}
                  >
                    {isAdding ? (
                      <span className="alm-btn-spinner" />
                    ) : isAdded ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Eklendi
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Ekle
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Alt bilgi */}
        {!loading && items.length > 0 && (
          <div className="alm-footer">
            {filtered.length} eser · {added.size - alreadyIn.length > 0
              ? `${added.size - alreadyIn.length} yeni eklendi`
              : "Eklemek için bir esere tıkla"}
          </div>
        )}
      </div>

      <style>{`
        .alm-overlay {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(26, 18, 9, 0.55);
          backdrop-filter: blur(3px);
          display: flex; align-items: center; justify-content: center;
          padding: 1rem;
          animation: almFadeIn .15s ease;
        }
        @keyframes almFadeIn { from { opacity: 0 } to { opacity: 1 } }

        .alm-modal {
          background: var(--bg, #faf7f2);
          border: 1px solid var(--border, #d4c9a8);
          border-radius: 14px;
          box-shadow: 0 20px 60px rgba(26,18,9,0.22);
          width: 100%; max-width: 520px;
          max-height: 85vh;
          display: flex; flex-direction: column;
          overflow: hidden;
          animation: almSlideUp .18s ease;
        }
        @keyframes almSlideUp {
          from { transform: translateY(16px); opacity: 0 }
          to   { transform: translateY(0);    opacity: 1 }
        }

        /* HEADER */
        .alm-header {
          display: flex; align-items: flex-start;
          justify-content: space-between;
          padding: 1.1rem 1.25rem 0.85rem;
          border-bottom: 1px solid var(--border, #d4c9a8);
          flex-shrink: 0;
        }
        .alm-title {
          font-family: 'Cormorant Garamond', 'Cormorant', Georgia, serif;
          font-size: 1.15rem; font-weight: 700;
          color: var(--ink, #1a1209);
          margin: 0 0 0.25rem;
        }
        .alm-subtitle {
          font-family: 'DM Sans', sans-serif;
          font-size: 0.8rem; color: var(--ink-3, #7a6a50);
          display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
        }
        .alm-list-badge {
          display: inline-flex; align-items: center; gap: 0.3rem;
          background: color-mix(in srgb, var(--accent, #8b3a1c) 10%, transparent);
          color: var(--accent, #8b3a1c);
          padding: 0.18rem 0.55rem;
          border-radius: 20px;
          font-weight: 600; font-size: 0.78rem;
        }
        .alm-close {
          width: 30px; height: 30px; border-radius: 50%;
          border: 1px solid var(--border, #d4c9a8);
          background: transparent;
          color: var(--ink-3, #7a6a50);
          cursor: pointer; display: flex;
          align-items: center; justify-content: center;
          transition: all .15s; flex-shrink: 0; margin-top: 2px;
        }
        .alm-close:hover { background: var(--bg-2, #f0ead8); color: var(--ink, #1a1209); }

        /* ARAMA */
        .alm-search-wrap {
          position: relative; padding: 0.75rem 1.25rem;
          border-bottom: 1px solid var(--border, #d4c9a8);
          flex-shrink: 0;
        }
        .alm-search-icon {
          position: absolute; left: 1.9rem; top: 50%;
          transform: translateY(-50%);
          color: var(--ink-4, #a09070); pointer-events: none;
        }
        .alm-search {
          width: 100%; padding: 0.55rem 2.2rem 0.55rem 2.2rem;
          border: 1.5px solid var(--border, #d4c9a8);
          border-radius: 8px;
          background: var(--bg, #faf7f2);
          font-family: 'DM Sans', sans-serif;
          font-size: 0.88rem; color: var(--ink, #1a1209);
          outline: none; transition: border-color .15s;
        }
        .alm-search:focus { border-color: var(--accent, #8b3a1c); }
        .alm-search-clear {
          position: absolute; right: 1.9rem; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          color: var(--ink-4, #a09070); cursor: pointer;
          font-size: 0.8rem; line-height: 1;
          padding: 2px 4px; border-radius: 3px;
        }
        .alm-search-clear:hover { color: var(--ink, #1a1209); }

        /* MESAJ BANDI */
        .alm-msg {
          padding: 0.45rem 1.25rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.82rem; font-weight: 500;
          flex-shrink: 0;
        }
        .alm-msg--ok  { background: #f0faf3; color: #2d7a4a; }
        .alm-msg--err { background: #fef2f2; color: #c0392b; }

        /* LİSTE */
        .alm-list {
          flex: 1; overflow-y: auto; padding: 0.4rem 0;
        }
        .alm-list::-webkit-scrollbar { width: 5px; }
        .alm-list::-webkit-scrollbar-track { background: transparent; }
        .alm-list::-webkit-scrollbar-thumb {
          background: var(--border, #d4c9a8); border-radius: 3px;
        }

        /* STATE (boş/yükleniyor) */
        .alm-state {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 0.5rem; padding: 2.5rem 1rem;
          text-align: center;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.88rem; color: var(--ink-3, #7a6a50);
        }
        .alm-state-icon { font-size: 2rem; opacity: 0.5; }
        .alm-state-link {
          color: var(--accent, #8b3a1c);
          font-size: 0.83rem; text-decoration: underline;
        }
        .alm-spinner {
          width: 22px; height: 22px; border-radius: 50%;
          border: 2px solid var(--border, #d4c9a8);
          border-top-color: var(--accent, #8b3a1c);
          animation: almSpin .7s linear infinite;
        }
        @keyframes almSpin { to { transform: rotate(360deg) } }

        /* ESER SATIRI */
        .alm-item {
          display: flex; align-items: center; gap: 0.9rem;
          padding: 0.6rem 1.25rem;
          transition: background .12s;
        }
        .alm-item:hover { background: var(--bg-2, #f0ead8); }
        .alm-item--added { opacity: 0.65; }

        .alm-item-cover {
          width: 38px; height: 52px;
          border-radius: 4px; overflow: hidden; flex-shrink: 0;
          background: var(--bg-2, #e8e3d8);
          border: 1px solid var(--border, #d4c9a8);
        }
        .alm-item-cover img {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }

        .alm-item-info { flex: 1; min-width: 0; }
        .alm-item-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 0.88rem; font-weight: 600;
          color: var(--ink, #1a1209);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-bottom: 0.1rem;
        }
        .alm-item-author {
          font-family: 'DM Sans', sans-serif;
          font-size: 0.78rem; color: var(--ink-3, #7a6a50);
          font-style: italic;
        }
        .alm-item-meta {
          font-family: 'DM Sans', sans-serif;
          font-size: 0.74rem; color: var(--ink-4, #a09070);
          margin-top: 0.1rem;
        }

        /* EKLE BUTONU */
        .alm-add-btn {
          display: flex; align-items: center; gap: 0.3rem;
          padding: 0.38rem 0.85rem;
          border-radius: 20px; border: 1.5px solid var(--accent, #8b3a1c);
          background: transparent; color: var(--accent, #8b3a1c);
          font-family: 'DM Sans', sans-serif;
          font-size: 0.78rem; font-weight: 600;
          cursor: pointer; flex-shrink: 0;
          transition: all .15s; white-space: nowrap;
        }
        .alm-add-btn:hover:not(:disabled) {
          background: var(--accent, #8b3a1c); color: #fff;
        }
        .alm-add-btn:disabled { cursor: default; }
        .alm-add-btn--done {
          border-color: #4a7c59; color: #4a7c59;
          background: #f0faf3;
        }
        .alm-btn-spinner {
          width: 11px; height: 11px; border-radius: 50%;
          border: 1.5px solid currentColor;
          border-top-color: transparent;
          animation: almSpin .6s linear infinite;
          display: inline-block;
        }

        /* ALT BİLGİ */
        .alm-footer {
          padding: 0.6rem 1.25rem;
          border-top: 1px solid var(--border, #d4c9a8);
          font-family: 'DM Sans', sans-serif;
          font-size: 0.78rem; color: var(--ink-4, #a09070);
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}