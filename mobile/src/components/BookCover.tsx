import { Image, Text, View } from 'react-native';
import { fonts } from '../ui';
import type { Work } from '../types';
const bindings = ['#234B43', '#7B4C3B', '#505947', '#3E4D62', '#846748'];
export function BookCover({ work, width = 72 }: { work: Pick<Work, '_id' | 'title' | 'coverImage' | 'author'>; width?: number }) {
  const binding = bindings[Array.from(work._id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % bindings.length];
  return <View style={{ width, height: width * 1.43, flexShrink: 0, borderRadius: 2, borderTopRightRadius: 5, borderBottomRightRadius: 5, overflow: 'hidden', backgroundColor: binding }}>
    {work.coverImage ? <Image source={{ uri: work.coverImage }} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors resizeMode="cover"/> : <View style={{ flex: 1, padding: width * .15, justifyContent: 'center', alignItems: 'center', gap: width * .12 }}><View pointerEvents="none" style={{ position: 'absolute', width: width * .84, height: width * .84, borderRadius: width, borderWidth: 1, borderColor: '#FFFFFF20', top: -width * .24, right: -width * .24 }}/><View style={{ width: '32%', height: 2, backgroundColor: '#E9DCC180' }}/><Text numberOfLines={4} style={{ fontFamily: fonts.display, fontSize: width < 50 ? 18 : Math.max(10, width * .14), lineHeight: width < 50 ? 24 : Math.max(14, width * .2), color: '#FFF5E4', textAlign: 'center' }}>{width < 50 ? work.title.slice(0, 1) : work.title}</Text><View style={{ width: '40%', height: 1, backgroundColor: '#E9DCC180' }}/>{width > 100 && <Text numberOfLines={1} style={{ color: '#E9DCC1', fontFamily: fonts.body, fontSize: 9, textAlign: 'center' }}>{work.author?.kullaniciAdi || work.author?.username || 'ACB ATÖLYESİ'}</Text>}</View>}
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: width * .07, backgroundColor: '#00000026', borderRightWidth: 1, borderRightColor: '#FFFFFF30' }}/>
  </View>;
}
