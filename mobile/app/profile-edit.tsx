import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { Alert, Image, Platform, Text, View } from 'react-native';
import { MemberGate } from '../src/components/MemberGate';
import { api } from '../src/api';
import { pickAndUpload } from '../src/images';
import { safeWebsite } from '../src/profile';
import { useResource } from '../src/useResource';
import { useSession } from '../src/session';
import type { User } from '../src/types';
import { Avatar, Button, ErrorBox, Field, Loading, Page, TextAction, Title, confirmDelete, useAction, useUI } from '../src/ui';
const fields = (p: User) => ({ kullaniciAdi: p.kullaniciAdi, bio: p.bio || '', location: p.location || '', website: p.website || '' });
function EditProfile() {
  const { styles, colors } = useUI(); const { refresh } = useSession(); const action = useAction(); const navigation = useNavigation();
  const resource = useResource<{ user: User }>('/user/profile'); const initialized = useRef(false);
  const [form, setForm] = useState({ kullaniciAdi: '', bio: '', location: '', website: '' }); const [saved, setSaved] = useState(form); const [notice, setNotice] = useState('');
  useEffect(() => { if (resource.data && !initialized.current) { initialized.current = true; const next = fields(resource.data.user); setForm(next); setSaved(next); } }, [resource.data]);
  const dirty = JSON.stringify(saved) !== JSON.stringify(form);
  usePreventRemove(dirty || action.busy, ({ data }) => {
    if (action.busy) { Alert.alert('İşlem sürüyor', 'Kaydetme veya görsel yükleme tamamlanınca çıkabilirsin.'); return; }
    Alert.alert('Değişiklikler kaydedilmedi', 'Kaydetmeden çıkmak istiyor musun?', [{ text: 'Düzenlemeye devam et', style: 'cancel' }, { text: 'Kaydetmeden çık', style: 'destructive', onPress: () => navigation.dispatch(data.action) }]);
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || (!dirty && !action.busy)) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, action.busy]);
  const imageChange = (kind: 'avatar' | 'banner', remove = false) => action.run(async () => {
    setNotice(''); const field = kind === 'avatar' ? 'avatarUrl' : 'bannerImage';
    const result = remove ? (await api(`/user/${kind}`, 'DELETE'), { [field]: '' }) : await pickAndUpload<Record<string, string>>(`/user/${kind}`, kind);
    if (!result) return;
    // Commit only the server-confirmed URL. A failed upload leaves the old image intact.
    resource.setData(d => d && ({ ...d, user: { ...d.user, [field]: result[field] } }));
    setNotice(remove ? 'Görsel kaldırıldı.' : 'Görsel kaydedildi.'); await refresh();
  });
  return <Page><Title description="Kelimelerinin ardındaki seni anlat.">Profili düzenle</Title>{resource.loading && !resource.data && <Loading/>}<ErrorBox error={resource.error} retry={resource.reload}/>
    {resource.data && <>
      <View style={{ gap: 12 }}><View style={{ height: 150, backgroundColor: colors.soft, borderRadius: 8, overflow: 'hidden' }}>{resource.data.user.bannerImage && <Image accessibilityLabel="Mevcut banner" source={{ uri: resource.data.user.bannerImage }} style={{ width: '100%', height: '100%' }}/>}</View><View style={styles.row}><TextAction title="Bannerı değiştir" disabled={action.busy} onPress={() => imageChange('banner')}/>{!!resource.data.user.bannerImage && <TextAction title="Bannerı kaldır" disabled={action.busy} onPress={() => confirmDelete('Banner kaldırılsın mı?', () => imageChange('banner', true))}/>}</View>
      <View style={styles.row}><Avatar uri={resource.data.user.avatarUrl} name={form.kullaniciAdi} size={72}/><TextAction title="Avatarı değiştir" disabled={action.busy} onPress={() => imageChange('avatar')}/>{!!resource.data.user.avatarUrl && <TextAction title="Avatarı kaldır" disabled={action.busy} onPress={() => confirmDelete('Avatar kaldırılsın mı?', () => imageChange('avatar', true))}/>}</View><Text style={styles.muted}>JPEG, PNG veya WebP · en fazla 5 MB. Görseller seçimin ardından yüklenir.</Text></View>
      <Field label="Kullanıcı adı" value={form.kullaniciAdi} maxLength={30} autoCapitalize="none" autoCorrect={false} onChangeText={kullaniciAdi => setForm(f => ({ ...f, kullaniciAdi }))}/>
      <Field label="Biyografi" multiline value={form.bio} onChangeText={bio => setForm(f => ({ ...f, bio }))}/>
      <Field label="Konum" value={form.location} onChangeText={location => setForm(f => ({ ...f, location }))}/>
      <Field label="Web sitesi" value={form.website} keyboardType="url" autoCapitalize="none" onChangeText={website => setForm(f => ({ ...f, website }))}/>
      <Button title="Değişiklikleri kaydet" icon="checkmark-outline" busy={action.busy} disabled={!dirty || form.kullaniciAdi.trim().length < 3} onPress={() => action.run(async () => {
        setNotice(''); const website = safeWebsite(form.website); if (form.website.trim() && !website) throw new Error('Geçerli bir http veya https web adresi gir.');
        const submitted = { ...form, kullaniciAdi: form.kullaniciAdi.trim(), bio: form.bio.trim(), location: form.location.trim(), website: website || '' };
        await api('/user/profile', 'PATCH', submitted); setForm(submitted); setSaved(submitted); setNotice('Profilin kaydedildi.'); await refresh();
      })}/><Button secondary title="Profile dön" disabled={action.busy} onPress={() => router.back()}/>
    </>}<ErrorBox error={action.error}/>{!!notice && <Text accessibilityLiveRegion="polite" style={styles.text}>{notice}</Text>}
  </Page>;
}
export default function ProfileEdit() { const { user } = useSession(); return <MemberGate title="Profili düzenle"><EditProfile key={user?._id}/></MemberGate>; }
