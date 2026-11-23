import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUI } from '../ui';
import { BookCover } from './BookCover';
import type { Work } from '../types';
export function WorkCard({ work, studio, onPress }: { work: Work; studio?: boolean; onPress?: () => void }) {
  const { colors, styles } = useUI();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${work.title}, ${studio ? 'atölyeyi aç' : 'eseri aç'}`} onPress={onPress || (() => router.push(studio ? `/studio/${work._id}` : `/work/${work._id}`))} style={({ pressed }) => ({ flexDirection: 'row', gap: 17, paddingVertical: 19, borderBottomWidth: 1, borderColor: colors.line, opacity: pressed ? .65 : 1 })}>
    <BookCover work={work} width={78}/>
    <View style={{ flex: 1, minWidth: 0, gap: 5 }}><Text numberOfLines={2} style={styles.heading}>{work.title}</Text><Text style={[styles.muted, { fontSize: 13 }]}>{studio ? work.status === 'published' ? 'Yayında' : 'Taslak' : work.author?.kullaniciAdi || work.author?.username || 'Anonim yazar'}</Text>
      {!!(work.genres || work.universe?.genres || []).length && <Text numberOfLines={1} style={[styles.muted, { color: colors.accent, fontSize: 12 }]}>{(work.genres || work.universe?.genres || []).join(' / ')}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 4 }}><Text style={[styles.muted, { fontSize: 12 }]}>{work.chapterCount !== undefined ? `${work.chapterCount} bölüm` : studio ? 'Eser atölyesi' : 'Hikâyeyi keşfet'}</Text><Ionicons name={studio ? 'pencil-outline' : 'arrow-forward-outline'} size={18} color={colors.accent}/></View>
    </View>
  </Pressable>;
}
