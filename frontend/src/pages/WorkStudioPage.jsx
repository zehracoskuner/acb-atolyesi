// src/pages/WorkStudioPage.jsx
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";
import { isLoggedIn } from "../lib/auth";
import "../styles/WorkStudioPage.css";
import TopBar from "../components/TopBar";
import EditWorkModal from "../components/EditWorkModal";

// ─── Palet ───────────────────────────────────────────────────────────────────
const COVER_PALETTES = {
  purple: { from: "#6e6c6c", to: "#020202", accent: "#c4b5fd" },
  blue:   { from: "#0f1f34", to: "#33456c", accent: "#93c5fd" },
  red:    { from: "#7f1d1d", to: "#dc2626", accent: "#fca5a5" },
  green:  { from: "#113a21", to: "#18833f", accent: "#86efac" },
  amber:  { from: "#78350f", to: "#d97706", accent: "#fde68a" },
  slate:  { from: "#1e293b", to: "#475569", accent: "#cbd5e1" },
};

const S = {
  loadingScreen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#09090f",
    fontFamily: "'DM Sans', sans-serif",
  },
  loadingInner:   { display: "flex", flexDirection: "column", alignItems: "center", gap: 16 },
  loadingSpinner: {
    width: 32, height: 32,
    borderRadius: "50%",
    border: "2px solid rgba(201,168,76,.2)",
    borderTopColor: "#c9a84c",
    animation: "spin 1s linear infinite",
  },
  loadingText:  { color: "#7070a0", fontSize: ".85rem", letterSpacing: ".08em" },
  errorScreen: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#09090f",
    color: "#7070a0",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: ".9rem",
  },
};

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

async function safePatch(path, body) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const url   = `${API_BASE}${path}`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const preview = await res.text();
    console.error(`[safePatch] ${url} → beklenmeyen yanıt:`, preview.slice(0, 300));
    throw new Error(
      `Sunucu hatası (${res.status}): JSON beklendi ama farklı yanıt döndü. URL: ${url}`
    );
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || `İşlem başarısız (${res.status}).`);
  return data;
}

