import { router, useLocalSearchParams } from 'expo-router';
import { MemberGate } from '../src/components/MemberGate';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { api } from '../src/api';
import { useResource } from '../src/useResource';
import { useSession } from '../src/session';
import type { Work } from '../src/types';
import { WorkCard } from '../src/components/WorkCard';
import { ResourceState } from '../src/components/ProfileTabs';
import { Button, Empty, ErrorBox, Field, Page, TextAction, Title, useAction, confirmDelete, useUI } from '../src/ui';
interface ReadingList { _id: string; name: string; description: string; isPrivate: boolean; works: { work: Work | null }[] }
function ListEditor({ list, reload }: { list: ReadingList; reload: () => Promise<void> }) {
  const { styles } = useUI(); const action = useAction(); const [name, setName] = useState(list.name); const [description, setDescription] = useState(list.description || ''); const [privateList, setPrivateList] = useState(list.isPrivate);
  return <View style={{ gap: 12 }}><Field label="Liste adı" maxLength={100} value={name} onChangeText={setName}/><Field label="Liste açıklaması" maxLength={500} multiline value={description} onChangeText={setDescription}/><View style={styles.row}><Switch accessibilityLabel="Yalnızca ben görebilirim" value={privateList} onValueChange={setPrivateList}/><Text style={styles.text}>{privateList ? 'Yalnızca ben' : 'Herkese açık'}</Text></View><Button title="Liste değişikliklerini kaydet" busy={action.busy} disabled={!name.trim()} onPress={() => action.run(async () => { await api(`/reading-lists/${list._id}`, 'PATCH', { name: name.trim(), description, isPrivate: privateList }); await reload(); })}/><ErrorBox error={action.error}/></View>;
}
function AddWorks({ list, reload }: { list: ReadingList; reload: () => Promise<void> }) {
  const library = useResource<{ items: Work[] }>('/library'); const action = useAction();
  const items = library.data?.items.filter(w => !list.works?.some(e => e.work?._id === w._id));
  return <><ResourceState resource={library} empty={items?.length === 0 ? 'Eklenebilecek başka eser yok' : undefined}/><ErrorBox error={action.error}/>{items?.map(w => <Button key={w._id} secondary title={`+ ${w.title}`} busy={action.busy} onPress={() => action.run(async () => { await api(`/reading-lists/${list._id}/works`, 'POST', { workId: w._id }); await reload(); })}/>)}</>;
}
function ListsContent() {
  const { styles } = useUI(); const { user } = useSession();
  const { userId, workId, listId } = useLocalSearchParams<{ userId?: string; workId?: string; listId?: string }>();
  const owner = !userId || userId === user?._id;
  const lists = useResource<{ items: ReadingList[] }>(owner ? '/reading-lists' : `/reading-lists/user/${userId}`); const action = useAction();
  const [name, setName] = useState(''); const [privateList, setPrivateList] = useState(true); const [adding, setAdding] = useState<string | null>(null); const [editing, setEditing] = useState<string | null>(null);
  const items = lists.data?.items.filter(list => !listId || list._id === listId);
  return <Page><Title>Okuma listeleri</Title>{listId && <TextAction title="Tüm listeleri göster" onPress={() => router.setParams({ listId: '' })}/>}
    {owner && !listId && <View style={styles.card}><Field label="Yeni liste adı" maxLength={100} value={name} onChangeText={setName}/><View style={styles.row}><Switch accessibilityLabel="Yeni liste gizli olsun" value={privateList} onValueChange={setPrivateList}/><Text style={styles.text}>{privateList ? 'Yalnızca ben' : 'Herkese açık'}</Text></View><Button title="Liste oluştur" busy={action.busy} disabled={!name.trim()} onPress={() => action.run(async () => { await api('/reading-lists', 'POST', { name, isPrivate: privateList }); setName(''); await lists.reload(); })}/></View>}
    <ResourceState resource={lists}/><ErrorBox error={action.error}/>{items?.map(list => <View key={list._id} style={{ gap: 14, paddingVertical: 16 }}><Text style={styles.heading}>{list.name}</Text><Text style={styles.muted}>{list.works?.filter(e => e.work).length || 0} eser · {list.isPrivate ? 'Yalnızca sen' : 'Herkese açık'}</Text>{!!list.description && <Text style={styles.text}>{list.description}</Text>}
      {editing === list._id && owner && <ListEditor key={`${list._id}:${list.name}:${list.description}:${list.isPrivate}`} list={list} reload={lists.reload}/>}
      {list.works?.map((entry, index) => entry.work ? <View key={entry.work._id}><WorkCard work={entry.work}/>{owner && <TextAction title="Eseri listeden çıkar" disabled={action.busy} onPress={() => action.run(async () => { await api(`/reading-lists/${list._id}/works/${entry.work!._id}`, 'DELETE'); await lists.reload(); })}/>}</View> : <Text key={`removed-${index}`} style={styles.muted}>Bu eser artık erişilebilir değil.</Text>)}
      {owner && <>{workId && <Button title={list.works?.some(e => e.work?._id === workId) ? 'Okuduğun eser bu listede' : 'Okuduğum eseri bu listeye ekle'} disabled={list.works?.some(e => e.work?._id === workId)} busy={action.busy} onPress={() => action.run(async () => { await api(`/reading-lists/${list._id}/works`, 'POST', { workId }); await lists.reload(); })}/>}
        <Button secondary title="Kütüphanemden eser ekle" onPress={() => setAdding(adding === list._id ? null : list._id)}/>{adding === list._id && <AddWorks list={list} reload={lists.reload}/>}
        <View style={styles.row}><TextAction title={editing === list._id ? 'Düzenlemeyi kapat' : 'Adı, açıklamayı ve gizliliği düzenle'} onPress={() => setEditing(editing === list._id ? null : list._id)}/><TextAction title="Listeyi sil" disabled={action.busy} onPress={() => confirmDelete('Liste silinsin mi? Eserler silinmez.', () => action.run(async () => { await api(`/reading-lists/${list._id}`, 'DELETE'); await lists.reload(); if (listId) router.setParams({ listId: '' }); }))}/></View>
      </>}
    </View>)}{!lists.loading && !lists.error && items?.length === 0 && <Empty title={listId ? 'Bu liste bulunamadı veya erişime kapalı' : 'Henüz liste yok'}/>}</Page>;
}
export default function Lists() {
  const { userId } = useLocalSearchParams<{ userId?: string }>(); const { user } = useSession();
  const content = <ListsContent key={`${user?._id || 'guest'}:${userId || 'own'}`}/>;
  return userId ? content : <MemberGate title="Okuma listeleri" returnTo="/lists">{content}</MemberGate>;
}
