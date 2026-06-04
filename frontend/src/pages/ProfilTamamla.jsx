// src/pages/ProfilTamamla.jsx

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

export default function ProfilTamamla() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [status,   setStatus]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const debounceRef = useRef(null);

  useEffect(() => {
    document.title = "Profili Tamamla · ACB Atölyesi";
    if (!localStorage.getItem("token")) navigate("/login");
  }, [navigate]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (username.length < 3) {
      setStatus(username.length > 0 ? "invalid" : null);
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/auth/check-username?q=${encodeURIComponent(username)}`);
        const data = await res.json();
        setStatus(data.available ? "ok" : "taken");
      } catch {
        setStatus(null);
      }
    }, 500);
  }, [username]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (status !== "ok") return;
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(`${API}/auth/complete-profile`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ kullaniciAdi: username }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Bir hata oluştu."); return; }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user",  JSON.stringify(data.user));
      navigate("/keşfet", { replace: true });
    } catch {
      setError("Sunucu bağlantısı kurulamadı.");
    } finally {
      setSaving(false);
    }
  }

  const statusIcon = {
    checking: <span style={{ color: "#b0a898" }}>⏳</span>,
    ok:       <span style={{ color: "#0f6e56" }}>✓</span>,
    taken:    <span style={{ color: "#a32d2d" }}>✗</span>,
    invalid:  <span style={{ color: "#a32d2d" }}>✗</span>,
  };
  const statusMsg = {
    checking: "Kontrol ediliyor…",
    ok:       "Kullanıcı adı müsait!",
    taken:    "Bu kullanıcı adı alınmış.",
    invalid:  "3–30 karakter, sadece harf/rakam/_",
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logoRow}>
          <span style={s.dot} />
          <span style={s.logoText}>ACB Atölyesi</span>
        </div>

        <h1 style={s.title}>Bir kullanıcı adı <em style={s.em}>seç.</em></h1>
        <p style={s.sub}>
          Google hesabınla giriş yaptın. Seni nasıl çağıralım?
          Şifre ve diğer ayarları daha sonra Ayarlar sayfasından düzenleyebilirsin.
        </p>

        {error && <div style={s.errBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={s.group}>
            <label style={s.label}>Kullanıcı Adı</label>
            <div style={{ position: "relative" }}>
              <input
                style={{
                  ...s.input,
                  borderColor: status === "ok" ? "#0f6e56"
                    : (status === "taken" || status === "invalid") ? "#a32d2d"
                    : "#e2ddd6",
                  paddingRight: "2.2rem",
                }}
                type="text"
                placeholder="ornek_yazar_123"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase())}
                maxLength={30}
                autoFocus
                autoComplete="off"
              />
              {status && (
                <span style={{ position: "absolute", right: ".75rem", top: "50%", transform: "translateY(-50%)" }}>
                  {statusIcon[status]}
                </span>
              )}
            </div>
            {status && (
              <p style={{ fontSize: ".7rem", marginTop: ".3rem", color: status === "ok" ? "#0f6e56" : "#a32d2d" }}>
                {statusMsg[status]}
              </p>
            )}
            <p style={s.hint}>3–30 karakter · harf, rakam ve _ kullanılabilir</p>
          </div>

          <button
            type="submit"
            style={{ ...s.btn, opacity: status === "ok" && !saving ? 1 : .45, cursor: status === "ok" && !saving ? "pointer" : "not-allowed" }}
            disabled={status !== "ok" || saving}
          >
            {saving ? "Kaydediliyor…" : "Başla →"}
          </button>
        </form>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        input:focus { border-color: #8b2500 !important; box-shadow: 0 0 0 3px rgba(139,37,0,.09) !important; outline: none; }
      `}</style>
    </div>
  );
}

const s = {
  wrap:     { minHeight: "100vh", background: "#f0ebe2", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "'DM Sans', sans-serif" },
  card:     { background: "#faf8f4", border: "1px solid #e2ddd6", borderRadius: 10, padding: "2.5rem 2.25rem", width: "100%", maxWidth: 400 },
  logoRow:  { display: "flex", alignItems: "center", gap: 6, marginBottom: "1.5rem" },
  dot:      { display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#8b2500" },
  logoText: { fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 700, color: "#1a1209" },
  title:    { fontFamily: "'Playfair Display', serif", fontSize: "1.65rem", fontWeight: 700, color: "#1a1209", lineHeight: 1.2, margin: "0 0 .4rem" },
  em:       { fontStyle: "italic", color: "#8b2500", fontWeight: 400 },
  sub:      { fontSize: ".83rem", color: "#9a8e80", lineHeight: 1.6, margin: "0 0 1.5rem" },
  errBox:   { padding: ".5rem .75rem", background: "#fdf0f0", borderLeft: "2.5px solid #a32d2d", borderRadius: 4, fontSize: ".78rem", color: "#a32d2d", marginBottom: ".9rem" },
  group:    { marginBottom: "1.1rem" },
  label:    { display: "block", fontSize: ".7rem", fontWeight: 500, color: "#9a8e80", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: ".4rem" },
  input:    { width: "100%", padding: ".62rem .85rem", border: "1.5px solid #e2ddd6", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", color: "#1a1209", background: "#fff", transition: "border .18s" },
  hint:     { fontSize: ".68rem", color: "#b0a898", marginTop: ".3rem" },
  btn:      { width: "100%", padding: ".72rem", background: "#1a1209", color: "#f5f0e8", border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 500, letterSpacing: ".05em", cursor: "pointer", transition: "background .18s" },
};