import { router } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { joinAtelier } from '../../src/components/MemberGate';
import { api } from '../../src/api';
import { FeedController } from '../../src/feedController';
import { feedKey } from '../../src/communityStore';
import { useSession } from '../../src/session';
import { Avatar, Button, Empty, ErrorBox, fonts, Loading, Page, TextAction, useUI } from '../../src/ui';
import { ChapterAnnouncement, JournalCard } from '../../src/components/CommunityCards';

function MemberFeed() {
  const { colors, styles } = useUI(); const { user } = useSession();
  const [controller] = useState(() => new FeedController(path => api(path)));
  const feed = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}), [notice, setNotice] = useState('');
  useEffect(() => { const disconnect = controller.connect(); void controller.refresh(); return disconnect; }, [controller]);
  return <FlatList testID="community-feed" maintainVisibleContentPosition={{ minIndexForVisible: 1 }} style={styles.page} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, width: '100%', maxWidth: 700, alignSelf: 'center' }}
    data={feed.items} keyExtractor={feedKey} refreshing={feed.loading && feed.loaded} onRefresh={controller.refresh}
    onEndReached={() => { if (!feed.moreError) void controller.more(); }} onEndReachedThreshold={0.5}
    initialNumToRender={8} windowSize={9} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
    ListHeaderComponent={<View style={{ gap: 12, paddingTop: 10, paddingBottom: 4 }}>
      <Text accessibilityRole="header" style={[styles.heading, { fontSize: 27, lineHeight: 35 }]}>Akış</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Günlüğüne yaz…" onPress={() => router.push('/compose')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1, borderColor: colors.line, minHeight: 68 }}>
        <Avatar name={user?.kullaniciAdi} uri={user?.avatarUrl}/><Text style={[styles.text, { flex: 1, color: colors.muted, fontFamily: fonts.body }]}>Günlüğüne yaz…</Text><Ionicons name="create-outline" size={22} color={colors.accent}/>
      </Pressable>
      <Text style={[styles.muted, { fontSize: 13 }]}>Atölyeden günlükler ve takip ettiğin yazarların yeni bölümleri.</Text>
      {!!notice && <View><Text accessibilityLiveRegion="polite" style={styles.muted}>{notice}</Text><TextAction title="Kapat" onPress={() => setNotice('')}/></View>}
      <ErrorBox error={feed.error} retry={controller.refresh}/>{feed.loading && !feed.loaded && <Loading/>}
    </View>}
    renderItem={({ item }) => item.type === 'log' ? <JournalCard item={item} expanded={!!expanded[feedKey(item)]} onExpanded={value => setExpanded(current => ({ ...current, [feedKey(item)]: value }))}/> : <ChapterAnnouncement item={item} onUnavailable={id => { setNotice('Bu bölüm yayından kaldırılmış veya erişime kapatılmış. Akış yenileniyor.'); controller.unavailable(id); }}/>}
    ListEmptyComponent={!feed.loading && !feed.error ? <View style={{ gap: 12 }}><Empty title="Henüz paylaşım yok." description={feed.followingCount ? 'Atölyede ve takip ettiğin yazarlarda henüz görünür bir paylaşım yok.' : 'Atölye henüz sessiz. Keşfet’ten yazarları takip edebilirsin.'}/><Button secondary title="Keşfete git" onPress={() => router.push('/(tabs)/explore')}/><Button title="Günlüğüne yaz" onPress={() => router.push('/compose')}/></View> : null}
    ListFooterComponent={<View style={{ gap: 12, paddingTop: 12 }}><ErrorBox error={feed.moreError} retry={controller.more}/>{feed.loadingMore ? <Loading/> : feed.nextCursor ? <Button secondary title="Daha fazla paylaşım" onPress={controller.more}/> : feed.items.length ? <Text style={[styles.muted, { textAlign: 'center', paddingVertical: 16 }]}>Mevcut paylaşımların sonuna geldin.</Text> : null}</View>}/>;
}
export default function Feed() {
  const { user, loading } = useSession();
  if (loading) return <Page><Loading/></Page>;
  if (!user) return <Page contentStyle={{ maxWidth: 700 }}><Empty title="Atölyenin sohbetine katıl." description="Günlükleri ve takip ettiğin yazarların yeni bölümlerini görmek için giriş yap."/><Button title="Giriş yap / Kayıt ol" onPress={() => joinAtelier('/(tabs)')}/><Button secondary title="Keşfete git" onPress={() => router.push('/(tabs)/explore')}/></Page>;
  return <MemberFeed key={user._id}/>;
}
