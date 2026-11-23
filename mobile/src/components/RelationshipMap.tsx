import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Character } from '../types';
import { Button, Chip, ErrorBox, Field, SearchField, TextAction, confirmDelete, useAction, useUI } from '../ui';
import { characterLayout } from '../storyGraph';
import { GraphCanvas } from './GraphCanvas';

export type Relationship = { _id: string; from: string; to: string; type: string; label: string; directed?: boolean };
export function RelationshipMap({ characters, relationships, onClose, onCreate, onDelete, loadError, onReload, onEdit }: {
  characters: Character[]; relationships: Relationship[]; onClose: () => void;
  loadError?: unknown; onReload?: () => void;
  onEdit?: (character: Character) => void;
  onCreate: (from: string, to: string, type: string, directed?: boolean) => Promise<void>; onDelete: (id: string) => Promise<void>;
}) {
  const { styles, colors, wide } = useUI(); const { height, fontScale } = useWindowDimensions(); const action = useAction();
  const [selected, select] = useState(''); const [from, setFrom] = useState(''); const [target, setTarget] = useState(''); const [type, setType] = useState('');
  const [focus, setFocus] = useState(selected);
  const [nearby, setNearby] = useState(false); const [query, setQuery] = useState(''); const [directed, setDirected] = useState(true);
  const nodes = characterLayout(characters, relationships, selected, nearby && !from, fontScale);
  const edges = relationships.map(r => ({ id: r._id, from: r.from, to: r.to, label: r.label || r.type, directed: r.directed }));
  const person = characters.find(c => c._id === selected);
  const links = relationships.filter(r => r.from === selected || r.to === selected);
  const pick = (id: string) => { Keyboard.dismiss(); setQuery(''); if (from) { if (id !== from) setTarget(id); } else { select(id); setFocus(id); } };
  const panel = <ScrollView keyboardShouldPersistTaps="handled" style={wide ? { width: 320, flexGrow: 0, flexShrink: 0 } : { maxHeight: height * .4 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
    {from ? <><Text style={styles.heading}>{characters.find(c => c._id === from)?.name} → {characters.find(c => c._id === target)?.name || 'Karakter seç'}</Text>
      {!target && <Text style={styles.muted}>Haritadan veya üstteki karakter seçicisinden ikinci kişiyi seç.</Text>}
      {!!target && <><View style={styles.row}><Chip title="Tek yönlü →" selected={directed} disabled={action.busy} onPress={() => setDirected(true)}/><Chip title="Karşılıklı ↔" selected={!directed} disabled={action.busy} onPress={() => setDirected(false)}/></View><Field label="İlişki türü" placeholder="Dostluk, rekabet, aile…" maxLength={80} value={type} onChangeText={setType}/><Button title="İlişkiyi kaydet" disabled={!type.trim()} busy={action.busy} onPress={() => action.run(async () => { await onCreate(from, target, type.trim(), directed); setFrom(''); setTarget(''); setType(''); })}/></>}
      <TextAction title="Vazgeç" disabled={action.busy} onPress={() => { setFrom(''); setTarget(''); }}/></> : person && <>
      <Text style={styles.label}>{person.role || 'KARAKTER'}</Text><Text style={styles.heading}>{person.name}</Text>
      {!!person.tagline && <Text style={styles.text}>{person.tagline}</Text>}
      {!!person.notes && <Text style={styles.muted}>{person.notes}</Text>}
      <View style={styles.row}><Chip title="Yakın çevresi" selected={nearby} onPress={() => setNearby(!nearby)}/><TextAction title="Seçimi kaldır" disabled={action.busy} onPress={() => { select(''); setFocus(''); setNearby(false); }}/></View>
      <Button title="Bu karakterden bağ kur" disabled={characters.length < 2 || action.busy} onPress={() => setFrom(selected)}/>
      {onEdit && <TextAction title="Karakteri düzenle" disabled={action.busy} onPress={() => { onClose(); onEdit(person); }}/>} 
      <Text style={styles.label}>{links.length} İLİŞKİ</Text>
      {links.map(r => { const other = characters.find(c => c._id === (r.from === selected ? r.to : r.from)); return <View key={r._id} style={{ borderTopWidth: 1, borderColor: colors.line }}><TextAction title={`${r.directed === false ? '↔' : r.from === selected ? '→' : '←'} ${other?.name || 'Kaldırılmış karakter'} · ${r.label || r.type}`} onPress={() => { if (other) pick(other._id); }}/><TextAction title="İlişkiyi kaldır" disabled={action.busy} onPress={() => confirmDelete('İlişkiyi kaldır?', () => action.run(() => onDelete(r._id)))}/></View>; })}
    </>}
    <ErrorBox error={action.error}/>
  </ScrollView>;
  return <Modal visible animationType="slide" onRequestClose={() => { if (!action.busy) { if (from) { setFrom(''); setTarget(''); } else onClose(); } }}><SafeAreaView style={styles.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{ padding: 16, gap: 6 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={[styles.heading, { flex: 1 }]}>Karakter ilişkileri</Text><TextAction title="Kapat" disabled={action.busy} onPress={onClose}/></View>
      <SearchField value={query} onChangeText={setQuery} placeholder="Karakter veya rol ara…"/>
      <ErrorBox error={loadError} retry={onReload}/>
      <ScrollView horizontal contentContainerStyle={{ gap: 18 }} keyboardShouldPersistTaps="handled">{characters.filter(c => `${c.name} ${c.role}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))).map(c => <TextAction key={c._id} title={c.name} disabled={action.busy} onPress={() => pick(c._id)}/>)}</ScrollView>
      {!!query && !characters.some(c => `${c.name} ${c.role}`.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))) && <Text style={styles.muted}>Karakter bulunamadı.</Text>}
    </View>
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}><GraphCanvas overview nodes={nodes} edges={edges} selected={from || selected} focus={focus} onSelect={pick}/>{(person || from) && panel}</View>
    {!person && <Text style={[styles.muted, { padding: 16 }]}>İlişkilerini görmek için bir karakter seç. Haritayı sürükleyebilir, iki parmakla yakınlaştırabilirsin.</Text>}
  </KeyboardAvoidingView></SafeAreaView></Modal>;
}
