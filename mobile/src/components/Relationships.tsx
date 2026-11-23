import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../api';
import { useResource } from '../useResource';
import type { Character } from '../types';
import { Button, Chip, ErrorBox, Field, TextAction, useAction, confirmDelete, useUI } from '../ui';
import { RelationshipMap, type Relationship } from './RelationshipMap';

export function Relationships({ workId, characters, onEdit }: { workId: string; characters: Character[]; onEdit?: (character: Character) => void }) {
  const { styles } = useUI(); const action = useAction();
  const resource = useResource<{ items: Relationship[] }>(`/relationships?workId=${workId}`);
  const [mapOpen, setMapOpen] = useState(false); const [listOpen, setListOpen] = useState(false);
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [type, setType] = useState('');
  const create = async (source: string, target: string, relationType: string, directed = true) => {
    const saved = await api<{ item: Relationship }>('/relationships', 'POST', { workId, from: source, to: target, type: relationType, directed });
    resource.setData(previous => ({ items: [...(previous?.items || []), saved.item] }));
    await resource.reload();
  };
  const remove = async (id: string) => {
    await api(`/relationships/${id}?workId=${workId}`, 'DELETE');
    resource.setData(previous => previous ? { items: previous.items.filter(r => r._id !== id) } : previous);
    await resource.reload();
  };
  return <View style={{ gap: 12 }}>
    <Button title="İlişki haritasını aç" icon="git-network-outline" disabled={!characters.length || resource.loading} onPress={() => setMapOpen(true)}/>
    <TextAction title={listOpen ? 'İlişki listesini kapat' : 'İlişkileri listeyle yönet'} onPress={() => setListOpen(!listOpen)}/>
    {mapOpen && <RelationshipMap characters={characters} relationships={resource.data?.items || []} loadError={resource.error} onReload={resource.reload} onClose={() => setMapOpen(false)} onCreate={create} onDelete={remove} onEdit={onEdit}/>}
    {listOpen && <View style={styles.card}>
      <Text style={styles.heading}>Karakterler arasındaki bağlar</Text>
      <Text style={styles.muted}>İlk karakter</Text><View style={styles.row}>{characters.map(c => <Chip key={c._id} title={c.name} selected={from === c._id} onPress={() => { setFrom(c._id); if (to === c._id) setTo(''); }}/>)}</View>
      <Text style={styles.muted}>İkinci karakter</Text><View style={styles.row}>{characters.filter(c => c._id !== from).map(c => <Chip key={c._id} title={c.name} selected={to === c._id} onPress={() => setTo(c._id)}/>)}</View>
      <Field label="İlişki türü (ör. dostluk, rekabet)" maxLength={80} value={type} onChangeText={setType}/>
      <Button title="Bağı kaydet" disabled={!from || !to || from === to || !type.trim()} busy={action.busy} onPress={() => action.run(async () => { await create(from, to, type.trim()); setType(''); })}/>
      {resource.data?.items.map(r => <View key={r._id} style={{ gap: 6 }}><Text style={styles.text}>{characters.find(c => c._id === r.from)?.name || 'Kaldırılmış karakter'} {r.directed === false ? '↔' : '→'} {characters.find(c => c._id === r.to)?.name || 'Kaldırılmış karakter'}: {r.label || r.type}</Text><TextAction title="Bağı kaldır" disabled={action.busy} onPress={() => confirmDelete('İlişkiyi kaldır?', () => action.run(() => remove(r._id)))}/></View>)}
    </View>}
    <ErrorBox error={action.error}/><ErrorBox error={resource.error} retry={resource.reload}/>
  </View>;
}
