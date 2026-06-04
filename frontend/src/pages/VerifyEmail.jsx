// src/pages/VerifyEmail.jsx
import { useSearchParams, Link } from "react-router-dom";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");

  const states = {
    success: {
      icon: "✓",
      iconBg: "#e8f5f0",
      iconColor: "#0f6e56",
      title: "E-posta doğrulandı!",
      titleEm: "doğrulandı",
      sub: "Hesabın aktif. Artık tüm özelliklere erişebilirsin.",
      btn: { to: "/login", label: "Giriş Yap" },
    },
    invalid: {
      icon: "×",
      iconBg: "#fdf0f0",
      iconColor: "#a32d2d",
      title: "Bağlantı geçersiz",
      titleEm: "geçersiz",
      sub: "Bu doğrulama bağlantısı geçersiz veya süresi dolmuş. Yeni bir bağlantı talep edebilirsin.",
      btn: { to: "/register", label: "Tekrar Dene" },
    },
    error: {
      icon: "!",
      iconBg: "#fdf0f0",
      iconColor: "#a32d2d",
      title: "Bir hata oluştu",
      titleEm: "hata",
      sub: "Doğrulama sırasında bir sorun çıktı. Lütfen tekrar dene.",
      btn: { to: "/register", label: "Geri Dön" },
    },
  };

  const state = states[status] || states.invalid;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f0ebe2", fontFamily: "'DM Sans', sans-serif", padding: "2rem",
    }}>
      <div style={{
        background: "#faf8f4", border: "1px solid #e2ddd6", borderRadius: 8,
        padding: "3rem 2.5rem", maxWidth: 420, width: "100%", textAlign: "center",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: state.iconBg, color: state.iconColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.5rem", fontWeight: 700, margin: "0 auto 1.5rem",
          border: `1.5px solid ${state.iconColor}22`,
        }}>
          {state.icon}
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "1.75rem", fontWeight: 700,
          color: "#1a1209", lineHeight: 1.2, marginBottom: ".5rem",
        }}>
          {state.title.replace(state.titleEm, "")}<em style={{ color: "#8b2500", fontWeight: 400 }}>{state.titleEm}</em>
        </h1>
        <p style={{ fontSize: ".85rem", color: "#7a6e5f", lineHeight: 1.7, marginBottom: "2rem" }}>
          {state.sub}
        </p>
        <Link to={state.btn.to} style={{
          display: "inline-block", padding: ".7rem 2rem",
          background: "#1a1209", color: "#f5f0e8",
          textDecoration: "none", borderRadius: 5,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: ".82rem", fontWeight: 500,
          letterSpacing: ".06em", textTransform: "uppercase",
        }}>
          {state.btn.label}
        </Link>
      </div>
    </div>
  );
}