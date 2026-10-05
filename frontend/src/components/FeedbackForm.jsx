import { useRef, useState } from 'react';
import { apiPost } from '../lib/api';
import '../styles/Support.css';

export default function FeedbackForm() {
  const [kind, setKind] = useState('suggestion');
  const [subject, setSubject] = useState(''), [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [receipt, setReceipt] = useState('');
  const pending = useRef(false);
  async function submit(e) {
    e.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setReceipt('');
    try {
      const data = await apiPost('/feedback', { kind, subject: subject.trim(), message: message.trim() });
      setReceipt(String(data.id)); setSubject(''); setMessage('');
    } catch (err) { setError(err.message || 'Gönderilemedi. Tekrar deneyin.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="support-card" id="geri-bildirim">
    <h2>Öneri veya şikâyetler</h2>
    <p>Atölyeyle ilgili önerinizi veya yaşadığınız sorunu bizimle paylaşabilirsiniz. Mesajınız doğrudan yönetime iletilir.</p>
    <p>Bir eserin telif hakkı veya içeriğiyle ilgili bildirim için eserin üç nokta menüsünü kullanabilirsiniz.</p>
    <form onSubmit={submit}>
      <label>Bildirim türü<select value={kind} onChange={e => setKind(e.target.value)} disabled={busy}>
        <option value="suggestion">Öneri</option><option value="complaint">Şikâyet</option>
      </select></label>
      <label>Konu<input required maxLength={160} value={subject} onChange={e => setSubject(e.target.value)} disabled={busy} /></label>
      <label>Mesajınız<textarea required maxLength={4000} rows={5} value={message} onChange={e => setMessage(e.target.value)} disabled={busy} /></label>
      {error && <p className="support-error" role="alert">{error}</p>}
      {receipt && <p className="support-success" role="status">Teşekkür ederiz. Mesajınız yönetime iletildi. Başvuru numarası: {receipt}</p>}
      <button type="submit" disabled={busy || !subject.trim() || !message.trim()}>{busy ? 'Gönderiliyor…' : 'Yönetime gönder'}</button>
    </form>
  </section>;
}
