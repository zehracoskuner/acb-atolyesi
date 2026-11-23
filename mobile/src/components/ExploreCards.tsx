import { useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '../api';
import { useSession } from '../session';
import { useResource } from '../useResource';
import type { Work, FeedItem } from '../types';
import { JournalCard } from './CommunityCards';
import { Avatar, Button, ErrorBox, fonts, IconButton, Loading, Page, TextAction, Title, useAction, useUI } from '../ui';

export interface ExploreWriter { _id: string; kullaniciAdi: string; avatarUrl?: string; bio?: string; isFollowedByMe?: boolean }

export function ExploreJournal({ log }: { log: FeedItem }) {
  return <JournalCard item={{ ...log, type: 'log' }} preview/>;
}

export function ExploreCover({ work, width }: { work: Work; width: number }) {
  const { colors, styles } = useUI(); const [failed, setFailed] = useState<string>();
  return <View style={{ width, height: width * 1.5, backgroundColor: colors.soft, borderRadius: 3, overflow: 'hidden' }}>
    {!!work.coverImage && failed !== work.coverImage
      ? <Image source={{ uri: work.coverImage, cache: 'force-cache' }} resizeMode="cover" onError={() => setFailed(work.coverImage)} style={{ width: '100%', height: '100%' }} accessibilityIgnoresInvertColors/>
      : <View testID="cover-placeholder" style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 12, gap: 10 }}><Ionicons name="book-outline" color={colors.muted} size={28}/><Text style={[styles.muted, { fontSize: 12, textAlign: 'center' }]}>Kapak yok</Text></View>}
  </View>;
}

export function ExploreBook({ work, width, onMenu, compact = false }: { work: Work; width?: number; onMenu: (work: Work) => void; compact?: boolean }) {
  const { colors, styles } = useUI();
  const author = work.isAnonymous ? undefined : work.author;
  const name = author?.kullaniciAdi || author?.username || 'Anonim yazar';
  const open = () => router.push(`/work/${work._id}`);
  return <View style={{ width, flexDirection: compact ? 'row' : 'column', gap: compact ? 16 : 7, paddingBottom: compact ? 18 : 0 }}>
    <View><Pressable accessibilityRole="button" accessibilityLabel={`${work.title}, eseri aç`} onPress={open} style={({ pressed }) => ({ opacity: pressed ? .7 : 1 })}><ExploreCover work={work} width={compact ? 72 : width || 140}/></Pressable>{!compact && <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: colors.paper, borderRadius: 24 }}><IconButton icon="ellipsis-horizontal" label={`${work.title}, eser menüsü`} onPress={() => onMenu(work)}/></View>}</View>
    <View style={{ flex: compact ? 1 : undefined, minWidth: 0, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}><Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${work.title}, eser detayını aç`} style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}><Text numberOfLines={2} style={{ fontFamily: fonts.display, fontSize: 19, lineHeight: 26, color: colors.ink }}>{work.title}</Text></Pressable>{compact && <IconButton icon="ellipsis-horizontal" label={`${work.title}, eser menüsü`} onPress={() => onMenu(work)}/>}</View>
      {author?._id ? <Pressable accessibilityRole="button" accessibilityLabel={`${name}, yazar profilini aç`} onPress={() => router.push(`/profile/${author._id}`)} style={{ minHeight: 44, justifyContent: 'center' }}><Text numberOfLines={2} style={[styles.muted, { color: colors.accent, fontSize: 13 }]}>{name}</Text></Pressable> : <Text style={styles.muted}>{name}</Text>}
      <Text numberOfLines={2} style={[styles.muted, { fontSize: 12 }]}>{(work.genres || work.universe?.genres || []).slice(0, 2).join(' · ')}</Text>
      {!!work.description && <Text numberOfLines={2} style={[styles.muted, { fontSize: 13 }]}>{work.description}</Text>}
    </View>
  </View>;
}

export function WriterCard({ writer, onChanged }: { writer: ExploreWriter; onChanged: () => void }) {
  const { styles, colors } = useUI(); const { user } = useSession(); const action = useAction();
  const [confirmed, setConfirmed] = useState<{ source: ExploreWriter; followed: boolean }>();
  const followed = confirmed?.source === writer ? confirmed.followed : writer.isFollowedByMe;
  return <View style={{ paddingVertical: 16, gap: 10, borderBottomWidth: 1, borderColor: colors.line }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${writer.kullaniciAdi}, yazar profilini aç`} onPress={() => router.push(`/profile/${writer._id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Avatar name={writer.kullaniciAdi} uri={writer.avatarUrl} size={44}/><Text style={[styles.text, { flex: 1, fontFamily: fonts.medium }]}>{writer.kullaniciAdi}</Text></Pressable>
    {!!writer.bio && <Text style={styles.muted} numberOfLines={3}>{writer.bio}</Text>}
    {writer._id !== user?._id && <Button secondary busy={action.busy} title={followed ? 'Takibi bırak' : 'Takip et'} onPress={() => !user ? router.push('/auth/login') : action.run(async () => {
      const response = await api<{ following: boolean }>(`/public/profile/${writer._id}/follow`, 'POST', {});
      setConfirmed({ source: writer, followed: response.following }); onChanged();
    })}/>}<ErrorBox error={action.error}/>
  </View>;
}

export function BookMenu({ work, close }: { work: Work; close: () => void }) {
  const { user } = useSession(); const { styles } = useUI(); const action = useAction();
  const library = useResource<{ inLibrary: boolean }>(user ? `/library/check/${work._id}` : null);
  const owner = !work.isAnonymous && work.author?._id === user?._id;
  return <Modal visible animationType="slide" onRequestClose={close}><Page safeTop><TextAction title="Menüyü kapat" onPress={close}/><Title>{work.title}</Title>
    <Button secondary title="Eseri aç" onPress={() => { close(); router.push(`/work/${work._id}`); }}/>
    {!user ? <Button title="Kütüphanene eklemek için giriş yap" onPress={() => { close(); router.push('/auth/login'); }}/>
      : owner ? <Text style={styles.muted}>Bu eser senin atölyende.</Text> : <>
        {library.loading && <Loading/>}<ErrorBox error={library.error} retry={library.reload}/>
        <Button title={library.data?.inLibrary ? 'Kütüphanemden çıkar' : 'Kütüphaneme ekle'} disabled={!library.data || !!library.error || library.loading} busy={action.busy} onPress={() => action.run(async () => {
          try { await api(library.data?.inLibrary ? `/library/${work._id}` : '/library', library.data?.inLibrary ? 'DELETE' : 'POST', { workId: work._id }); }
          finally { await library.reload(); }
        })}/>
        {library.data && <Text accessibilityLiveRegion="polite" style={styles.muted}>{library.data.inLibrary ? 'Kütüphanende kayıtlı.' : 'Kütüphanende kayıtlı değil.'}</Text>}
      </>}<ErrorBox error={action.error}/>
  </Page></Modal>;
}
