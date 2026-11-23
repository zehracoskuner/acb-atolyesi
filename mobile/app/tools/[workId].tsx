import { MemberGate } from '../../src/components/MemberGate';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../../src/api';
import { useResource } from '../../src/useResource';
import { useFormDrafts } from '../../src/useFormDrafts';
import { FormDraftPanel, FormDraftRecovery, FormRichText } from '../../src/components/FormDraftPanel';
import type { Note, World } from '../../src/types';
import { Button, Chip, ErrorBox, Field, Loading, Page, Title, useAction, confirmDelete, useUI } from '../../src/ui';
type Kind = 'notes' | 'world';
function ToolsRoute() {
  const { styles } = useUI();
  const { workId } = useLocalSearchParams<{ workId: string }>(); const action = useAction();
  const [kind, setKind] = useState<Kind>('world'); const [category, setCategory] = useState<keyof Pick<World, 'locations' | 'timeline' | 'rules' | 'notes'>>('locations');
  const editor = useFormDrafts({ kind, workId, category: kind === 'world' ? category : undefined });
  const form = editor.engine?.draft && !editor.engine.draft.conflict ? editor.engine.draft.data : null;
  const notes = useResource<{ items: Note[] }>(`/works/${workId}/notes`);
  const world = useResource<{ world: World }>(`/world/${workId}`);
  const current = kind === 'notes' ? notes : world;
  const endpoint = kind === 'notes' ? `/works/${workId}/notes` : `/world/${workId}/entries`;
  const start = (id?: string) => { void editor.start(id); };
  const remove = (id: string) => confirmDelete('Bu kaydı ve cihaz kopyasını sil?', () => action.run(async () => { await api(`${endpoint}/${id}`, 'DELETE'); await editor.forget(id); await current.reload(); }));
  return <Page><Title>Hikâye araçları</Title>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{(['scenes', 'characters', 'world', 'notes'] as const).map(k => <Chip key={k} selected={kind === k} disabled={editor.busy} title={({ scenes: 'Olay Örgüsü', characters: 'Karakterler', world: 'Dünya', notes: 'Notlar' })[k]} onPress={() => action.run(async () => { await editor.close(); if (k === 'characters') router.push('/characters/' + workId); else if (k === 'scenes') router.push('/plot/' + workId); else setKind(k); })}/>)}</ScrollView>
    {kind === 'world' && <View style={styles.row}>{(['locations', 'timeline', 'rules', 'notes'] as const).map(c => <Chip key={c} selected={category === c} disabled={editor.busy} title={({ locations: 'Mekân', timeline: 'Zaman', rules: 'Kurallar', notes: 'Dünya notları' })[c]} onPress={() => action.run(async () => { await editor.close(); setCategory(c); })}/>)}</View>}
    <Button title={kind === 'notes' ? 'Yeni not oluştur' : 'Yeni dünya kaydı oluştur'} busy={editor.busy} onPress={() => start()}/>
    <FormDraftPanel editor={editor}/>
    {form && <View style={styles.card}>
      {kind === 'world' ? <Field label="Ad" value={form.name} onChangeText={name => editor.update({ name })}/> : <Field label="Başlık" value={form.title} onChangeText={title => editor.update({ title })}/>}
      {kind === 'notes' ? <FormRichText key={editor.engine!.draft.localId} initial={form.body} onChange={body => editor.update({ body })} onBlur={() => {}}/> : <><Field label="Açıklama" multiline maxLength={2000} value={form.description} onChangeText={description => editor.update({ description })}/><Field label="Ek notlar" multiline value={form.notes} onChangeText={notes => editor.update({ notes })}/></>}
      <Button title="Kaydet" busy={editor.engine?.busy} disabled={!(kind === 'world' ? form.name : form.title).trim()} onPress={() => action.run(async () => { await editor.save(); await current.reload(); })}/><Button secondary title="Düzenlemeyi kapat" onPress={() => action.run(editor.close)}/>
    </View>}
    <FormDraftRecovery editor={editor}/><ErrorBox error={action.error}/>{current.loading && <Loading/>}<ErrorBox error={current.error} retry={current.reload}/>
    {kind === 'notes' && notes.data?.items.map(n => <View key={n._id} style={styles.card}><Text style={styles.heading}>{n.title}</Text><Text style={styles.text}>{n.body}</Text><Button secondary title="Düzenle" busy={editor.busy} onPress={() => start(n._id)}/><Button secondary title="Sil" onPress={() => remove(n._id)}/></View>)}
    {kind === 'world' && world.data?.world[category].map(e => <View key={e._id} style={styles.card}><Text style={styles.heading}>{e.name}</Text><Text style={styles.text}>{e.description}</Text><Text style={styles.muted}>{e.notes}</Text><Button secondary title="Düzenle" onPress={() => start(e._id)}/><Button secondary title="Sil" onPress={() => remove(e._id)}/></View>)}
  </Page>;
}
export default function Tools() { return <MemberGate title="Hikâye araçları"><ToolsRoute/></MemberGate>; }
