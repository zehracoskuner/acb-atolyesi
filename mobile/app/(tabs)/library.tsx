import { MemberGate } from '../../src/components/MemberGate';
import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResource } from '../../src/useResource';
import { useSync } from '../../src/sync';
import { SyncBatchError } from '../../src/syncResult';
import type { Progress, Work } from '../../src/types';
import { ShelfBook } from '../../src/components/ShelfBook';
import { BookCover } from '../../src/components/BookCover';
import { Button, Empty, ErrorBox, Loading, Page, SectionHeading, Title, useUI } from '../../src/ui';
function LibraryContent() {
  const { colors, styles, wide } = useUI(); const { width, fontScale } = useWindowDimensions();
  const columns = fontScale > 1.4 ? 1 : wide ? 3 : 2;
  const library = useResource<{ items: Work[] }>('/library'); const progress = useResource<{ items: Progress[] }>('/reading-progress'); const sync = useSync();
  const issues = sync.issues.filter(i => i.kind === 'reading' || (i.kind === 'storage' && i.id === 'reading'));
  return <Page><Title>Kütüphane</Title>
    <View style={styles.row}>{([{ title: 'Okuma listeleri', icon: 'albums-outline', route: '/lists' }, { title: 'Alıntılar', icon: 'chatbox-ellipses-outline', route: '/quotes' }] as const).map(item => <Pressable key={item.route} accessibilityRole="button" onPress={() => router.push(item.route)} style={({ pressed }) => ({ flex: 1, minWidth: 110, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, minHeight: 56, borderRadius: 14, backgroundColor: colors.pale, opacity: pressed ? .7 : 1 })}><Ionicons name={item.icon} size={21} color={colors.accent}/><Text style={[styles.text, { fontSize: 13, flex: 1 }]}>{item.title}</Text></Pressable>)}</View>
    <ErrorBox error={issues.length ? new SyncBatchError(issues, false) : null} retry={sync.sync}/>
    {progress.loading && <Loading/>}<ErrorBox error={progress.error} retry={progress.reload}/>
    {!!progress.data?.items.length && <><SectionHeading title="Okumaya Devam Et"/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>{progress.data.items.map(p => <View key={p.story._id} style={[styles.card, { width: Math.min(width - 40, 380), gap: 14, backgroundColor: colors.pale, borderWidth: 0 }]}>
      <View style={{ flexDirection: 'row', gap: 14 }}><BookCover work={p.story} width={60}/><View style={{ flex: 1, gap: 5, justifyContent: 'center' }}><Text style={[styles.heading, { fontSize: 20, lineHeight: 27 }]}>{p.story.title}</Text><Text style={[styles.muted, { fontSize: 12 }]}>{p.chapter.title}</Text><Text style={[styles.muted, { fontSize: 12 }]}>Bölüm içi %{Math.round(p.scrollPosition)}</Text></View></View>
      <View accessibilityLabel={`Bölüm içindeki konum yüzde ${Math.round(p.scrollPosition)}`} style={{ height: 4, borderRadius: 4, backgroundColor: colors.line }}><View style={{ height: 4, borderRadius: 4, backgroundColor: colors.accent, width: `${Math.max(0, Math.min(100, p.scrollPosition))}%` }}/></View>
      <Button title="Okumaya devam et" icon="book-outline" onPress={() => router.push({ pathname: '/read/[workId]/[chapterId]', params: { workId: p.story._id, chapterId: p.chapter._id, mode: 'resume' } })}/>
    </View>)}</ScrollView></>}
    <SectionHeading title="Eserler" detail={library.data ? `${library.data.items.length} eser kütüphanende` : undefined}/>
    {library.loading && <Loading/>}<ErrorBox error={library.error} retry={library.reload}/>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>{library.data?.items.map(w => <View key={w._id} style={{ width: columns === 1 ? '100%' : columns === 2 ? '47.5%' : '31%' }}><ShelfBook work={w}/></View>)}</View>
    {library.data?.items.length === 0 && <><Empty title="Kütüphanen henüz boş" description="Eser sayfasındaki kütüphaneye ekle düğmesiyle okumalarını burada biriktir."/><Button title="Keşfet" onPress={() => router.push('/explore')}/></>}
  </Page>;
}
export default function Library() { return <MemberGate title="Kütüphane" returnTo="/library"><LibraryContent/></MemberGate>; }
