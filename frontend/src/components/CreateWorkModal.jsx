import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

// ─── Genre taxonomy ───────────────────────────────────────────────────────────
const GENRE_GROUPS = [
  {
    label: "Kurgu",
    genres: [
      "Fantastik",
      "Bilim Kurgu",
      "Distopya / Ütopya",
      "Tarihi Kurgu",
      "Mitolojik Kurgu",
      "Alternatif Tarih",
    ],
  },
  {
    label: "Gerilim & Gizem",
    genres: [
      "Polisiye",
      "Psikolojik Gerilim",
      "Suç Kurgu",
      "Korku & Karanlık",
      "Gotik",
      "Gizem",
    ],
  },
  {
    label: "Duygu & İnsan",
    genres: [
      "Romantizm",
      "Aile & Nesil",
      "Büyüme Romanı",
      "Trajedi",
      "Dram",
      "Mizah & Yergi",
    ],
  },
  {
    label: "Şiir & Deneme",
    genres: [
      "Lirik Şiir",
      "Epik Şiir",
      "Deneme",
      "Anı & Otobiyografi",
      "Günlük",
    ],
  },
  {
    label: "Macera & Dünya İnşası",
    genres: [
      "Macera",
      "Seyahat Yazını",
      "Destansı Fantezi",
      "Açık Dünya",
    ],
  },
];

