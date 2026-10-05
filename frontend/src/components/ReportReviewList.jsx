import { useEffect, useState } from 'react';
import { apiGet } from '../lib/api';
import ReportCase from './ReportCase';

// Staff inspection is separate from the existing decision tools.
export default function ReportReviewList() {
  const [items, setItems] = useState([]), [page, setPage] = useState(1);
  const [pages, setPages] = useState(1), [selected, setSelected] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    apiGet(`/admin/reports?status=all&sayfa=${page}&limit=15`).then(data => {
      if (active) { setItems(data.sikayetler); setPages(data.meta.toplamSayfa); setError(''); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [page]);
  return <section aria-label="Şikâyet inceleme">
    <h3>Şikâyetleri incele</h3>
    {error && <p role="alert">{error}</p>}
    {items.filter(item => !item.contentCase).map(item => <p key={item._id}>
      <button onClick={() => setSelected(item._id)}>{item.targetType} · {item.reason} · Detayları incele</button>
    </p>)}
    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Önceki</button>
    <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Sonraki</button>
    {selected && <><button onClick={() => setSelected(null)}>Detayı kapat</button><ReportCase id={selected} staff /></>}
  </section>;
}
