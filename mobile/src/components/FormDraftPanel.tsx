import { useRef } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import RenderHTML from 'react-native-render-html';
import { RichEditor, type EditorHandle } from './RichEditor';
import { Button, ErrorBox, useUI } from '../ui';
import type { useFormDrafts } from '../useFormDrafts';
import type { FormKind, FormValues } from '../formDraftEngine';

type Editor = ReturnType<typeof useFormDrafts>;
export function FormDraftRecovery({ editor }: { editor: Editor }) {
  const { styles } = useUI();
  return <>{editor.drafts.filter(draft => draft.localId !== editor.engine?.draft.localId).map(draft => <View key={draft.localId} style={styles.card}>
    <Text style={styles.heading}>{draft.data.title || draft.data.name || 'Yeni cihaz taslağı'}</Text>
    <Text style={styles.muted}>{draft.conflict ? 'Çakışan sürümler cihazda korunuyor' : draft.dirty ? 'Cihazda kayıtlı · sunucu kaydı bekliyor' : 'Cihaz kopyası hazır'}</Text>
    <Button secondary title="Cihaz kaydını aç" busy={editor.busy} onPress={() => { void editor.start(undefined, draft.localId); }}/>
  </View>)}</>;
}
const fields: Record<FormKind, (keyof FormValues)[]> = { personal: ['title', 'content'], notes: ['title', 'body'], characters: ['name', 'role', 'tagline', 'notes'], scenes: ['title', 'description', 'goal', 'act', 'status', 'draftText', 'characters', 'volume'], world: ['name', 'description', 'notes'] };
const labels: Partial<Record<keyof FormValues, string>> = { title: 'Başlık', content: 'Not', body: 'Not', name: 'Ad', role: 'Rol', tagline: 'Kısa tanım', notes: 'Notlar', description: 'Açıklama', goal: 'Amaç', act: 'Perde', status: 'Durum', draftText: 'Sahne yazısı', characters: 'Karakterler', volume: 'Hacim' };
export function FormDraftPanel({ editor, characterNames = {}, actNames = {} }: { editor: Editor; characterNames?: Record<string, string>; actNames?: Record<string, string> }) {
  const { colors, styles } = useUI();
  const { width } = useWindowDimensions(); const draft = editor.engine?.draft;
  return <View style={{ gap: 12 }}>
    {!!editor.engine && <Text accessibilityLiveRegion="polite" style={styles.muted}>{editor.engine.status}</Text>}
    <ErrorBox error={editor.error}/>
    {!!editor.engine?.diskError && <Button title="Cihaz kaydını tekrar dene" onPress={() => { void editor.save(); }}/>}
    {draft?.conflict && <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>İki farklı sürüm var</Text>
      <Text style={styles.muted}>Bir seçim yapana kadar iki metin de korunur. Seçim öncesi iki sürümün cihaz yedeği alınır.</Text>
      {([{ label: 'Cihazındaki kayıt', data: draft.data }, { label: 'Sunucudaki kayıt', data: draft.conflict.data }]).map(version => <View key={version.label} style={{ gap: 8 }}>
        <Text style={styles.heading}>{version.label}</Text>
        {fields[draft.kind].map(field => <View key={field}>
          <Text style={styles.muted}>{labels[field]}</Text>
          {field === 'body' || field === 'content' ? <RenderHTML contentWidth={width - 76} source={{ html: String(version.data[field]) }} defaultTextProps={{ selectable: true }} baseStyle={{ color: colors.ink, fontSize: 16 }}/>
            : <Text selectable style={styles.text}>{Array.isArray(version.data[field]) ? version.data[field].map(id => characterNames[id] || 'Kayıtlı karakter').join(', ')
              : field === 'act' ? actNames[String(version.data[field])] || version.data[field]
              : field === 'status' ? ({ idea: 'Fikir', drafting: 'Taslak', writing: 'Yazılıyor', done: 'Tamamlandı' } as Record<string, string>)[String(version.data[field])] || version.data[field]
              : version.data[field]}</Text>}
        </View>)}
      </View>)}
      <Button title="Cihazdaki sürümü sunucuya kaydet" busy={editor.engine?.busy} onPress={() => { void editor.resolve('local'); }}/>
      <Button secondary title="Sunucudaki sürümle devam et" busy={editor.engine?.busy} onPress={() => { void editor.resolve('remote'); }}/>
    </View>}
  </View>;
}
export function FormRichText({ initial, onChange, onBlur }: { initial: string; onChange: (html: string) => void; onBlur: () => void }) {
  const { colors } = useUI();
  const initialContent = useRef(initial); const editor = useRef<EditorHandle>(null);
  return <View style={{ height: 380, borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: 'hidden' }}>
    <RichEditor ref={editor} initial={initialContent.current} onChange={onChange} onBlur={onBlur}/>
    <ScrollView horizontal keyboardShouldPersistTaps="always" style={{ maxHeight: 70 }} contentContainerStyle={{ padding: 8, gap: 8 }}>
      {([['Kalın', 'bold', ''], ['İtalik', 'italic', ''], ['Başlık', 'formatBlock', 'h2'], ['Paragraf', 'formatBlock', 'p'], ['Liste', 'insertUnorderedList', ''], ['Geri al', 'undo', '']] as const).map(([label, command, value]) => <Button key={label} secondary title={label} onPress={() => editor.current?.command(command, value)}/>)}
    </ScrollView>
  </View>;
}
