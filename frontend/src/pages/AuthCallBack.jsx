// src/pages/AuthCallback.jsx
import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { consumeLoginReturn } from "../lib/loginReturn";
import { completeWebLogin } from "../lib/auth";
import { apiGet }   from "../lib/api";
import { membershipStep } from "../lib/terms";

export default function AuthCallback() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    async function handle() {
      window.history.replaceState({}, document.title, window.location.pathname);
      try {
        await completeWebLogin();
        const data = await apiGet("/auth/me");
        const user = data.user ?? data;
        if (user?._id) localStorage.setItem("user", JSON.stringify(user));
        navigate(membershipStep(user) || consumeLoginReturn(), { replace: true });
      } catch {
        navigate("/login?error=session", { replace: true });
      }
    }

    handle();
  }, [navigate, searchParams]);

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
