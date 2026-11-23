import { MemberGate } from '../src/components/MemberGate';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { discardLocalDrafts } from '../src/sync';
import { api } from '../src/api';
import { EmailChangePanel } from '../src/components/EmailChangePanel';
import { useSession } from '../src/session';
import { useResource } from '../src/useResource';
import type { User, MobileConfig } from '../src/types';
import { enablePush, disablePush } from '../src/push';
import { pickAndUpload } from '../src/images';
import { Button, Chip, ErrorBox, Field, Page, Title, useAction, useUI } from '../src/ui';
function SettingsRoute() {
  const { styles, mode, setMode, error: themeError } = useUI();
  const { user, refresh, logout } = useSession(); const action = useAction(); const profile = useResource<{ user: User }>('/user/profile'); const config = useResource<MobileConfig>('/mobile/config');
  const [username, setUsername] = useState(user?.kullaniciAdi || ''); const [bio, setBio] = useState(''); const [location, setLocation] = useState(''); const [website, setWebsite] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''); const [password, setPassword] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => { if (profile.data) { setBio(profile.data.user.bio || ''); setLocation(profile.data.user.location || ''); setWebsite(profile.data.user.website || ''); } }, [profile.data]);
  return <Page><Title>Ayarlar</Title><Text style={styles.heading}>Görünüm</Text><View style={styles.row}>{([{ value: "light", label: "Açık" }, { value: "dark", label: "Koyu" }, { value: "system", label: "Sistem" }] as const).map(item => <Chip key={item.value} title={item.label} selected={mode === item.value} onPress={() => setMode(item.value)}/>)}</View>{!!themeError && <Text style={styles.muted}>{themeError}</Text>}<Field label="Kullanıcı adı" value={username} onChangeText={setUsername} autoCapitalize="none"/><Field label="Hakkımda" multiline value={bio} onChangeText={setBio}/><Field label="Konum" value={location} onChangeText={setLocation}/><Field label="Web sitesi" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url"/>
    <Button title="Profili kaydet" busy={action.busy} onPress={() => action.run(async () => { await api('/user/profile', 'PATCH', { kullaniciAdi: username, bio, location, website }); await refresh(); setNotice('Profilin güncellendi.'); })}/>
    <View style={styles.row}><Button secondary title="Profil fotoğrafı seç" busy={action.busy} onPress={() => action.run(async () => { if (await pickAndUpload('/user/avatar', 'avatar')) { await refresh(); await profile.reload(); setNotice('Profil fotoğrafın güncellendi.'); } })}/><Button secondary title="Profil kapağı seç" busy={action.busy} onPress={() => action.run(async () => { if (await pickAndUpload('/user/banner', 'banner')) { await profile.reload(); setNotice('Profil kapağın güncellendi.'); } })}/></View>
    <Text style={styles.heading}>Hesap güvenliği</Text>
    {(user?.hasPassword ?? user?.authProvider !== 'google') && <Field label="Mevcut şifre" secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} autoComplete="current-password"/>}
    <Field label="Yeni şifre" secureTextEntry value={password} onChangeText={setPassword} autoComplete="new-password"/>
    <Button secondary title={(user?.hasPassword ?? user?.authProvider !== 'google') ? 'Şifreyi değiştir' : 'İlk şifreni belirle'} busy={action.busy} disabled={password.length < 6} onPress={() => action.run(async () => {
      if (user?.hasPassword ?? user?.authProvider !== 'google') await api('/user/password', 'PATCH', { currentPassword, newPassword: password });
      else await api('/user/set-password', 'PATCH', { newPassword: password });
      setPassword(''); setCurrentPassword(''); await logout(); router.replace('/auth/login');
    })}/>
    <Text style={styles.muted}>Şifreyi kaydettikten sonra güvenlik için yeniden giriş yapacaksın.</Text>
    <EmailChangePanel currentPassword={currentPassword}/>
    <Text style={styles.heading}>Bildirimler</Text><Button secondary title="Telefonda bildirimleri etkinleştir" busy={action.busy} onPress={() => action.run(async () => { await enablePush(); setNotice('Push bildirimleri etkinleştirildi.'); })}/><Button secondary title="Push bildirimlerini kapat" onPress={() => action.run(async () => { await disablePush(); setNotice('Push bildirimleri kapatıldı.'); })}/>
    {config.data?.legal.map(doc => <Button key={doc.id} secondary title={doc.title} onPress={() => router.push(`/legal/${doc.id}`)}/>)}
    <View style={styles.card}><Text style={styles.heading}>Cihazdaki taslakları yönet</Text><Text style={styles.muted}>Çıkış yapmak taslaklarını silmez. Bu cihazda kayıtlı metinleri silmek için aşağıdaki eylemi kullan.</Text><Button secondary title="Bu hesaba ait cihaz taslaklarını sil" onPress={() => Alert.alert('Yerel taslakları sil?', 'Eşitlenmemiş yazılar ve yedekler geri alınamaz biçimde silinecek.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => action.run(async () => { if (user) await discardLocalDrafts(user._id); setNotice('Yerel taslaklar silindi.'); }) }])}/></View>
    {notice && <Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}<ErrorBox error={profile.error} retry={profile.reload}/><ErrorBox error={action.error}/>
    <Pressable accessibilityRole="button" onPress={() => Alert.alert('Hesabını sil?', 'Eserlerin ve hesabın kalıcı olarak silinecek.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Hesabı sil', style: 'destructive', onPress: () => action.run(async () => { await disablePush(); await api('/user/account', 'DELETE'); await logout(); router.replace('/auth/welcome'); }) }])} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: '#A4492E' }}>Hesabımı sil</Text></Pressable>
  </Page>;
}

export default function Settings() { return <MemberGate title="Ayarlar"><SettingsRoute/></MemberGate>; }
