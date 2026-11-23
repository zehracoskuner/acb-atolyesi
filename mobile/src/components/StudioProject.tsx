import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useResource } from '../useResource';
import type { Chapter, Work } from '../types';
import { BookCover } from './BookCover';
import { Button, ErrorBox, TextAction, useUI } from '../ui';
export function StudioProject({ work }: { work: Work }) {
  const { colors, styles } = useUI();
  const chapters = useResource<{ items: Chapter[] }>(`/works/${work._id}/chapters`);
  const chapter = chapters.data?.items.find(c => c.status !== 'published') || chapters.data?.items.at(-1);
  return <View style={[styles.card, { padding: 20, gap: 18 }]}>
    <View style={{ flexDirection: 'row', gap: 16 }}><BookCover work={work} width={70}/><View style={{ flex: 1, gap: 6, justifyContent: 'center' }}><Text style={[styles.label, { letterSpacing: .6 }]}>{work.status === 'published' ? 'YAYINDA' : 'TASLAK'}</Text><Text style={styles.heading}>{work.title}</Text><Text style={styles.muted}>{chapters.data ? `${chapters.data.items.length} bölüm` : 'Bölümler yükleniyor'}</Text></View></View>
    {chapter ? <View style={{ backgroundColor: colors.pale, padding: 14, borderRadius: 10, gap: 8 }}><Text style={styles.muted}>Yazmaya devam et</Text><Text style={[styles.text, { fontWeight: '600' }]}>{chapter.title}</Text><Button title="Bölümü aç" icon="create-outline" onPress={() => router.push({ pathname: '/write/[id]', params: { id: chapter._id, workId: work._id } })}/></View> : <Button secondary title="Bölümleri aç" icon="reader-outline" onPress={() => router.push(`/studio/${work._id}`)}/>}
    <ErrorBox error={chapters.error} retry={chapters.reload}/>
    <View style={[styles.row, { justifyContent: 'space-between' }]}><TextAction title="Eser bilgileri" icon="options-outline" onPress={() => router.push(`/studio/${work._id}`)}/><TextAction title="Hikâye araçları" icon="git-branch-outline" onPress={() => router.push(`/tools/${work._id}`)}/></View>
  </View>;
}
