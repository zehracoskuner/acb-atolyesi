import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, PenLine } from "lucide-react";
import { apiGet } from "../../lib/api";
import CreateWorkModal from "../CreateWorkModal";
import { BookCover } from "./WriterShelf";
import { timeAgo, questionForDate } from "./feedPresentation";

export default function AtelierToday() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: false, work: null });
  const [retry, setRetry] = useState(0);
  const [creating, setCreating] = useState(false);
  const [today, setToday] = useState(() => new Date());
  const [inspirationOpen, setInspirationOpen] = useState(true);
  useEffect(() => {
    const narrow = window.matchMedia("(max-width:760px)");
    const sync = () => setInspirationOpen(!narrow.matches);
    sync(); narrow.addEventListener("change", sync);
    return () => narrow.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    let current = true;
    setState(prev => ({ ...prev, loading: true, error: false }));
    apiGet("/feed/atelier").then(res => { if (current) setState({ loading: false, error: false, work: res.work }); })
      .catch(() => { if (current) setState({ loading: false, error: true, work: null }); });
    return () => { current = false; };
  }, [retry]);
  useEffect(() => {
    const tick = setInterval(() => setToday(new Date()), 60000);
    return () => clearInterval(tick);
  }, []);
  return <aside className="atelier-today" aria-labelledby="atelier-today-title">
    <header className="atelier-today-heading"><h2 id="atelier-today-title">ATÖLYEDE BUGÜN</h2><span>{today.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}</span></header>
    <section className="atelier-last-work" aria-label="Son çalışman">
      <p className="atelier-label"><PenLine size={13} aria-hidden="true" />SON ÇALIŞMAN</p>
      {state.loading ? <div className="atelier-loading" role="status">Çalışma masan hazırlanıyor…</div> : state.error ? <div className="atelier-load-error"><p>Son çalışman yüklenemedi.</p><button type="button" onClick={() => setRetry(value => value + 1)}>Yeniden dene</button></div> : state.work ? <>
        <Link className="atelier-current-work" to={`/work/${state.work._id}/chapters`}><BookCover work={state.work} /><div><h3>{state.work.title}</h3><small>Son çalışma · {timeAgo(state.work.lastWorkedAt)}</small></div></Link>
        <p className="atelier-invitation">Yarım kalan cümlen seni bekliyor.</p>
        <Link className="atelier-write" to={`/work/${state.work._id}/chapters`}>Yazmaya dön <ArrowUpRight size={17} aria-hidden="true" /></Link>
      </> : <><h3>Henüz yazılmamış bir dünya.</h3><p className="atelier-invitation">İlk sayfa için masanda yer var.</p><button type="button" className="atelier-write" onClick={() => setCreating(true)}>İlk eserini oluştur <ArrowUpRight size={17} aria-hidden="true" /></button></>}
    </section>
    <details className="atelier-inspiration" open={inspirationOpen} onToggle={event => setInspirationOpen(event.currentTarget.open)}>
      <summary>Masandan bir not <span>Günün sorusu & alıntı</span></summary>
      <section className="atelier-question"><p className="atelier-label">GÜNÜN SORUSU</p><p>{questionForDate(today)}</p><span className="atelier-question-mark" aria-hidden="true">?</span></section>
      <figure className="atelier-quote"><span aria-hidden="true">“</span><blockquote>Ben buradayım sevgili okuyucum, sen neredesin acaba?</blockquote><figcaption>— Oğuz Atay</figcaption></figure>
    </details>
    {creating && <CreateWorkModal isOpen onClose={() => setCreating(false)} onSuccess={work => navigate(`/work/${work._id || work.id}/chapters`)} />}
  </aside>;
}
