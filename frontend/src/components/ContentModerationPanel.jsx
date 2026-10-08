import { useCallback, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { apiGet, apiPost } from '../lib/api';
import './ReportCase.css';
import { API_BASE as API } from "../lib/apiBase";
const labels = { cover: 'Eser kapağı', avatar: 'Profil fotoğrafı', banner: 'Profil bannerı', chapter: 'Bölüm' };
export default function ContentModerationPanel({ caseId, onChanged }) {
  const [items, setItems] = useState([]), [detail, setDetail] = useState(null);
  const [status, setStatus] = useState('pending'), [page, setPage] = useState(1);
  const [reason, setReason] = useState(''), [message, setMessage] = useState(''), [until, setUntil] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [evidence, setEvidence] = useState('');
  const load = useCallback(async () => { try { setItems((await apiGet(`/moderation/cases?status=${status}&page=${page}`)).items); } catch(e) { setError(e.message); } }, [status, page]);
  useEffect(() => { if (!caseId) load(); }, [load, caseId]);
  useEffect(() => { if (caseId) open(caseId); }, [caseId]);
  useEffect(() => {
    let disposed = false, objectUrl;
    setEvidence('');
    if (detail?.item.asset) {
      const token = localStorage.getItem('token');
      fetch(`${API}/moderation/cases/${detail.item._id}/evidence`, { credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(async res => { if (!res.ok) return; objectUrl = URL.createObjectURL(await res.blob()); if (!disposed) setEvidence(objectUrl); else URL.revokeObjectURL(objectUrl); })
        .catch(() => { if (!disposed) setError('Özel kanıt yüklenemedi.'); });
    }
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [detail?.item._id, detail?.item.revision, detail?.item.asset]);
  async function open(id) { try { setDetail(await apiGet(`/moderation/cases/${id}`)); setReason(''); setMessage(''); setError(''); } catch(e) { setError(e.message); } }
  async function decide(action) {
    if (!reason.trim()) return setError('Gerekçe zorunludur.');
    setBusy(true); setError('');
    try {
      await apiPost(`/moderation/cases/${detail.item._id}/decision`, { action, reason, message, revision: detail.item.revision });
      await open(detail.item._id); if (!caseId) await load(); onChanged?.();
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  async function block() {
    if (!reason.trim() || !until) return setError('Manuel engel için gerekçe ve bitiş tarihi gerekir.');
    setBusy(true);
    try { await apiPost(`/moderation/users/${detail.item.owner}/images/block`, { reason, until: new Date(until).toISOString() }); setError('Gerekçeli görsel engeli kaydedildi.'); }
    catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="report-case">
    <h2>Görsel ve bölüm şikâyetleri</h2>
    <p>Şikâyet sayısı karar değildir. İçeriği ve bağlamı inceleyip gerekçeli karar verin.</p>
    {error && <p role="alert">{error}</p>}
    {caseId && !detail && !error && <p role="status">İnceleme yükleniyor…</p>}
    {caseId && <button disabled={busy} onClick={() => open(caseId)}>Yenile</button>}
    {!caseId && <><select aria-label="İnceleme durumu" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
      <option value="pending">Bekleyen</option><option value="removed">Kaldırılan</option><option value="dismissed">Reddedilen şikâyet</option><option value="reversed">Geri alınan karar</option>
    </select>
    <button onClick={load}>Yenile</button>
    {items.map(item => <p key={item._id}><button onClick={() => open(item._id)}>{labels[item.kind]} · {item.reportCount} şikâyet · {new Date(item.createdAt).toLocaleString('tr-TR')}</button></p>)}
    {!items.length && <p>Bu durumda inceleme yok.</p>}
    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Önceki</button><span> {page} </span><button disabled={items.length < 30} onClick={() => setPage(p => p + 1)}>Sonraki</button></>}
    {detail && <article>
      <h3>{labels[detail.item.kind]} incelemesi</h3>
      <p>Sürüm: {detail.item.version}</p>
      {evidence && <img src={evidence} alt="Yalnız yetkililere açık şikâyet kanıtı" style={{ maxWidth: '100%', maxHeight: 420 }} />}
      {detail.asset && <p>Depolama/CDN işlemi: {detail.asset.delivery}. {detail.asset.deliveryError || ''}{!evidence && ' Eski dış görsel için özel kanıt bulunmayabilir.'}</p>}
      {detail.item.kind === 'chapter' && <>
        <h4>Şikâyet anındaki metin: {detail.item.snapshot?.title}</h4>
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.item.snapshot?.content || '') }} />
        <details><summary>Güncel bölümle karşılaştır</summary><h4>{detail.current?.title}</h4><div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.current?.content || '') }} /></details>
      </>}
      {detail.complaints.map(c => <p key={c._id}>{c.reason}: {c.description || 'Açıklama yok'}</p>)}
      {detail.item.events.map((e, i) => <p key={i}>{new Date(e.at).toLocaleString('tr-TR')} · {e.action}: {e.reason}</p>)}
      {detail.canDecide === false && <p>Taraf olduğunuz dosyayı inceleyebilirsiniz; nihai karar veremezsiniz.</p>}
      {detail.canDecide !== false && <>
      <label>Karar gerekçesi<textarea maxLength={4000} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <label>Kullanıcıya mesaj (isteğe bağlı)<textarea maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} /></label>
      {detail.item.status === 'pending' && <><button disabled={busy} onClick={() => decide('remove')}>İhlali doğrula ve kaldır</button><button disabled={busy} onClick={() => decide('dismiss')}>Şikâyeti reddet</button></>}
      {detail.item.status === 'removed' && <><button disabled={busy} onClick={() => decide('reverse')}>Kararı geri al</button>{detail.asset?.delivery === 'purge_pending' && <button disabled={busy} onClick={() => decide('retry_delivery')}>CDN silmeyi tekrar dene</button>}</>}
      {detail.item.kind !== 'chapter' && <details><summary>Ağır ihlal için manuel görsel engeli</summary><label>Bitiş zamanı<input type="datetime-local" value={until} onChange={e => setUntil(e.target.value)} /></label><button disabled={busy} onClick={block}>Gerekçeli engel uygula</button></details>}
      </>}
    </article>}
  </section>;
}
