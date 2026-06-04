// frontend/src/pages/EmailDogrula.jsx
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";

export default function EmailDogrula() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [durum, setDurum] = useState("bekleniyor");
  const [gonderiyor, setGonderiyor] = useState(false);
  const [yenidenmesaj, setYenidenMesaj] = useState("");

  useEffect(() => {
    const status = searchParams.get("status");
    const token  = searchParams.get("token");

    if (status === "success") {
      setDurum("basarili");
      setTimeout(() => navigate("/login?verified=true"), 2500);
    } else if (status === "invalid" || status === "error") {
      setDurum("hata");
    } else if (token) {
      // Eski /email-dogrula/:token formatından gelen direkt token
      axios
        .get(`/api/auth/verify-email?token=${token}`)
        .then(() => {
          setDurum("basarili");
          setTimeout(() => navigate("/login?verified=true"), 2500);
        })
        .catch(() => setDurum("hata"));
    } else {
      setDurum("hata");
    }
  }, [searchParams]);

  async function handleResend() {
    const email = prompt("Kayıtlı e-posta adresinizi girin:");
    if (!email) return;
    setGonderiyor(true);
    try {
      await axios.post("/api/auth/resend-verification", { email });
      setYenidenMesaj("Doğrulama e-postası tekrar gönderildi. Gelen kutunuzu kontrol edin.");
    } catch {
      setYenidenMesaj("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setGonderiyor(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f0ebe2",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Georgia', serif",
    }}>
      <div style={{
        background: "#faf8f4",
        border: "1px solid #e2ddd6",
        borderRadius: "8px",
        padding: "48px 56px",
        maxWidth: "480px",
        width: "100%",
        textAlign: "center",
      }}>

        {durum === "bekleniyor" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <p style={{ color: "#7a6e5f", fontSize: 15 }}>Doğrulanıyor...</p>
          </>
        )}

        {durum === "basarili" && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "#eaf5ea", display: "flex",
              alignItems: "center", justifyContent: "center",
              margin: "0 auto 24px",
            }}>
              <span style={{ color: "#2d7a2d", fontSize: 24 }}>✓</span>
            </div>
            <h1 style={{ fontSize: 24, color: "#1a1209", margin: "0 0 8px" }}>
              E-posta <em style={{ color: "#2d7a2d", fontWeight: "normal" }}>doğrulandı!</em>
            </h1>
            <p style={{ color: "#7a6e5f", fontSize: 14, lineHeight: 1.7, margin: "16px 0 0" }}>
              Hesabın aktifleştirildi. Giriş sayfasına yönlendiriliyorsun...
            </p>
          </>
        )}

        {durum === "hata" && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "#fdecea", display: "flex",
              alignItems: "center", justifyContent: "center",
              margin: "0 auto 24px",
            }}>
              <span style={{ color: "#8b2500", fontSize: 22 }}>✕</span>
            </div>
            <h1 style={{ fontSize: 24, color: "#1a1209", margin: "0 0 8px" }}>
              Bağlantı <em style={{ color: "#8b2500", fontWeight: "normal" }}>geçersiz</em>
            </h1>
            <p style={{ color: "#7a6e5f", fontSize: 14, lineHeight: 1.7, margin: "16px 0 28px" }}>
              Bu doğrulama bağlantısı geçersiz veya süresi dolmuş.
              Yeni bir bağlantı talep edebilirsin.
            </p>

            {yenidenmesaj ? (
              <p style={{ color: "#2d7a2d", fontSize: 13, marginBottom: 20 }}>{yenidenmesaj}</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={gonderiyor}
                style={{
                  display: "inline-block", padding: "12px 28px",
                  background: "#1a1209", color: "#f5f0e8",
                  border: "none", borderRadius: "4px",
                  fontSize: 13, fontFamily: "sans-serif",
                  letterSpacing: ".06em", textTransform: "uppercase",
                  fontWeight: 500, cursor: "pointer",
                }}
              >
                {gonderiyor ? "Gönderiliyor..." : "Tekrar Dene"}
              </button>
            )}

            <div style={{ marginTop: 24 }}>
              <Link to="/login" style={{ color: "#8b2500", fontSize: 13 }}>
                Giriş sayfasına dön
              </Link>
            </div>
          </>
        )}

      </div>
    </div>
  );
}