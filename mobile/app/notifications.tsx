import { MemberGate } from '../src/components/MemberGate';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { useResource } from '../src/useResource';
import { Empty, ErrorBox, fonts, Loading, Page, TextAction, Title, useAction, useUI } from '../src/ui';
interface Notification { _id: string; text: string; read: boolean; createdAt: string; work?: { _id: string }; chapter?: { _id: string }; log?: string; report?: string; sender?: { _id: string }; type: string }
function NotificationsRoute() {
  const { colors, styles } = useUI();
  const resource = useResource<{ items: Notification[]; unreadCount: number }>('/notifications?limit=100'); const action = useAction();
  return <Page><Title eyebrow="BİLDİRİMLER" description={resource.data ? `${resource.data.unreadCount} okunmamış bildirim` : undefined}>Bildirimler</Title>
    <Text style={styles.muted}>Bildirimler 90 gün sonra otomatik silinir.</Text>
    <TextAction title="Tümünü okundu işaretle" disabled={action.busy || !resource.data?.unreadCount} icon="checkmark-done-outline" onPress={() => action.run(async () => { await api('/notifications/read-all', 'PATCH', {}); await resource.reload(); })}/>
    {resource.loading && <Loading/>}<ErrorBox error={resource.error} retry={resource.reload}/><ErrorBox error={action.error}/><View>{resource.data?.items.map(n => <Pressable key={n._id} accessibilityRole="button" accessibilityLabel={`${n.read ? '' : 'Yeni bildirim: '}${n.text}`} disabled={action.busy} style={({ pressed }) => ({ flexDirection: 'row', gap: 13, paddingVertical: 20, paddingHorizontal: 10, backgroundColor: n.read ? 'transparent' : colors.soft, borderBottomWidth: 1, borderColor: colors.line, opacity: pressed ? .7 : 1 })} onPress={() => action.run(async () => {
      await api(`/notifications/${n._id}/read`, 'PATCH', {}); await resource.reload();
      if (n.type === 'report_update' && n.report) router.push({ pathname: '/reports', params: { id: n.report } });
      else if (n.type === 'follow' && n.sender) router.push(`/profile/${n.sender._id}`);
      else if (n.log) router.push({ pathname: '/discussion/[id]', params: { id: n.log, kind: 'log' } });
      else if (n.work && n.chapter && !n.type.startsWith('chapter_')) router.push({ pathname: '/read/[workId]/[chapterId]', params: { workId: n.work._id, chapterId: n.chapter._id, mode: 'start', ...(n.type === 'comment' ? { discussion: 'comments' } : {}) } });
      else if (n.work) router.push(n.type.startsWith('chapter_') ? `/studio/${n.work._id}` : `/work/${n.work._id}`);
    })}><Ionicons name={n.type === 'follow' ? 'person-add-outline' : n.type?.includes('like') ? 'heart-outline' : 'notifications-outline'} size={21} color={colors.accent}/><View style={{ flex: 1, gap: 7 }}><Text style={[styles.text, { fontSize: 15, fontFamily: n.read ? fonts.body : fonts.medium }]}>{n.text}</Text><Text style={[styles.muted, { fontSize: 11 }]}>{n.read ? '' : 'YENİ · '}{new Date(n.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}</Text></View></Pressable>)}</View>{resource.data?.items.length === 0 && <Empty title="Şimdilik sakin." description="Yeni etkileşimlerin burada görünecek."/>}</Page>;
}

export default function Notifications() { return <MemberGate title="Bildirimler"><NotificationsRoute/></MemberGate>; }
