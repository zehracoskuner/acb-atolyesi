import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '../session';
import { useResource } from '../useResource';
import { api } from '../api';
import type { User } from '../types';
import { Avatar, Button, Empty, ErrorBox, Page, IconButton, TextAction, Title, fonts, useAction, useUI } from '../ui';
import { profileSection, profileSections, safeWebsite, type ProfileSection } from '../profile';
import { ProfileLogs, ProfileWorks, ProfileLists, ProfileQuotes, ProfileLibrary, ResourceState } from './ProfileTabs';
type Profile = User & { followers?: string[]; following?: string[]; followerCount?: number; followingCount?: number; workCount?: number; isFollowedByMe?: boolean };
type ProfileData = { user: Profile; stats?: { totalWorks: number; totalWords: number; totalViews: number } };
function Biography({ text }: { text: string }) {
  const { styles } = useUI(); const [open, setOpen] = useState(false); const [overflows, setOverflows] = useState(false);
  return <><View><Text aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" onTextLayout={event => setOverflows(event.nativeEvent.lines.length > 3)} style={[styles.text, { position: 'absolute', opacity: 0, width: '100%' }]}>{text}</Text><Text selectable numberOfLines={open ? undefined : 3} style={styles.text}>{text}</Text></View>{(overflows || text.length > 140 || text.split('\n').length > 3) && <TextAction title={open ? 'Daha az göster' : 'Devamını göster'} onPress={() => setOpen(!open)}/>}</>;
}
function Person({ id, close }: { id: string; close: () => void }) {
  const { styles } = useUI(); const p = useResource<{ user: Profile }>(`/public/profile/${id}`);
  return <View style={styles.row}><ResourceState resource={p}/>{p.data && <><Avatar name={p.data.user.kullaniciAdi} uri={p.data.user.avatarUrl}/><TextAction title={p.data.user.kullaniciAdi} onPress={() => { close(); router.push(`/profile/${id}`); }}/></>}</View>;
}
export function ProfileScreen({ id }: { id?: string }) {
  const { user } = useSession(); const target = id || user?._id;
  if (!target) return <Page safeTop><Title>Profil</Title><Button title="Aramıza katıl :)" onPress={() => router.push('/auth/login')}/></Page>;
  // Identity keys dispose every private resource before rendering another account/profile.
  return <ProfileContent key={`${user?._id || 'guest'}:${target}`} target={target} owner={!id || id === user?._id} showBack={!!id}/>;
}
function ProfileContent({ target, owner, showBack }: { target: string; owner: boolean; showBack: boolean }) {
  const { styles, colors, wide } = useUI(); const { user: me } = useSession(); const action = useAction(); const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>(); const initial = profileSection(params.tab, owner);
  const [section, setSection] = useState<ProfileSection>(initial); const activeSection = useRef(section); const [visited, setVisited] = useState<ProfileSection[]>([initial]);
  const [menu, setMenu] = useState(false); const [people, setPeople] = useState<'followers' | 'following' | null>(null); const [peoplePage, setPeoplePage] = useState(1);
  const scroll = useRef<ScrollView>(null); const tabs = useRef<ScrollView>(null); const offsets = useRef<Partial<Record<ProfileSection, number>>>({}); const currentOffset = useRef(0); const positions = useRef<Partial<Record<ProfileSection, number>>>({});
  const profile = useResource<ProfileData>(owner ? '/user/profile' : `/public/profile/${target}`); const p = profile.data?.user; const website = safeWebsite(p?.website);
  const select = useCallback((next: ProfileSection) => { if (next === activeSection.current) return; offsets.current[activeSection.current] = currentOffset.current; activeSection.current = next; setSection(next); setVisited(v => v.includes(next) ? v : [...v, next]); }, []);
  useEffect(() => { select(profileSection(params.tab, owner)); }, [params.tab, owner, select]);
  useEffect(() => { const frame = requestAnimationFrame(() => { scroll.current?.scrollTo({ y: offsets.current[section] || 0, animated: false }); tabs.current?.scrollTo({ x: Math.max(0, (positions.current[section] || 0) - 18), animated: true }); }); return () => cancelAnimationFrame(frame); }, [section]);
  return <Page scroll={false}><ScrollView testID="profile-scroll" ref={scroll} onScroll={e => { currentOffset.current = e.nativeEvent.contentOffset.y; }} scrollEventThrottle={32} contentContainerStyle={{ width: '100%', maxWidth: 1100, alignSelf: 'center', paddingBottom: 36 }}>
    <View style={{ height: (wide ? 220 : 166) + insets.top, backgroundColor: colors.soft }}>
      {p?.bannerImage && <Image source={{ uri: p.bannerImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel="Profil bannerı"/>}
      <View style={{ position: 'absolute', top: insets.top + 10, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>{showBack ? <View style={{ borderRadius: 24, backgroundColor: colors.card }}><IconButton icon="arrow-back-outline" label="Geri dön" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}/></View> : <View/>}<View style={{ borderRadius: 24, backgroundColor: colors.card }}><IconButton icon="ellipsis-horizontal" label="Profil menüsü" onPress={() => setMenu(!menu)}/></View></View>
    </View>
    <View style={{ paddingHorizontal: wide ? 32 : 20, gap: 16 }}>
      {p && <><View style={{ marginTop: -32, alignSelf: 'flex-start', padding: 5, borderRadius: 56, backgroundColor: colors.paper }}><Avatar name={p.kullaniciAdi} uri={p.avatarUrl} size={88}/></View>
        {menu && <View style={styles.row}>{owner ? <TextAction title="Hesap ayarları" icon="settings-outline" onPress={() => router.push('/settings')}/> : <TextAction title="Kullanıcıyı bildir" onPress={() => router.push({ pathname: '/report', params: { targetId: p._id, targetType: 'user' } })}/>}</View>}
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: 22, alignItems: 'flex-start' }}><View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%', gap: 8 }}><Text accessibilityRole="header" style={[styles.title, { fontSize: 30 }]}>{p.kullaniciAdi}</Text>
          {!!p.bio && <Biography text={p.bio}/>}
          <View style={styles.row}>{!!p.location && <Text style={styles.muted}>{p.location}</Text>}{website && <TextAction title={p.website!} icon="open-outline" onPress={() => action.run(() => Linking.openURL(website))}/>}</View>
        </View><View style={{ flexDirection: wide ? 'column' : 'row', flexWrap: 'wrap', gap: 10, maxWidth: '100%' }}>{owner ? <><Button secondary title="Profili düzenle" icon="create-outline" onPress={() => router.push('/profile-edit')}/><Button title="Atölye" icon="pencil-outline" onPress={() => router.push('/(tabs)/studio')}/></> : <Button busy={action.busy} title={p.isFollowedByMe ? 'Takip ediliyor' : 'Takip et'} secondary={p.isFollowedByMe} onPress={() => me ? action.run(async () => {
          const result = await api<{ following: boolean; followerCount: number }>(`/public/profile/${p._id}/follow`, 'POST', {});
          profile.setData(d => d && ({ ...d, user: { ...d.user, isFollowedByMe: result.following, followerCount: result.followerCount, followers: result.following ? [...new Set([...(d.user.followers || []), me._id])] : d.user.followers?.filter(id => id !== me._id) } }));
        }) : router.push('/auth/login')}/>}</View></View>
        <View style={[styles.row, { columnGap: 22, borderBottomWidth: 1, borderColor: colors.line, paddingBottom: 12 }]}><Text style={styles.text}>{profile.data?.stats?.totalWorks ?? p.workCount ?? 0} eser</Text><TextAction title={`${p.followerCount ?? p.followers?.length ?? 0} takipçi`} onPress={() => { setPeoplePage(1); setPeople('followers'); }}/><TextAction title={`${p.followingCount ?? p.following?.length ?? 0} takip edilen`} onPress={() => { setPeoplePage(1); setPeople('following'); }}/></View>
        {profile.data?.stats && <Text style={styles.muted}>{profile.data.stats.totalWords.toLocaleString('tr-TR')} kelime · {profile.data.stats.totalViews.toLocaleString('tr-TR')} okunma</Text>}
      </>}
      <ResourceState resource={profile}/><ErrorBox error={action.error}/>
      {p && <><View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: colors.line }}><ScrollView ref={tabs} horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 24 }} accessibilityRole="tablist">{profileSections.filter(s => owner || !('owner' in s)).map(s => <Pressable key={s.id} accessibilityRole="tab" aria-selected={s.id === section} accessibilityState={{ selected: s.id === section }} onLayout={e => { positions.current[s.id] = e.nativeEvent.layout.x; if (s.id === section) tabs.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - 18), animated: false }); }} onPress={() => { select(s.id); router.setParams({ tab: s.id }); }} style={{ minHeight: 52, paddingVertical: 14, borderBottomWidth: 2, borderColor: section === s.id ? colors.accent : 'transparent', justifyContent: 'center' }}><Text style={{ fontFamily: section === s.id ? fonts.semibold : fonts.body, fontSize: 15, color: section === s.id ? colors.accent : colors.muted }}>{s.label}</Text></Pressable>)}</ScrollView><IconButton icon="chevron-forward-outline" label="Diğer profil sekmeleri" onPress={() => tabs.current?.scrollToEnd({ animated: true })}/></View>
      {visited.map(s => <View key={s === 'logs' ? `${s}:${p.isFollowedByMe}` : s} style={{ display: section === s ? 'flex' : 'none', gap: 14, paddingTop: 8 }}>{s === 'logs' ? <ProfileLogs target={p._id} owner={owner}/> : s === 'works' || s === 'drafts' ? <ProfileWorks target={p._id} owner={owner} draft={s === 'drafts'}/> : s === 'lists' ? <ProfileLists target={p._id} owner={owner}/> : s === 'quotes' ? <ProfileQuotes target={p._id} owner={owner}/> : owner ? <ProfileLibrary/> : null}</View>)}</>}
    </View>
  </ScrollView><Modal visible={!!people} animationType="slide" onRequestClose={() => setPeople(null)}><Page safeTop><Button secondary title="Profile dön" onPress={() => setPeople(null)}/><Title>{people === 'followers' ? 'Takipçiler' : 'Takip edilenler'}</Title>{people && (p?.[people] || []).slice((peoplePage - 1) * 20, peoplePage * 20).map(person => <Person key={person} id={person} close={() => setPeople(null)}/>)}{people && !p?.[people]?.length && <Empty title="Henüz kimse yok"/>}<View style={styles.row}><Button secondary title="Önceki" disabled={peoplePage === 1} onPress={() => setPeoplePage(n => n - 1)}/><Button secondary title="Sonraki" disabled={!people || peoplePage * 20 >= (p?.[people]?.length || 0)} onPress={() => setPeoplePage(n => n + 1)}/></View></Page></Modal></Page>;
}
