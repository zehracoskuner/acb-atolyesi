import { refreshSession } from "../lib/session";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import TermsAcceptance from "../components/TermsAcceptance";
import { apiGet, apiPost } from "../lib/api";
import { TERMS_VERSION, membershipStep, TERMS_ACCEPT_PATH } from "../lib/terms";
import { consumeLoginReturn } from "../lib/loginReturn";

export default function SozlesmeKabul() {
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Sözleşme Kabulü · ACB Atölyesi";
    let active = true;
    apiGet("/auth/me").then(({ user }) => {
      if (!active) return;
      const step = membershipStep(user);
      if (step !== TERMS_ACCEPT_PATH) navigate(step || consumeLoginReturn(), { replace: true });
      else setReady(true);
    }).catch(() => { if (active) setError("Hesap bilgileri alınamadı. Sayfayı yenileyerek tekrar deneyin."); });
    return () => { active = false; };
  }, [navigate]);

  async function submit(event) {
    event.preventDefault();
    if (!accepted || !ready || saving) return;
    setSaving(true);
    setError("");
    try {
      const { user } = await apiPost("/auth/accept-terms", { termsAccepted: accepted, termsVersion: TERMS_VERSION });
      localStorage.setItem("user", JSON.stringify(user));
      await refreshSession({ force: true });
      navigate(consumeLoginReturn(), { replace: true });
    } catch (err) {
      setAccepted(false);
      setError(err.message || "Kabul kaydedilemedi. Tekrar deneyin.");
    } finally { setSaving(false); }
  }

  return (
    <main className="terms-screen">
      <div className="terms-card">
        <h1>Güncel sözleşmeyi inceleyin</h1>
        <p>Üyelik işlemlerine devam etmek için eser sahipliği ve izinsiz kullanım ekini içeren güncel sözleşmeyi açıkça kabul etmeniz gerekiyor.</p>
        <form onSubmit={submit}>
          <TermsAcceptance checked={accepted} onChange={setAccepted} disabled={!ready || saving} />
          {error && <p role="alert">{error}</p>}
          <button type="submit" disabled={!ready || !accepted || saving}>{saving ? "Kaydediliyor…" : "Kabul et ve devam et"}</button>
        </form>
        <p><Link to="/login">Şimdi kabul etmeden giriş sayfasına dön</Link></p>
      </div>
    </main>
  );
}
