import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import TopBar from "../components/TopBar";
import { LogCard } from "../components/feed/FeedCards";
import { apiGet } from "../lib/api";
import "../styles/WorkshopFeed.css";
export default function LogDetail() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setItem(null); setError("");
    apiGet('/logs/' + id + '/detail').then(res => { if (active) setItem(res.item); })
      .catch(err => { if (active) setError(err.status === 404 ? "Bu günlük girdisi silinmiş veya artık erişime kapalı." : "Günlük yüklenemedi. Lütfen yeniden dene."); });
    return () => { active = false; };
  }, [id]);
  return <><TopBar /><main style={{ maxWidth: 680, margin: "0 auto", padding: "32px 20px 64px" }}>
    <Link to="/bildirimler" style={{ color: "#8b2500", fontSize: 13 }}>← Bildirimler</Link>
    <h1 style={{ fontFamily: "'Lora', serif", fontSize: 26 }}>Günlükten bir sayfa</h1>
    {error ? <p role="alert">{error}</p> : item ? <LogCard key={item._id} item={item} initiallyShowComments /> : <p role="status">Günlük yükleniyor…</p>}
  </main></>;
}
