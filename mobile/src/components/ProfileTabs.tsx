import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { useResource } from '../useResource';
import { api, ApiError } from '../api';
import type { Work, FeedItem, Progress } from '../types';
import { Button, Empty, ErrorBox, Loading, TextAction, useAction, useUI, confirmDelete } from '../ui';
import { profileColumns, workState } from '../profile';
import { WorkCard } from './WorkCard';
import { BookCover } from './BookCover';
import { JournalCard } from './CommunityCards';
type ReadingList = { _id: string; name: string; description?: string; isPrivate?: boolean; works?: { work: Work | null }[] };
type Quote = { _id: string; text: string; workTitle?: string; authorName?: string };
export function ResourceState({ resource, empty }: { resource: { loading: boolean; error: unknown; reload: () => void }; empty?: string }) {
  const restricted = resource.error instanceof ApiError && [401, 403].includes(resource.error.status);
  return <>{resource.loading && <Loading/>}{restricted ? <Empty title="Erişim kısıtlı" description={(resource.error as Error).message}/> : <ErrorBox error={resource.error} retry={resource.reload}/>} {!resource.loading && !resource.error && empty && <Empty title={empty}/>}</>;
}
export function ProfileLogs({ target, owner }: { target: string; owner: boolean }) {
  const [page, setPage] = useState(1); const { styles } = useUI();
  const logs = useResource<{ items: FeedItem[]; hasMore: boolean }>(`/logs/${target}?page=${page}&limit=10`);
  return <>{owner && <Button secondary title="Günlüğüne yaz" icon="create-outline" onPress={() => router.push('/compose')}/>}
    <ResourceState resource={logs} empty={logs.data?.items.length === 0 ? 'Bu günlük henüz boş' : undefined}/>
    {logs.data?.items.map(log => <JournalCard key={log._id} item={{ ...log, type: 'log' }}/>)}
    {(page > 1 || logs.data?.hasMore) && <View style={styles.row}><Button secondary title="Önceki günlükler sayfası" disabled={page === 1 || logs.loading} onPress={() => setPage(p => p - 1)}/><Text style={styles.muted}>{page}</Text><Button secondary title="Sonraki günlükler sayfası" disabled={!logs.data?.hasMore || logs.loading} onPress={() => setPage(p => p + 1)}/></View>}
  </>;
}
function ProfileBook({ work, owner, draft }: { work: Work; owner: boolean; draft: boolean }) {
  const { colors, styles } = useUI(); const [menu, setMenu] = useState(false); const [width, setWidth] = useState(120);
  return <View style={{ gap: 8, paddingBottom: 24 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${work.title}, ${draft ? 'atölyeyi aç' : 'eseri aç'}`} onPress={() => router.push(draft ? `/studio/${work._id}` : `/work/${work._id}`)} style={{ gap: 10 }}>
      <View style={{ backgroundColor: colors.soft, padding: 16, alignItems: 'center', borderRadius: 8 }}><BookCover work={work} width={Math.min(180, Math.max(70, width - 32))}/></View>
      <Text style={styles.heading}>{work.title}</Text><Text style={styles.muted}>{(work.genres || work.universe?.genres || []).join(' · ') || 'Tür belirtilmemiş'}</Text>
      <Text style={[styles.muted, { color: colors.accent }]}>{workState(work)}{work.chapterCount !== undefined ? ` · ${work.chapterCount} yayında bölüm` : ''}</Text>
    </Pressable>
    {draft && <><Text style={styles.muted}>{work.updatedAt ? `Son düzenleme · ${new Date(work.updatedAt).toLocaleDateString('tr-TR')}` : 'Düzenleme tarihi belirtilmemiş'}</Text><TextAction title="Yazmaya devam et" icon="create-outline" onPress={() => router.push(`/studio/${work._id}`)}/></>}
    {owner && !draft && <><TextAction title="Eser işlemleri" icon="ellipsis-horizontal" onPress={() => setMenu(!menu)}/>{menu && <TextAction title="Atölyede yönet" onPress={() => router.push(`/studio/${work._id}`)}/>}</>}
  </View>;
}
export function ProfileWorks({ target, owner, draft }: { target: string; owner: boolean; draft: boolean }) {
  const { width, fontScale } = useWindowDimensions(); const columns = profileColumns(width, fontScale);
  const works = useResource<{ items: Work[] }>(owner ? '/user/works' : `/public/profile/${target}/works`);
  const items = works.data?.items.filter(w => draft ? w.status !== 'published' : w.status === 'published');
  return <><ResourceState resource={works} empty={items?.length === 0 ? draft ? 'Henüz taslak yok' : 'Henüz yayınlanmış eser yok' : undefined}/><View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18 }}>{items?.map(work => <View key={work._id} style={{ width: columns === 1 ? '100%' : columns === 2 ? '47%' : '31%' }}><ProfileBook work={work} owner={owner} draft={draft}/></View>)}</View></>;
}
export function ProfileLists({ target, owner }: { target: string; owner: boolean }) {
  const { styles, colors } = useUI(); const lists = useResource<{ items: ReadingList[] }>(owner ? '/reading-lists' : `/reading-lists/user/${target}`);
  return <>{owner && <Button secondary title="Liste oluştur / düzenle" icon="add-outline" onPress={() => router.push('/lists')}/>}<ResourceState resource={lists} empty={lists.data?.items.length === 0 ? 'Henüz okuma listesi yok' : undefined}/>
    {lists.data?.items.map(list => { const works = list.works?.flatMap(e => e.work ? [e.work] : []) || []; return <Pressable key={list._id} accessibilityRole="button" accessibilityLabel={`${list.name}, listeyi aç`} onPress={() => router.push({ pathname: '/lists', params: { ...(owner ? {} : { userId: target }), listId: list._id } })} style={{ paddingVertical: 20, gap: 12, borderBottomWidth: 1, borderColor: colors.line }}><View style={{ flexDirection: 'row', gap: 8 }}>{works.slice(0, 3).map(w => <BookCover key={w._id} work={w} width={54}/>)}</View><Text style={styles.heading}>{list.name}</Text><Text style={styles.muted}>{works.length} eser · {list.isPrivate ? 'Yalnızca sen' : 'Herkese açık'}</Text>{!!list.description && <Text style={styles.text}>{list.description}</Text>}</Pressable>; })}
  </>;
}
export function ProfileQuotes({ target, owner }: { target: string; owner: boolean }) {
  const { styles, colors } = useUI(); const action = useAction(); const [page, setPage] = useState(1);
  const quotes = useResource<{ items: Quote[]; totalPages: number }>(owner ? `/quotes/my?page=${page}` : `/quotes/user/${target}?page=${page}`);
  return <><Text style={styles.muted}>Alıntılar özel not değildir; giriş yapan diğer üyeler de görebilir.</Text><ResourceState resource={quotes} empty={quotes.data?.items.length === 0 ? 'Henüz alıntı yok' : undefined}/><ErrorBox error={action.error}/>{quotes.data?.items.map(q => <View key={q._id} style={{ paddingVertical: 24, gap: 12, borderBottomWidth: 1, borderColor: colors.line }}><Text selectable style={[styles.prose, { fontSize: 19, lineHeight: 32 }]}>“{q.text}”</Text><Text style={styles.heading}>{q.workTitle || 'Kaldırılmış eser'}</Text><Text style={styles.muted}>{q.authorName || 'Yazar bilgisi bulunamadı'}</Text>{owner && <TextAction title="Alıntıyı sil" disabled={action.busy} onPress={() => confirmDelete('Alıntı silinsin mi?', () => action.run(async () => { await api(`/quotes/${q._id}`, 'DELETE'); await quotes.reload(); }))}/>}</View>)}{(page > 1 || (quotes.data?.totalPages || 0) > 1) && <View style={styles.row}><Button secondary title="Önceki alıntılar" disabled={page === 1 || quotes.loading} onPress={() => setPage(p => p - 1)}/><Button secondary title="Sonraki alıntılar" disabled={page >= (quotes.data?.totalPages || 1) || quotes.loading} onPress={() => setPage(p => p + 1)}/></View>}</>;
}
export function ProfileLibrary() {
  const library = useResource<{ items: Work[] }>('/library'); const progress = useResource<{ items: Progress[] }>('/reading-progress'); const { styles } = useUI();
  return <><Text style={styles.muted}>Kütüphaneni yalnızca sen görebilirsin.</Text><ResourceState resource={progress}/>{progress.data?.items.filter(p => p.story && p.chapter).map(p => <View key={p.story._id} style={{ gap: 8 }}><Text style={styles.heading}>{p.story.title}</Text><Text style={styles.muted}>{p.chapter.title} · Bölüm içi %{Math.round(p.scrollPosition)}</Text><Button secondary title="Devam et" onPress={() => router.push({ pathname: '/read/[workId]/[chapterId]', params: { workId: p.story._id, chapterId: p.chapter._id, mode: 'resume' } })}/></View>)}<ResourceState resource={library} empty={library.data?.items.length === 0 ? 'Kütüphanen henüz boş' : undefined}/>{library.data?.items.filter(Boolean).map(w => <WorkCard key={w._id} work={w}/>)}</>;
}
