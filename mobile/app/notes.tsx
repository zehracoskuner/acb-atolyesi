import { MemberGate } from '../src/components/MemberGate';
import { Text, View } from 'react-native';
import { api } from '../src/api';
import { useResource } from '../src/useResource';
import { useFormDrafts } from '../src/useFormDrafts';
import { FormDraftPanel, FormDraftRecovery, FormRichText } from '../src/components/FormDraftPanel';
import type { Note } from '../src/types';
import { Button, Empty, ErrorBox, Field, Loading, Page, Title, useAction, confirmDelete, useUI } from '../src/ui';
function NotesRoute() {
  const { styles } = useUI();
  const resource = useResource<{ items: Note[] }>('/notes'); const action = useAction(); const editor = useFormDrafts({ kind: 'personal' }, true);
  const draft = editor.engine?.draft;
  return <Page><Title description="Geçip gitmeden bir düşünceyi yakala.">Not defterin.</Title>
    <Button title="Yeni not" busy={editor.busy} onPress={() => { void editor.start(); }}/>
    <FormDraftPanel editor={editor}/>
    {draft && !draft.conflict && <View style={styles.card}>
      <Field label="Başlık" value={draft.data.title} onChangeText={title => editor.update({ title })}/>
      <FormRichText key={draft.localId} initial={draft.data.content} onChange={content => editor.update({ content })} onBlur={() => { void editor.save(); }}/>
      <Button title="Notu kaydet" busy={editor.engine?.busy} disabled={!draft.data.title.trim()} onPress={() => { void editor.save().then(resource.reload); }}/>
      <Button secondary title="Düzenlemeyi kapat" onPress={() => action.run(editor.close)}/>
    </View>}
    <FormDraftRecovery editor={editor}/>
    <ErrorBox error={action.error}/>{resource.loading && <Loading/>}<ErrorBox error={resource.error} retry={resource.reload}/>
    {resource.data?.items.map(note => <View key={note._id} style={styles.card}>
      <Text style={styles.heading}>{note.title}</Text>
      <Text style={styles.text}>{note.content}</Text>
      <Button secondary title="Düzenle" busy={editor.busy} onPress={() => { void editor.start(note._id); }}/>
      <Button secondary title="Sil" onPress={() => confirmDelete('Notu ve cihaz kopyasını sil?', () => action.run(async () => { await api(`/notes/${note._id}`, 'DELETE'); await editor.forget(note._id); await resource.reload(); }))}/>
    </View>)}
    {resource.data?.items.length === 0 && editor.drafts.length === 0 && <Empty title="Bir fikri buraya bırak."/>}
  </Page>;
}

export default function Notes() { return <MemberGate title="Notlar"><NotesRoute/></MemberGate>; }
