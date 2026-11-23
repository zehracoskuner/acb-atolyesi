import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Work } from '../types';
import { fonts, useUI } from '../ui';
import { BookCover } from './BookCover';
export function ShelfBook({ work }: { work: Work }) {
  const { colors, styles } = useUI(); const [width, setWidth] = useState(120);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${work.title}, eseri aç`} onPress={() => router.push(`/work/${work._id}`)} onLayout={e => setWidth(Math.max(80, e.nativeEvent.layout.width - 24))} style={({ pressed }) => ({ gap: 8, paddingBottom: 20, opacity: pressed ? .7 : 1 })}>
    <View style={{ alignItems: 'center', padding: 12, paddingBottom: 16, backgroundColor: colors.soft, borderRadius: 14 }}><BookCover work={work} width={Math.min(width, 190)}/></View>
    <Text numberOfLines={2} style={{ fontFamily: fonts.display, fontSize: 19, lineHeight: 25, color: colors.ink }}>{work.title}</Text>
    <Text numberOfLines={1} style={[styles.muted, { fontSize: 12, lineHeight: 18 }]}>{work.author?.kullaniciAdi || work.author?.username || 'Anonim yazar'}</Text>
    <Text style={[styles.muted, { fontSize: 11, lineHeight: 17 }]}>{[work.genres?.[0] || work.universe?.genres?.[0], work.chapterCount ? `${work.chapterCount} bölüm` : ''].filter(Boolean).join(' · ')}</Text>
  </Pressable>;
}