// ─── Inline styles ────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  :root {
    /* Kırık beyaz yüzeyler */
    --bg:          #f5f2ed;
    --surface:     #faf8f4;
    --surface2:    #f0ece5;
    --surface3:    #e8e2d9;

    /* Kenarlıklar */
    --border:      rgba(60, 45, 30, 0.1);
    --border-hi:   rgba(60, 45, 30, 0.25);

    /* Yazı */
    --ink:         #1e1a16;
    --ink-dim:     #5c5046;
    --ink-ghost:   #a89a8a;

    /* Vurgu renkleri */
    --accent:      #c0392b;   /* soft kırmızı */
    --accent-glow: rgba(192, 57, 43, 0.08);
    --accent-hi:   rgba(192, 57, 43, 0.18);

    --green:       #4a7c59;   /* soft yeşil */
    --green-glow:  rgba(74, 124, 89, 0.1);

    --blue:        #3d6b8e;   /* soft mavi */
    --blue-glow:   rgba(61, 107, 142, 0.1);

    --gold:        #b8914a;   /* opsiyonel altın */
    --gold-glow:   rgba(184, 145, 74, 0.12);

    /* Hata */
    --red:         #b83232;
    --red-bg:      rgba(184, 50, 50, 0.07);

    --radius:     5px;
    --transition: 0.18s ease;
  }

  /* ── Overlay ── */
  .cwm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(20, 15, 10, 0.42);
    backdrop-filter: blur(5px) saturate(0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 9999;
    animation: cwm-fade-in 0.22s ease;
  }

  @keyframes cwm-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* ── Modal ── */
  .cwm-modal {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    width: 100%;
    max-width: 560px;
    max-height: 92dvh;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--surface3) transparent;
    position: relative;
    box-shadow:
      0 1px 3px rgba(30, 20, 10, 0.08),
      0 8px 32px rgba(30, 20, 10, 0.12),
      0 24px 64px rgba(30, 20, 10, 0.1);
    animation: cwm-slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  @keyframes cwm-slide-up {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* İnce üst şerit — kırmızı */
  .cwm-modal::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--accent) 35%, var(--accent) 65%, transparent);
    opacity: 0.55;
    border-radius: var(--radius) var(--radius) 0 0;
    pointer-events: none;
  }

  /* Hafif doku — ince noise */
  .cwm-modal::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
    border-radius: var(--radius);
    pointer-events: none;
    z-index: 0;
  }

  .cwm-header,
  .cwm-body,
  .cwm-footer { position: relative; z-index: 1; }

  /* ── Header ── */
  .cwm-header {
    padding: 2rem 2.25rem 0;
  }

  .cwm-eyebrow {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.62rem;
    font-weight: 500;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 0 0 0.7rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    opacity: 0.85;
  }

  .cwm-eyebrow::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(192,57,43,0.2), transparent);
  }

  .cwm-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.9rem;
    font-weight: 300;
    font-style: italic;
    color: var(--ink);
    margin: 0;
    line-height: 1.15;
    letter-spacing: 0.01em;
  }

  .cwm-subtitle {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.76rem;
    font-weight: 300;
    color: var(--ink-ghost);
    margin: 0.35rem 0 0;
    letter-spacing: 0.01em;
  }

  /* ── Body ── */
  .cwm-body {
    padding: 1.75rem 2.25rem 0;
    display: flex;
    flex-direction: column;
    gap: 1.4rem;
  }

  /* ── Error ── */
  .cwm-error {
    background: var(--red-bg);
    border: 1px solid rgba(184,50,50,0.2);
    border-radius: var(--radius);
    padding: 0.65rem 0.9rem;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.81rem;
    color: var(--red);
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .cwm-error-icon {
    flex-shrink: 0;
    margin-top: 0.05rem;
  }

  /* ── Field ── */
  .cwm-field {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .cwm-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.62rem;
    font-weight: 500;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--ink-dim);
  }

  .cwm-input,
  .cwm-textarea {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.08rem;
    font-weight: 400;
    color: var(--ink);
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 0.68rem 0.9rem;
    width: 100%;
    box-sizing: border-box;
    transition: border-color var(--transition), box-shadow var(--transition), background var(--transition);
    outline: none;
  }

  .cwm-input::placeholder,
  .cwm-textarea::placeholder {
    color: var(--ink-ghost);
    font-style: italic;
  }

  .cwm-input:focus,
  .cwm-textarea:focus {
    border-color: rgba(150, 31, 18, 0.35);
    background: var(--surface);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .cwm-textarea {
    resize: vertical;
    min-height: 88px;
    line-height: 1.65;
  }

  /* ── Genre Picker ── */
  .cwm-genre-groups {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .cwm-genre-group {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    transition: border-color var(--transition), box-shadow var(--transition);
  }

  .cwm-genre-group.is-open {
    border-color: var(--border-hi);
    box-shadow: 0 2px 8px rgba(30,20,10,0.06);
  }

  .cwm-genre-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.58rem 0.9rem;
    background: var(--surface2);
    cursor: pointer;
    user-select: none;
    transition: background var(--transition);
    gap: 0.5rem;
  }

  .cwm-genre-group-header:hover {
    background: var(--surface3);
  }

  .cwm-genre-group-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    color: var(--ink-dim);
    text-transform: uppercase;
  }

  .cwm-genre-group-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .cwm-genre-badge {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.6rem;
    font-weight: 600;
    background: var(--green-glow);
    color: var(--green);
    border: 1px solid rgba(74,124,89,0.25);
    border-radius: 99px;
    padding: 0.12rem 0.5rem;
  }

  .cwm-genre-chevron {
    color: var(--ink-ghost);
    font-size: 0.65rem;
    transition: transform 0.18s ease;
  }

  .cwm-genre-group.is-open .cwm-genre-chevron {
    transform: rotate(180deg);
    color: var(--accent);
  }

  .cwm-genre-options {
    display: none;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.7rem 0.9rem;
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .cwm-genre-group.is-open .cwm-genre-options {
    display: flex;
  }

  .cwm-genre-chip {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.72rem;
    font-weight: 400;
    color: var(--ink-dim);
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 99px;
    padding: 0.28rem 0.75rem;
    cursor: pointer;
    transition: all var(--transition);
    outline: none;
    white-space: nowrap;
  }

  .cwm-genre-chip:hover {
    color: var(--ink);
    border-color: var(--border-hi);
    background: var(--surface3);
  }

  .cwm-genre-chip.selected {
    color: var(--green);
    background: var(--green-glow);
    border-color: rgba(74,124,89,0.35);
  }

  .cwm-genre-chip.at-max:not(.selected) {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* ── Genre counter ── */
  .cwm-genre-counter {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.68rem;
    font-weight: 400;
    color: var(--ink-ghost);
    margin-bottom: 0.45rem;
  }

  .cwm-genre-counter-bar {
    display: flex;
    gap: 3px;
  }

  .cwm-genre-counter-dot {
    width: 14px;
    height: 2.5px;
    border-radius: 99px;
    background: var(--surface3);
    transition: background 0.2s;
  }

  .cwm-genre-counter-dot.filled {
    background: var(--green);
  }

  /* ── Selected pills ── */
  .cwm-genres-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.5rem;
    min-height: 1.8rem;
  }

  .cwm-genre-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.7rem;
    font-weight: 400;
    color: var(--green);
    background: var(--green-glow);
    border: 1px solid rgba(74,124,89,0.3);
    border-radius: 99px;
    padding: 0.22rem 0.5rem 0.22rem 0.65rem;
  }

  .cwm-genre-pill-remove {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--green);
    opacity: 0.55;
    font-size: 0.65rem;
    line-height: 1;
    transition: opacity var(--transition);
    display: flex;
    align-items: center;
  }

  .cwm-genre-pill-remove:hover { opacity: 1; }

  /* ── Cover Upload ── */
  .cwm-cover-area {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .cwm-cover-drop {
    flex-shrink: 0;
    width: 88px;
    height: 118px;
    border: 1.5px dashed var(--border-hi);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    cursor: pointer;
    transition: border-color var(--transition), background var(--transition);
    overflow: hidden;
    position: relative;
    background: var(--surface2);
  }

  .cwm-cover-drop:hover {
    border-color: var(--blue);
    background: var(--blue-glow);
  }

  .cwm-cover-drop.drag-over {
    border-color: var(--blue);
    background: var(--blue-glow);
    box-shadow: 0 0 0 3px rgba(61,107,142,0.1);
  }

  .cwm-cover-drop.has-preview {
    border-style: solid;
    border-color: var(--border-hi);
  }

  .cwm-cover-preview-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cwm-cover-preview-overlay {
    position: absolute;
    inset: 0;
    background: rgba(20,15,10,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity var(--transition);
    font-family: 'DM Sans', sans-serif;
    font-size: 0.58rem;
    color: #faf8f4;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .cwm-cover-drop.has-preview:hover .cwm-cover-preview-overlay {
    opacity: 1;
  }

  .cwm-cover-icon {
    color: var(--ink-ghost);
    font-size: 1.2rem;
    line-height: 1;
  }

  .cwm-cover-hint {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.55rem;
    font-weight: 400;
    letter-spacing: 0.05em;
    text-align: center;
    color: var(--ink-ghost);
    text-transform: uppercase;
    line-height: 1.5;
  }

  .cwm-cover-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.1rem;
  }

  .cwm-cover-filename {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.78rem;
    font-weight: 300;
    color: var(--ink-ghost);
    font-style: italic;
    word-break: break-all;
    min-height: 1.1rem;
  }

  .cwm-cover-filename.has-file {
    color: var(--ink-dim);
    font-style: normal;
  }

  .cwm-cover-clear {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.68rem;
    color: var(--accent);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    text-align: left;
    opacity: 0.7;
    transition: opacity var(--transition);
    letter-spacing: 0.03em;
  }

  .cwm-cover-clear:hover { opacity: 1; }

  .cwm-cover-formats {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.66rem;
    color: var(--ink-ghost);
    line-height: 1.55;
  }

  /* ── Footer ── */
  .cwm-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.7rem;
    padding: 1.4rem 2.25rem 1.6rem;
    margin-top: 0.5rem;
    border-top: 1px solid var(--border);
  }

  .cwm-btn {
    font-family: 'DM Sans', sans-serif;
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    border: none;
    border-radius: var(--radius);
    padding: 0.62rem 1.4rem;
    cursor: pointer;
    transition: all var(--transition);
    outline: none;
  }

  .cwm-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  .cwm-btn--ghost {
    background: transparent;
    color: var(--ink-ghost);
    border: 1px solid var(--border);
  }

  .cwm-btn--ghost:hover {
    color: var(--ink-dim);
    border-color: var(--border-hi);
    background: var(--surface2);
  }

  /* Primary — kırmızı vurgu */
  .cwm-btn--primary {
    background: var(--accent);
    color: #faf8f4;
    border: 1px solid var(--accent);
    font-weight: 500;
    position: relative;
    overflow: hidden;
  }

  .cwm-btn--primary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(255,255,255,0.1);
    opacity: 0;
    transition: opacity var(--transition);
  }

  .cwm-btn--primary:hover::after { opacity: 1; }

  .cwm-btn--primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(192,57,43,0.25);
  }

  .cwm-btn--primary:active {
    transform: translateY(0);
    box-shadow: none;
  }

  /* Spinner */
  .cwm-spinner {
    display: inline-block;
    width: 9px;
    height: 9px;
    border: 1.5px solid rgba(250,248,244,0.35);
    border-top-color: #faf8f4;
    border-radius: 50%;
    animation: cwm-spin 0.65s linear infinite;
    margin-right: 0.45rem;
    vertical-align: middle;
  }

  @keyframes cwm-spin { to { transform: rotate(360deg); } }

  /* ── Responsive ── */
  @media (max-width: 500px) {
    .cwm-header,
    .cwm-body { padding-left: 1.25rem; padding-right: 1.25rem; }
    .cwm-footer { padding: 1.25rem; }
    .cwm-title { font-size: 1.55rem; }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function CreateWorkModal({ isOpen, onClose, onSuccess }) {
  const [title, setTitle]           = useState("");
  const [genres, setGenres]         = useState([]);
  const [description, setDesc]      = useState("");
  const [coverFile, setCoverFile]   = useState(null);
  const [coverPreview, setPreview]  = useState(null);
  const [openGroups, setOpenGroups] = useState({});
  const [dragOver, setDragOver]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const fileInputRef                = useRef(null);

  // Inject styles
  useEffect(() => {
    const id = "cwm-styles-v2";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }
  }, []);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setTitle(""); setGenres([]); setDesc("");
      setCoverFile(null); setPreview(null);
      setOpenGroups({}); setError(""); setLoading(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && isOpen) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // ── Genre helpers ──
  const toggleGroup = useCallback((label) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] })), []);

  const MAX_GENRES = 5;
  const toggleGenre = useCallback((g) => {
    setGenres((prev) => {
      if (prev.includes(g)) return prev.filter((x) => x !== g);
      if (prev.length >= MAX_GENRES) return prev; // cap
      return [...prev, g];
    });
  }, []);

  // ── Cover file handling ──
  const applyFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setCoverFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }, []);

  const clearCover = useCallback(() => {
    setCoverFile(null);
    setPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    applyFile(file);
  }, [applyFile]);

  // ── Submit ──
  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!title.trim()) { setError("Eser adı zorunludur."); return; }
    setLoading(true);
    setError("");

    // Boş veya bozuk response body'yi güvenle parse eder
    const safeJson = async (response) => {
      const text = await response.text();
      if (!text || !text.trim()) return {};
      try { return JSON.parse(text); } catch { return {}; }
    };

    try {
      let coverImage = "";

      if (coverFile) {
        const formData = new FormData();
        formData.append("file", coverFile);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          body: formData,
        });
        const uploadData = await safeJson(uploadRes);
        if (!uploadRes.ok) {
          throw new Error(uploadData.message || "Kapak resmi yüklenemedi.");
        }
        coverImage = uploadData.url || uploadData.secure_url || "";
      }

      const res = await fetch("/api/works", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          title:       title.trim(),
          genres:      genres.length ? genres : [],
          description: description.trim() || "",
          coverImage:  coverImage || "",
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message || "Eser oluşturulamadı.");

      onSuccess(data.item || data);
      onClose();
    } catch (err) {
      setError(err.message || "Beklenmeyen bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="cwm-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Yeni eser oluştur"
    >
      <div className="cwm-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="cwm-header">
          <p className="cwm-eyebrow">Yeni Eser</p>
          <h2 className="cwm-title">Hikayeni Başlat</h2>
          <p className="cwm-subtitle">Bir başlık, bir tür, bir ilk adım.</p>
        </div>

        {/* ── Body ── */}
        <div className="cwm-body">

          {/* Error */}
          {error && (
            <div className="cwm-error">
              <span className="cwm-error-icon">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Eser Adı */}
          <div className="cwm-field">
            <label className="cwm-label">Eser Adı *</label>
            <input
              className="cwm-input"
              type="text"
              placeholder="Hikayenizin başlığı..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              autoFocus
            />
          </div>

          {/* Tür */}
          <div className="cwm-field">
            <label className="cwm-label">Tür <span style={{ color: "var(--ink-ghost)", fontStyle: "italic", textTransform: "none", letterSpacing: 0 }}>(en fazla 5)</span></label>

            {/* Counter dots */}
            <div className="cwm-genre-counter">
              <div className="cwm-genre-counter-bar">
                {Array.from({ length: MAX_GENRES }).map((_, i) => (
                  <div key={i} className={`cwm-genre-counter-dot${i < genres.length ? " filled" : ""}`} />
                ))}
              </div>
              <span>{genres.length} / {MAX_GENRES} seçili</span>
            </div>

            <div className="cwm-genre-groups">
              {GENRE_GROUPS.map((group) => {
                const isOpen = !!openGroups[group.label];
                const countInGroup = group.genres.filter(g => genres.includes(g)).length;
                const atMax = genres.length >= MAX_GENRES;
                return (
                  <div
                    key={group.label}
                    className={`cwm-genre-group${isOpen ? " is-open" : ""}`}
                  >
                    <div
                      className="cwm-genre-group-header"
                      onClick={() => toggleGroup(group.label)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleGroup(group.label); }}
                    >
                      <span className="cwm-genre-group-label">{group.label}</span>
                      <div className="cwm-genre-group-meta">
                        {countInGroup > 0 && (
                          <span className="cwm-genre-badge">{countInGroup}</span>
                        )}
                        <span className="cwm-genre-chevron">▾</span>
                      </div>
                    </div>
                    <div className="cwm-genre-options">
                      {group.genres.map((g) => {
                        const selected = genres.includes(g);
                        return (
                          <button
                            key={g}
                            type="button"
                            className={`cwm-genre-chip${selected ? " selected" : ""}${atMax && !selected ? " at-max" : ""}`}
                            onClick={() => toggleGenre(g)}
                            disabled={atMax && !selected}
                          >
                            {g}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected pills */}
            {genres.length > 0 && (
              <div className="cwm-genres-pills">
                {genres.map((g) => (
                  <span key={g} className="cwm-genre-pill">
                    {g}
                    <button
                      type="button"
                      className="cwm-genre-pill-remove"
                      onClick={() => toggleGenre(g)}
                      aria-label={`${g} türünü kaldır`}
                    >✕</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Kısa Özet */}
          <div className="cwm-field">
            <label className="cwm-label">Kısa Özet</label>
            <textarea
              className="cwm-textarea"
              placeholder="Bu hikaye ne hakkında? İlk notlarını buraya bırak..."
              rows={3}
              value={description}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>

          {/* Kapak Resmi */}
          <div className="cwm-field">
            <label className="cwm-label">Kapak Resmi <span style={{ color: "var(--ink-ghost)", fontStyle: "italic", textTransform: "none", letterSpacing: 0 }}>(isteğe bağlı)</span></label>
            <div className="cwm-cover-area">
              {/* Drop zone */}
              <div
                className={`cwm-cover-drop${coverPreview ? " has-preview" : ""}${dragOver ? " drag-over" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                aria-label="Kapak resmi yükle"
                onKeyDown={(e) => { if (e.key === "Enter") fileInputRef.current?.click(); }}
              >
                {coverPreview ? (
                  <>
                    <img className="cwm-cover-preview-img" src={coverPreview} alt="Kapak önizleme" />
                    <div className="cwm-cover-preview-overlay">Değiştir</div>
                  </>
                ) : (
                  <>
                    <span className="cwm-cover-icon">🖼</span>
                    <span className="cwm-cover-hint">Tıkla veya{"\n"}sürükle</span>
                  </>
                )}
              </div>

              {/* Right side info */}
              <div className="cwm-cover-right">
                <span className={`cwm-cover-filename${coverFile ? " has-file" : ""}`}>
                  {coverFile ? coverFile.name : "Henüz resim seçilmedi."}
                </span>
                {coverFile && (
                  <button type="button" className="cwm-cover-clear" onClick={clearCover}>
                    ✕ Resmi kaldır
                  </button>
                )}
                <span className="cwm-cover-formats">
                  JPG, PNG, WEBP<br />
                  Maks. 5 MB
                </span>
              </div>
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={(e) => applyFile(e.target.files[0])}
            />
          </div>

        </div>

        {/* ── Footer ── */}
        <div className="cwm-footer">
          <button type="button" className="cwm-btn cwm-btn--ghost" onClick={onClose}>
            İptal
          </button>
          <button
            type="button"
            className="cwm-btn cwm-btn--primary"
            onClick={handleSubmit}
            disabled={loading || !title.trim()}
          >
            {loading && <span className="cwm-spinner" />}
            {loading ? "Oluşturuluyor…" : "Eseri Oluştur"}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}