export default function WorkStudioPage() {
  const { workId } = useParams();
  const navigate   = useNavigate();
  const fileInputRef = useRef(null);

  const [work,    setWork]    = useState(null);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState([]);
  const [error,   setError]   = useState("");
  const [mounted, setMounted] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);

  const initPage = useCallback(async () => {
  if (!isLoggedIn()) {
    navigate("/login");
    return;
  }

  try {
    setLoading(true);

    const [workRes, chRes, charRes, plotRes, noteRes] = await Promise.all([
      apiGet(`/works/${workId}`),
      apiGet(`/works/${workId}/chapters`),
      apiGet(`/characters?workId=${workId}`),
      apiGet(`/plots/${workId}`),
      apiGet(`/works/${workId}/notes`),
    ]);

    setWork(workRes.item);

    setStats({
      ...(workRes.stats ?? {}),
      characterCount: charRes.items?.length ?? 0,
      plotCount: plotRes.plot?.scenes?.length ?? 0,
      noteCount: noteRes.items?.length ?? 0,
    });

    setChapters(chRes.items || []);
  } catch (err) {
    setError(err.message || "Çalışma yüklenemedi.");
  } finally {
    setLoading(false);
    setTimeout(() => setMounted(true), 60);
  }
}, [workId, navigate]);

  useEffect(() => { initPage(); }, [initPage]);

  if (loading) return (
    <div style={S.loadingScreen}>
      <div style={S.loadingInner}>
        <div style={S.loadingSpinner} />
        <span style={S.loadingText}>Stüdyo açılıyor…</span>
      </div>
    </div>
  );
  if (error)  return <div style={S.errorScreen}>{error}</div>;
  if (!work)  return <div style={S.errorScreen}>Çalışma bulunamadı.</div>;

  const palette    = COVER_PALETTES[work.color] ?? COVER_PALETTES.purple;
  const statusDraft = work.status === "draft";
  const cssVars    = {
    "--cover-from":   palette.from,
    "--cover-to":     palette.to,
    "--cover-accent": palette.accent,
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Dosya boyutu 5 MB'dan küçük olmalıdır.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");

      const uploadRes = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Resim sunucuya yüklenemedi.");

      const uploadData = await uploadRes.json();
      const secureUrl  = uploadData.url || uploadData.secure_url;
      if (!secureUrl) throw new Error("Cloudinary URL döndürmedi.");

      const patchRes = await safePatch(`/works/${workId}`, { coverImage: secureUrl });
      setWork(patchRes?.item ?? (prev => ({ ...prev, coverImage: secureUrl })));
    } catch (err) {
      console.error("Kapak yükleme hatası:", err);
      alert("Kapak yüklenirken hata oluştu: " + err.message);
    }
  };

  const tools = [
  {
    icon: "📜",
    label: "Bölümler",
    value: `${chapters.length}`,
    unit: "bölüm",
    path: `/work/${workId}/chapters`,
    tourId: "atolyem-yaz-btn",
  },
  {
    icon: "👤",
    label: "Karakterler",
    value: `${stats?.characterCount ?? 0}`,
    unit: "karakter",
    path: `/work/${workId}/characters`,
    tourId: "atolyem-karakterler",
  },
  {
    icon: "🧩",
    label: "Olay Örgüsü / Dünya",
    value: `${stats?.plotCount ?? 0}`,
    unit: "olay",
    path: `/work/${workId}/plot`,
    tourId: "atolyem-plotworld",
  },
  {
    icon: "📝",
    label: "Notlar",
    value: `${stats?.noteCount ?? 0}`,
    unit: "not",
    path: `/work/${workId}/notlarım`,
    tourId: "atolyem-notlar",
  },
];

  return (
    <div className="ws-root" style={cssVars}>
      <TopBar />

      <div className="ws-page">

        {/* ── Breadcrumb ── */}
        <nav className="ws-topbar">
          <div className="ws-breadcrumb">
            <span className="ws-bc-link" onClick={() => navigate("/yazma")}>Atölyem</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
            <strong>{work.title}</strong>
          </div>
          <div className="ws-topbar-right">
            <span className={`ws-status-badge ${statusDraft ? "draft" : "live"}`}>
              {statusDraft ? "Taslak" : "Yayında"}
            </span>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className={`ws-hero ${mounted ? "ws-hero--in" : ""}`}>
          <div className="ws-hero-glow" />

          {/* Kapak — data-tour ile vurgula */}
          <div
            className="ws-cover-stage"
            onClick={() => fileInputRef.current?.click()}
            data-tour="atolyem-kapak"
          >
            <div className="ws-book">
              <div className="ws-book-front">
                <div className="ws-book-texture" />
                {work.coverImage ? (
                  <img
                    src={work.coverImage}
                    alt="Kapak Görseli"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div className="ws-book-content">
                    <p className="ws-book-author">
                      {work.isAnonymous ? "Anonim Yazar" : (work.author?.username || "Yazar")}
                    </p>
                    <p className="ws-book-title">{work.title}</p>
                    <div className="ws-book-ornament">
                      <span />
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--cover-accent)">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <span />
                    </div>
                  </div>
                )}
              </div>
              <div className="ws-book-spine" />
              <div className="ws-book-back" />
              <div className="ws-book-shadow" />
            </div>
            <input
              type="file"
              ref={fileInputRef}
              hidden
              accept="image/*"
              onChange={handleCoverUpload}
            />
          </div>

          {/* Hero bilgi */}
          <div className="ws-hero-info">
            <h1 className="ws-hero-title" data-tour="atolyem-baslik">
              {work.title}
            </h1>

            <p className="ws-hero-desc">
              {work.description || "Bu hikaye için henüz bir özet yazılmadı."}
            </p>

            {/* Hero aksiyonlar */}
            <div className="ws-hero-actions">
              <button
                className="ws-btn-primary"
                onClick={() => navigate(`/work/${workId}/chapters`)}
              >
                Yazmaya Devam Et
              </button>
              <button
                className="ws-btn-ghost"
                onClick={() => setShowEditModal(true)}
                data-tour="atolyem-duzenle-btn"
              >
                ✎ Düzenle & Yayınla
              </button>
            </div>
          </div>
        </section>

        {/* ── Proje Araçları ── */}
        <section
          className={`ws-tools ${mounted ? "ws-tools--in" : ""}`}
          data-tour="atolyem-araclar"
        >
          <div className="ws-tools-header">
            <span className="ws-tools-label">Proje Araçları</span>
            <div className="ws-tools-line" />
          </div>
          <div className="ws-tools-grid">
            {tools.map((t, i) => (
              <button
                key={t.path}
                className="ws-tool-card"
                style={{ animationDelay: `${0.55 + i * 0.08}s` }}
                onClick={() => navigate(t.path)}
                data-tour={t.tourId}
              >
                <div className="ws-tool-icon">{t.icon}</div>
                <div className="ws-tool-body">
                  <span className="ws-tool-name">{t.label}</span>
                  {t.value !== null && (
                    <span className="ws-tool-stat"><strong>{t.value}</strong> {t.unit}</span>
                  )}
                </div>
                <svg className="ws-tool-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </section>

      </div>

      <EditWorkModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        work={work}
        onSuccess={(updated) => {
          setWork(updated);
          setShowEditModal(false);
        }}
      />
    </div>
  );
}