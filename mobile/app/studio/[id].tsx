import { MemberGate } from '../../src/components/MemberGate';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { api } from '../../src/api';
import { pickAndUpload } from '../../src/images';
import { useResource } from '../../src/useResource';
import type { Work, Chapter } from '../../src/types';
import { BookCover } from '../../src/components/BookCover';
import { useSession } from '../../src/session';
import { removeChapterDraft } from '../../src/sync';
import { Button, Empty, ErrorBox, Field, Loading, MenuRow, Page, SectionHeading, TextAction, Title, useAction, useUI } from '../../src/ui';
export function StudioWorkContent({ id }: { id: string }) {
  const { styles } = useUI();
  const work = useResource<{ item: Work }>(`/works/${id}`); const chapters = useResource<{ items: Chapter[] }>(`/works/${id}/chapters`); const action = useAction();
  const [editing, setEditing] = useState(false); const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [genres, setGenres] = useState<string[]>([]);
  const catalog = useResource<{ genres: { genre: string; count: number }[] }>('/works/genres');
  const { user } = useSession(); const [managing, setManaging] = useState<Chapter | null>(null); const [order, setOrder] = useState('');
  useEffect(() => { if (work.data) { setTitle(work.data.item.title); setDescription(work.data.item.description || ''); setGenres(work.data.item.genres || []); } }, [work.data]);
  return <View style={{ gap: 18 }}>{work.loading && <Loading/>}<ErrorBox error={work.error} retry={work.reload}/>{work.data && <><View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}><BookCover work={work.data.item} width={72}/><View style={{ flex: 1 }}><Title eyebrow="Eser atölyesi">{work.data.item.title}</Title></View></View><TextAction title={editing ? 'Düzenlemeyi kapat' : 'Eser bilgilerini düzenle'} icon="options-outline" onPress={() => setEditing(!editing)}/>
    {editing && <View style={styles.card}><Field label="Eser adı" value={title} onChangeText={setTitle}/><Field label="Açıklama" multiline value={description} onChangeText={setDescription}/><Text style={styles.muted}>En fazla 5 tür seç</Text><View style={styles.row}>{catalog.data?.genres.map(({ genre: g }) => <Button key={g} secondary title={`${genres.includes(g) ? '✓ ' : ''}${g}`} onPress={() => setGenres(current => current.includes(g) ? current.filter(x => x !== g) : current.length < 5 ? [...current, g] : current)}/>)}</View><Button title="Bilgileri kaydet" busy={action.busy} disabled={!title.trim()} onPress={() => action.run(async () => { await api(`/works/${id}`, 'PATCH', { title, description, genres }); await work.reload(); setEditing(false); })}/></View>}
    <Button title="Yeni bölüm yaz" icon="add-outline" busy={action.busy} onPress={() => action.run(async () => { const r = await api<{ item: Chapter }>('/chapters', 'POST', { workId: id }); router.push({ pathname: '/write/[id]', params: { id: r.item._id, workId: id } }); })}/>
    <SectionHeading title="Bölümleri yönet" detail="Sıralama ve silme işlemleri yazma alanından ayrıdır."/>
    <View style={styles.row}>{chapters.data?.items.map(ch => <Button key={ch._id} secondary title={`${ch.order}. ${ch.title}`} onPress={() => { setManaging(ch); setOrder(String(ch.order || 1)); }}/>)}</View>
    {managing && <View style={{ gap: 12 }}><Text style={styles.heading}>{managing.title}</Text><Field label="Sıra numarası" keyboardType="number-pad" value={order} onChangeText={setOrder}/><Button busy={action.busy} title="Sırayı kaydet" disabled={!/^\d+$/.test(order) || Number(order) < 1} onPress={() => action.run(async () => { await api(`/chapters/${managing._id}`, 'PUT', { order: Number(order) }); await chapters.reload(); setManaging(null); })}/><Button secondary title="Bölümü sil" busy={action.busy} onPress={() => Alert.alert(`“${managing.title}” silinsin mi?`, 'Bölüm ve bölüm geçmişi kalıcı olarak silinecek. Bu işlem geri alınamaz.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Bölümü sil', style: 'destructive', onPress: () => action.run(async () => { await api(`/chapters/${managing._id}`, 'DELETE'); if (user) await removeChapterDraft(user._id, id, managing._id); setManaging(null); await chapters.reload(); }) }])}/><TextAction title="Yönetimi kapat" onPress={() => setManaging(null)}/></View>}
    <View><MenuRow title="Olay Örgüsü" detail="Sahne haritası, perdeler ve bağlantılar" icon="git-branch-outline" onPress={() => router.push(`/plot/${id}`)}/><MenuRow title="Hikâye araçları" detail="Karakterler, dünya ve notlar" icon="people-outline" onPress={() => router.push(`/tools/${id}`)}/><MenuRow title="Kapak görseli seç" icon="image-outline" onPress={() => action.run(async () => { const uploaded = await pickAndUpload<{ url: string }>('/upload'); if (uploaded) { await api(`/works/${id}`, 'PATCH', { coverImage: uploaded.url }); await work.reload(); } })}/></View><ErrorBox error={action.error}/>
    <View><SectionHeading title="Bölümlerin"/>{chapters.loading && <Loading/>}<ErrorBox error={chapters.error} retry={chapters.reload}/>{chapters.data?.items.map((ch, index) => <View key={ch._id}><MenuRow title={`${String(index + 1).padStart(2, '0')}   ${ch.title}`} detail={`${({ draft: 'Taslak', published: 'Yayında', pending_review: 'İncelemede', rejected: 'Gözden geçirme gerekiyor' } as Record<string, string>)[ch.status || 'draft']}${ch.hasUnpublishedChanges ? ' · yayınlanmamış değişiklikler' : ''}`} icon="document-text-outline" onPress={() => router.push({ pathname: '/write/[id]', params: { id: ch._id, workId: id } })}/>{ch.reviewNote && <Text style={styles.muted}>{ch.reviewNote}</Text>}</View>)}{chapters.data?.items.length === 0 && <Empty title="İlk bölüm seni bekliyor."/>}</View></>}</View>;
}

function StudioWorkRoute() { const { id } = useLocalSearchParams<{ id: string }>(); return <Page><StudioWorkContent key={id} id={id}/></Page>; }

export default function StudioWork() { return <MemberGate title="Atölye"><StudioWorkRoute/></MemberGate>; }
