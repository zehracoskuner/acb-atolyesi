// src/pages/Register.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
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
const EnvelopeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b2500" strokeWidth="1.5">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

export default function Register() {
  const { isMobile, isSm } = useBreakpoint();
  const [form, setForm]     = useState({ kullaniciAdi: "", email: "", sifre: "" });
  const [showPw, setShowPw] = useState(false);
  const [mesaj, setMesaj]   = useState(null);
  const [loading, setLoad]  = useState(false);
  const [verified, setVerified] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { document.title = "Kayıt Ol · ACB Atölyesi"; }, []);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const pwScore = (() => {
    const v = form.sifre;
    return [v.length >= 6, /[A-Z]/.test(v), /[0-9]/.test(v), v.length >= 10].filter(Boolean).length;
  })();
  const pwLabel = ["", "Çok kısa", "Zayıf", "İyi", "Güçlü"][pwScore];
  const pwColor = pwScore <= 1 ? "#a32d2d" : pwScore <= 2 ? "#ba7517" : "#0f6e56";
  const barColor = (i) => {
    if (i >= pwScore) return "#e8e2d8";
    return pwScore <= 1 ? "#e24b4a" : pwScore <= 2 ? "#ef9f27" : "#1d9e75";
  };
  const userHint = (() => {
    const v = form.kullaniciAdi;
    if (!v) return null;
    if (v.length < 3) return { text: "En az 3 karakter", color: "#9a8e80" };
    if (/[^a-zA-Z0-9_]/.test(v)) return { text: "Sadece harf, rakam ve _ kullanılabilir", color: "#a32d2d" };
    return { text: "Kullanıcı adı uygun", color: "#0f6e56" };
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.sifre.length < 6) { setMesaj({ type: "err", text: "Şifre en az 6 karakter olmalı." }); return; }
    setLoad(true); setMesaj(null);
    try {
      await axios.post(`${API}/auth/register`, form, { withCredentials: true });
      setVerified(true);
    } catch (err) {
      setMesaj({ type: "err", text: err.response?.data?.message || "Kayıt başarısız." });
    } finally { setLoad(false); }
  };

  /* ── Breakpoint stiller ── */
  const responsive = {
    page: {
      display:             isMobile ? "flex" : "grid",
      gridTemplateColumns: isMobile ? undefined : "1fr 460px",
      flexDirection:       isMobile ? "column" : undefined,
      minHeight:           "100vh",
      fontFamily:          "'DM Sans', sans-serif",
    },
    left:    { display: isMobile ? "none" : "block", background: "#1a1209", position: "relative", overflow: "hidden" },
    right:   {
      background:     isMobile ? "#f0ebe2" : "#faf8f4",
      borderLeft:     isMobile ? "none" : "1px solid #e2ddd6",
      display:        "flex", alignItems: "center", justifyContent: "center",
      flex:           isMobile ? 1 : undefined,
      padding:        isMobile ? (isSm ? "1.5rem 1rem" : "2rem 1.25rem") : "0",
      minHeight:      isMobile ? "100vh" : undefined,
      overflowY:      "auto",
    },
    formWrap: { width: "100%", maxWidth: isMobile ? "100%" : 360, padding: isMobile ? "0" : "2.5rem 2rem" },
    mobileLogo: { display: isMobile ? "flex" : "none", alignItems: "center", gap: ".5rem", marginBottom: "2rem" },
    input: {
      width: "100%", padding: isSm ? ".75rem .9rem" : ".62rem .85rem",
      border: "1.5px solid #e2ddd6", borderRadius: 5,
      fontFamily: "'DM Sans', sans-serif",
      fontSize: isSm ? "1rem" : ".9rem",
      color: "#1a1209", background: "#fff", outline: "none",
      boxSizing: "border-box", WebkitAppearance: "none",
    },
    btnMain: {
      width: "100%", padding: isSm ? ".8rem" : ".72rem",
      background: "#1a1209", color: "#f5f0e8", border: "none", borderRadius: 5,
      fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 500,
      letterSpacing: ".06em", textTransform: "uppercase", cursor: "pointer", marginBottom: "1rem",
      WebkitAppearance: "none",
    },
    btnGoogle: {
      width: "100%", padding: isSm ? ".72rem" : ".62rem",
      background: "#fff", color: "#3c3c3c", border: "1.5px solid #e2ddd6",
      borderRadius: 5, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem",
      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      gap: ".6rem", marginBottom: "1.5rem", WebkitAppearance: "none",
    },
  };

  /* ── E-posta doğrulama ekranı ── */
  if (verified) return (
    <div style={responsive.page}>
      <div style={responsive.left}>
        <div style={s.leftInner}>
          <div style={s.brand}><span style={s.brandDot}/><span style={s.brandName}>ACB Atölyesi</span></div>
          <div style={s.leftContent}><div style={s.leftRule}/><p style={s.leftQuote}>"Her büyük hikâye,<br/>tek bir cümleyle başlar."</p><p style={s.leftAttr}>— Atölye ruhu</p></div>
          <div style={s.leftFooter}><div style={s.avatarRow}>{["AY","MK","SE"].map((i,idx)=>(<div key={idx} style={{...s.avatar,marginLeft:idx===0?0:-8,background:["#c9b89a","#b4a48a","#a09070"][idx]}}>{i}</div>))}</div><span style={s.joinText}><strong>2.400+</strong> yazar atölyede</span></div>
        </div>
      </div>
      <div style={responsive.right}>
        <div style={{...responsive.formWrap, textAlign:"center"}}>
          <div style={s.mobileLogo}><span style={s.brandDot}/><span style={{...s.brandName,color:"#1a1209"}}>ACB Atölyesi</span></div>
          <div style={s.envCircle}><EnvelopeIcon/></div>
          <h2 style={{...s.formTitle, fontSize:"1.6rem", marginBottom:".5rem"}}>E-postanı <em style={s.formTitleEm}>doğrula</em></h2>
          <p style={{...s.formSub, marginBottom:"1.5rem"}}>
            <strong style={{color:"#1a1209"}}>{form.email}</strong> adresine<br/>bir doğrulama bağlantısı gönderdik.<br/>Doğrulamadan da giriş yapabilirsin.
          </p>
          <button style={responsive.btnMain} onClick={() => navigate("/login")}>Giriş sayfasına git</button>
          <p style={{...s.switchTxt, marginTop:".75rem"}}>
            E-posta gelmediyse{" "}
            <button style={s.textBtn} onClick={() => axios.post(`${API}/auth/resend-verification`, { email: form.email }).catch(()=>{})}>tekrar gönder</button>
          </p>
        </div>
      </div>
      <style>{css}</style>
    </div>
  );

  return (
    <div style={responsive.page}>
      <div style={responsive.left}>
        <div style={s.leftInner}>
          <div style={s.brand}><span style={s.brandDot}/><span style={s.brandName}>ACB Atölyesi</span></div>
          <div style={s.leftContent}><div style={s.leftRule}/><p style={s.leftQuote}>"Her büyük hikâye,<br/>tek bir cümleyle başlar."</p><p style={s.leftAttr}>— Atölye ruhu</p></div>
          <div style={s.leftFooter}><div style={s.avatarRow}>{["AY","MK","SE"].map((i,idx)=>(<div key={idx} style={{...s.avatar,marginLeft:idx===0?0:-8,background:["#c9b89a","#b4a48a","#a09070"][idx]}}>{i}</div>))}</div><span style={s.joinText}><strong>2.400+</strong> yazar atölyede</span></div>
        </div>
      </div>

      <div style={responsive.right}>
        <div style={responsive.formWrap}>
          {/* Mobil logo */}
          <div style={responsive.mobileLogo}><span style={s.brandDot}/><span style={{...s.brandName,color:"#1a1209"}}>ACB Atölyesi</span></div>

          <div style={s.formTop}>
            <h1 style={s.formTitle}>Atölyeye<br/><em style={s.formTitleEm}>katıl.</em></h1>
            <p style={s.formSub}>Ücretsiz hesap oluştur, yazmaya başla</p>
          </div>

          {mesaj && <div style={mesaj.type === "ok" ? s.msgOk : s.msgErr}>{mesaj.text}</div>}

          <form onSubmit={handleSubmit}>
            <div style={s.field}>
              <label style={s.label}>Kullanıcı adı</label>
              <input type="text" style={responsive.input} placeholder="yazaradi"
                value={form.kullaniciAdi} onChange={e => set("kullaniciAdi", e.target.value)} required autoComplete="username"/>
              {userHint && <p style={{...s.hint, color: userHint.color}}>{userHint.text}</p>}
            </div>
            <div style={s.field}>
              <label style={s.label}>E-posta</label>
              <input type="email" style={responsive.input} placeholder="yazar@ornek.com"
                value={form.email} onChange={e => set("email", e.target.value)} required autoComplete="email"/>
            </div>
            <div style={s.field}>
              <label style={s.label}>Şifre</label>
              <div style={s.pwWrap}>
                <input type={showPw ? "text" : "password"} style={responsive.input}
                  placeholder="En az 6 karakter" value={form.sifre}
                  onChange={e => set("sifre", e.target.value)} required autoComplete="new-password"/>
                <button type="button" style={s.pwToggle} onClick={() => setShowPw(v=>!v)}>
                  {showPw ? <EyeOff/> : <Eye/>}
                </button>
              </div>
              {form.sifre && (
                <>
                  <div style={s.strengthRow}>{[0,1,2,3].map(i=><div key={i} style={{...s.strengthBar,background:barColor(i)}}/>)}</div>
                  <p style={{...s.hint,color:pwColor}}>{pwLabel}</p>
                </>
              )}
            </div>
            <p style={s.terms}>
              Kayıt olarak{" "}<Link to="/kullanim-sartlari" style={s.termsLink}>Kullanım Şartları</Link>{" "}ve{" "}<Link to="/gizlilik" style={s.termsLink}>Gizlilik Politikası</Link>'nı kabul etmiş olursun.<Link to="/etik-kurallar" style={s.termsLink}>Etik Kuralları</Link> okumayı unutma.
            </p>
            <button type="submit" style={{...responsive.btnMain, opacity: loading ? .7 : 1}} disabled={loading}>
              {loading ? "Hesap oluşturuluyor…" : "Hesap Oluştur"}
            </button>
          </form>

          <div style={s.orRow}><span style={s.orLine}/><span style={s.orText}>ya da</span><span style={s.orLine}/></div>
          <button style={responsive.btnGoogle} onClick={() => window.location.href = `${API}/auth/google`}>
            <GoogleIcon/> Google ile devam et
          </button>
          <p style={s.switchTxt}>
            Zaten hesabın var mı?{" "}<Link to="/login" style={s.switchLink}>Giriş yap</Link>
          </p>
        </div>
      </div>
      <style>{css}</style>
    </div>
  );
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@400;500;600&display=swap');
  * { box-sizing: border-box; }
  input:focus { border-color: #8b2500 !important; box-shadow: 0 0 0 3px rgba(139,37,0,.08) !important; outline: none; }
`;

const s = {
  brand:       { display:"flex", alignItems:"center", gap:".5rem" },
  brandDot:    { display:"inline-block", width:7, height:7, borderRadius:"50%", background:"#8b2500" },
  brandName:   { fontFamily:"'Playfair Display',serif", fontSize:"1.1rem", fontWeight:700, color:"#f5f0e8", letterSpacing:"-.01em" },
  leftInner:   { position:"relative", zIndex:1, height:"100%", padding:"3rem", display:"flex", flexDirection:"column", justifyContent:"space-between" },
  leftContent: { flex:1, display:"flex", flexDirection:"column", justifyContent:"center" },
  leftRule:    { width:36, height:2, background:"#8b2500", marginBottom:"1.5rem" },
  leftQuote:   { fontFamily:"'Playfair Display',serif", fontStyle:"italic", fontSize:"1.55rem", color:"rgba(245,240,232,.9)", lineHeight:1.5, fontWeight:400, marginBottom:".75rem" },
  leftAttr:    { fontSize:".75rem", color:"rgba(245,240,232,.35)", letterSpacing:".06em" },
  leftFooter:  { display:"flex", alignItems:"center", gap:".6rem" },
  avatarRow:   { display:"flex" },
  avatar:      { width:28, height:28, borderRadius:"50%", border:"2px solid #1a1209", display:"flex", alignItems:"center", justifyContent:"center", fontSize:".58rem", fontWeight:600, color:"#1a1209" },
  joinText:    { fontSize:".75rem", color:"rgba(245,240,232,.4)" },
  mobileLogo:  { display:"none" },
  envCircle:   { width:56, height:56, borderRadius:"50%", border:"1.5px solid #e2ddd6", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1.25rem" },
  formTop:     { marginBottom:"2rem" },
  formTitle:   { fontFamily:"'Playfair Display',serif", fontSize:"2rem", fontWeight:700, color:"#1a1209", lineHeight:1.2, marginBottom:".4rem" },
  formTitleEm: { fontStyle:"italic", color:"#8b2500", fontWeight:400 },
  formSub:     { fontSize:".82rem", color:"#9a8e80", lineHeight:1.5 },
  msgOk:       { padding:".5rem .75rem", borderRadius:4, marginBottom:".9rem", fontSize:".78rem", borderLeft:"2.5px solid #0f6e56", background:"#e8f5f0", color:"#0f6e56" },
  msgErr:      { padding:".5rem .75rem", borderRadius:4, marginBottom:".9rem", fontSize:".78rem", borderLeft:"2.5px solid #a32d2d", background:"#fdf0f0", color:"#a32d2d" },
  field:       { marginBottom:"1.1rem" },
  label:       { display:"block", fontSize:".7rem", fontWeight:500, color:"#9a8e80", letterSpacing:".07em", textTransform:"uppercase", marginBottom:".4rem" },
  pwWrap:      { position:"relative" },
  pwToggle:    { position:"absolute", right:".75rem", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#c4bdb2", padding:0, display:"flex" },
  strengthRow: { display:"flex", gap:3, marginTop:".35rem" },
  strengthBar: { flex:1, height:2.5, borderRadius:2 },
  hint:        { fontSize:".7rem", marginTop:".3rem" },
  terms:       { fontSize:".7rem", color:"#b0a898", lineHeight:1.55, marginBottom:"1rem" },
  termsLink:   { color:"#8b2500", textDecoration:"none" },
  orRow:       { display:"flex", alignItems:"center", gap:".6rem", marginBottom:"1rem" },
  orLine:      { flex:1, height:1, background:"#e8e2d8" },
  orText:      { fontSize:".7rem", color:"#c4bdb2", letterSpacing:".05em" },
  switchTxt:   { textAlign:"center", fontSize:".78rem", color:"#9a8e80" },
  switchLink:  { color:"#1a1209", fontWeight:500, textDecoration:"none" },
  textBtn:     { background:"none", border:"none", cursor:"pointer", color:"#1a1209", fontWeight:500, fontSize:".78rem", padding:0, fontFamily:"'DM Sans',sans-serif" },
};