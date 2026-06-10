// src/components/TopBar.jsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect, useCallback} from "react";
import { createPortal } from "react-dom";
import { apiGet, apiPatch } from "../lib/api";
import "../styles/TopBar.css";
import ManifestoModal from "./ManifestoModal";
import { TourHelpButton } from "./tour/TourManager";

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);
const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconDoc = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const IconBell = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconLibrary = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
  </svg>
);
const IconCompass = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
  </svg>
);
const IconBookmark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
  </svg>
);
const IconProfile = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconPen = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);
const IconAdmin = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
  </svg>
);

/* ── Bildirim ikonları — tüm type'lar dahil ── */
const NOTIF_ICON = {
  like:             "❤️",
  comment:          "💬",
  follow:           "👤",
  log_like:         "✨",
  log_comment:      "💬",
  chapter_approved: "✅",
  chapter_pending:  "⏳",
  chapter_rejected: "❌",
  system:           "📢",
};

/* ══════════════════════════════════════════════
   PROJE HİKAYESİ MODALI
══════════════════════════════════════════════ */
const MODAL_CSS = `
  .acb-story-overlay {
    position: fixed; inset: 0;
    background: rgba(20, 15, 10, 0.48);
    backdrop-filter: blur(6px) saturate(0.8);
    display: flex; align-items: center; justify-content: center;
    padding: 1.5rem; z-index: 9999;
    animation: acb-fade 0.22s ease;
  }
  @keyframes acb-fade { from { opacity: 0; } to { opacity: 1; } }
  .acb-story-modal {
    background: #faf8f4;
    border: 1px solid rgba(60,45,30,0.12);
    border-radius: 6px;
    width: 100%; max-width: 520px;
    max-height: 88dvh; overflow-y: auto;
    position: relative;
    box-shadow: 0 2px 6px rgba(30,20,10,0.08), 0 16px 48px rgba(30,20,10,0.14);
    animation: acb-up 0.32s cubic-bezier(0.22,1,0.36,1);
    scrollbar-width: thin; scrollbar-color: #e8e2d9 transparent;
  }
  @keyframes acb-up {
    from { opacity: 0; transform: translateY(18px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .acb-story-modal::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, #c0392b 30%, #c0392b 70%, transparent);
    opacity: 0.5; border-radius: 6px 6px 0 0; pointer-events: none;
  }
  .acb-story-body { padding: 2.5rem 2.5rem 1.8rem; }
  .acb-story-eyebrow {
    font-family: 'DM Sans', sans-serif; font-size: 0.6rem; font-weight: 500;
    letter-spacing: 0.3em; text-transform: uppercase; color: #c0392b; opacity: 0.8;
    display: flex; align-items: center; gap: 0.6rem; margin: 0 0 0.8rem;
  }
  .acb-story-eyebrow::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(192,57,43,0.2), transparent); }
  .acb-story-title { font-family: 'Cormorant Garamond', serif; font-size: 2rem; font-weight: 300; font-style: italic; color: #1e1a16; margin: 0 0 1.6rem; line-height: 1.2; }
  .acb-story-section { margin-bottom: 1.4rem; }
  .acb-story-section p { font-family: 'Cormorant Garamond', serif; font-size: 1.05rem; font-weight: 400; color: #3d3229; line-height: 1.85; margin: 0; }
  .acb-story-divider { border: none; border-top: 1px solid rgba(60,45,30,0.08); margin: 1.4rem 0; }
  .acb-story-welcome p {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.1rem;
    font-weight: 600;
    font-style: italic;
    color: #1e1a16;
  }
  .acb-story-footer { display: flex; align-items: center; justify-content: space-between; padding: 1rem 2.5rem 1.5rem; border-top: 1px solid rgba(60,45,30,0.07); }
  .acb-story-footer-note { font-family: 'Cormorant Garamond', serif; font-size: 0.85rem; font-weight: 400; color: #7a6e5f; font-style: italic; }
  .acb-story-close { font-family: 'DM Sans', sans-serif; font-size: 0.7rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: #5c5046; background: #f0ece5; border: 1px solid rgba(60,45,30,0.12); border-radius: 4px; padding: 0.5rem 1.2rem; cursor: pointer; transition: background 0.15s, border-color 0.15s; }
  .acb-story-close:hover { background: #e8e2d9; border-color: rgba(60,45,30,0.2); }
  @media (max-width: 500px) { .acb-story-body { padding: 1.8rem 1.5rem 1.2rem; } .acb-story-footer { padding: 1rem 1.5rem 1.2rem; } .acb-story-title { font-size: 1.65rem; } }
`;

