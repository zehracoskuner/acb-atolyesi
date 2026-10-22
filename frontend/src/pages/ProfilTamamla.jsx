import { refreshSession } from "../lib/session";
import { consumeLoginReturn } from "../lib/loginReturn";
// src/pages/ProfilTamamla.jsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import TermsAcceptance from "../components/TermsAcceptance";
import { TERMS_VERSION, membershipStep } from "../lib/terms";
import { apiGet } from "../lib/api";

import { API_BASE as API } from "../lib/apiBase";

export default function ProfilTamamla() {
  const navigate = useNavigate();

  const [birthYear, setBirthYear] = useState("");
  const [existingUsername, setExistingUsername] = useState(false);
  const [ownedUsername, setOwnedUsername] = useState("");
  const [username, setUsername] = useState("");
  const [status,   setStatus]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.title = "Profili Tamamla · ACB Atölyesi";

    let active = true;
    apiGet("/auth/me").then(({ user }) => {
      if (!active) return;
      if (user.profileComplete !== false && Number.isInteger(user.birthYear)) {
        navigate(membershipStep(user) || consumeLoginReturn(), { replace: true });
      } else {
        const canChoose = user.canChooseUsername ?? (user.profileComplete === false && ['google', 'both'].includes(user.authProvider));
        setOwnedUsername(user.kullaniciAdi || '');
        setExistingUsername(!canChoose && !!user.kullaniciAdi);
        // Google creates an internal placeholder; the author chooses their public name here.
        setUsername(canChoose && ['google', 'both'].includes(user.authProvider) ? '' : user.kullaniciAdi || '');
        setReady(true);
      }
    }).catch(() => { if (active) setError("Hesap bilgileri alınamadı. Sayfayı yenileyerek tekrar deneyin."); });
    return () => { active = false; };
  }, [navigate]);

  useEffect(() => {
    if (existingUsername) { setStatus("ok"); return; }
    if (username.length < 3) {
      setStatus(username.length > 0 ? "invalid" : null);
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      setStatus("invalid");
      return;
    }
    if (username === ownedUsername) { setStatus("ok"); return; }
    setStatus("checking");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/auth/check-username?q=${encodeURIComponent(username)}`, { signal: controller.signal });
        if (!res.ok) throw new Error('Username check failed');
        const data = await res.json();
        if (!controller.signal.aborted) setStatus(data.available ? "ok" : "taken");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, 500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [username, existingUsername, ownedUsername]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!ready || status !== "ok") return;
    if (!termsAccepted) { setError("Devam etmek için sözleşmeyi kabul etmelisiniz."); return; }
    setSaving(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(`${API}/auth/complete-profile`, {
        method:  "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ kullaniciAdi: username, birthYear: Number(birthYear), termsAccepted, termsVersion: TERMS_VERSION }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "BIRTH_YEAR_ALREADY_SET") {
          await refreshSession({ force: true });
          const { user } = await apiGet("/auth/me");
          const step = membershipStep(user);
          if (step !== "/profili-tamamla") { navigate(step || consumeLoginReturn(), { replace: true }); return; }
        }
        if (data.code === "TERMS_VERSION_MISMATCH") setTermsAccepted(false);
        setError(data.message || "Bir hata oluştu."); return;
      }

      if (data.token) localStorage.setItem("token", data.token);
      localStorage.setItem("user",  JSON.stringify(data.user));
      await refreshSession({ force: true });
      navigate(consumeLoginReturn(), { replace: true });
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
    ok:       existingUsername ? "Mevcut kullanıcı adın korunacak." : username === ownedUsername ? "Bu kullanıcı adı sana ait." : "Kullanıcı adı müsait!",
    taken:    "Bu kullanıcı adı alınmış.",
    invalid:  "3–30 karakter, sadece harf/rakam/_",
    error:    "Kullanıcı adı kontrol edilemedi. Bağlantını kontrol edip tekrar yaz.",
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logoRow}>
          <span style={s.dot} />
          <span style={s.logoText}>ACB Atölyesi</span>
        </div>

        <h1 style={s.title}>Profilini <em style={s.em}>tamamla.</em></h1>
        <p style={s.sub}>
          Doğum yılını paylaş. Gün ve ay bilgisi istemiyoruz.
          {existingUsername ? 'Mevcut kullanıcı adın korunacak.' : 'Hikâyelerinde görünecek kullanıcı adını seç.'}
        </p>

        {error && <div style={s.errBox}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={s.group}>
            <label style={s.label} htmlFor="birth-year">Doğum yılı</label>
            <input id="birth-year" style={s.input} type="number" min="1900" max={new Date().getFullYear()} required value={birthYear} onChange={e => setBirthYear(e.target.value)} autoComplete="bday-year" />
          </div>
          <div style={s.group}>
            <label style={s.label} htmlFor="profile-username">Kullanıcı Adı</label>
            <div style={{ position: "relative" }}>
              <input
                id="profile-username"
                style={{
                  ...s.input,
                  borderColor: status === "ok" ? "#0f6e56"
                    : (status === "taken" || status === "invalid") ? "#a32d2d"
                    : "#e2ddd6",
                  paddingRight: "2.2rem",
                }}
                disabled={existingUsername || !ready || saving}
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

          <TermsAcceptance checked={termsAccepted} onChange={setTermsAccepted} disabled={saving || !ready} />
          <button
            type="submit"
            style={{ ...s.btn, opacity: status === "ok" && !saving ? 1 : .45, cursor: status === "ok" && !saving ? "pointer" : "not-allowed" }}
            disabled={status !== "ok" || saving || !termsAccepted || !ready}
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
  wrap:     { minHeight: "100vh", background: "#f0ebe2", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(16px, 4vw, 32px)", fontFamily: "'DM Sans', sans-serif" },
  card:     { background: "#faf8f4", border: "1px solid #e2ddd6", borderRadius: 10, padding: "clamp(20px, 5vw, 40px) clamp(18px, 4vw, 36px)", width: "100%", maxWidth: 400 },
  logoRow:  { display: "flex", alignItems: "center", gap: 6, marginBottom: "1.5rem" },
  dot:      { display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#8b2500" },
  logoText: { fontFamily: "'Playfair Display', serif", fontSize: "1rem", fontWeight: 700, color: "#1a1209" },
  title:    { fontFamily: "'Playfair Display', serif", fontSize: "1.65rem", fontWeight: 700, color: "#1a1209", lineHeight: 1.2, margin: "0 0 .4rem" },
  em:       { fontStyle: "italic", color: "#8b2500", fontWeight: 400 },
  sub:      { fontSize: ".83rem", color: "#9a8e80", lineHeight: 1.6, margin: "0 0 1.5rem" },
  errBox:   { padding: ".5rem .75rem", background: "#fdf0f0", borderLeft: "2.5px solid #a32d2d", borderRadius: 4, fontSize: ".78rem", color: "#a32d2d", marginBottom: ".9rem" },
  group:    { marginBottom: "1.1rem" },
  label:    { display: "block", fontSize: ".7rem", fontWeight: 500, color: "#9a8e80", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: ".4rem" },
  input:    { width: "100%", padding: ".62rem .85rem", border: "1.5px solid #e2ddd6", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: "1rem", color: "#1a1209", background: "#fff", transition: "border .18s" },
  hint:     { fontSize: ".68rem", color: "#b0a898", marginTop: ".3rem" },
  btn:      { width: "100%", padding: ".72rem", background: "#1a1209", color: "#f5f0e8", border: "none", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: ".82rem", fontWeight: 500, letterSpacing: ".05em", cursor: "pointer", transition: "background .18s" },
};
