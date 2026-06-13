// src/pages/Ayarlar.jsx
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import TopBar from "../components/TopBar";
import Footer from "../components/Footer";
import { apiPatch, apiDelete } from "../lib/api";
import { clearAuth } from "../lib/auth";
import { useBreakpoint } from "../hooks/useBreakpoint";

function Msg({ msg }) {
  if (!msg) return null;
  const ok = msg.ok;
  return (
    <span style={{ fontSize: ".75rem", color: ok ? "#166534" : "#a32d2d", display: "flex", alignItems: "center", gap: 4 }}>
      {ok ? "✓" : "✕"} {msg.text}
    </span>
  );
}

/* ── Şifre Değiştir ── */
// Ayarlar.jsx içindeki PasswordSection'ı bu versiyonla değiştir.
// authProvider bilgisini localStorage'dan okur.
// Google kullanıcısına "Mevcut Şifre" alanı göstermez.

function PasswordSection({ s }) {
  const [cur,    setCur]    = useState("");
  const [next,   setNext]   = useState("");
  const [conf,   setConf]   = useState("");
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState(null);

  // Google kullanıcısı mı? (daha önce hiç şifre belirlememiş)
  const isGoogle = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return u.authProvider === "google";
    } catch { return false; }
  })();

  const pwScore = (() => {
    const v = next;
    return [v.length >= 6, /[A-Z]/.test(v), /[0-9]/.test(v), v.length >= 10].filter(Boolean).length;
  })();
  const barColor = (i) => {
    if (i >= pwScore) return "#e8e2d8";
    return pwScore <= 1 ? "#e24b4a" : pwScore <= 2 ? "#ef9f27" : "#1d9e75";
  };

  async function handle() {
    if (next !== conf)    { setMsg({ ok: false, text: "Şifreler eşleşmiyor." }); return; }
    if (next.length < 6)  { setMsg({ ok: false, text: "Şifre en az 6 karakter olmalı." }); return; }
    if (!isGoogle && !cur){ setMsg({ ok: false, text: "Mevcut şifrenizi girin." }); return; }

    setSaving(true); setMsg(null);
    try {
      // Google kullanıcısı → /auth/forgot-password akışı yerine direkt set
      // Normal kullanıcı → /user/password
      const endpoint = isGoogle ? "/user/set-password" : "/user/password";
      const body     = isGoogle
        ? { newPassword: next }
        : { currentPassword: cur, newPassword: next };

      await apiPatch(endpoint, body);
      setMsg({ ok: true, text: isGoogle ? "Şifre belirlendi! Artık e-posta ile de giriş yapabilirsin." : "Şifre güncellendi." });
      setCur(""); setNext(""); setConf("");

      // localStorage'daki authProvider'ı güncelle
      if (isGoogle) {
        try {
          const stored = JSON.parse(localStorage.getItem("user") || "{}");
          localStorage.setItem("user", JSON.stringify({ ...stored, authProvider: "both" }));
        } catch {}
      }
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setSaving(false); setTimeout(() => setMsg(null), 5000); }
  }

  return (
    <div style={s.section}>
      <div style={s.secHead}>
        <div style={{ ...s.secIcon, background: "rgba(26,18,9,.06)" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a1209" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div>
          <span style={s.secTitle}>Şifre</span>
          {isGoogle && (
            <p style={{ fontSize: ".7rem", color: "#9a8e80", margin: "2px 0 0" }}>
              Google hesabın var — şifre belirleyerek e-posta ile de giriş yapabilirsin.
            </p>
          )}
        </div>
      </div>
      <div style={s.secBody}>
        {/* Mevcut şifre — sadece local kullanıcılara göster */}
        {!isGoogle && (
          <div style={s.group}>
            <label style={s.label}>Mevcut Şifre</label>
            <input type="password" style={s.input} placeholder="••••••••" value={cur} onChange={e => setCur(e.target.value)} />
          </div>
        )}
        <div style={s.group}>
          <label style={s.label}>{isGoogle ? "Şifre Belirle" : "Yeni Şifre"}</label>
          <input type="password" style={s.input} placeholder="En az 6 karakter" value={next} onChange={e => setNext(e.target.value)} />
          {next && (
            <div style={{ display: "flex", gap: 3, marginTop: 5 }}>
              {[0,1,2,3].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: barColor(i), transition: "background .25s" }} />)}
            </div>
          )}
        </div>
        <div style={{ ...s.group, marginBottom: 0 }}>
          <label style={s.label}>Şifre Tekrar</label>
          <input type="password" style={s.input} placeholder="••••••••" value={conf} onChange={e => setConf(e.target.value)} />
        </div>
        <div style={{ ...s.row, marginTop: 16 }}>
          <button style={{ ...s.btnPri, opacity: saving ? .6 : 1 }} onClick={handle} disabled={saving}>
            {saving ? "Güncelleniyor…" : isGoogle ? "Şifreyi Belirle" : "Şifreyi Güncelle"}
          </button>
          <Msg msg={msg} />
        </div>
      </div>
    </div>
  );
}

