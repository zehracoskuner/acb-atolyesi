import { useEffect, useState } from 'react';
import { apiPost } from '../lib/api';
import { supportsWebPush, preparePush, applicationKey, unlockPushSound, playPushSound } from '../lib/webPush';

export default function WebPushSettings() {
  const [prepared, setPrepared] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');
  const [sound, setSound] = useState(() => localStorage.getItem('acb_push_sound') === 'on');
  useEffect(() => {
    let active = true;
    if (!supportsWebPush()) { setMessage('Bu tarayıcıda bildirim desteği yok. iPhone/iPad üzerinde siteyi Ana Ekrana ekleyip oradan açmayı deneyebilirsin.'); setBusy(false); return; }
    preparePush().then(async value => {
      const sub = await value.registration?.pushManager.getSubscription();
      if (!active) return;
      setPrepared(value); setEnabled(!!sub && Notification.permission === 'granted');
      if (!value.config.enabled) setMessage('Tarayıcı bildirimleri yakında kullanıma açılacak.');
      else if (Notification.permission === 'denied') setMessage('Bildirim izni engellenmiş. Tarayıcının site ayarlarından izin verebilirsin.');
    }).catch(() => { if (active) setMessage('Bildirim ayarları yüklenemedi. Sayfayı yenileyip tekrar dene.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function enable() {
    // Invoke permission directly from the click, before any network await (Safari).
    const permission = Notification.requestPermission();
    setBusy(true); setMessage('');
    let created;
    try {
      if (await permission !== 'granted') { setMessage('İzin verilmedi. Bildirimleri daha sonra buradan açabilirsin.'); return; }
      const existing = await prepared.registration.pushManager.getSubscription();
      const sub = existing || (created = await prepared.registration.pushManager.subscribe({
        userVisibleOnly: true, applicationServerKey: applicationKey(prepared.config.publicKey),
      }));
      await apiPost('/notifications/push/subscribe', sub.toJSON());
      setEnabled(true); setMessage('Bu tarayıcı için bildirimler açıldı.');
    } catch { if (created) await created.unsubscribe().catch(() => {}); setMessage('Bildirimler açılamadı. Bağlantını ve tarayıcı izinlerini kontrol edip tekrar dene.'); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setMessage('');
    try {
      const sub = await prepared.registration.pushManager.getSubscription();
      if (sub) {
        await apiPost('/notifications/push/unsubscribe', { endpoint: sub.endpoint });
        if (!await sub.unsubscribe()) throw new Error('unsubscribe failed');
      }
      setEnabled(false); setMessage('Bu tarayıcı için bildirimler kapatıldı.');
    } catch { setMessage('Bildirimler kapatılamadı. Tekrar dene veya tarayıcı site ayarlarından izni kaldır.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Tarayıcı bildirimleri" style={{ padding: 18, marginBottom: 24, border: '1px solid #e2ddd6', borderRadius: 10, background: '#fff' }}>
    <strong>Atölyeden haberdar ol</strong>
    <p style={{ fontSize: '.85rem', lineHeight: 1.6 }}>Site açık değilken de yeni bildirimlerini al. Çıkış yaptığında veya oturumun sona erdiğinde gönderim durur.</p>
    <button type="button" disabled={busy || !prepared?.registration} onClick={enabled ? disable : enable}
      style={{ padding: '9px 14px', borderRadius: 6, border: '1px solid #8b2500', background: enabled ? '#fff' : '#8b2500', color: enabled ? '#8b2500' : '#fff', cursor: 'pointer' }}>
      {busy ? 'Hazırlanıyor…' : enabled ? 'Tarayıcı bildirimlerini kapat' : 'Tarayıcı bildirimlerini aç'}
    </button>
    <label style={{ display: 'block', marginTop: 14, fontSize: '.85rem' }}>
      <input type="checkbox" checked={sound} onChange={event => {
        setSound(event.target.checked); localStorage.setItem('acb_push_sound', event.target.checked ? 'on' : 'off');
        if (event.target.checked) { unlockPushSound(); setTimeout(playPushSound, 100); }
      }} /> Site açıkken yumuşak bildirim sesi çal
    </label>
    <p style={{ fontSize: '.75rem', color: '#7a6e5f' }}>Site dışındaki bildirim sesi cihazının ayarlarına bağlıdır.</p>
    {message && <p role="status" style={{ fontSize: '.85rem', lineHeight: 1.5 }}>{message}</p>}
  </section>;
}
