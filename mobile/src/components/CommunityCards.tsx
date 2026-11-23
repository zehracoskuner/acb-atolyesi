import { useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api, activeAccountId, ApiError } from '../api';
import { communityEpoch, getLog, lockLog, logBusy, subscribeCommunity, unlockLog } from '../communityStore';
import { useSession } from '../session';
import type { FeedItem, Work } from '../types';
import { Avatar, Button, confirmDelete, ErrorBox, fonts, IconButton, TextAction, useAction, useUI } from '../ui';
import { BookCover } from './BookCover';
import { joinAtelier } from './MemberGate';

const visibilityNames = { public: 'Herkese açık', followers: 'Takipçilere açık', private: 'Yalnızca sen' };
function AuthorLine({ item, children }: React.PropsWithChildren<{ item: FeedItem }>) {
  const { styles, colors } = useUI();
  const { user } = useSession();
  if (user?._id === item.author?._id && user) item = { ...item, author: user };
  const date = new Date(item.createdAt);
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
    <Pressable accessibilityRole="button" disabled={!item.author?._id} accessibilityLabel={`${item.author?.kullaniciAdi || 'Kaldırılmış kullanıcı'} profilini aç`} onPress={() => item.author?._id && router.push(`/profile/${item.author._id}`)} style={{ flex: 1, minHeight: 48, flexDirection: 'row', gap: 11, alignItems: 'center' }}>
      <Avatar name={item.author?.kullaniciAdi} uri={item.author?.avatarUrl} size={40}/><View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.semibold, color: colors.ink, fontSize: 15, lineHeight: 22 }}>{item.author?.kullaniciAdi || 'Kaldırılmış kullanıcı'}</Text>
        <Text style={[styles.muted, { fontSize: 12, lineHeight: 19 }]}>{Number.isFinite(+date) ? date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}{item.type === 'log' ? ` · ${visibilityNames[item.visibility || 'public']}` : ''}{item.publicationDateEstimated ? ' · Eski kayıt' : ''}</Text>
      </View>
    </Pressable>{children}
  </View>;
}
export function WorkPreview({ work }: { work: Work }) {
  const { styles, colors } = useUI();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${work.title || 'Eser'} detayını aç`} onPress={() => router.push(`/work/${work._id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 5 }}>
    <BookCover work={work} width={38}/><Text style={[styles.text, { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.accent }]}>{work.title || 'Eser'}</Text>
  </Pressable>;
}
export function JournalCard({ item: source, expanded, onExpanded, preview = false }: { item: FeedItem; expanded?: boolean; onExpanded?: (value: boolean) => void; preview?: boolean }) {
  const { styles, colors } = useUI(), { user } = useSession(); const action = useAction();
  const stored = useSyncExternalStore(subscribeCommunity, () => getLog(source._id));
  const busy = useSyncExternalStore(subscribeCommunity, () => logBusy(source._id));
  const item = stored === undefined ? source : stored;
  const [localExpanded, setLocalExpanded] = useState(false), [long, setLong] = useState(false), [menu, setMenu] = useState(false);
  const open = expanded ?? localExpanded;
  if (!item) return null;
  const own = !!user && user._id === item.author?._id;
  const toggle = () => action.run(async () => {
    if (!user) { joinAtelier({ pathname: '/discussion/[id]', params: { id: item._id, kind: 'log' } }); return; }
    if (!lockLog(item._id)) return;
    const epoch = communityEpoch(), desired = !item.likedByMe;
    try {
      const current = await api<{ item: FeedItem }>(`/logs/${item._id}/detail`);
      if (activeAccountId() !== user._id || epoch !== communityEpoch()) return;
      // A lost receipt may already have applied this intent. Reconcile it,
      // rather than inverting the newly fetched state on a retry tap.
      if (current.item.likedByMe !== desired) await api(`/logs/${item._id}/like`, 'POST', { liked: desired });
    } finally { if (epoch === communityEpoch()) unlockLog(item._id); }
  });
  if (preview) return item.visibility !== 'public' ? null : <View style={{ paddingVertical: 14, gap: 10, borderBottomWidth: 1, borderColor: colors.line }}>
    <AuthorLine item={item}/><Text selectable numberOfLines={3} style={[styles.text, { fontSize: 17, lineHeight: 27 }]}>{item.content}</Text>
    <TextAction title="Günlüğü aç" onPress={() => router.push({ pathname: '/discussion/[id]', params: { id: item._id, kind: 'log' } })}/>
  </View>;
  return <View style={{ paddingVertical: 20, gap: 11, borderBottomWidth: 1, borderColor: colors.line }}>
    <AuthorLine item={item}><IconButton icon="ellipsis-horizontal" label="Günlük seçenekleri" active={menu} onPress={() => setMenu(!menu)}/></AuthorLine>
    {menu && <View style={[styles.row, { paddingVertical: 4 }]}>{own ? <>
      <TextAction title="Düzenle" onPress={() => { setMenu(false); router.push({ pathname: '/compose', params: { id: item._id } }); }}/>
      <TextAction title="Sil" disabled={action.busy} onPress={() => confirmDelete('Günlük silinsin mi?', () => action.run(async () => { await api(`/logs/${item._id}`, 'DELETE'); }))}/>
    </> : item.author?._id ? <TextAction title="Yazar profilini aç" onPress={() => router.push(`/profile/${item.author!._id}`)}/> : <Text style={styles.muted}>Yazar hesabı artık kullanılamıyor.</Text>}</View>}
    <View>
      <Text accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" onTextLayout={event => setLong(event.nativeEvent.lines.length > 6)} style={[styles.text, { fontSize: 17, lineHeight: 27, position: 'absolute', opacity: 0, width: '100%' }]}>{item.content}</Text>
      <Text selectable numberOfLines={open ? undefined : 6} style={[styles.text, { fontSize: 17, lineHeight: 27 }]}>{item.content}</Text>
    </View>
    {(long || open || (item.content?.length || 0) > 300) && <TextAction title={open ? 'Daha az göster' : 'Devamını oku'} onPress={() => { setLocalExpanded(!open); onExpanded?.(!open); }}/>}
    {item.relatedWork?._id && <WorkPreview work={item.relatedWork}/>}
    <View style={[styles.row, { columnGap: 28 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.likedByMe ? 'Beğeniyi kaldır' : 'Beğen'} · ${item.likeCount || 0} beğeni`} accessibilityState={{ selected: !!item.likedByMe, disabled: busy }} disabled={busy} onPress={toggle} style={{ minHeight: 44, minWidth: 68, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={[styles.text, { color: item.likedByMe ? colors.rust : colors.accent }]}>{item.likedByMe ? '♥' : '♡'} {item.likeCount || 0}</Text>
      </Pressable>
      <TextAction title={`Yorumlar${item.commentCount === undefined ? '' : ` · ${item.commentCount}`}`} icon="chatbubble-outline" onPress={() => router.push({ pathname: '/discussion/[id]', params: { id: item._id, kind: 'log' } })}/>
    </View><ErrorBox error={action.error}/>
  </View>;
}
export function ChapterAnnouncement({ item, onUnavailable }: { item: FeedItem; onUnavailable: (id: string) => void }) {
  const { styles, colors } = useUI(); const action = useAction(); const { user } = useSession();
  const read = () => action.run(async () => {
    if (!item.work?._id || !item.chapter?._id) throw new Error('Bu bölüm artık kullanılamıyor.');
    const target = { pathname: '/read/[workId]/[chapterId]' as const, params: { workId: item.work._id, chapterId: item.chapter._id, mode: 'start' } };
    if (!user) { joinAtelier(target); return; }
    try {
      await api(`/public/works/${item.work._id}/chapters/${item.chapter._id}`);
      if (activeAccountId() === user._id) router.push(target);
    } catch (error) {
      if (error instanceof ApiError && [403, 404, 410].includes(error.status)) { onUnavailable(item._id); return; }
      throw error;
    }
  });
  return <View style={{ paddingVertical: 20, gap: 12, borderBottomWidth: 1, borderColor: colors.line }}>
    <AuthorLine item={item}/><Text style={[styles.muted, { color: colors.accent }]}>Yeni bölüm yayımladı</Text>
    {item.work?._id && <WorkPreview work={item.work}/>}
    <Text style={[styles.text, { fontFamily: fonts.semibold }]}>{item.chapter?.order ? `${item.chapter.order}. Bölüm · ` : ''}{item.chapter?.title || 'Bölüm artık kullanılamıyor'}</Text>
    <Button secondary title="Bölümü oku" icon="arrow-forward-outline" busy={action.busy} onPress={read}/><ErrorBox error={action.error}/>
  </View>;
}
