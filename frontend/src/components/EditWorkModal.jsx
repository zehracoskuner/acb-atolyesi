import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { apiGet, apiPatch } from "../lib/api";
import EtikHatirlatma from "./EtikHatirlatma";

// ─── Sabitler ────────────────────────────────────────────────────────────────
const COVER_COLORS = [
  { key: "purple", label: "Mor",      from: "#6e6c6c", to: "#020202" },
  { key: "blue",   label: "Lacivert", from: "#0f1f34", to: "#33456c" },
  { key: "red",    label: "Kırmızı",  from: "#7f1d1d", to: "#dc2626" },
  { key: "green",  label: "Yeşil",    from: "#113a21", to: "#18833f" },
  { key: "amber",  label: "Amber",    from: "#78350f", to: "#d97706" },
  { key: "slate",  label: "Koyu Gri", from: "#1e293b", to: "#475569" },
];

const GENRE_GROUPS = [
  { label: "Kurgu",           genres: ["Fantastik", "Bilim Kurgu", "Distopya / Ütopya", "Tarihi Kurgu", "Mitolojik Kurgu", "Alternatif Tarih"] },
  { label: "Gerilim & Gizem", genres: ["Polisiye", "Psikolojik Gerilim", "Suç Kurgu", "Korku & Karanlık", "Gotik", "Gizem"] },
  { label: "Duygu & İnsan",   genres: ["Romantizm", "Aile & Nesil", "Büyüme Romanı", "Trajedi", "Dram", "Mizah & Yergi"] },
  { label: "Şiir & Deneme",   genres: ["Lirik Şiir", "Epik Şiir", "Deneme", "Anı & Otobiyografi", "Günlük"] },
  { label: "Macera & Dünya İnşası", genres: ["Macera", "Seyahat Yazını", "Destansı Fantezi", "Açık Dünya"] },
];
const MAX_GENRES = 5;

const TABS = [
  { id: "meta",     icon: "📄", label: "Genel bilgiler"  },
  { id: "publish",  icon: "🚀", label: "Yayın ayarları" },
  { id: "chapters", icon: "📋", label: "Bölümler"        },
];

