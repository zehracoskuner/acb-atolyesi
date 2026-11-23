import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useResource } from './useResource';
import { useExploreData } from './useExploreData';
import { useSession } from './session';
import type { FeedItem, Work } from './types';
import { BookMenu, ExploreBook, ExploreJournal, WriterCard, type ExploreWriter } from './components/ExploreCards';
import { Button, Chip, ErrorBox, Loading, Page, SearchField, SectionHeading, Segments, TextAction, Title, useUI } from './ui';

type Resource = { items: unknown[]; loading: boolean; error: unknown; reload: () => unknown };
function ShelfState({ resource, empty }: { resource: Resource; empty?: string }) {
  const { styles } = useUI();
  return <>{resource.loading && !resource.items.length && <Loading/>}<ErrorBox error={resource.error} retry={resource.reload}/>{!resource.loading && !resource.error && !resource.items.length && !!empty && <Text accessibilityLiveRegion="polite" style={[styles.muted, { paddingVertical: 20 }]}>{empty}</Text>}</>;
}

export default function Explore() {
  const { styles } = useUI(); const { user } = useSession(); const { width, fontScale } = useWindowDimensions();
  const account = user?._id || 'guest';
  const [q, setQ] = useState(''); const [genre, setGenre] = useState(''); const [tab, setTab] = useState('works');
  const [catalogOpen, setCatalogOpen] = useState(false); const [genrePanel, setGenrePanel] = useState(false);
  const [menu, setMenu] = useState<Work>(); const [joinHidden, setJoinHidden] = useState(false);
  const term = q.trim(); const searching = q.length > 0; const resultsOpen = searching || catalogOpen;
  const usableQuery = term.length >= 2;
  const available = Math.min(width, 1180) - 40;
  const tablet = width >= 700;
  const columns = Math.max(2, Math.min(6, Math.floor(available / (155 * Math.max(1, fontScale)))));
  const bookWidth = tablet ? (available - (columns - 1) * 16) / columns : Math.max(110, (available - 32) / (fontScale > 1.4 ? 1.6 : 2.2));
  const genres = useResource<{ genres: { genre: string; count: number }[] }>('/works/genres');
  const shelf = useExploreData<Work>(`/works/discover?sort=updated&limit=6&genres=${encodeURIComponent(genre)}`, 0, account);
  const review = useExploreData<Work>('/feed/needs-review', 0, account);
  const writers = useExploreData<ExploreWriter>('/feed/writers', 0, account);
  const logs = useExploreData<FeedItem & { visibility: string }>('/feed/top-logs', 0, account);
  const workPath = searching ? usableQuery ? `/search/works?q=${encodeURIComponent(term)}&genre=${encodeURIComponent(genre)}&limit=20` : null
    : catalogOpen ? `/works/discover?sort=updated&genres=${encodeURIComponent(genre)}&limit=20` : null;
  const workResults = useExploreData<Work>(workPath, searching ? 350 : 0, account);
  const writerResults = useExploreData<ExploreWriter>(searching && usableQuery ? `/search/users?q=${encodeURIComponent(term)}&limit=15` : null, 350, account);
  const workList = useRef<FlatList<Work>>(null); const writerList = useRef<FlatList<ExploreWriter>>(null);
  useEffect(() => { workList.current?.scrollToOffset({ offset: 0, animated: false }); }, [workPath]);
  useEffect(() => { writerList.current?.scrollToOffset({ offset: 0, animated: false }); }, [term]);
  const changedFollow = () => { void writers.reload(); void writerResults.reload(); };
  const books = (items: Work[]) => tablet
    ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>{items.map(work => <ExploreBook key={work._id} work={work} width={bookWidth} onMenu={setMenu}/>)}</View>
    : <FlatList horizontal data={items} keyExtractor={w => w._id} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }} renderItem={({ item }) => <ExploreBook work={item} width={bookWidth} onMenu={setMenu}/>} />;
  const changeGenre = (value: string) => { setGenre(value); setGenrePanel(false); };
  const visibleGenres = (genres.data?.genres || []).slice(0, 7);
  const publicLogs = logs.items.filter(log => log.visibility === 'public' && log.content?.trim()).slice(0, 3);

  return <View style={styles.page}>
    <View style={[styles.content, { paddingBottom: 10, paddingTop: 12, gap: 10 }]}>
      <Title>Keşfet</Title>
      <SearchField value={q} onChangeText={setQ} placeholder="Eser veya yazar ara"/>
      <View style={[styles.row, { justifyContent: 'space-between' }]}><Text style={[styles.muted, { fontSize: 12 }]}>Eser türü{genre ? ` · ${genre}` : ''}</Text><TextAction title={genre ? 'Türü temizle' : 'Tüm türler'} onPress={() => genre ? changeGenre('') : setGenrePanel(true)}/></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
        <Chip title="Hepsi" selected={!genre} onPress={() => changeGenre('')}/>
        {visibleGenres.map(g => <Chip key={g.genre} title={g.genre} selected={genre === g.genre} onPress={() => changeGenre(g.genre)}/>)}
        {!!genre && !visibleGenres.some(g => g.genre === genre) && <Chip title={genre} selected onPress={() => changeGenre('')}/>}
        <Chip title="Tüm türler…" onPress={() => setGenrePanel(true)}/>
      </ScrollView>
      {genres.loading && !genres.data && <Text style={styles.muted}>Türler yükleniyor…</Text>}<ErrorBox error={genres.error} retry={genres.reload}/>
      {searching && <><Segments options={[{ value: 'works', label: 'Eserler' }, { value: 'writers', label: 'Yazarlar' }]} value={tab} onChange={setTab}/>{tab === 'writers' && <Text style={styles.muted}>Yazarlar tüm türlerden gösterilir.</Text>}</>}
      {!searching && catalogOpen && <TextAction title="Keşif raflarına dön" onPress={() => setCatalogOpen(false)}/>}
    </View>

    {/* Keep scroll surfaces mounted: clearing search restores native offsets,
        including horizontal shelf positions. Detail routes stack above this tab. */}
    <ScrollView testID="discovery-scroll" style={{ flex: 1, display: resultsOpen ? 'none' : 'flex' }} contentContainerStyle={[styles.content, { paddingTop: 8, gap: 30 }]} keyboardShouldPersistTaps="handled">
      <View style={{ gap: 14 }}><SectionHeading title="Keşfedilecek eserler" detail="Son güncellenen hikâyelere göz at." action={shelf.hasMore ? 'Tümünü gör' : undefined} onPress={() => setCatalogOpen(true)}/>
        <ShelfState resource={shelf} empty={genre ? 'Bu türde yayımlanmış bir eser bulunamadı.' : 'Henüz yayımlanmış bir eser yok.'}/>{books(shelf.items)}
      </View>
      {(review.loading || review.error || review.items.length > 0) ? <View style={{ gap: 14 }}><SectionHeading title="Bir yorumunla katkı ver" detail="Tüm türlerden, daha az yorum almış yayımlanmış eserler."/><ShelfState resource={review}/>{books(review.items)}</View> : null}
      <View style={{ gap: 6 }}><SectionHeading title="Yazarlarla tanış" detail="Son herkese açık günlüklerden kalemler."/><ShelfState resource={writers} empty="Henüz keşfedilecek bir yazar yok."/>
        <View style={{ flexDirection: tablet && fontScale < 1.5 ? 'row' : 'column', flexWrap: 'wrap', gap: 20 }}>{writers.items.map(writer => <View key={writer._id} style={{ width: tablet && fontScale < 1.5 ? (available - 40) / 3 : '100%' }}><WriterCard writer={writer} onChanged={changedFollow}/></View>)}</View>
      </View>
      <View style={{ gap: 16 }}><SectionHeading title="Günlüklerden birkaç satır" detail="Son 24 saatten, herkese açık bir seçki." action="Akış’a git" onPress={() => router.push('/')}/>
        <ShelfState resource={{ ...logs, items: publicLogs }} empty="Bugün için henüz bir günlük yok."/>
        {publicLogs.map(log => <ExploreJournal key={log._id} log={log}/>)}
      </View>
      {!user && !joinHidden && <View style={[styles.row, { justifyContent: 'space-between' }]}><TextAction title="Aramıza katıl :)" onPress={() => router.push('/auth/login')}/><TextAction title="Kapat" onPress={() => setJoinHidden(true)}/></View>}
    </ScrollView>

    <FlatList ref={workList} testID="work-results" style={{ flex: 1, display: resultsOpen && (!searching || tab === 'works') ? 'flex' : 'none' }} contentContainerStyle={[styles.content, { paddingTop: 10, gap: 14 }]} data={workResults.items} keyExtractor={w => w._id} keyboardShouldPersistTaps="handled" onEndReached={() => { void workResults.more(); }} onEndReachedThreshold={0.4}
      ListHeaderComponent={!searching ? <SectionHeading title="Keşfedilecek eserler" detail="Son güncellenenler"/> : null}
      renderItem={({ item }) => <ExploreBook work={item} compact onMenu={setMenu}/>}
      ListFooterComponent={<><ShelfState resource={workResults} empty={searching && !usableQuery ? 'Aramak için en az 2 karakter yaz.' : 'Eser bulunamadı. Aramayı veya türü değiştirebilirsin.'}/>{workResults.loading && !!workResults.items.length && <Loading/>}{workResults.hasMore && !workResults.loading && !workResults.error && <Button secondary title="Daha fazla eser" onPress={() => { void workResults.more(); }}/>}</>}/>
    <FlatList ref={writerList} testID="writer-results" style={{ flex: 1, display: searching && tab === 'writers' ? 'flex' : 'none' }} contentContainerStyle={[styles.content, { paddingTop: 0 }]} data={writerResults.items} keyExtractor={p => p._id} keyboardShouldPersistTaps="handled" onEndReached={() => { void writerResults.more(); }} onEndReachedThreshold={0.4}
      renderItem={({ item }) => <WriterCard writer={item} onChanged={changedFollow}/>}
      ListFooterComponent={<><ShelfState resource={writerResults} empty={!usableQuery ? 'Aramak için en az 2 karakter yaz.' : 'Yazar bulunamadı. Başka bir ad deneyebilirsin.'}/>{writerResults.loading && !!writerResults.items.length && <Loading/>}{writerResults.hasMore && !writerResults.loading && !writerResults.error && <Button secondary title="Daha fazla yazar" onPress={() => { void writerResults.more(); }}/>}</>}/>

    <Modal visible={genrePanel} animationType="slide" onRequestClose={() => setGenrePanel(false)}><Page safeTop><TextAction title="Türleri kapat" onPress={() => setGenrePanel(false)}/><Title>Eser türleri</Title><Text style={styles.muted}>Bu seçim yalnızca eser rafını ve eser aramasını etkiler.</Text><ErrorBox error={genres.error} retry={genres.reload}/>{genres.loading && <Loading/>}<View style={[styles.row, { alignItems: 'flex-start' }]}><Chip title="Hepsi" selected={!genre} onPress={() => changeGenre('')}/>{genres.data?.genres.map(g => <Chip key={g.genre} title={g.genre} selected={genre === g.genre} onPress={() => changeGenre(g.genre)}/>)}</View></Page></Modal>
    {menu && <BookMenu work={menu} close={() => setMenu(undefined)}/>}
  </View>;
}
