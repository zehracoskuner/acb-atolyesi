import { MemberGate } from '../src/components/MemberGate';
import { useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePreventRemove } from '@react-navigation/native';
import { useSession } from '../src/session';
import { activeAccountId, api } from '../src/api';
import { useResource } from '../src/useResource';
import type { FeedItem, Work } from '../src/types';
import { Button, Chip, ErrorBox, Field, Loading, Page, Title, useAction, useUI } from '../src/ui';
import { journalDraftKey, parseJournalDraft, type JournalDraft, JOURNAL_LIMIT } from '../src/journalDraft';

function ComposeRoute({ userId, id }: { userId: string; id?: string }) {
  const { styles } = useUI(); const action = useAction();
  const key = journalDraftKey(userId, id);
  const [draft, setDraft] = useState<JournalDraft>({ content: '', visibility: 'public', relatedWork: '' });
  const [ready, setReady] = useState(false), [saved, setSaved] = useState(true), [sent, setSent] = useState(false), [finished, setFinished] = useState(false);
  const [error, setError] = useState<unknown>(null), [attempt, setAttempt] = useState(0);
  const queue = useRef(Promise.resolve()), version = useRef(0);
  const works = useResource<{ items: Work[] }>(id ? null : '/user/works');
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(key);
        const item = id ? (await api<{ item: FeedItem }>(`/logs/${id}/detail`)).item : null;
        if (item && item.author?._id !== userId) throw new Error('Bu günlüğü düzenleme yetkin yok.');
        if (!active) return;
        const local = stored ? parseJournalDraft(stored) : null;
        setDraft(item ? { content: local?.content ?? item.content ?? '', visibility: item.visibility || 'public', relatedWork: item.relatedWork?._id || '' } : local || { content: '', visibility: 'public', relatedWork: '' });
        setReady(true); setError(null);
      } catch (e) { if (active) setError(e); }
    })();
    return () => { active = false; };
  }, [key, id, userId, attempt]);
  const persist = (next: JournalDraft) => {
    setDraft(next); setSaved(false); const request = ++version.current;
    queue.current = queue.current.catch(() => {}).then(() => AsyncStorage.setItem(key, JSON.stringify(next)));
    void queue.current.then(() => { if (request === version.current) { setSaved(true); setError(null); } }).catch(e => { if (request === version.current) setError(e); });
  };
  usePreventRemove(!saved || (action.busy && !sent), () => setError(new Error(action.busy ? 'Paylaşımın sonucu bekleniyor. Lütfen bu işlem tamamlanana kadar bekle.' : 'Taslak henüz cihaza kaydedilemedi. Tekrar kaydet veya metnini kopyalayarak koru.')));
  useEffect(() => { if (finished && !action.busy && activeAccountId() === userId) router.back(); }, [finished, action.busy, userId]);
  const remaining = JOURNAL_LIMIT - draft.content.length;
  return <Page contentStyle={{ maxWidth: 700 }}><Title>{id ? 'Günlüğünü düzenle' : 'Günlüğüne yaz'}</Title>
    {!ready && !error && <Loading/>}
    <Field label="Paylaşımın" multiline autoFocus editable={ready && !action.busy && !sent} value={draft.content} onChangeText={content => persist({ ...draft, content })} style={{ minHeight: 240, fontSize: 17, lineHeight: 27 }}/>
    <Text accessibilityLiveRegion="polite" style={styles.muted}>{draft.content.length}/{JOURNAL_LIMIT} · {remaining < 0 ? `${-remaining} karakter fazla` : saved ? 'Taslak cihazında saklanıyor' : 'Cihaza kaydediliyor'}</Text>
    <Text style={styles.text}>Görünürlük</Text>
    <View style={styles.row}>{[{ value: 'public', label: 'Herkese açık' }, { value: 'followers', label: 'Takipçilere açık' }, { value: 'private', label: 'Yalnızca ben' }].map(v => <Chip key={v.value} title={v.label} selected={draft.visibility === v.value} disabled={!!id || !ready || action.busy || sent} onPress={() => persist({ ...draft, visibility: v.value as JournalDraft['visibility'] })}/>)}</View>
    {id ? <Text style={styles.muted}>Bu paylaşımın görünürlüğü ve bağlı eseri korunur.</Text> : <><Text style={styles.text}>İsteğe bağlı eser</Text><View style={styles.row}><Chip title="Eser yok" selected={!draft.relatedWork} disabled={action.busy || sent || !ready} onPress={() => persist({ ...draft, relatedWork: '' })}/>{works.data?.items.filter(w => w.status === 'published').map(w => <Chip key={w._id} title={w.title} selected={draft.relatedWork === w._id} disabled={action.busy || sent || !ready} onPress={() => persist({ ...draft, relatedWork: w._id })}/>)}</View>
      {!!draft.relatedWork && !works.loading && !works.data?.items.some(w => w._id === draft.relatedWork && w.status === 'published') && <Text style={styles.muted}>Taslağındaki bağlı eser artık listede yok. Eser seçimini güncelle.</Text>}
      <ErrorBox error={works.error} retry={works.reload}/></>}
    <ErrorBox error={error} retry={() => ready ? persist(draft) : setAttempt(a => a + 1)}/><ErrorBox error={action.error}/>
    {sent ? <><Text accessibilityLiveRegion="polite" style={styles.text}>{id ? 'Değişikliklerin kaydedildi.' : draft.visibility === 'private' ? 'Günlüğün yalnızca profilinde sana görünür.' : 'Günlüğün paylaşıldı.'}</Text><Button title="Geri dön" onPress={() => router.back()}/></> : <Button title={id ? 'Değişiklikleri kaydet' : 'Paylaş'} busy={action.busy} disabled={!ready || !saved || !draft.content.trim() || remaining < 0 || (!id && !!draft.relatedWork && !works.data?.items.some(w => w._id === draft.relatedWork && w.status === 'published'))} onPress={() => action.run(async () => {
      await api(id ? `/logs/${id}` : '/logs', id ? 'PATCH' : 'POST', id ? { content: draft.content } : { ...draft, relatedWork: draft.relatedWork || undefined });
      setSent(true); // A local cleanup failure must never make the submit button send twice.
      await queue.current; await AsyncStorage.removeItem(key);
      setFinished(true);
    })}/>}
  </Page>;
}
export default function Compose() {
  const { user } = useSession(); const { id } = useLocalSearchParams<{ id?: string }>();
  return <MemberGate title="Günlük yaz">{user && <ComposeRoute key={`${user._id}:${id || 'new'}`} userId={user._id} id={id}/>}</MemberGate>;
}