// ─── CSS (IYILEŞTIRILMIŞ) ─────────────────────────────────────────────────────
const CSS = `
  :root {
    --ewm-surface:     #faf8f4;
    --ewm-surface2:    #f0ece5;
    --ewm-surface3:    #e8e2d9;
    --ewm-border:      rgba(60, 45, 30, 0.1);
    --ewm-border-hi:   rgba(60, 45, 30, 0.25);
    --ewm-ink:         #1e1a16;
    --ewm-ink-dim:     #5c5046;
    --ewm-ink-ghost:   #a89a8a;
    --ewm-accent:      #c0392b;
    --ewm-accent-glow: rgba(192, 57, 43, 0.08);
    --ewm-green:       #4a7c59;
    --ewm-green-glow:  rgba(74, 124, 89, 0.1);
    --ewm-orange:      #c8832a;
    --ewm-orange-glow: rgba(200, 131, 42, 0.1);
    --ewm-red:         #b83232;
    --ewm-radius:      5px;
    --ewm-t:           0.18s ease;
  }

  .ewm-overlay {
    position: fixed; inset: 0;
    background: rgba(20, 15, 10, 0.42);
    backdrop-filter: blur(5px) saturate(0.85);
    display: flex; align-items: center; justify-content: center;
    padding: 1rem; z-index: 9999;
    animation: ewm-fade 0.22s ease;
  }
  @keyframes ewm-fade { from { opacity: 0; } to { opacity: 1; } }

  .ewm-modal {
    background: var(--ewm-surface);
    border: 1px solid var(--ewm-border);
    border-radius: var(--ewm-radius);
    width: 100%; max-width: 580px; max-height: 92dvh;
    overflow-y: auto; scrollbar-width: thin;
    scrollbar-color: var(--ewm-surface3) transparent;
    position: relative;
    box-shadow: 0 1px 3px rgba(30,20,10,0.08), 0 8px 32px rgba(30,20,10,0.12), 0 24px 64px rgba(30,20,10,0.1);
    animation: ewm-up 0.3s cubic-bezier(0.22,1,0.36,1);
  }
  @keyframes ewm-up {
    from { opacity: 0; transform: translateY(20px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .ewm-modal::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, var(--ewm-accent) 35%, var(--ewm-accent) 65%, transparent);
    opacity: 0.55; border-radius: var(--ewm-radius) var(--ewm-radius) 0 0; pointer-events: none;
  }
  .ewm-modal::after {
    content: ''; position: absolute; inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
    border-radius: var(--ewm-radius); pointer-events: none; z-index: 0;
  }
  .ewm-header, .ewm-tabs, .ewm-body, .ewm-footer { position: relative; z-index: 1; }

  .ewm-header { padding: 2rem 2.25rem 0; }
  .ewm-eyebrow {
    font-family: 'DM Sans', sans-serif; font-size: 0.62rem; font-weight: 500;
    letter-spacing: 0.28em; text-transform: uppercase; color: var(--ewm-accent);
    margin: 0 0 0.7rem; display: flex; align-items: center; gap: 0.6rem; opacity: 0.85;
  }
  .ewm-eyebrow::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(192,57,43,0.2), transparent); }
  .ewm-title { font-family: 'Cormorant Garamond', serif; font-size: 1.9rem; font-weight: 300; font-style: italic; color: var(--ewm-ink); margin: 0; line-height: 1.15; }
  .ewm-subtitle { font-family: 'DM Sans', sans-serif; font-size: 0.76rem; font-weight: 300; color: var(--ewm-ink-ghost); margin: 0.35rem 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* ✅ TAB'LAR - DİKKAT ÇEKICI YAPILDI */
  .ewm-tabs { display: flex; padding: 1.25rem 2.25rem 0; border-bottom: 1px solid var(--ewm-border); margin-top: 1.25rem; }
  .ewm-tab { font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 400; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ewm-ink-ghost); background: none; border: none; border-bottom: 2px solid transparent; padding: 0.55rem 1rem 0.65rem; cursor: pointer; transition: all var(--ewm-t); display: flex; align-items: center; gap: 0.4rem; white-space: nowrap; margin-bottom: -1px; outline: none; }
  .ewm-tab:hover { color: var(--ewm-ink-dim); background: var(--ewm-surface2); border-radius: 3px 3px 0 0; }
  .ewm-tab--active { color: var(--ewm-accent); border-bottom-color: var(--ewm-accent); border-bottom-width: 3px; font-weight: 600; background: var(--ewm-accent-glow); margin-bottom: -2px; }
  .ewm-tab-badge { font-family: 'DM Sans', sans-serif; font-size: 0.62rem; font-weight: 600; background: var(--ewm-green-glow); color: var(--ewm-green); border: 1px solid rgba(74,124,89,0.35); border-radius: 99px; padding: 0.1rem 0.5rem; }

  /* ✅ BODY - SECTION AYRILMASI */
  .ewm-body { padding: 1.75rem 2.25rem 0; display: flex; flex-direction: column; gap: 1.4rem; }
  .ewm-section { display: flex; flex-direction: column; gap: 1.4rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--ewm-surface3); }
  .ewm-section:last-child { border-bottom: none; }
  
  .ewm-field { display: flex; flex-direction: column; gap: 0.45rem; }
  
  /* ✅ LABEL - DAHA KOYU VE KALINI */
  .ewm-label { font-family: 'DM Sans', sans-serif; font-size: 0.65rem; font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ewm-ink); }
  
  .ewm-input, .ewm-textarea, .ewm-select { font-family: 'Cormorant Garamond', serif; font-size: 1.08rem; font-weight: 400; color: var(--ewm-ink); background: var(--ewm-surface2); border: 1px solid var(--ewm-border); border-radius: var(--ewm-radius); padding: 0.68rem 0.9rem; width: 100%; box-sizing: border-box; transition: border-color var(--ewm-t), box-shadow var(--ewm-t), background var(--ewm-t); outline: none; appearance: none; }
  .ewm-input::placeholder, .ewm-textarea::placeholder { color: var(--ewm-ink-ghost); font-style: italic; }
  .ewm-input:focus, .ewm-textarea:focus, .ewm-select:focus { border-color: rgba(150,31,18,0.35); background: var(--ewm-surface); box-shadow: 0 0 0 3px var(--ewm-accent-glow); }
  .ewm-textarea { resize: vertical; min-height: 88px; line-height: 1.65; }
  
  /* ✅ SELECT - SOFT ARKA PLAN + KALINI BORDER */
  .ewm-select { cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a89a8a' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 0.9rem center; padding-right: 2.2rem; font-weight: 500; border: 1.5px solid var(--ewm-border-hi); background-color: rgba(192,57,43,0.04); }
  .ewm-select:hover { border-color: var(--ewm-accent); background-color: rgba(192,57,43,0.08); }
  
  .ewm-hint { font-family: 'DM Sans', sans-serif; font-size: 0.68rem; font-weight: 300; color: var(--ewm-ink-ghost); margin: 0; }
  .ewm-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

  .ewm-color-grid { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .ewm-color-swatch { width: 32px; height: 32px; border-radius: 4px; border: 2px solid transparent; cursor: pointer; transition: transform var(--ewm-t), box-shadow var(--ewm-t), border-color var(--ewm-t); outline: none; }
  .ewm-color-swatch:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(30,20,10,0.18); }
  .ewm-color-swatch--active { border-color: var(--ewm-ink); box-shadow: 0 0 0 3px var(--ewm-surface), 0 0 0 5px var(--ewm-ink); transform: translateY(-2px); }

  .ewm-genre-counter { display: inline-flex; align-items: center; gap: 0.35rem; font-family: 'DM Sans', sans-serif; font-size: 0.68rem; color: var(--ewm-ink-ghost); margin-bottom: 0.45rem; }
  .ewm-genre-counter-bar { display: flex; gap: 3px; }
  .ewm-genre-counter-dot { width: 14px; height: 2.5px; border-radius: 99px; background: var(--ewm-surface3); transition: background 0.2s; }
  .ewm-genre-counter-dot.filled { background: var(--ewm-green); }
  .ewm-genre-groups { display: flex; flex-direction: column; gap: 0.25rem; }
  .ewm-genre-group { border: 1px solid var(--ewm-border); border-radius: var(--ewm-radius); overflow: hidden; transition: border-color var(--ewm-t), box-shadow var(--ewm-t); }
  .ewm-genre-group.is-open { border-color: var(--ewm-border-hi); box-shadow: 0 2px 8px rgba(30,20,10,0.06); }
  .ewm-genre-group-header { display: flex; align-items: center; justify-content: space-between; padding: 0.58rem 0.9rem; background: var(--ewm-surface2); cursor: pointer; user-select: none; transition: background var(--ewm-t); gap: 0.5rem; }
  .ewm-genre-group-header:hover { background: var(--ewm-surface3); }
  .ewm-genre-group-label { font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 500; letter-spacing: 0.1em; color: var(--ewm-ink-dim); text-transform: uppercase; }
  .ewm-genre-group-meta { display: flex; align-items: center; gap: 0.5rem; }
  .ewm-genre-count-badge { font-family: 'DM Sans', sans-serif; font-size: 0.6rem; font-weight: 600; background: var(--ewm-green-glow); color: var(--ewm-green); border: 1px solid rgba(74,124,89,0.25); border-radius: 99px; padding: 0.12rem 0.5rem; }
  .ewm-genre-chevron { color: var(--ewm-ink-ghost); font-size: 0.65rem; transition: transform 0.18s ease; }
  .ewm-genre-group.is-open .ewm-genre-chevron { transform: rotate(180deg); color: var(--ewm-accent); }
  .ewm-genre-options { display: none; flex-wrap: wrap; gap: 0.4rem; padding: 0.7rem 0.9rem; background: var(--ewm-surface); border-top: 1px solid var(--ewm-border); }
  .ewm-genre-group.is-open .ewm-genre-options { display: flex; }
  .ewm-genre-chip { font-family: 'DM Sans', sans-serif; font-size: 0.72rem; color: var(--ewm-ink-dim); background: var(--ewm-surface2); border: 1px solid var(--ewm-border); border-radius: 99px; padding: 0.28rem 0.75rem; cursor: pointer; transition: all var(--ewm-t); outline: none; white-space: nowrap; }
  .ewm-genre-chip:hover { color: var(--ewm-ink); border-color: var(--ewm-border-hi); background: var(--ewm-surface3); }
  .ewm-genre-chip.selected { color: var(--ewm-green); background: var(--ewm-green-glow); border-color: rgba(74,124,89,0.35); }
  .ewm-genre-chip.at-max:not(.selected) { opacity: 0.3; cursor: not-allowed; }
  .ewm-genres-pills { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; min-height: 1.8rem; }
  .ewm-genre-pill { display: inline-flex; align-items: center; gap: 0.3rem; font-family: 'DM Sans', sans-serif; font-size: 0.7rem; color: var(--ewm-green); background: var(--ewm-green-glow); border: 1px solid rgba(74,124,89,0.3); border-radius: 99px; padding: 0.22rem 0.5rem 0.22rem 0.65rem; }
  .ewm-genre-pill-remove { background: none; border: none; padding: 0; cursor: pointer; color: var(--ewm-green); opacity: 0.55; font-size: 0.65rem; line-height: 1; transition: opacity var(--ewm-t); display: flex; align-items: center; }
  .ewm-genre-pill-remove:hover { opacity: 1; }

  /* ✅ TOGGLE ROWS - DAHA VURGULU BORDERS + HOVER */
  .ewm-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.1rem; background: var(--ewm-surface2); border: 1.5px solid var(--ewm-border-hi); border-radius: var(--ewm-radius); transition: all var(--ewm-t); }
  .ewm-toggle-row:hover { border-color: var(--ewm-accent); background: linear-gradient(90deg, var(--ewm-surface2), var(--ewm-accent-glow)); }
  .ewm-toggle-info { display: flex; flex-direction: column; gap: 0.2rem; }
  .ewm-toggle-label { font-family: 'DM Sans', sans-serif; font-size: 0.84rem; font-weight: 600; color: var(--ewm-ink); }
  .ewm-toggle-sub { font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 300; color: var(--ewm-ink-dim); }
  .ewm-toggle-sw { flex-shrink: 0; width: 36px; height: 20px; border-radius: 99px; border: 1px solid var(--ewm-border-hi); background: var(--ewm-surface3); cursor: pointer; position: relative; transition: background var(--ewm-t), border-color var(--ewm-t); outline: none; }
  .ewm-toggle-sw::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--ewm-ink-ghost); transition: transform var(--ewm-t), background var(--ewm-t); }
  .ewm-toggle-sw--on { background: var(--ewm-accent); border-color: var(--ewm-accent); }
  .ewm-toggle-sw--on::after { transform: translateX(16px); background: #faf8f4; }

  .ewm-ch-status {
    font-family: 'DM Sans', sans-serif; font-size: 0.58rem; font-weight: 500;
    letter-spacing: 0.08em; text-transform: uppercase;
    border-radius: 99px; padding: 0.1rem 0.5rem; flex-shrink: 0;
  }
  .ewm-ch-status--published     { color: #4a7c59; background: rgba(74,124,89,0.1);  border: 1px solid rgba(74,124,89,0.25); }
  .ewm-ch-status--draft         { color: var(--ewm-ink-ghost); background: var(--ewm-surface3); border: 1px solid var(--ewm-border); }
  .ewm-ch-status--pending_review{ color: var(--ewm-orange); background: rgba(200,131,42,0.1); border: 1px solid rgba(200,131,42,0.25); }
  .ewm-ch-status--rejected      { color: var(--ewm-red); background: rgba(184,50,50,0.07); border: 1px solid rgba(184,50,50,0.2); }

  .ewm-chapters-header { display: flex; align-items: center; justify-content: space-between; }
  .ewm-chapters-count { font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 300; color: var(--ewm-ink-ghost); }
  .ewm-btn-select-all { font-family: 'DM Sans', sans-serif; font-size: 0.68rem; color: var(--ewm-accent); background: none; border: none; cursor: pointer; padding: 0; opacity: 0.8; transition: opacity var(--ewm-t); outline: none; }
  .ewm-btn-select-all:hover { opacity: 1; }

  .ewm-chapters-list { display: flex; flex-direction: column; gap: 0.35rem; }
  /* ✅ CHAPTER ITEMS - SEÇILI'DE YEŞIL BORDER + SHADOW */
  .ewm-ch-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.75rem 0.9rem; border: 1px solid var(--ewm-border); border-radius: var(--ewm-radius); background: var(--ewm-surface2); transition: all var(--ewm-t); }
  .ewm-ch-item:hover { border-color: var(--ewm-border-hi); background: var(--ewm-surface); }
  .ewm-ch-item--on  { background: var(--ewm-surface); border-color: var(--ewm-green); border-width: 1.5px; box-shadow: 0 0 0 2px var(--ewm-green-glow); }
  .ewm-ch-item--off { opacity: 0.55; }
  .ewm-ch-check { flex-shrink: 0; width: 14px; height: 14px; accent-color: var(--ewm-accent); cursor: pointer; }
  .ewm-ch-num { font-family: 'DM Sans', sans-serif; font-size: 0.68rem; font-weight: 300; color: var(--ewm-ink-ghost); flex-shrink: 0; min-width: 1.4rem; }
  .ewm-ch-title { font-family: 'Cormorant Garamond', serif; font-size: 0.98rem; font-weight: 500; color: var(--ewm-ink); background: none; border: none; border-bottom: 1px solid transparent; padding: 0 0 1px; flex: 1; outline: none; transition: border-color var(--ewm-t); min-width: 0; }
  .ewm-ch-title:focus { border-bottom-color: var(--ewm-accent); }
  .ewm-ch-title:disabled { cursor: default; color: var(--ewm-ink-ghost); }

  .ewm-chapters-loading, .ewm-empty { display: flex; align-items: center; justify-content: center; gap: 0.6rem; padding: 2.5rem 0; font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 300; color: var(--ewm-ink-ghost); font-style: italic; }
  .ewm-spinner { display: inline-block; width: 14px; height: 14px; border: 1.5px solid var(--ewm-border-hi); border-top-color: var(--ewm-accent); border-radius: 50%; animation: ewm-spin 0.65s linear infinite; flex-shrink: 0; }
  @keyframes ewm-spin { to { transform: rotate(360deg); } }

  .ewm-footer { display: flex; align-items: center; justify-content: space-between; gap: 0.7rem; padding: 1.4rem 2.25rem 1.6rem; margin-top: 1.5rem; border-top: 1px solid var(--ewm-border); }
  .ewm-foot-note { font-family: 'DM Sans', sans-serif; font-size: 0.65rem; font-weight: 300; color: var(--ewm-ink-ghost); font-style: italic; }
  .ewm-foot-actions { display: flex; align-items: center; gap: 0.6rem; }
  .ewm-save-msg { font-family: 'DM Sans', sans-serif; font-size: 0.7rem; }
  .ewm-save-msg--ok  { color: var(--ewm-green); }
  .ewm-save-msg--err { color: var(--ewm-red); }

  .ewm-btn { font-family: 'DM Sans', sans-serif; font-size: 0.72rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; border: none; border-radius: var(--ewm-radius); padding: 0.62rem 1.4rem; cursor: pointer; transition: all var(--ewm-t); outline: none; }
  .ewm-btn:disabled { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
  .ewm-btn--ghost { background: transparent; color: var(--ewm-ink-ghost); border: 1px solid var(--ewm-border); }
  .ewm-btn--ghost:hover { color: var(--ewm-ink-dim); border-color: var(--ewm-border-hi); background: var(--ewm-surface2); }
  .ewm-btn--primary { background: var(--ewm-accent); color: #faf8f4; border: 1px solid var(--ewm-accent); position: relative; overflow: hidden; }
  .ewm-btn--primary::after { content: ''; position: absolute; inset: 0; background: rgba(255,255,255,0.1); opacity: 0; transition: opacity var(--ewm-t); }
  .ewm-btn--primary:hover::after { opacity: 1; }
  .ewm-btn--primary:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(192,57,43,0.25); }
  .ewm-btn--primary:active { transform: translateY(0); box-shadow: none; }
  .ewm-btn-spinner { display: inline-block; width: 9px; height: 9px; border: 1.5px solid rgba(250,248,244,0.35); border-top-color: #faf8f4; border-radius: 50%; animation: ewm-spin 0.65s linear infinite; margin-right: 0.45rem; vertical-align: middle; }

  @media (max-width: 500px) {
    .ewm-header, .ewm-tabs, .ewm-body { padding-left: 1.25rem; padding-right: 1.25rem; }
    .ewm-footer { padding: 1.25rem; }
    .ewm-title { font-size: 1.55rem; }
    .ewm-row-2 { grid-template-columns: 1fr; }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function EditWorkModal({ isOpen, onClose, work, onSuccess }) {
  const [tab,       setTab]       = useState("meta");
  const [saving,    setSaving]    = useState(false);
  const [saveMsg,   setSaveMsg]   = useState(null);
  const [chapters,  setChapters]  = useState([]);
  const [chLoading, setChLoading] = useState(false);
  const [chError,   setChError]   = useState("");

  // Genel bilgiler
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [genres,      setGenres]      = useState([]);
  const [openGroups,  setOpenGroups]  = useState({});
  const [language,    setLanguage]    = useState("tr");
  const [tags,        setTags]        = useState("");
  const [color,       setColor]       = useState("purple");

  // Yayın ayarları
  const [isAnonymous,    setIsAnonymous]    = useState(false);
  const [contentWarning, setContentWarning] = useState(false);
  const [preface,        setPreface]        = useState("");

  // Bölümler
  const [selectedIds,  setSelectedIds]  = useState(new Set());
  const [customTitles, setCustomTitles] = useState({});

  const getWorkId = (w) => w?._id ?? w?.id ?? null;
  const loadedForWorkIdRef = useRef(null);
  const initialPublishedIdsRef = useRef(null);

  // Font ve CSS — bir kez yükle
  useEffect(() => {
    const fontId = "ewm-font-link";
    if (!document.getElementById(fontId)) {
      const link = document.createElement("link");
      link.id = fontId; link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap";
      document.head.appendChild(link);
    }
    const styleId = "ewm-styles-v4";
    if (!document.getElementById(styleId)) {
      const tag = document.createElement("style");
      tag.id = styleId; tag.textContent = CSS;
      document.head.appendChild(tag);
    }
  }, []);

  // Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && isOpen) onClose?.(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Modal açılınca formu doldur + bölüm önbelleğini sıfırla
  useEffect(() => {
    if (!work || !isOpen) return;

    setTitle(work.title ?? "");
    setDescription(work.description ?? "");
    setLanguage(work.language ?? work.universe?.language ?? "tr");
    setTags(
      Array.isArray(work.tags)
        ? work.tags.join(", ")
        : (work.tags ?? work.universe?.tags?.join(", ") ?? "")
    );
    setColor(work.color ?? work.universe?.color ?? "purple");
    setIsAnonymous(work.isAnonymous ?? false);
    setContentWarning(work.contentWarning ?? false);
    setPreface(work.preface ?? "");
    setCustomTitles(work.customChapterTitles ?? {});
    setOpenGroups({});

    const raw = work.genres
      ?? work.universe?.genres
      ?? (work.genre ? [work.genre] : []);
    setGenres(Array.isArray(raw) ? raw : [raw].filter(Boolean));

    setChapters([]);
    setChError("");
    setTab("meta");
    setSaveMsg(null);

    loadedForWorkIdRef.current = null;
    initialPublishedIdsRef.current = work.publishedChapterIds?.length > 0
      ? new Set(work.publishedChapterIds.map(String))
      : null;

    if (work.publishedChapterIds?.length > 0) {
      setSelectedIds(new Set(work.publishedChapterIds.map(String)));
    } else {
      setSelectedIds(new Set());
    }
  }, [work, isOpen]);

  const loadChapters = useCallback(async () => {
    const workId = getWorkId(work);
    if (!workId) return;

    if (loadedForWorkIdRef.current === workId) return;

    setChLoading(true);
    setChError("");

    try {
      const res = await apiGet(`/works/${workId}/chapters`);
      const chs = res.items ?? res.data ?? res ?? [];
      const safeChapters = Array.isArray(chs) ? chs : [];

      setChapters(safeChapters);

      if (initialPublishedIdsRef.current === null) {
        setSelectedIds(
          new Set(
            safeChapters
              .filter((ch) => ch.status === "published")
              .map((ch) => String(ch._id ?? ch.id))
          )
        );
      }

      loadedForWorkIdRef.current = workId;
    } catch (err) {
      setChError(err.message || "Bölümler yüklenemedi.");
      loadedForWorkIdRef.current = null;
    } finally {
      setChLoading(false);
    }
  }, [work]);

  function handleTabChange(id) {
    setTab(id);
    if (id === "chapters") {
      loadChapters();
    }
  }

  function retryLoadChapters() {
    loadedForWorkIdRef.current = null;
    setChapters([]);
    loadChapters();
  }

  const toggleGroup = (label) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  const toggleGenre = (g) => {
    setGenres(prev => {
      if (prev.includes(g)) return prev.filter(x => x !== g);
      if (prev.length >= MAX_GENRES) return prev;
      return [...prev, g];
    });
  };

  function toggleChapter(id, status) {
    if (status !== "published") return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(String(id)) ? next.delete(String(id)) : next.add(String(id));
      return next;
    });
  }

  function toggleAll() {
    const publishable = chapters
      .filter(ch => ch.status === "published")
      .map(ch => String(ch._id));
    const hepsiSecili = publishable.length > 0 && publishable.every(id => selectedIds.has(id));
    setSelectedIds(hepsiSecili ? new Set() : new Set(publishable));
  }

  async function handleSave() {
    if (!title.trim()) {
      setSaveMsg({ ok: false, text: "Başlık boş olamaz." });
      setTab("meta");
      return;
    }

    setSaving(true);
    setSaveMsg(null);

    const payload = {
      title:               title.trim(),
      description:         description.trim(),
      genres,
      language,
      tags:                tags.split(",").map(t => t.trim()).filter(Boolean),
      color,
      isAnonymous,
      contentWarning,
      preface:             preface.trim(),
      customChapterTitles: customTitles,
      ...(chapters.length > 0 ? { publishedChapterIds: [...selectedIds] } : {}),
    };

    try {
      const workId = getWorkId(work);

      const res     = await apiPatch(`/works/${workId}`, payload);
      const updated = res?.item ?? { ...work, ...payload };
      setSaveMsg({ ok: true, text: "Kaydedildi ✓" });
      setTimeout(() => { onSuccess?.(updated); onClose?.(); }, 700);
    } catch (e) {
      setSaveMsg({ ok: false, text: e.message || "Kaydedilemedi." });
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen || !work) return null;

  const selectedCount = selectedIds.size;
  const lastSaved = work.updatedAt
    ? new Date(work.updatedAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return createPortal(
    <div
      className="ewm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog" aria-modal="true" aria-label="Eseri düzenle"
    >
      <div className="ewm-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="ewm-header">
          <p className="ewm-eyebrow">Eser Düzenleme</p>
          <h2 className="ewm-title">Hikayeni Şekillendir</h2>
          <p className="ewm-subtitle">{work.title}</p>
        </div>

        {/* Tabs */}
        <div className="ewm-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`ewm-tab ${tab === t.id ? "ewm-tab--active" : ""}`}
              onClick={() => handleTabChange(t.id)}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
              {t.id === "chapters" && chapters.length > 0 && (
                <span className="ewm-tab-badge">{selectedCount}/{chapters.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="ewm-body">

          {/* ── Genel Bilgiler ── */}
          {tab === "meta" && (
            <div className="ewm-section">
              <div className="ewm-field">
                <label className="ewm-label">Başlık *</label>
                <input className="ewm-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Eserinin başlığı…" maxLength={120} autoFocus />
              </div>

              <div className="ewm-field">
                <label className="ewm-label">Açıklama</label>
                <textarea className="ewm-textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Okuyucuya kısa bir tanıtım…" maxLength={500} rows={3} />
                <p className="ewm-hint">{description.length} / 500</p>
              </div>

              <div className="ewm-field">
                <label className="ewm-label">
                  Tür{" "}
                  <span style={{ color: "var(--ewm-ink-ghost)", fontStyle: "italic", textTransform: "none", letterSpacing: 0 }}>(en fazla {MAX_GENRES})</span>
                </label>
                <div className="ewm-genre-counter">
                  <div className="ewm-genre-counter-bar">
                    {Array.from({ length: MAX_GENRES }).map((_, i) => (
                      <div key={i} className={`ewm-genre-counter-dot${i < genres.length ? " filled" : ""}`} />
                    ))}
                  </div>
                  <span>{genres.length} / {MAX_GENRES} seçili</span>
                </div>
                <div className="ewm-genre-groups">
                  {GENRE_GROUPS.map(group => {
                    const isGroupOpen  = !!openGroups[group.label];
                    const countInGroup = group.genres.filter(g => genres.includes(g)).length;
                    const atMax        = genres.length >= MAX_GENRES;
                    return (
                      <div key={group.label} className={`ewm-genre-group${isGroupOpen ? " is-open" : ""}`}>
                        <div className="ewm-genre-group-header" onClick={() => toggleGroup(group.label)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") toggleGroup(group.label); }}>
                          <span className="ewm-genre-group-label">{group.label}</span>
                          <div className="ewm-genre-group-meta">
                            {countInGroup > 0 && <span className="ewm-genre-count-badge">{countInGroup}</span>}
                            <span className="ewm-genre-chevron">▾</span>
                          </div>
                        </div>
                        <div className="ewm-genre-options">
                          {group.genres.map(g => {
                            const selected = genres.includes(g);
                            return (
                              <button key={g} type="button" className={`ewm-genre-chip${selected ? " selected" : ""}${atMax && !selected ? " at-max" : ""}`} onClick={() => toggleGenre(g)} disabled={atMax && !selected}>
                                {g}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {genres.length > 0 && (
                  <div className="ewm-genres-pills">
                    {genres.map(g => (
                      <span key={g} className="ewm-genre-pill">
                        {g}
                        <button type="button" className="ewm-genre-pill-remove" onClick={() => toggleGenre(g)} aria-label={`${g} türünü kaldır`}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="ewm-row-2">
                <div className="ewm-field">
                  <label className="ewm-label">Dil</label>
                  <select className="ewm-select" value={language} onChange={e => setLanguage(e.target.value)}>
                    <option value="tr">Türkçe</option>
                    <option value="en">İngilizce</option>
                    <option value="other">Diğer</option>
                  </select>
                </div>
                <div className="ewm-field">
                  <label className="ewm-label">Etiketler</label>
                  <input className="ewm-input" value={tags} onChange={e => setTags(e.target.value)} placeholder="macera, gizem… (virgülle)" />
                </div>
              </div>

              <div className="ewm-field">
                <label className="ewm-label">Kapak rengi</label>
                <div className="ewm-color-grid">
                  {COVER_COLORS.map(c => (
                    <button key={c.key} type="button" className={`ewm-color-swatch ${color === c.key ? "ewm-color-swatch--active" : ""}`} style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }} onClick={() => setColor(c.key)} title={c.label} aria-label={c.label} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Yayın Ayarları ── */}
          {tab === "publish" && (
            <div className="ewm-section">

              <div className="ewm-toggle-row">
                <div className="ewm-toggle-info">
                  <span className="ewm-toggle-label">Anonim yayınla</span>
                  <span className="ewm-toggle-sub">Kullanıcı adın okuyucuya gösterilmez</span>
                </div>
                <button type="button" className={`ewm-toggle-sw ${isAnonymous ? "ewm-toggle-sw--on" : ""}`} onClick={() => setIsAnonymous(v => !v)} aria-pressed={isAnonymous} />
              </div>

              <div className="ewm-toggle-row">
                <div className="ewm-toggle-info">
                  <span className="ewm-toggle-label">İçerik uyarısı</span>
                  <span className="ewm-toggle-sub">18+ veya hassas içerik etiketi ekle</span>
                </div>
                <button type="button" className={`ewm-toggle-sw ${contentWarning ? "ewm-toggle-sw--on" : ""}`} onClick={() => setContentWarning(v => !v)} aria-pressed={contentWarning} />
              </div>

              <div className="ewm-field">
                <label className="ewm-label">Önsöz / Yazarın notu</label>
                <textarea className="ewm-textarea" value={preface} onChange={e => setPreface(e.target.value)} placeholder="Okuyucularına hikayeye başlamadan önce ne söylemek istersin? (İsteğe bağlı)" rows={5} maxLength={1000} />
                <p className="ewm-hint">{preface.length} / 1000</p>
              </div>
              <EtikHatirlatma variant="paylasim" />
            </div>
          )}

          {/* ── Bölümler ── */}
          {tab === "chapters" && (
            <div className="ewm-section">
              {chLoading ? (
                <div className="ewm-chapters-loading">
                  <div className="ewm-spinner" />
                  <span>Bölümler yükleniyor…</span>
                </div>
              ) : chError ? (
                <div className="ewm-empty" style={{ color: "var(--ewm-red)", fontStyle: "normal" }}>
                  {chError}
                  <button
                    type="button"
                    onClick={retryLoadChapters}
                    style={{ marginLeft: 8, background: "none", border: "none", color: "var(--ewm-accent)", cursor: "pointer", fontSize: "0.72rem" }}
                  >
                    Tekrar dene
                  </button>
                </div>
              ) : chapters.length === 0 ? (
                <div className="ewm-empty">
                  <span>Henüz hiç bölüm yok.</span>
                </div>
              ) : (
                <>
                  <div className="ewm-chapters-header">
                    <span className="ewm-chapters-count">{selectedCount} / {chapters.length} bölüm seçili</span>
                    <button type="button" className="ewm-btn-select-all" onClick={toggleAll}>
                      {selectedIds.size === chapters.length ? "Tümünü kaldır" : "Tümünü seç"}
                    </button>
                  </div>

                  <div className="ewm-chapters-list">
                    {chapters.map((ch, idx) => {
                      const id          = String(ch._id);
                      const isSelected  = selectedIds.has(id);
                      const displayTitle = customTitles[id] ?? ch.title;
                      const statusLabel = {
                        published:      "Yayında",
                        draft:          "Taslak",
                        pending_review: "İnceleniyor",
                        rejected:       "Reddedildi",
                      }[ch.status] || ch.status;

                      return (
                        <div key={id} className={`ewm-ch-item ${isSelected ? "ewm-ch-item--on" : "ewm-ch-item--off"}`}>
                          <input
                            type="checkbox" className="ewm-ch-check"
                            checked={isSelected}
                            disabled={ch.status !== "published"}
                            title={ch.status !== "published" ? "Önce bölüm editöründen yayınla" : "Yayına dahil et"}
                            onChange={() => toggleChapter(id, ch.status)}
                          />
                          <span className="ewm-ch-num">{idx + 1}.</span>
                          <input
                            className="ewm-ch-title"
                            type="text"
                            value={displayTitle}
                            onChange={e => setCustomTitles(prev => ({ ...prev, [id]: e.target.value }))}
                            placeholder={ch.title}
                            disabled={!isSelected}
                            title="Okuyucuya gösterilecek başlık"
                          />
                          <span className={`ewm-ch-status ewm-ch-status--${ch.status}`}>
                            {statusLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p className="ewm-hint">
                    Başlığı değiştirebilirsin — sadece bu yayın için geçerli. Bölümü kaldırsan da silinmez.
                  </p>
                </>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="ewm-footer">
          <span className="ewm-foot-note">
            {lastSaved ? `Son kaydedildi: ${lastSaved}` : "Henüz kaydedilmedi"}
          </span>
          <div className="ewm-foot-actions">
            {saveMsg && (
              <span className={`ewm-save-msg ${saveMsg.ok ? "ewm-save-msg--ok" : "ewm-save-msg--err"}`}>
                {saveMsg.text}
              </span>
            )}
            <button type="button" className="ewm-btn ewm-btn--ghost" onClick={onClose} disabled={saving}>Vazgeç</button>
            <button type="button" className="ewm-btn ewm-btn--primary" onClick={handleSave} disabled={saving}>
              {saving && <span className="ewm-btn-spinner" aria-hidden="true" />}
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}