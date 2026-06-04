// src/pages/Bildirimler.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import Footer from "../components/Footer";
import { apiGet, apiPatch } from "../lib/api";

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)     return "az önce";
  if (diff < 3600)   return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} sa önce`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

const NOTIF_ICON = {
  like:    { emoji: "❤️", bg: "rgba(239,68,68,.1)" },
  follow:  { emoji: "👤", bg: "rgba(59,130,246,.1)" },
  comment: { emoji: "💬", bg: "rgba(34,197,94,.1)"  },
  log_like:    "✨",
  log_comment: "💬",
  system:  { emoji: "📢", bg: "rgba(200,191,173,.3)" },
};

export default function Bildirimler() {
  const navigate                  = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filter,        setFilter]        = useState("all"); // all | unread

  useEffect(() => {
    document.title = "Bildirimler · ACB Atölyesi";
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login"); return; }

    apiGet("/notifications")
      .then(res => setNotifications(res.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navigate]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const displayed = filter === "unread"
    ? notifications.filter(n => !n.read)
    : notifications;

  async function markRead(id) {
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
    await apiPatch(`/notifications/${id}/read`).catch(() => {});
  }

  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await apiPatch("/notifications/read-all").catch(() => {});
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f0", fontFamily: "'DM Sans', sans-serif" }}>
      <TopBar />

      <main style={{ maxWidth: 680, margin: "0 auto", padding: "2.5rem 1.5rem 4rem" }}>

        {/* Başlık */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.75rem", fontWeight: 700, color: "#1a1209", margin: "0 0 .25rem" }}>
              Bildirimler
            </h1>
            <p style={{ fontSize: ".8rem", color: "#9a8e80", margin: 0 }}>
              {unreadCount > 0 ? `${unreadCount} okunmamış bildirim` : "Tümü okundu"}
            </p>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {/* Filtre */}
            <div style={{ display: "flex", border: "1px solid #e2ddd6", borderRadius: 6, overflow: "hidden" }}>
              {[["all", "Tümü"], ["unread", "Okunmamış"]].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setFilter(val)}
                  style={{
                    padding: "5px 14px",
                    background: filter === val ? "#1a1209" : "transparent",
                    color:      filter === val ? "#f5f0e8" : "#7a6e5f",
                    border:     "none",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize:   ".75rem",
                    fontWeight: 500,
                    cursor:     "pointer",
                    transition: "all .15s",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  padding:    "5px 14px",
                  background: "transparent",
                  color:      "#8b2500",
                  border:     "1px solid rgba(139,37,0,.25)",
                  borderRadius: 6,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize:   ".75rem",
                  fontWeight: 500,
                  cursor:     "pointer",
                }}
              >
                Tümünü okundu say
              </button>
            )}
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem 0", color: "#9a8e80", fontSize: ".85rem", fontStyle: "italic" }}>
            Yükleniyor…
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem 0" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem", opacity: .4 }}>🔔</div>
            <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: ".95rem", color: "#9a8e80" }}>
              {filter === "unread" ? "Okunmamış bildirim yok." : "Henüz bildirim yok."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {displayed.map((n, i) => {
              const { emoji, bg } = NOTIF_ICON[n.type] ?? NOTIF_ICON.system;
              return (
                <div
                  key={n._id}
                  onClick={() => !n.read && markRead(n._id)}
                  style={{
                    display:       "flex",
                    alignItems:    "flex-start",
                    gap:           "14px",
                    padding:       "14px 18px",
                    background:    n.read ? "#fff" : "rgba(139,37,0,.025)",
                    border:        "1px solid",
                    borderColor:   n.read ? "rgba(0,0,0,.06)" : "rgba(139,37,0,.12)",
                    borderRadius:  10,
                    cursor:        n.read ? "default" : "pointer",
                    transition:    "background .15s, border-color .15s",
                    animation:     `fadeUp .35s ease ${i * 0.03}s both`,
                    position:      "relative",
                  }}
                >
                  {!n.read && (
                    <div style={{
                      position:      "absolute",
                      left:          0, top: 0, bottom: 0,
                      width:         3,
                      background:    "#8b2500",
                      borderRadius:  "10px 0 0 10px",
                    }} />
                  )}

                  <div style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1rem", flexShrink: 0,
                  }}>
                    {emoji}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontFamily:  "'Lora', serif",
                      fontSize:    ".88rem",
                      color:       n.read ? "#44403c" : "#1a1209",
                      lineHeight:  1.55,
                      margin:      "0 0 4px",
                      fontWeight:  n.read ? 400 : 500,
                    }}>
                      {n.text}
                    </p>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: ".68rem", color: "#a8a29e" }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=Lora:ital@0;1&family=DM+Sans:wght@400;500&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}