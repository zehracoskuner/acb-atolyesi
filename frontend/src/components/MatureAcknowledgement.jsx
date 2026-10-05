import { useEffect, useState } from "react";
import { apiPost } from "../lib/api";

export default function MatureAcknowledgement() {
  const [request, setRequest] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const receive = event => { setError(""); setRequest(event.detail); };
    window.addEventListener("acb-mature-acknowledgement", receive);
    return () => window.removeEventListener("acb-mature-acknowledgement", receive);
  }, []);
  if (!request) return null;
  function close() { request.resolve(false); setRequest(null); }
  async function accept() {
    setSaving(true); setError("");
    try {
      await apiPost(`/public/works/${request.workId}/mature-acknowledgement`);
      request.resolve(true); setRequest(null);
    } catch { setError("Onay kaydedilemedi. Tekrar deneyin."); }
    finally { setSaving(false); }
  }
  return <div style={{ position: "fixed", inset: 0, background: "#0006", zIndex: 10000, display: "grid", placeItems: "center", padding: 20 }}>
    <div role="dialog" aria-modal="true" aria-labelledby="mature-prompt" style={{ background: "#fffdf8", color: "#281f18", borderRadius: 12, padding: 24, maxWidth: 390 }}>
      <p id="mature-prompt">Bu hikâye yetişkinlere yönelik içerik barındırıyor. Devam etmek istiyor musun?</p>
      {error && <p role="alert">{error}</p>}
      <div style={{ display: "flex", gap: 12 }}>
        <button autoFocus disabled={saving} onClick={accept}>Devam et</button>
        <button disabled={saving} onClick={close}>Çık</button>
      </div>
    </div>
  </div>;
}
