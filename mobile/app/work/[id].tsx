import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSession } from '../../src/session';
import { joinAtelier } from '../../src/components/MemberGate';
import { api } from '../../src/api';
import { readPosition } from '../../src/reading';
import { useResource } from '../../src/useResource';
import type { Work, Chapter } from '../../src/types';
import { BookCover } from '../../src/components/BookCover';
import { Button, Empty, ErrorBox, fonts, Loading, MenuRow, Page, SectionHeading, TextAction, useAction, useUI } from '../../src/ui';
export default function WorkDetail() {
  const { colors, styles } = useUI(); const { user } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>(); const action = useAction();
  const work = useResource<{ item: Work }>(`/public/works/${id}`); const chapters = useResource<{ items: Chapter[] }>(`/public/works/${id}/chapters`);
  const library = useResource<{ inLibrary: boolean }>(user ? `/library/check/${id}` : null); const like = useResource<{ liked: boolean; likeCount: number }>(user ? `/likes/check/${id}` : null);
  const progress = useResource<{ found: boolean; chapterId?: string }>(user ? `/reading-progress/${id}` : null);
  const [localChapter, setLocalChapter] = useState<string>();
  useFocusEffect(useCallback(() => { let active = true; setLocalChapter(undefined); if (user) void readPosition(user._id, id).then(p => { if (active) setLocalChapter(p?.chapterId); }).catch(() => {}); return () => { active = false; }; }, [user, id]));
  const canResume = !!localChapter || !!progress.data?.found;
  const start = localChapter || progress.data?.chapterId || chapters.data?.items[0]?._id;
  return <Page>{work.loading && <Loading/>}<ErrorBox error={work.error} retry={work.reload}/>{work.data && <>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingBottom: 8, gap: 20 }}><View style={{ padding: 10, backgroundColor: colors.soft, borderRadius: 14 }}><BookCover work={work.data.item} width={92}/></View><View style={{ flex: 1, gap: 8 }}><Text style={[styles.label, { textAlign: 'left' }]}>{(work.data.item.genres || work.data.item.universe?.genres || []).join(' / ').toLocaleUpperCase('tr') || 'ATÖLYENİN RAFINDAN'}</Text><Text accessibilityRole="header" style={[styles.heading, { textAlign: 'left' }]}>{work.data.item.title}</Text>
      {work.data.item.author?._id ? <Pressable accessibilityRole="button" accessibilityLabel="Yazar profilini aç" onPress={() => router.push(`/profile/${work.data!.item.author!._id}`)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[styles.muted, { color: colors.accent }]}>{work.data.item.author.kullaniciAdi || work.data.item.author.username || 'Yazarı tanı'}</Text></Pressable> : <Text style={styles.muted}>Anonim yazar</Text>}
    </View></View>
    {work.data.item.contentWarning && <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.rust }]}><Text style={styles.text}>Bu eserde hassas içerik bulunuyor. Okumadan önce içerik uyarısını kabul et.</Text><Button secondary busy={action.busy} title="Uyarıyı okudum, devam etmek istiyorum" onPress={() => !user ? joinAtelier(`/work/${id}`) : action.run(async () => { await api(`/public/works/${id}/mature-acknowledgement`, 'POST', {}); if (start) router.push(`/read/${id}/${start}`); })}/></View>}
    <Button title={canResume ? 'Kaldığım yerden oku' : user ? 'Okumaya başla' : 'Önizlemeyi oku'} icon="book-outline" disabled={!start} onPress={() => start && router.push({ pathname: '/read/[workId]/[chapterId]', params: { workId: id, chapterId: start, mode: canResume ? 'resume' : 'start' } })}/>
    {canResume && chapters.data?.items[0] && <Button secondary title="Başlangıçtan oku" onPress={() => router.push({ pathname: '/read/[workId]/[chapterId]', params: { workId: id, chapterId: chapters.data!.items[0]!._id, mode: 'start' } })}/>}
    <View style={styles.row}><Button secondary style={{ flexGrow: 1 }} busy={action.busy} disabled={!!user && !like.data} icon={like.data?.liked ? 'heart' : 'heart-outline'} title={`${like.data?.likeCount ?? 0} beğeni`} onPress={() => action.run(async () => { const r = await api<{ liked: boolean; likeCount: number }>('/likes', 'POST', { workId: id, liked: !like.data?.liked }); like.setData(r); })}/>
      {!work.data.item.isOwner && <Button secondary style={{ flexGrow: 1 }} busy={action.busy} disabled={!library.data} icon={library.data?.inLibrary ? 'bookmark' : 'bookmark-outline'} title={library.data?.inLibrary ? 'Rafımda' : 'Rafıma ekle'} onPress={() => action.run(async () => { await api(library.data?.inLibrary ? `/library/${id}` : '/library', library.data?.inLibrary ? 'DELETE' : 'POST', { workId: id }); await library.reload(); })}/>}</View>
    <ErrorBox error={action.error}/>
    {!!work.data.item.description && <View style={{ gap: 12 }}><SectionHeading title="Açıklama"/><Text style={styles.prose}>{work.data.item.description}</Text></View>}
    {!!work.data.item.preface && <View style={{ borderLeftWidth: 2, borderColor: colors.line, paddingLeft: 18 }}><Text style={[styles.prose, { fontFamily: fonts.italic, color: colors.muted }]}>{work.data.item.preface}</Text></View>}
    <View><SectionHeading title="Bölümler" detail={chapters.data ? `${chapters.data.items.length} bölüm` : undefined}/>{chapters.loading && <Loading/>}<ErrorBox error={chapters.error} retry={chapters.reload}/>{chapters.data?.items.map((ch, i) => <MenuRow key={ch._id} title={`${String(i + 1).padStart(2, '0')}   ${ch.title}`} icon="reader-outline" onPress={() => router.push(`/read/${id}/${ch._id}`)}/>)}{chapters.data?.items.length === 0 && <Empty title="Yayında bölüm yok."/>}</View>
    <MenuRow title="Eser hakkında sohbet" detail="Bu hikâye sende ne bıraktı?" icon="chatbubbles-outline" onPress={() => router.push({ pathname: '/discussion/[id]', params: { id, kind: 'work' } })}/>
    {!work.data.item.isOwner && <TextAction title="Eseri bildir" onPress={() => router.push({ pathname: '/report', params: { targetId: id, targetType: 'work' } })}/>}
  </>}</Page>;
}
