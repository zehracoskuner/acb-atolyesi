// src/pages/SifremiUnuttum.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

export default function SifremiUnuttum() {
  const [email,   setEmail]   = useState("");
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => { document.title = "Şifremi Unuttum · ACB Atölyesi"; }, []);

  async function handle(e) {
    e.preventDefault();
    if (!email.includes("@")) { setError("Geçerli bir e-posta adresi girin."); return; }
    setLoading(true); setError("");
    try {
      await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Güvenlik: hata da dönse başarılı göster (kullanıcı bilgisi sızdırma)
      setSent(true);
    } catch {
      setError("Bir hata oluştu, lütfen tekrar dene.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={pg.wrap}>
      <div style={pg.card}>
        {/* Logo */}
        <div style={pg.logoRow}>
          <span style={pg.dot} />
          <span style={pg.logoText}>ACB Atölyesi</span>
        </div>

        {!sent ? (
          <>
            <h1 style={pg.title}>Şifreni mi <em style={pg.em}>unuttun?</em></h1>
            <p style={pg.sub}>E-posta adresini gir, sıfırlama bağlantısı gönderelim.</p>

            {error && <div style={pg.errBox}>{error}</div>}

            <form onSubmit={handle}>
              <div style={pg.group}>
                <label style={pg.label}>E-posta</label>
                <input
                  type="email"
                  style={pg.input}
                  placeholder="yazar@ornek.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" style={{ ...pg.btn, opacity: loading ? .6 : 1 }} disabled={loading}>
                {loading ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={pg.successIcon}>✉</div>
            <h2 style={{ ...pg.title, fontSize: "1.4rem" }}>E-posta <em style={pg.em}>gönderildi</em></h2>
            <p style={{ ...pg.sub, marginBottom: "1.5rem" }}>
              <strong style={{ color: "#1a1209" }}>{email}</strong> adresine bir sıfırlama bağlantısı gönderdik.
              Birkaç dakika içinde gelmezse spam klasörünü kontrol et.
            </p>
            <button
              style={{ ...pg.btn, background: "transparent", color: "#8b2500", border: "1px solid rgba(139,37,0,.25)" }}
              onClick={() => setSent(false)}
            >
              Tekrar gönder
            </button>
          </div>
        )}

        <p style={pg.footer}>
          <Link to="/login" style={pg.link}>← Giriş sayfasına dön</Link>
        </p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        input:focus { border-color: #8b2500 !important; box-shadow: 0 0 0 3px rgba(139,37,0,.09) !important; background: #fff !important; outline: none; }
      `}</style>
    </div>
  );
}

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
  btn: { width: "100%", padding: ".72rem", background: "#1a1209", color: "#f5f0e8", border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 500, letterSpacing: ".05em", cursor: "pointer", marginBottom: "1rem", transition: "background .18s" },
  successIcon: { width: 52, height: 52, borderRadius: "50%", border: "1.5px solid #e2ddd6", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", margin: "0 auto 1.25rem" },
  footer: { textAlign: "center", margin: "1rem 0 0", fontSize: ".78rem" },
  link: { color: "#8b2500", textDecoration: "none", fontWeight: 500 },
};