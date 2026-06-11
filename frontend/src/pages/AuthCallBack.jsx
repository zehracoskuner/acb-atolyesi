// src/pages/AuthCallback.jsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { setToken } from "../lib/auth";
import { apiGet }   from "../lib/api";
import ProfilTamamla from "./ProfilTamamla";

export default function AuthCallback() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    async function handle() {
      // Token URL fragment'inde gelir (#token=...) — query'de değil.
      const hash  = window.location.hash.replace(/^#/, "");
      const token = new URLSearchParams(hash).get("token");
      const setup = searchParams.get("setup"); // "1" → kullanıcı adı seçilmeli

      if (!token) { navigate("/login?error=no_token"); return; }

      // Token'ı kaydet (+ reading progress sync tetikler)
      setToken(token);

      // Fragment'i adres çubuğundan ve geçmişten temizle
      window.history.replaceState({}, document.title,
        window.location.pathname + window.location.search);

      // Kullanıcı bilgisini çek ve localStorage'a yaz
      try {
        const data = await apiGet("/auth/me");
        const user = data.user ?? data;
        if (user?._id) localStorage.setItem("user", JSON.stringify(user));
      } catch {
        // /auth/me başarısız olsa bile devam et
      }

      navigate(setup === "1" ? "/profili-tamamla" : "/keşfet", { replace: true });
    }

    handle();
  }, []);

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      background: "#f0ebe2",
    }}>
      <p style={{ fontFamily: "Georgia, serif", color: "#7a6e5f", fontSize: ".9rem" }}>
        Yönlendiriliyor…
      </p>
    </div>
  );
}