function ProjectStoryModal({ onClose }) {
  useEffect(() => {
    const id = "acb-story-css";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id; tag.textContent = MODAL_CSS;
      document.head.appendChild(tag);
    }
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  return createPortal(
    <div className="acb-story-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="acb-story-modal" role="dialog" aria-modal="true" aria-label="Proje hikayesi">
        <div className="acb-story-body">
          <p className="acb-story-eyebrow">Proje Hakkında</p>
          <h2 className="acb-story-title">ACB Atölyesi</h2>

          <div className="acb-story-section">
            <p>
              Yazmak bazen yağmur gibidir, susup içimizde biriktirdiğimiz onca duygunun
              gayrihtiyari dışa vurumudur. Bizi dengelemesine rağmen dengelenemeyen kelime
              topluluklarıdır. Kontrolsüzce zihnimizin döktüğü yağmur damlaları misali,
              toprağımızı ruhumuzu besler, bizi tedavi eder. Yazmak birçok tanımla
              anlatılabilecekken en güzelini aramaya gerek yoktur. Çünkü yazmak en yalın
              haliyle kendi başına bahar yağmuru kadar güzeldir.
            </p>
          </div>

          <hr className="acb-story-divider" />

          <div className="acb-story-section">
            <p>
              ACB Atölyesi henüz alfabeyi bile doğru yazamayan (!) bir yazılımcının fikriyle
              doğdu. Burası mükemmel hikayelerin değil kendini bu konuda geliştirmek isteyen
              ve okumayı seven kişiler için oluşturulmuş topluluk. Bir acemi yazarlar birliği.
            </p>
          </div>

          <div className="acb-story-section">
            <p>
              İster keşfederek oku, ister sadece senin zihninde yaşayan evrenlerin taslaklarını
              atölyende inşa etmeye başla. Ama en nihayetinde sonsuz ihtimalle dolu beyaz
              kağıda sana özgü hikayeni yaz. Çünkü eminim ki sadece senin zihninde durması
              okumayı severler için haksızlık :)
            </p>
          </div>

          <hr className="acb-story-divider" />

          <div className="acb-story-section acb-story-welcome">
            <p>Yazı atölyemize ve topluluğumuza hoş geldin, iyi ki geldin.</p>
          </div>
        </div>

        <div className="acb-story-footer">
          <span className="acb-story-footer-note">— Geliştirici, Vito · 2026</span>
          <button className="acb-story-close" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ══════════════════════════════════════════════
   YARDIMCI
══════════════════════════════════════════════ */
function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)     return "az önce";
  if (diff < 3600)   return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} sa önce`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

/* ══════════════════════════════════════════════
   TOPBAR
══════════════════════════════════════════════ */
export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const [open,          setOpen]          = useState(false);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [storyOpen,     setStoryOpen]     = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading,  setNotifLoading]  = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [pendingCount,  setPendingCount]  = useState(0);
  const [user,          setUser]          = useState({ kullaniciAdi: "Yazar", email: "", role: "user" });

  const dropdownRef = useRef(null);
  const notifRef    = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
      if (notifRef.current    && !notifRef.current.contains(e.target))    setNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) setUser(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    apiGet("/notifications")
      .then(res => {
        const items = res.items || [];
        setUnreadCount(items.filter(n => !n.read).length);
      })
      .catch(() => {});

    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    if (storedUser.role === "admin" || storedUser.role === "moderator") {
      apiGet(`/${import.meta.env.VITE_ADMIN_PATH}/stats`)
        .then(res => setPendingCount(res.bekleyen?.reviewQueue || 0))
        .catch(() => {});
    }
  }, []);

  const handleNotifOpen = useCallback(async () => {
    const willOpen = !notifOpen;
    setNotifOpen(willOpen);
    setOpen(false);
    if (willOpen && notifications.length === 0) {
      setNotifLoading(true);
      try {
        const res = await apiGet("/notifications");
        setNotifications(res.items || []);
        setUnreadCount((res.items || []).filter(n => !n.read).length);
      } catch { /* ignore */ }
      finally { setNotifLoading(false); }
    }
  }, [notifOpen, notifications.length]);

  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    await apiPatch("/notifications/read-all").catch(() => {});
  }

  async function markRead(notifId) {
    setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    await apiPatch(`/notifications/${notifId}/read`).catch(() => {});
  }

  function goTo(path) { setOpen(false); navigate(path); }

  const handleLogout = () => {
    if (window.confirm("Atölyeden ayrılmak istediğine emin misin?")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setOpen(false);
      navigate("/login");
    }
  };

  const isActive = (path) => location.pathname === path;
  const isStudio = location.pathname.startsWith("/work") || location.pathname === "/studio";
  const isAdmin  = user.role === "admin";
  const isModerator = user.role === "moderator";

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">

          {/* ── Marka ── */}
          <button
            className="brand"
            onClick={() => setStoryOpen(true)} data-tour="topbar-marka"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            title="Proje hakkında"
          >
            <span className="logo">ACB-Atölyesi</span>
            <span className="brand-divider" />
            <span className="topbar-tag">acemi yazarlar birliği</span>
          </button>

          {/* ── Nav ── */}
          <nav className="nav">
            <Link to="/keşfet" className={`nav-link ${isActive("/keşfet") ? "active" : ""}`} data-tour="topbar-kesfet">
              <IconCompass />Keşfet
            </Link>
            <Link to="/library" className={`nav-link ${isActive("/library") ? "active" : ""}`}>
              <IconBookmark />Kütüphanem
            </Link>
            <Link to="/profile/me" className={`nav-link ${location.pathname.startsWith("/profile") ? "active" : ""}`} data-tour="topbar-profil">
              <IconProfile />Profil
            </Link>
            <Link to="/studio" className={`nav-link nav-cta ${isStudio ? "active" : ""}`} data-tour="topbar-atolyem">
              <IconPen />Atölyem
            </Link>
          </nav>

          {/* ── Sağ ── */}
          <div className="nav-right">
            <TourHelpButton />

            <div ref={notifRef} style={{ position: "relative" }}>
              <button className={`icon-btn ${notifOpen ? "active" : ""}`} onClick={handleNotifOpen} title="Bildirimler">
                <IconBell />
                {unreadCount > 0 && (
                  <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </button>

              <div className={`notif-panel ${notifOpen ? "open" : ""}`}>
                <div className="notif-panel-header">
                  <span className="notif-panel-title">Bildirimler</span>
                  {unreadCount > 0 && (
                    <button className="notif-mark-all" onClick={markAllRead}>Tümünü okundu say</button>
                  )}
                </div>
                <div className="notif-list">
                  {notifLoading ? (
                    <div className="notif-loading">Yükleniyor…</div>
                  ) : notifications.length === 0 ? (
                    <div className="notif-empty">Henüz bildirim yok.</div>
                  ) : (
                    notifications.slice(0, 8).map(n => (
                      <div
                        key={n._id}
                        className={`notif-item ${!n.read ? "unread" : ""}`}
                        onClick={() => markRead(n._id)}
                      >
                        <span className="notif-item-icon">
                          {NOTIF_ICON[n.type] ?? "📢"}
                        </span>
                        <div className="notif-item-body">
                          <p className="notif-item-text">{n.text}</p>
                          <span className="notif-item-time">{timeAgo(n.createdAt)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="notif-panel-footer">
                  <Link to="/bildirimler" onClick={() => setNotifOpen(false)}>Tüm bildirimleri gör →</Link>
                </div>
              </div>
            </div>

            {/* Hesap dropdown */}
            <div ref={dropdownRef} style={{ position: "relative" }}>
              <button
                className={`icon-btn ${open ? "active" : ""}`}
                onClick={() => { setOpen(v => !v); setNotifOpen(false); }}
                title="Hesap Menüsü"
              >
                <IconSettings />
              </button>

              <div className={`dropdown ${open ? "open" : ""}`}>
                <div className="dropdown-header">
                  <span className="d-name">{user.kullaniciAdi || user.username || "Yazar"}</span>
                  <span className="d-email">{user.email || "—"}</span>
                </div>
                <div className="dropdown-section">
                  <button className="dd-item" onClick={() => goTo("/profile/me")}><IconUser /> Profilim</button>
                  <button className="dd-item" onClick={() => goTo("/studio")}><IconDoc /> Atölyem</button>
                  <button className="dd-item" onClick={() => goTo("/kutuphane")}><IconLibrary /> Kütüphane</button>
                  <button className="dd-item" onClick={() => goTo("/ayarlar")}><IconSettings /> Ayarlar</button>
                </div>

                {isAdmin && (
                  <div className="dropdown-section">
                    <button
                      className="dd-item"
                      onClick={() => goTo("/admin")}
                      style={{ color: "#c0392b", position: "relative" }}
                    >
                      <IconAdmin />
                      Yönetim Paneli
                      {pendingCount > 0 && (
                        <span style={{
                          marginLeft: "auto",
                          background: "#c0392b",
                          color: "#fff",
                          borderRadius: "99px",
                          fontSize: "0.6rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          lineHeight: 1.6,
                          minWidth: 18,
                          textAlign: "center",
                        }}>
                          {pendingCount > 9 ? "9+" : pendingCount}
                        </span>
                      )}
                    </button>
                  </div>


                )}

                {isModerator && (
  <div className="dropdown-section">
    <button className="dd-item" onClick={() => goTo("/moderator")} style={{ color: "#3a8080", position: "relative" }}>
      <IconAdmin />
      Moderatör Paneli
      {pendingCount > 0 && (
        <span style={{ marginLeft:"auto", background:"#3a8080", color:"#fff", borderRadius:"99px", fontSize:"0.6rem", fontWeight:700, padding:"1px 6px", lineHeight:1.6, minWidth:18, textAlign:"center" }}>
          {pendingCount > 9 ? "9+" : pendingCount}
        </span>
      )}
    </button>
  </div>
)}

                <div className="dropdown-section">
                  <button className="dd-item danger" onClick={handleLogout}><IconLogout /> Çıkış Yap</button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </header>

      {storyOpen && <ProjectStoryModal onClose={() => setStoryOpen(false)} />}
    </>
  );
}