import { afterLogin } from '../../src/components/MemberGate';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useSession } from '../../src/session';
import { useResource } from '../../src/useResource';
import type { MobileConfig, User } from '../../src/types';
import { Brand, Button, ErrorBox, Field, Page, TextAction, Title, useAction, useUI } from '../../src/ui';
export default function Auth() {
  const { colors, styles } = useUI();
  const { mode, email: initialEmail, token: resetToken, otp: initialOtp } = useLocalSearchParams<{ mode: string; email?: string; token?: string; otp?: string }>();
  const session = useSession(); const config = useResource<MobileConfig>('/mobile/config'); const action = useAction();
  const [email, setEmail] = useState(initialEmail || ''); const [password, setPassword] = useState(''); const [username, setUsername] = useState(session.user?.kullaniciAdi || '');
  const [year, setYear] = useState(''); const [otp, setOtp] = useState(initialOtp || ''); const [accepted, setAccepted] = useState(false); const [notice, setNotice] = useState('');
  const canChooseUsername = session.user?.canChooseUsername ?? !session.user?.profileComplete;
  const accountName = session.user?.kullaniciAdi; const provider = session.user?.authProvider; const accountId = session.user?._id;
  useEffect(() => {
    if (mode === 'complete') setUsername(canChooseUsername && (provider === 'google' || provider === 'both') ? '' : accountName || '');
  }, [mode, accountId, accountName, provider, canChooseUsername]);
  useEffect(() => { setAccepted(false); setNotice(''); setPassword(''); }, [mode, config.data?.termsVersion]);
  const navigate = (account: User) => router.replace(account.profileComplete && !account.requiresTermsAcceptance ? afterLogin() : '/auth/complete');
  const loginResult = async (path: string, body: unknown) => { const r = await api<{ token: string; user: User }>(path, 'POST', body); await session.setLogin(r.token, r.user); navigate(r.user); };
  const submit = () => action.run(async () => {
    const terms = { termsAccepted: accepted, termsVersion: config.data?.termsVersion };
    if (mode === 'login') {
      try { await loginResult('/auth/login', { email: email.trim().toLowerCase(), sifre: password, client: 'native' }); }
      catch (e) { if (e instanceof ApiError && e.body.code === 'EMAIL_NOT_VERIFIED') router.push({ pathname: '/auth/verify', params: { email } }); else throw e; }
    } else if (mode === 'register') {
      try { await api('/auth/register', 'POST', { kullaniciAdi: username, email: email.trim().toLowerCase(), sifre: password, client: 'native', ...terms }); }
      catch (e) { if (!(e instanceof ApiError && e.body.accountCreated)) throw e; }
      router.replace({ pathname: '/auth/verify', params: { email } });
    } else if (mode === 'verify') await loginResult('/auth/verify-email-otp', { email, otp, client: 'native' });
    else if (mode === 'forgot') { await api('/auth/forgot-password', 'POST', { email, client: 'native' }); router.push({ pathname: '/auth/reset', params: { email } }); }
    else if (mode === 'reset') { await api('/auth/reset-password', 'POST', { email, otp, ...(resetToken ? { token: resetToken } : {}), newPassword: password }); setNotice('Şifren güncellendi. Giriş yapabilirsin.'); }
    else if (mode === 'complete') {
      if (!session.user?.profileComplete) await api('/auth/complete-profile', 'POST', { kullaniciAdi: username, birthYear: Number(year), ...terms });
      else await api('/auth/accept-terms', 'POST', terms);
      await session.refresh(); router.replace(afterLogin());
    }
  });
  if (mode === 'welcome') return <Page safeTop contentStyle={{ gap: 28, paddingTop: 28 }}><Stack.Screen options={{ headerShown: false }}/><Brand/>
    <View style={{ gap: 14, paddingTop: 14 }}><Text style={styles.label}>YAZARLIK, OKUMA VE ÜRETİM ALANI</Text><Text accessibilityRole="header" style={[styles.title, { fontSize: 42, lineHeight: 52 }]}>Bir hikâye,{ '\n' }<Text style={{ color: colors.accent }}>bir dünya açar.</Text></Text><Text style={[styles.prose, { color: colors.muted }]}>Kendi sesini bul. Başka dünyalara dokun. Henüz yazılmamış cümlelerine yer aç.</Text></View>
    {session.expired && <Text style={styles.muted}>Oturumun sona erdi. Cihazdaki taslakların korunuyor.</Text>}
    <View style={{ gap: 10 }}><Button title="Atölyeye katıl" icon="arrow-forward-outline" onPress={() => router.push('/auth/register')}/><Button secondary title="Keşfetmeye başla" onPress={() => router.replace("/explore")}/><Button secondary title="Hesabım var, giriş yap" onPress={() => router.push('/auth/login')}/></View><Text style={[styles.muted, { textAlign: 'center', fontSize: 12 }]}></Text></Page>;
  const titles: Record<string, string> = { login: 'Yeniden hoş geldin.', register: 'Hikâyen burada başlasın.', verify: 'E-postanı doğrula.', forgot: 'Yeni bir başlangıç.', reset: 'Yeni şifreni belirle.', complete: 'Atölyeye hazırlan.' };
  const needsTerms = mode === 'register' || mode === 'complete';
  return <Page><View style={{ paddingTop: 15, paddingBottom: 8 }}><Title eyebrow="ACB Atölyesi" description={mode === 'login' ? 'Hesabına giriş yap.' : mode === 'register' ? 'Kendine bir yer aç. İlk cümlenle başla.' : undefined}>{titles[mode]}</Title></View>
    {['login', 'register', 'forgot', 'verify', 'reset'].includes(mode) && <Field label="E-posta" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email"/>}
    {(mode === 'register' || (mode === 'complete' && !session.user?.profileComplete)) && <Field label="Kullanıcı adı" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} editable={mode !== 'complete' || canChooseUsername} maxLength={30} placeholder="Kendi kullanıcı adını seç"/>}
    {['login', 'register', 'reset'].includes(mode) && <Field label={mode === 'login' ? 'Şifre' : 'Yeni şifre (en az 6 karakter)'} secureTextEntry value={password} onChangeText={setPassword} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/>}
    {mode === 'complete' && !session.user?.profileComplete && <Field label="Doğum yılı" value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4}/>}
    {(mode === 'verify' || (mode === 'reset' && !resetToken)) && <Field label="E-postadaki 6 haneli kod" value={otp} onChangeText={setOtp} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6}/>}
    {needsTerms && <View style={styles.card}><Text style={styles.muted}>Güncel metinleri okuyup açıkça kabul et.</Text>
      {config.data?.legal.map(doc => <Button key={doc.id} secondary title={doc.title} onPress={() => router.push(`/legal/${doc.id}`)}/>)}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted(!accepted)} style={[styles.row, { minHeight: 48 }]}><Text style={styles.text}>{accepted ? '☑' : '☐'} Kullanıcı Sözleşmesi’ni kabul ediyorum.</Text></Pressable><ErrorBox error={config.error} retry={config.reload}/></View>}
    <ErrorBox error={action.error}/>{notice && <Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
    <Button busy={action.busy} title={mode === 'forgot' ? 'Sıfırlama kodu gönder' : mode === 'verify' ? 'Doğrula' : mode === 'reset' ? 'Şifreyi güncelle' : mode === 'register' ? 'Hesap oluştur' : mode === 'complete' ? 'Atölyeye katıl' : 'Giriş yap'} disabled={(needsTerms && (!accepted || !config.data)) || (mode === 'complete' && !session.user?.profileComplete && !/^[a-zA-Z0-9_]{3,30}$/.test(username))} onPress={submit}/>
    {mode === 'login' && <><TextAction title="Şifremi unuttum" onPress={() => router.push('/auth/forgot')}/><GoogleLogin onLogin={loginResult} run={action.run}/><View style={styles.rule}/><TextAction title="Henüz hesabın yok mu? Atölyeye katıl" icon="arrow-forward-outline" onPress={() => router.push('/auth/register')}/></>}
    {mode === 'verify' && <><Text style={styles.muted}>Doğrulama bağlantısını da kullanabilirsin. Kod almak için aşağıya dokun.</Text><Button secondary busy={action.busy} title="Doğrulama kodunu gönder" onPress={() => action.run(async () => { await api('/auth/send-verify-otp', 'POST', { email }); setNotice('Doğrulama kodu gönderildi.'); })}/><Button secondary title="Bağlantıyı tekrar gönder" onPress={() => action.run(async () => { await api('/auth/resend-verification', 'POST', { email, client: 'native' }); setNotice('Gönderim isteği işlendi.'); })}/></>}
    {!['complete', 'login'].includes(mode) && <TextAction title="Zaten hesabın var mı? Giriş yap" onPress={() => router.replace('/auth/login')}/>}
  </Page>;
}
function GoogleLogin({ onLogin, run }: { onLogin: (path: string, body: unknown) => Promise<void>; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) return null;
  return <Button secondary title="Google ile giriş yap" onPress={() => run(async () => {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID });
    await GoogleSignin.hasPlayServices(); const result = await GoogleSignin.signIn();
    if (result.type !== 'success' || !result.data.idToken) return;
    await onLogin('/auth/google/mobile', { idToken: result.data.idToken });
  })}/>;
}
