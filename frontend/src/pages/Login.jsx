// src/pages/Login.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { setToken } from "../lib/auth";
import { useBreakpoint } from "../hooks/useBreakpoint";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";

const Eye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function Login() {
  const { isMobile, isSm } = useBreakpoint();
  const [searchParams] = useSearchParams();

  const [email, setEmail]   = useState("");
  const [sifre, setSifre]   = useState("");
  const [showPw, setShowPw] = useState(false);
  const [mesaj, setMesaj]   = useState(null);
  const [loading, setLoad]  = useState(false);
  const navigate = useNavigate();

  const [verifyHata, setVerifyHata]             = useState(false);
  const [verifyBilgi, setVerifyBilgi]           = useState(false);
  const [tekrarGonderildi, setTekrarGonderildi] = useState(false);

  useEffect(() => {
    document.title = "Giriş Yap · ACB Atölyesi";
    if (searchParams.get("verified") === "true") setVerifyBilgi(true);
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoad(true);
    setMesaj(null);
    setVerifyHata(false);
    setTekrarGonderildi(false);

    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, sifre }, { withCredentials: true });
      setToken(data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setMesaj({ type: "ok", text: "Giriş başarılı, yönlendiriliyorsunuz…" });
      setTimeout(() => navigate("/keşfet", { replace: true }), 800);
    } catch (err) {
      const data   = err.response?.data;
      const status = err.response?.status;

      if (status === 403 && data?.code === "EMAIL_NOT_VERIFIED") {
        setVerifyHata(true);
      } else if (data?.provider === "google") {
        setMesaj({ type: "google", text: data.message });
      } else {
        setMesaj({ type: "err", text: data?.message || "Giriş başarısız." });
      }
    } finally {
      setLoad(false);
    }
  };

  // email state'inden okur — form submit edilmeden tıklanırsa boş gitmez
  const handleTekrarGonder = async () => {
    if (!email) return;
    try {
      await axios.post(`${API}/auth/resend-verification`, { email });
    } catch {
      // Güvenlik gereği hata sessizce yutulur
    } finally {
      setTekrarGonderildi(true);
      setVerifyHata(false);
    }
  };

  /* ── Responsive stiller ── */
  const s = {
    page: {
      display:             isMobile ? "flex" : "grid",
      gridTemplateColumns: isMobile ? undefined : "1fr 460px",
      flexDirection:       isMobile ? "column" : undefined,
      minHeight:           "100vh",
      fontFamily:          "'DM Sans', sans-serif",
    },
    left: {
      display:    isMobile ? "none" : "block",
      background: "#1a1209",
      position:   "relative",
      overflow:   "hidden",
    },
    leftInner: {
      position:      "relative",
      zIndex:        1,
      height:        "100%",
      padding:       "3rem",
      display:       "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    },
    right: {
      background:     isMobile ? "#f0ebe2" : "#faf8f4",
      borderLeft:     isMobile ? "none" : "1px solid #e2ddd6",
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      flex:           isMobile ? 1 : undefined,
      padding:        isMobile
        ? (isSm ? "2rem 1.25rem" : "2.5rem 1.5rem")
        : "2rem 2.5rem",
      minHeight:      isMobile ? "100vh" : undefined,
    },
    formWrap: {
      width:    "100%",
      maxWidth: isMobile ? 420 : 360,
    },
    mobileLogo: {
      display:      isMobile ? "flex" : "none",
      alignItems:   "center",
      gap:          ".5rem",
      marginBottom: "2rem",
    },
    input: {
      width:             "100%",
      padding:           isSm ? ".75rem .9rem" : ".62rem .85rem",
      border:            "1.5px solid #e2ddd6",
      borderRadius:      5,
      fontFamily:        "'DM Sans', sans-serif",
      fontSize:          isSm ? "1rem" : ".9rem",
      color:             "#1a1209",
      background:        "#fff",
      outline:           "none",
      boxSizing:         "border-box",
      WebkitAppearance:  "none",
    },
    btnMain: {
      width:            "100%",
      padding:          isSm ? ".8rem" : ".72rem",
      background:       "#1a1209",
      color:            "#f5f0e8",
      border:           "none",
      borderRadius:     5,
      fontFamily:       "'DM Sans', sans-serif",
      fontSize:         ".82rem",
      fontWeight:       500,
      letterSpacing:    ".06em",
      textTransform:    "uppercase",
      cursor:           "pointer",
      marginBottom:     "1rem",
      WebkitAppearance: "none",
    },
    btnGoogle: {
      width:            "100%",
      padding:          isSm ? ".72rem" : ".62rem",
      background:       "#fff",
      color:            "#3c3c3c",
      border:           "1.5px solid #e2ddd6",
      borderRadius:     5,
      fontFamily:       "'DM Sans', sans-serif",
      fontSize:         ".82rem",
      cursor:           "pointer",
      display:          "flex",
      alignItems:       "center",
      justifyContent:   "center",
      gap:              ".6rem",
      marginBottom:     "1.5rem",
      WebkitAppearance: "none",
    },
  };

  return (
    <div style={s.page}>
      {/* Sol panel — masaüstünde */}
      <div style={s.left}>
        <div style={s.leftInner}>
          <div style={base.brand}>
            <span style={base.brandDot}/>
            <span style={base.brandName}>ACB Atölyesi</span>
          </div>
          <div style={base.leftContent}>
            <div style={base.leftRule}/>
            <p style={base.leftQuote}>"Yazmak, görünmez olanı<br/>görünür kılmaktır."</p>
            <p style={base.leftAttr}>— Atölye ruhu</p>
          </div>
        </div>
      </div>

      {/* Sağ — form */}
      <div style={s.right}>
        <div style={s.formWrap}>

          {/* Mobil logo */}
          <div style={s.mobileLogo}>
            <span style={base.brandDot}/>
            <span style={{...base.brandName, color: "#1a1209"}}>ACB Atölyesi</span>
          </div>

          <div style={base.formTop}>
            <h1 style={base.formTitle}>
              Hoş geldin,<br/>
              <em style={base.formTitleEm}>yazar.</em>
            </h1>
            <p style={base.formSub}>Hesabına giriş yap ve yazmaya devam et</p>
          </div>

          {/* E-posta doğrulandı */}
          {verifyBilgi && (
            <div style={base.msgOk}>
              ✓ E-postanız doğrulandı. Artık giriş yapabilirsiniz.
            </div>
          )}

          {/* E-posta doğrulanmamış */}
          {verifyHata && !tekrarGonderildi && (
            <div style={{ ...base.msgErr, display: "flex", flexDirection: "column", gap: ".4rem" }}>
              <span>E-posta adresiniz henüz doğrulanmadı.</span>
              <span style={{ fontSize: ".75rem", color: "#7a6e5f" }}>
                Mail gelmediyse <strong>spam/gereksiz klasörünü</strong> kontrol edin.
              </span>
              <button
                type="button"
                onClick={handleTekrarGonder}
                style={{
                  background:    "none",
                  border:        "none",
                  color:         "#a32d2d",
                  fontWeight:    600,
                  cursor:        "pointer",
                  padding:       0,
                  textAlign:     "left",
                  fontFamily:    "'DM Sans', sans-serif",
                  fontSize:      ".78rem",
                  textDecoration: "underline",
                }}
              >
                Doğrulama e-postasını tekrar gönder →
              </button>
            </div>
          )}

          {/* Tekrar gönderildi */}
          {tekrarGonderildi && (
            <div style={{...base.msgOk, borderLeftColor: "#9a8e80", background: "#f5f0e8", color: "#1a1209"}}>
              Doğrulama e-postası gönderildi. Lütfen gelen kutunuzu kontrol edin.
            </div>
          )}

          {/* Standart mesajlar */}
          {mesaj && mesaj.type === "google" ? (
            <div style={{ ...base.msgErr, borderColor: "#4285F4", background: "#f0f4ff", color: "#1a1209" }}>
              {mesaj.text}
              <button
                type="button"
                style={{
                  display:    "block",
                  marginTop:  ".5rem",
                  background: "none",
                  border:     "none",
                  color:      "#4285F4",
                  fontWeight: 600,
                  cursor:     "pointer",
                  padding:    0,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize:   ".78rem",
                }}
                onClick={() => window.location.href = `${API}/auth/google`}
              >
                Google ile giriş yap →
              </button>
            </div>
          ) : mesaj ? (
            <div style={mesaj.type === "ok" ? base.msgOk : base.msgErr}>{mesaj.text}</div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div style={base.field}>
              <label style={base.label}>E-posta</label>
              <input
                type="email"
                style={s.input}
                placeholder="birisi@ornek.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div style={base.field}>
              <div style={base.labelRow}>
                <label style={base.label}>Şifre</label>
                <Link to="/sifremi-unuttum" style={base.forgot}>Şifremi unuttum</Link>
              </div>
              <div style={base.pwWrap}>
                <input
                  type={showPw ? "text" : "password"}
                  style={s.input}
                  placeholder="••••••••"
                  value={sifre}
                  onChange={e => setSifre(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="button" style={base.pwToggle} onClick={() => setShowPw(v => !v)}>
                  {showPw ? <EyeOff/> : <Eye/>}
                </button>
              </div>
            </div>
            <button
              type="submit"
              style={{...s.btnMain, opacity: loading ? .7 : 1}}
              disabled={loading}
            >
              {loading ? "Giriş yapılıyor…" : "Giriş Yap"}
            </button>
          </form>

          <div style={base.orRow}>
            <span style={base.orLine}/>
            <span style={base.orText}>ya da</span>
            <span style={base.orLine}/>
          </div>

          <button
            type="button"
            style={s.btnGoogle}
            onClick={() => window.location.href = `${API}/auth/google`}
          >
            <GoogleIcon/> Google ile devam et
          </button>

          <p style={base.switchTxt}>
            Hesabın yok mu?{" "}
            <Link to="/register" style={base.switchLink}>Hemen kayıt ol</Link>
          </p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        input:focus {
          border-color: #8b2500 !important;
          box-shadow: 0 0 0 3px rgba(139,37,0,.08) !important;
          outline: none;
        }
      `}</style>
    </div>
  );
}

/* ── Base stiller ── */
const base = {
  brand:       { display: "flex", alignItems: "center", gap: ".5rem" },
  brandDot:    { display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#8b2500" },
  brandName:   { fontFamily: "'Playfair Display',serif", fontSize: "1.1rem", fontWeight: 700, color: "#f5f0e8", letterSpacing: "-.01em" },
  leftContent: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" },
  leftRule:    { width: 36, height: 2, background: "#8b2500", marginBottom: "1.5rem" },
  leftQuote:   { fontFamily: "'Playfair Display',serif", fontStyle: "italic", fontSize: "1.55rem", color: "rgba(245,240,232,.9)", lineHeight: 1.5, fontWeight: 400, marginBottom: ".75rem" },
  leftAttr:    { fontSize: ".75rem", color: "rgba(245,240,232,.35)", letterSpacing: ".06em" },
  formTop:     { marginBottom: "2rem" },
  formTitle:   { fontFamily: "'Playfair Display',serif", fontSize: "2rem", fontWeight: 700, color: "#1a1209", lineHeight: 1.2, marginBottom: ".4rem" },
  formTitleEm: { fontStyle: "italic", color: "#8b2500", fontWeight: 400 },
  formSub:     { fontSize: ".82rem", color: "#9a8e80", lineHeight: 1.5 },
  msgOk:       { padding: ".5rem .75rem", borderRadius: 4, marginBottom: ".9rem", fontSize: ".78rem", borderLeft: "2.5px solid #0f6e56", background: "#e8f5f0", color: "#0f6e56" },
  msgErr:      { padding: ".5rem .75rem", borderRadius: 4, marginBottom: ".9rem", fontSize: ".78rem", borderLeft: "2.5px solid #a32d2d", background: "#fdf0f0", color: "#a32d2d" },
  field:       { marginBottom: "1.1rem" },
  labelRow:    { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".4rem" },
  label:       { display: "block", fontSize: ".7rem", fontWeight: 500, color: "#9a8e80", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: ".4rem" },
  forgot:      { fontSize: ".72rem", color: "#9a8e80", textDecoration: "none" },
  pwWrap:      { position: "relative" },
  pwToggle:    { position: "absolute", right: ".75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#c4bdb2", padding: 0, display: "flex" },
  orRow:       { display: "flex", alignItems: "center", gap: ".6rem", marginBottom: "1rem" },
  orLine:      { flex: 1, height: 1, background: "#e8e2d8" },
  orText:      { fontSize: ".7rem", color: "#c4bdb2", letterSpacing: ".05em" },
  switchTxt:   { textAlign: "center", fontSize: ".78rem", color: "#9a8e80" },
  switchLink:  { color: "#1a1209", fontWeight: 500, textDecoration: "none" },
};