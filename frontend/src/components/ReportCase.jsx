import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../lib/api';
import './ReportCase.css';
const STAGES = { received: 'Alındı', reviewing: 'İncelemede', awaiting_information: 'Ek bilgi bekleniyor', decided: 'Karar verildi', appeal_review: 'İtiraz incelemede' };
const outcomes = { upheld: 'İhlal tespit edildi', dismissed: 'Başvuru reddedildi', inconclusive: 'İhlal tespit edilemedi' };
export default function ReportCase({ id, staff = false, onChanged }) {
  const [report, setReport] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [text, setText] = useState(''), [rationale, setRationale] = useState(''), [privateNote, setPrivateNote] = useState('');
  const [outcome, setOutcome] = useState('inconclusive'), [action, setAction] = useState('none');
  const base = staff ? '/admin/reports' : '/reports';
  useEffect(() => { let alive = true; setReport(null); setError(''); apiGet(`${base}/${id}`).then(d => { if (alive) setReport(d.report); }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, [base, id]);
  async function send(operation) {
    setBusy(true); setError('');
    try {
      const d = await apiPost(`${base}/${id}/${staff ? 'workflow' : operation}`, { operation, revision: report.revision || 0, text, rationale, privateNote, outcome, action });
      const fresh = staff ? await apiGet(`${base}/${id}`) : d;
      setReport(fresh.report); setText(''); setRationale(''); setPrivateNote(''); onChanged?.();
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  const stage = report?.stage || (report?.status === 'pending' ? 'received' : 'decided');
  return <section className="report-case">
    {error && <p role="alert">{error} <button onClick={() => apiGet(`${base}/${id}`).then(d => setReport(d.report)).catch(e => setError(e.message))}>Yenile</button></p>}
    {!report ? <p>Dosya yükleniyor…</p> : <>
      <h3>Başvuru {report._id}</h3><p><strong>{STAGES[stage]}</strong> · {new Date(report.createdAt).toLocaleString('tr-TR')}</p>
      <p>Hedef: {report.targetType} / {report.targetId}</p>
      {report.originalWork && <p>Özgün eser: {report.originalWork}</p>}{report.description && <p>Başvuru gerekçesi: {report.description}</p>}
      <h4>İşlem geçmişi</h4><ol>{(report.history || []).map((h, i) => <li key={i}>{new Date(h.at).toLocaleString('tr-TR')} — {h.text}</li>)}</ol>
      {(report.decisions || []).map((d, i) => <article key={i}><h4>Karar {i + 1} · {new Date(d.at).toLocaleString('tr-TR')}</h4><p>{outcomes[d.outcome]} · İşlem: {d.action === 'notice' ? 'Dosyada kayıtlı uyarı' : 'İşlem uygulanmadı'}</p><p>{d.rationale}</p></article>)}
      {stage === 'decided' && !report.decisions?.length && <p>Eski kayıt: karar gerekçesi bu dosyada bulunmuyor.</p>}
      {(report.appeals || []).map((a, i) => <p key={i}>İtiraz · {new Date(a.at).toLocaleString('tr-TR')}: {a.rationale}</p>)}
      {staff && <><p>İnsan incelemesi esastır. Tek başvuru veya AI benzerlik yorumu ihlal kanıtı sayılmaz.</p>
        <details><summary>Korunan kanıt (yalnızca yetkili personel)</summary><pre>{JSON.stringify(report.evidenceSnapshot || 'Eski kayıtta görüntü yok.', null, 2)}</pre></details>
        <p>Özel personel notu: {report.adminNote || '—'}</p>
        {report.canManage === false && <p>Bu dosyayı inceleyebilirsiniz; işlem ve nihai karar yetkiniz bulunmuyor.</p>}
        {report.canManage !== false && <>
        <label>Özel personel notu<textarea maxLength={4000} value={privateNote} onChange={e => setPrivateNote(e.target.value)} /></label>
        <button disabled={busy || !privateNote.trim()} onClick={() => send('note')}>Özel notu kaydet</button>
        {stage === 'received' && <button disabled={busy} onClick={() => send('review')}>İncelemeyi başlat</button>}
        {['reviewing', 'appeal_review'].includes(stage) && <>
          <label>Başvurana ek bilgi talebi<textarea maxLength={4000} value={text} onChange={e => setText(e.target.value)} /></label><button disabled={busy || !text.trim()} onClick={() => send('request_information')}>Ek bilgi iste</button>
          <label>Karar sonucu<select value={outcome} onChange={e => { setOutcome(e.target.value); setAction('none'); }}>{Object.entries(outcomes).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>Uygulanan işlem<select value={action} onChange={e => setAction(e.target.value)}><option value="none">İşlem uygulanmadı</option>{outcome === 'upheld' && <option value="notice">Dosyada kayıtlı uyarı</option>}</select></label>
          <label>Her iki tarafa açık karar gerekçesi (zorunlu)<textarea maxLength={4000} value={rationale} onChange={e => setRationale(e.target.value)} /></label>
          <p>Bu alana iletişim bilgisi veya özel kanıt eklemeyin. Karar içerik silmez veya hesap cezası uygulamaz.</p>
          <button disabled={busy || !rationale.trim()} onClick={() => send('decision')}>Gerekçeli kararı kaydet</button>
        </>}
        </>}
      </>}
      {!staff && <>
        {report.role === 'reporter' && ['awaiting_information', 'appeal_review'].includes(stage) && <><label>İstenen ek bilgi<textarea maxLength={4000} value={text} onChange={e => setText(e.target.value)} /></label><button disabled={busy || !text.trim()} onClick={() => send('information')}>Ek bilgiyi gönder</button></>}
        {report.canAppeal && <><label>İtiraz gerekçesi<textarea maxLength={4000} value={text} onChange={e => setText(e.target.value)} /></label><button disabled={busy || !text.trim()} onClick={() => send('appeal')}>Bu karara itiraz et</button></>}
      </>}
    </>}
  </section>;
}
