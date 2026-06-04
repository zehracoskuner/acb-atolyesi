// src/pages/SifreSifirla.jsx
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

export default function SifreSifirla() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const token          = searchParams.get("token");

  const [pw,      setPw]      = useState("");
  const [conf,    setConf]    = useState("");
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => { document.title = "Şifre Sıfırla · ACB Atölyesi"; }, []);

  const pwScore = [pw.length >= 6, /[A-Z]/.test(pw), /[0-9]/.test(pw), pw.length >= 10].filter(Boolean).length;
  const barColor = (i) => {
    if (i >= pwScore) return "#e8e2d8";
    return pwScore <= 1 ? "#e24b4a" : pwScore <= 2 ? "#ef9f27" : "#1d9e75";
  };
  const pwLabel = ["", "Çok kısa", "Zayıf", "İyi", "Güçlü"][pwScore];
  const pwLabelColor = pwScore <= 1 ? "#a32d2d" : pwScore <= 2 ? "#ba7517" : "#0f6e56";

  async function handle(e) {
    e.preventDefault();
    if (pw.length < 6)  { setError("Şifre en az 6 karakter olmalı."); return; }
    if (pw !== conf)     { setError("Şifreler eşleşmiyor."); return; }
    if (!token)          { setError("Geçersiz bağlantı."); return; }

    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: pw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "İşlem başarısız.");
      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Token yoksa
  if (!token) return (
    <div style={pg.wrap}>
      <div style={pg.card}>
        <div style={pg.logoRow}><span style={pg.dot}/><span style={pg.logoText}>ACB Atölyesi</span></div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem", opacity: .5 }}>⚠</div>
          <h2 style={{ ...pg.title, fontSize: "1.3rem" }}>Geçersiz <em style={pg.em}>bağlantı</em></h2>
          <p style={{ ...pg.sub, marginBottom: "1.5rem" }}>Bu şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.</p>
          <Link to="/sifremi-unuttum" style={{ ...pg.btn, display: "block", textAlign: "center", textDecoration: "none" }}>
            Yeni bağlantı iste
          </Link>
        </div>
      </div>
      <style>{fonts}</style>
    </div>
  );

  // Başarılı
  if (done) return (
    <div style={pg.wrap}>
      <div style={pg.card}>
        <div style={pg.logoRow}><span style={pg.dot}/><span style={pg.logoText}>ACB Atölyesi</span></div>
        <div style={{ textAlign: "center" }}>
          <div style={pg.successIcon}>✓</div>
          <h2 style={{ ...pg.title, fontSize: "1.4rem" }}>Şifren <em style={pg.em}>güncellendi!</em></h2>
          <p style={{ ...pg.sub, marginBottom: 0 }}>Giriş sayfasına yönlendiriliyorsunuz…</p>
        </div>
      </div>
      <style>{fonts}</style>
    </div>
  );

  return (
    <div style={pg.wrap}>
      <div style={pg.card}>
        <div style={pg.logoRow}><span style={pg.dot}/><span style={pg.logoText}>ACB Atölyesi</span></div>

        <h1 style={pg.title}>Yeni <em style={pg.em}>şifre</em> belirle</h1>
        <p style={pg.sub}>Güçlü bir şifre seç ve bir daha unutma 😄</p>

        {error && <div style={pg.errBox}>{error}</div>}

        <form onSubmit={handle}>
          <div style={pg.group}>
            <label style={pg.label}>Yeni Şifre</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                style={{ ...pg.input, paddingRight: "2.5rem" }}
                placeholder="En az 6 karakter"
                value={pw}
                onChange={e => setPw(e.target.value)}
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ position: "absolute", right: ".75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#c4bdb2", padding: 0, display: "flex" }}
              >
                {showPw
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {pw && (
              <>
                <div style={{ display: "flex", gap: 3, marginTop: 5 }}>
                  {[0,1,2,3].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: barColor(i), transition: "background .25s" }} />)}
                </div>
                <p style={{ fontSize: ".7rem", color: pwLabelColor, margin: "3px 0 0" }}>{pwLabel}</p>
              </>
            )}
          </div>

          <div style={{ ...pg.group, marginBottom: 0 }}>
            <label style={pg.label}>Şifre Tekrar</label>
            <input
              type="password"
              style={{ ...pg.input, borderColor: conf && conf !== pw ? "#a32d2d" : "#e2ddd6" }}
              placeholder="••••••••"
              value={conf}
              onChange={e => setConf(e.target.value)}
              required
            />
            {conf && conf !== pw && (
              <p style={{ fontSize: ".7rem", color: "#a32d2d", margin: "3px 0 0" }}>Şifreler eşleşmiyor</p>
            )}
          </div>

          <button type="submit" style={{ ...pg.btn, marginTop: 20, opacity: loading ? .6 : 1 }} disabled={loading}>
            {loading ? "Güncelleniyor…" : "Şifremi Güncelle"}
          </button>
        </form>

        <p style={pg.footer}>
          <Link to="/login" style={pg.link}>← Giriş sayfasına dön</Link>
        </p>
      </div>
      <style>{fonts}</style>
    </div>
  );
}

const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@400;500&display=swap');
  * { box-sizing: border-box; }
  input:focus { border-color: #8b2500 !important; box-shadow: 0 0 0 3px rgba(139,37,0,.09) !important; background: #fff !important; outline: none; }
`;

const pg = {
  wrap: { minHeight: "100vh", background: "#f0ebe2", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "'DM Sans', sans-serif" },
  card: { background: "#faf8f4", border: "1px solid #e2ddd6", borderRadius: 10, padding: "2.5rem 2.25rem", width: "100%", maxWidth: 400 },
  logoRow: { display: "flex", alignItems: "center", gap: 6, marginBottom: "2rem" },
  dot: { display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#8b2500" },
  logoText: { fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 700, color: "#1a1209" },
  title: { fontFamily: "'Playfair Display', serif", fontSize: "1.65rem", fontWeight: 700, color: "#1a1209", lineHeight: 1.2, margin: "0 0 .4rem" },
  em: { fontStyle: "italic", color: "#8b2500", fontWeight: 400 },
  sub: { fontSize: ".83rem", color: "#9a8e80", lineHeight: 1.6, margin: "0 0 1.5rem" },
  errBox: { padding: ".5rem .75rem", background: "#fdf0f0", borderLeft: "2.5px solid #a32d2d", borderRadius: 4, fontSize: ".78rem", color: "#a32d2d", marginBottom: ".9rem" },
  group: { marginBottom: "1.1rem" },
  label: { display: "block", fontSize: ".7rem", fontWeight: 500, color: "#9a8e80", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: ".4rem" },
  input: { width: "100%", padding: ".62rem .85rem", border: "1.5px solid #e2ddd6", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".9rem", color: "#1a1209", background: "#fff", transition: "border .18s" },
  btn: { width: "100%", padding: ".72rem", background: "#1a1209", color: "#f5f0e8", border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 500, letterSpacing: ".05em", cursor: "pointer", transition: "background .18s" },
  successIcon: { width: 52, height: 52, borderRadius: "50%", border: "1.5px solid #1d9e75", background: "#e8f5f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", color: "#0f6e56", margin: "0 auto 1.25rem" },
  footer: { textAlign: "center", margin: "1rem 0 0", fontSize: ".78rem" },
  link: { color: "#8b2500", textDecoration: "none", fontWeight: 500 },
};