/* ── E-posta Güncelle ── */
function EmailSection({ s }) {
  const [email, setEmail]   = useState("");
  const [cur,    setCur]    = useState("");
  const [saving, setSave]   = useState(false);
  const [msg, setMsg]       = useState(null);

  // Şifresi olan hesaplarda mevcut şifre zorunlu (Google-only kullanıcılarda değil)
  const needsPassword = (() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return u.authProvider !== "google";
    } catch { return true; }
  })();

  useEffect(() => {
    try { const u = JSON.parse(localStorage.getItem("user")); if (u?.email) setEmail(u.email); } catch {}
  }, []);

  async function handle() {
    if (!email.includes("@")) { setMsg({ ok: false, text: "Geçerli bir e-posta girin." }); return; }
    if (needsPassword && !cur) { setMsg({ ok: false, text: "Mevcut şifrenizi girin." }); return; }
    setSave(true); setMsg(null);
    try {
      await apiPatch("/user/change-email", { newEmail: email, currentPassword: cur });
      setMsg({ ok: true, text: "E-posta adresi güncellendi." });
      setCur("");
      const stored = localStorage.getItem("user");
      if (stored) localStorage.setItem("user", JSON.stringify({ ...JSON.parse(stored), email }));
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setSave(false); setTimeout(() => setMsg(null), 5000); }
  }

  return (
    <div style={s.section}>
      <div style={s.secHead}>
        <div style={s.secIcon}>✉️</div>
        <span style={s.secTitle}>E-posta Adresi</span>
      </div>
      <div style={s.secBody}>
        <div style={s.group}>
          <label style={s.label}>E-posta</label>
          <input style={s.input} type="email" placeholder="yazar@ornek.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        {needsPassword && (
          <div style={{ ...s.group, marginBottom: 0 }}>
            <label style={s.label}>Mevcut Şifre</label>
            <input type="password" style={s.input} placeholder="••••••••" value={cur} onChange={e => setCur(e.target.value)} />
          </div>
        )}
        <div style={{ ...s.row, marginTop: 12 }}>
          <button style={{ ...s.btnPri, opacity: saving ? .6 : 1 }} onClick={handle} disabled={saving}>
            {saving ? "Güncelleniyor…" : "E-postayı Güncelle"}
          </button>
          <Msg msg={msg} />
        </div>
      </div>
    </div>
  );
}

