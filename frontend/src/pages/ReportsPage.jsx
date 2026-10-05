import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiGet } from '../lib/api';
import ReportCase from '../components/ReportCase';
import TopBar from '../components/TopBar';
import Footer from '../components/Footer';
import '../styles/Support.css';
const STAGES = { received: 'Alındı', reviewing: 'İncelemede', awaiting_information: 'Ek bilgi bekleniyor', decided: 'Karar verildi', appeal_review: 'İtiraz incelemede' };
export default function ReportsPage() {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => { let alive = true; setLoading(true); setError(''); apiGet(`/reports/mine?page=${page}`).then(d => { if (alive) setRows(d.sikayetler); }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [page, retry]);
  const reasons = { telif_ihlali: 'Telif hakkı', uygunsuz_icerik: 'Uygunsuz içerik', spam: 'Spam', taciz: 'Taciz', nefret_soylemi: 'Nefret söylemi', diger: 'Diğer' };
  return <div className="support-page"><TopBar /><main className="reports-page">
    <Link className="support-back" to="/ayarlar">← Ayarlara dön</Link><h1>Başvurularım</h1>
    <p>Gönderdiğin bildirimleri ve inceleme durumlarını buradan takip edebilirsin.</p>
    {error && <p role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>Tekrar dene</button></p>}
    {loading ? <p role="status">Başvurular yükleniyor…</p> : !error && <>
      <ul className="support-list">{rows.map(r => <li key={r._id}><Link to={`/basvurular/${r._id}`} aria-current={id === r._id ? 'page' : undefined}>
        <span>{reasons[r.reason] || 'Bildirim'}<br /><small>{r.number}</small></span><span>{STAGES[r.stage]}<br /><small>{new Date(r.createdAt).toLocaleDateString('tr-TR')}</small></span>
      </Link></li>)}</ul>
      {!rows.length && <div className="support-card"><p>Henüz başvurun yok.</p></div>}
    </>}
    <p><button disabled={loading || page === 1} onClick={() => setPage(p => p - 1)}>Önceki</button> Sayfa {page} <button disabled={loading || rows.length < 50} onClick={() => setPage(p => p + 1)}>Sonraki</button></p>
    {id && <ReportCase key={id} id={id} />}
  </main><Footer /></div>;
}
