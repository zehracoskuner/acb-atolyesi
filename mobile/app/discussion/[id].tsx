import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../../src/api';
import { joinAtelier } from '../../src/components/MemberGate';
import { useSession } from '../../src/session';
import { useResource } from '../../src/useResource';
import type { Comment, FeedItem } from '../../src/types';
import { JournalCard } from '../../src/components/CommunityCards';
import { Button, Empty, ErrorBox, Field, Loading, Page, Title, useAction, confirmDelete, useUI } from '../../src/ui';
function DiscussionContent() {
  const { styles } = useUI();
  const { id, kind = 'work' } = useLocalSearchParams<{ id: string; kind?: string }>(); const { user } = useSession(); const action = useAction(); const [text, setText] = useState(''); const [reply, setReply] = useState<string | null>(null); const [page, setPage] = useState(1);
  const endpoint = kind === 'log' ? `/logs/${id}/comments` : `/comments/${kind === 'chapter' ? 'chapter' : 'work'}/${id}`;
  const join = () => joinAtelier({ pathname: '/discussion/[id]', params: { id, kind } });
  const resource = useResource<{ items: Comment[]; pages?: number }>(`${endpoint}?page=${page}`);
  const log = useResource<{ item: FeedItem }>(kind === 'log' ? `/logs/${id}/detail` : null);
  const renderComment = (c: Comment, nested = false) => <View key={c._id} style={[styles.card, nested && { marginLeft: 15 }]}><Text style={styles.label}>{c.author?.kullaniciAdi || 'Atölyeden'}</Text><Text style={styles.text}>{c.isDeleted ? 'Yorum kaldırıldı.' : c.content}</Text>
    {!c.isDeleted && <View style={styles.row}>{kind !== 'log' && <><Button secondary title={`${c.isLiked ? '♥' : '♡'} ${c.likeCount || 0}`} busy={action.busy} onPress={() => action.run(async () => { await api(`/comments/${c._id}/like`, 'POST', { liked: !c.isLiked }); await resource.reload(); })}/>{!nested && <Button secondary title="Yanıtla" onPress={() => setReply(c._id)}/>}</>}
      {c.author?._id === user?._id && <Button secondary title="Sil" onPress={() => confirmDelete('Yorumu sil?', () => action.run(async () => { await api(kind === 'log' ? `/logs/${id}/comments/${c._id}` : `/comments/${c._id}`, 'DELETE'); await resource.reload(); }))}/>}
      {c.author?._id !== user?._id && kind !== 'log' && <Button secondary title="Bildir" onPress={() => router.push({ pathname: '/report', params: { targetId: c._id, targetType: 'comment' } })}/>}
    </View>}{c.replies?.map(r => renderComment(r, true))}</View>;
  const limit = kind === 'log' ? 500 : 3000;
  return <Page contentStyle={{ maxWidth: 700 }}>{kind === 'log' && <><Title>Günlük</Title>{log.loading && <Loading/>}<ErrorBox error={log.error} retry={log.reload}/>{log.data && !log.error && <JournalCard item={{ ...log.data.item, type: 'log' }} expanded/>}</>}<Title>Yorumlar</Title>{!user ? <Button title="Aramıza katıl :)" onPress={join}/> : <>{reply && <Button secondary title="Yanıtı iptal et" onPress={() => setReply(null)}/>}<Field label={reply ? 'Yanıtın' : 'Yorumun'} multiline value={text} onChangeText={setText} editable={!action.busy}/><Text style={styles.muted}>{text.length}/{limit}</Text><Button title="Gönder" busy={action.busy} disabled={!text.trim() || text.length > limit} onPress={() => action.run(async () => { await api(endpoint, 'POST', { content: text, ...(reply ? { parentId: reply } : {}) }); setText(''); setReply(null); await resource.reload(); })}/></>}
    <ErrorBox error={action.error}/>{resource.loading && <Loading/>}<ErrorBox error={resource.error} retry={resource.reload}/>{resource.data?.items.map(c => renderComment(c))}{resource.data?.items.length === 0 && <Empty title="İlk sözü sen söyle."/>}
    {resource.data?.pages && resource.data.pages > 1 && <View style={styles.row}><Button secondary title="Önceki" disabled={page === 1} onPress={() => setPage(p => p - 1)}/><Text style={styles.muted}>{page}/{resource.data.pages}</Text><Button secondary title="Sonraki" disabled={page >= resource.data.pages} onPress={() => setPage(p => p + 1)}/></View>}
  </Page>;
}

export default function Discussion() {
  const { user } = useSession(); const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
  return <DiscussionContent key={`${user?._id || 'guest'}:${kind}:${id}`}/>;
}
