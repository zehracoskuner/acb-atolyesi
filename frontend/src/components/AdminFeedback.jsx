import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPatch } from '../lib/api';
import '../styles/Support.css';
const statuses = { new: 'Yeni', reviewing: 'İnceleniyor', closed: 'Tamamlandı' };
export default function AdminFeedback({ onRefresh }) {
  const [status, setStatus] = useState('new'), [kind, setKind] = useState('all'), [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], pages: 0, total: 0 });
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await apiGet(`/feedback?status=${status}&kind=${kind}&page=${page}`)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [status, kind, page]);
  useEffect(() => { load(); }, [load]);
  async function update(id, value) {
    setBusy(id); setError('');
    try { await apiPatch(`/feedback/${id}`, { status: value }); await load(); onRefresh?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }
  return <section className="admin-feedback">
    <div className="adm-section-head"><h2 className="adm-section-title">Öneri veya şikâyetler</h2><span>{data.total} kayıt</span></div>
    <div className="adm-search-row">
      <select className="adm-filter-select" aria-label="Bildirim durumu" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
        {Object.entries(statuses).map(([v, label]) => <option key={v} value={v}>{label}</option>)}<option value="all">Tüm durumlar</option>
      </select>
      <select className="adm-filter-select" aria-label="Bildirim türü" value={kind} onChange={e => { setKind(e.target.value); setPage(1); }}><option value="all">Tüm türler</option><option value="suggestion">Öneriler</option><option value="complaint">Şikâyetler</option></select>
      <button className="adm-btn" onClick={load} disabled={loading}>Yenile</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Yükleniyor…</p> : <>
      {!data.items.length && <p>Bu kategoride bildirim yok.</p>}
      {data.items.map(item => <article key={item._id} className="admin-feedback-card">
        <div className="adm-section-head"><h3>{item.subject}</h3><span>{item.kind === 'suggestion' ? 'Öneri' : 'Şikâyet'} · {statuses[item.status]}</span></div>
        <p className="admin-feedback-meta">{item.author?.kullaniciAdi || 'Silinmiş hesap'} · {item.author?.email} · {new Date(item.createdAt).toLocaleString('tr-TR')}</p>
        <p className="admin-feedback-message">{item.message}</p>
        <div className="adm-btn-row">
          {item.status !== 'reviewing' && <button className="adm-btn" disabled={!!busy} onClick={() => update(item._id, 'reviewing')}>İncelemeye al</button>}
          {item.status !== 'closed' && <button className="adm-btn" disabled={!!busy} onClick={() => update(item._id, 'closed')}>Tamamlandı olarak işaretle</button>}
        </div>
      </article>)}
    </>}
    <div className="adm-pager"><button className="adm-btn" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)}>Önceki</button><span>{page} / {Math.max(1, data.pages)}</span><button className="adm-btn" disabled={loading || page >= data.pages} onClick={() => setPage(p => p + 1)}>Sonraki</button></div>
  </section>;
}