/* ── Tehlike Bölgesi ── */
function DangerSection({ s }) {
  const navigate = useNavigate();
  const [confirm, setConfirm]   = useState("");
  const [modal, setModal]       = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiDelete("/user/account");
      clearAuth();
      navigate("/login");
    } catch (e) { alert("Hesap silinemedi: " + e.message); }
    finally { setDeleting(false); }
  }

  return (
    <>
      <div style={{ ...s.section, border: "1px solid rgba(163,45,45,.2)" }}>
        <div style={{ ...s.secHead, background: "rgba(163,45,45,.02)" }}>
          <div style={s.secIcon}>⚠️</div>
          <span style={{ ...s.secTitle, color: "#a32d2d" }}>Tehlike Bölgesi</span>
        </div>
        <div style={s.secBody}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: ".88rem", fontWeight: 600, color: "#1a1209", margin: "0 0 4px" }}>Hesabımı Kalıcı Olarak Sil</p>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: ".75rem", color: "#7a6e5f", margin: 0, lineHeight: 1.55 }}>Tüm eserler, bölümler ve veriler kalıcı olarak silinir.</p>
            </div>
            <button
              style={{ padding: ".6rem 1.25rem", background: "transparent", color: "#a32d2d", border: "1px solid rgba(163,45,45,.25)", borderRadius: 6, fontFamily: "'DM Sans',sans-serif", fontSize: ".8rem", fontWeight: 500, cursor: "pointer", flexShrink: 0 }}
              onClick={() => setModal(true)}
            >
              Hesabı Sil
            </button>
          </div>
        </div>
      </div>

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: "1.75rem", maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: "1.15rem", fontWeight: 700, color: "#1a1209", margin: "0 0 .5rem" }}>Emin misin?</h3>
            <p style={{ fontSize: ".82rem", color: "#7a6e5f", lineHeight: 1.6, margin: "0 0 1.25rem" }}>
              Devam etmek için aşağıya <strong style={{ color: "#a32d2d" }}>HESABIMI SİL</strong> yaz.
            </p>
            <input
              style={{ ...s.input, marginBottom: 14, borderColor: confirm === "HESABIMI SİL" ? "#a32d2d" : "#e2ddd6" }}
              placeholder="HESABIMI SİL" value={confirm} onChange={e => setConfirm(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={{ padding: ".6rem 1rem", background: "transparent", border: "1px solid #e2ddd6", borderRadius: 6, fontFamily: "'DM Sans',sans-serif", fontSize: ".78rem", color: "#9a8e80", cursor: "pointer" }}
                onClick={() => { setModal(false); setConfirm(""); }}>Vazgeç</button>
              <button
                style={{ padding: ".6rem 1.25rem", background: confirm === "HESABIMI SİL" ? "#a32d2d" : "transparent", color: confirm === "HESABIMI SİL" ? "#fff" : "#a32d2d", border: "1px solid rgba(163,45,45,.3)", borderRadius: 6, fontFamily: "'DM Sans',sans-serif", fontSize: ".78rem", fontWeight: 500, cursor: "pointer", opacity: deleting ? .6 : 1 }}
                onClick={handleDelete} disabled={confirm !== "HESABIMI SİL" || deleting}>
                {deleting ? "Siliniyor…" : "Kalıcı Olarak Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══ Ana Sayfa ══ */
export default function Ayarlar() {
  const bp       = useBreakpoint();
  const navigate = useNavigate();
  const { isMobile, isSm } = bp;

  useEffect(() => {
    document.title = "Ayarlar · ACB Atölyesi";
    if (!localStorage.getItem("token")) navigate("/login");
  }, [navigate]);

  const s = {
    page:    { minHeight: "100vh", background: "#f7f5f0", fontFamily: "'DM Sans',sans-serif" },
    main:    { maxWidth: 680, margin: "0 auto", padding: isSm ? "1.5rem 1rem 4rem" : isMobile ? "2rem 1.25rem 5rem" : "2.5rem 1.5rem 5rem" },
    back:    { display: "inline-flex", alignItems: "center", gap: 6, fontSize: ".78rem", color: "#9a8e80", textDecoration: "none", marginBottom: "1.75rem" },
    heading: { fontFamily: "'Playfair Display',serif", fontSize: isSm ? "1.5rem" : "1.75rem", fontWeight: 700, color: "#1a1209", margin: "0 0 .3rem" },
    subhead: { fontSize: ".82rem", color: "#9a8e80", margin: "0 0 2rem" },
    section: { background: "#fff", border: "1px solid rgba(0,0,0,.07)", borderRadius: 10, marginBottom: 14, overflow: "hidden" },
    secHead: { padding: isSm ? ".9rem 1rem" : "1rem 1.25rem", borderBottom: "1px solid rgba(0,0,0,.06)", display: "flex", alignItems: "center", gap: 10 },
    secIcon: { fontSize: "1rem", flexShrink: 0 },
    secTitle:{ fontFamily: "'Playfair Display',serif", fontSize: ".95rem", fontWeight: 700, color: "#1a1209" },
    secBody: { padding: isSm ? "1rem" : "1.25rem 1.5rem" },
    group:   { marginBottom: "1rem" },
    label:   { display: "block", fontSize: ".68rem", fontWeight: 500, color: "#9a8e80", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: ".4rem" },
    input:   { width: "100%", padding: isSm ? ".72rem .9rem" : ".65rem .85rem", border: "1.5px solid #e2ddd6", borderRadius: 6, fontFamily: "'DM Sans',sans-serif", fontSize: isSm ? "1rem" : ".9rem", color: "#1a1209", background: "#faf8f4", outline: "none", boxSizing: "border-box", WebkitAppearance: "none" },
    hint:    { fontSize: ".72rem", color: "#b0a898", marginTop: ".35rem" },
    row:     { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
    btnPri:  { padding: isSm ? ".65rem 1.25rem" : ".65rem 1.5rem", background: "#1a1209", color: "#f5f0e8", border: "none", borderRadius: 6, fontFamily: "'DM Sans',sans-serif", fontSize: ".8rem", fontWeight: 500, letterSpacing: ".05em", cursor: "pointer" },
  };

  return (
    <div style={s.page}>
      <TopBar />
      <main style={s.main}>
        <Link to="/profile/me" style={s.back}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Profile dön
        </Link>
        <h1 style={s.heading}>Ayarlar</h1>
        <p style={s.subhead}>Hesap güvenliği ve tercihlerini buradan yönet.</p>
        <PasswordSection s={s} />
        <EmailSection    s={s} />
        <DangerSection   s={s} />
      </main>
      <Footer />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500&display=swap'); input:focus{border-color:#8b2500!important;box-shadow:0 0 0 3px rgba(139,37,0,.08)!important;background:#fff!important;outline:none}`}</style>
    </div>
  );
}