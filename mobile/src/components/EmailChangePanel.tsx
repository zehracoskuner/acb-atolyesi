import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { useSession } from '../session';
import { useResource } from '../useResource';
import { Button, ErrorBox, Field, useAction, useUI } from '../ui';

type Pending = { email: string; expiresAt: string; resendAt: string; locked: boolean };
type Status = { hasPassword: boolean; pending: Pending | null };
export function EmailChangePanel({ currentPassword }: { currentPassword: string }) {
  const { styles } = useUI();
  const { user, refresh } = useSession(); const action = useAction();
  const status = useResource<Status>('/user/email-change');
  const [email, setEmail] = useState(''); const [otp, setOtp] = useState(''); const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<Pending | null>(null); const [now, setNow] = useState(Date.now());
  useEffect(() => { if (status.data) setPending(status.data.pending); }, [status.data]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const needsPassword = status.data?.hasPassword ?? user?.hasPassword ?? user?.authProvider !== 'google';
  const seconds = pending ? Math.max(0, Math.ceil((Date.parse(pending.resendAt) - now) / 1000)) : 0;
  const expired = pending ? Date.parse(pending.expiresAt) <= now : false;
  const send = (address: string) => action.run(async () => {
    const result = await api<{ pending: Pending; message: string }>('/user/change-email', 'PATCH', { newEmail: address, currentPassword });
    setPending(result.pending); setOtp(''); setNotice(result.message);
  });
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.heading}>E-posta adresi</Text>
    <Text style={styles.text}>Mevcut adresin: {user?.email}</Text>
    <Text style={styles.muted}>Yeni adresini doğrulayana kadar bu adresle giriş yapmaya devam edebilirsin.</Text>
    {pending ? <>
      <Text style={styles.text}>{pending.email} için onay bekleniyor.</Text>
      <Text style={styles.muted}>{expired ? 'Kodun süresi doldu. Yeni kod iste.' : pending.locked ? 'Deneme hakkın doldu. Yeni kod iste.' : 'E-postandaki 6 haneli kodu gir. İstersen e-postadaki bağlantıdan da onaylayabilirsin.'}</Text>
      <Field label="Doğrulama kodu" value={otp} onChangeText={value => setOtp(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" maxLength={6}/>
      <Button title="Doğrula ve adresi değiştir" busy={action.busy} disabled={otp.length !== 6 || expired || pending.locked} onPress={() => action.run(async () => {
        await api('/user/email-change/verify', 'POST', { otp }); setPending(null); setEmail(''); setOtp('');
        await refresh(); await status.reload(); setNotice('Yeni e-posta adresin doğrulandı ve kaydedildi.');
      })}/>
      <Button secondary title={seconds ? `Yeni kod için ${seconds} sn bekle` : 'Yeni kod gönder'} busy={action.busy} disabled={seconds > 0 || (needsPassword && !currentPassword)} onPress={() => send(pending.email)}/>
      {needsPassword && !currentPassword && <Text style={styles.muted}>Yeni kod göndermek için yukarıdaki mevcut şifre alanını doldur.</Text>}
      <Button secondary title="Bağlantıdan onayladım, durumu yenile" busy={action.busy} onPress={() => action.run(async () => { await refresh(); await status.reload(); })}/>
      <Button secondary title="E-posta değişikliğini iptal et" busy={action.busy} onPress={() => action.run(async () => { await api('/user/email-change', 'DELETE'); setPending(null); setOtp(''); setNotice('İstek iptal edildi. Mevcut adresin korundu.'); })}/>
    </> : <>
      <Field label="Yeni e-posta" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false}/>
      <Button secondary title="Yeni adrese doğrulama kodu gönder" busy={action.busy} disabled={!email.trim() || (needsPassword && !currentPassword)} onPress={() => send(email)}/>
    </>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
    <ErrorBox error={status.error} retry={status.reload}/><ErrorBox error={action.error}/>
  </View>;
}
