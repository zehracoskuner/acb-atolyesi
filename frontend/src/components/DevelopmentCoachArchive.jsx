import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
export default function DevelopmentCoachArchive({ workId, refresh, onOpen }) {
  const [items, setItems] = useState([]), [next, setNext] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiGet(`/chapters/development/${workId}/analyses`).then(data => {
      if (active) { setItems(data.items); setNext(data.nextBefore); setError(""); }
    }).catch(() => { if (active) setError("Notlar yüklenemedi. Sayfayı yeniden açarak deneyebilirsin."); });
    return () => { active = false; };
  }, [workId, refresh]);
  const more = async () => {
    if (busy) return; setBusy(true);
    try {
      const data = await apiGet(`/chapters/development/${workId}/analyses?before=${next}`);
      setItems(current => [...current, ...data.items.filter(item => !current.some(old => old._id === item._id))]); setNext(data.nextBefore); setError("");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  if (!items.length) return null;
  return <section className="development-archive" aria-label="Gelişim koçu notlarım">
    <h3>Gelişim koçu notlarım</h3>
    {error && <p role="status">{error}</p>}
    <div className="development-archive-list">{items.map(item => <button key={item._id} onClick={() => onOpen({ ...item, status: "complete" })}>
      <span>{item.result?.headline || (item.kind === "baseline" ? "İlk Yazar Profili" : "Gelişim Karşılaştırması")}</span>
      <small>{new Date(item.analyzedAt).toLocaleDateString("tr-TR")} · {item.sequence}. değerlendirme</small>
    </button>)}</div>
    {next && <button disabled={busy} onClick={more}>Önceki notlar</button>}
  </section>;
}
