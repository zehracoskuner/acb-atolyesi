import { useMemo, useState } from 'react';
import { Modal, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Scene } from '../types';
import type { Act } from '../scenes';
import { edgeTypes, plotLayout, type EdgeType } from '../plotMap';
import { Button, Chip, Empty, ErrorBox, IconButton, SearchField, TextAction, useAction, useUI } from '../ui';
import { GraphCanvas } from './GraphCanvas';
import { unlinkedScenes } from '../storyGraph';

export function SceneMap({ scenes, acts, onClose, onEdit, onConnection, loadError, onReload }: {
  scenes: Scene[]; acts: Act[]; onClose: () => void; onEdit: (scene: Scene) => void;
  loadError?: unknown; onReload?: () => void;
  onConnection: (source: string, target: string, remove: boolean, type?: EdgeType) => Promise<void>;
}) {
  const { styles, colors, wide } = useUI(); const { fontScale, height } = useWindowDimensions();
  const graph = useMemo(() => plotLayout(scenes, acts, fontScale), [scenes, acts, fontScale]);
  const [selected, select] = useState(''); const [focus, setFocus] = useState(''); const [query, setQuery] = useState('');
  const [sourceId, setSource] = useState(''); const [targetId, setTarget] = useState(''); const [type, setType] = useState<EdgeType>('sonuc');
  const action = useAction(); const source = scenes.find(s => s._id === sourceId); const target = scenes.find(s => s._id === targetId);
  const scene = scenes.find(s => s._id === selected);
  const [review, setReview] = useState(false);
  const isolated = useMemo(() => unlinkedScenes(scenes), [scenes]);
  const links = graph.edges.filter(e => e.from === selected || e.to === selected);
  const jump = (id: string) => { select(id); setFocus(id); setQuery(''); };
  const cancel = () => { setSource(''); setTarget(''); };
  const pick = (id: string) => {
    if (sourceId) { if (id !== sourceId) setTarget(id); }
    else select(id);
  };
  const existing = !!source?.connections?.some(link => link.target === targetId);
  const detail = scene && <ScrollView keyboardShouldPersistTaps="handled" style={wide ? { width: 320, flexGrow: 0, flexShrink: 0, borderLeftWidth: 1, borderColor: colors.line } : { maxHeight: Math.min(290, height * .38), borderTopWidth: 1, borderColor: colors.line }} contentContainerStyle={{ padding: 18, gap: 12 }}>
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}><View style={{ flex: 1, gap: 4 }}><Text style={styles.label}>{acts.find(a => a.id === scene.act)?.label || scene.act}</Text><Text accessibilityRole="header" style={styles.heading}>{scene.title}</Text></View><IconButton icon="close-outline" label="Sahne ayrıntısını kapat" onPress={() => select('')}/></View>
    <View style={{ flexDirection: 'row', gap: 8 }}><Button disabled={action.busy} style={{ flex: 1 }} title="Düzenle" icon="create-outline" onPress={() => { onClose(); onEdit(scene); }}/><Button disabled={action.busy} style={{ flex: 1 }} secondary title="Bağlantı kur" icon="git-branch-outline" onPress={() => { setSource(scene._id); setTarget(''); select(''); }}/></View>
    {!!scene.goal && <Text style={styles.text}>{scene.goal}</Text>}
    {!!scene.description && <Text style={styles.muted}>{scene.description}</Text>}
    {!!scene.characters?.length && <Text style={styles.muted}>Karakterler · {scene.characters.map(c => c.name).join(', ')}</Text>}
    <Text style={styles.label}>BAĞLANTILAR · {links.length}</Text>
    {!links.length && <Text style={styles.muted}>Bu sahneyi başka bir sahneye bağlayarak hikâyenin akışını kur.</Text>}
    {links.map(link => {
      const outgoing = link.from === selected; const other = scenes.find(s => s._id === (outgoing ? link.to : link.from));
      return <View key={link.id} style={{ borderTopWidth: 1, borderColor: colors.line, paddingTop: 8 }}>
        <TextAction title={`${outgoing ? '→' : '←'} ${link.label} · ${other?.title}`} onPress={() => jump(other!._id)}/>
        <TextAction title="Bağlantıyı kaldır" disabled={action.busy} onPress={() => action.run(() => onConnection(link.from, link.to, true))}/>
      </View>;
    })}
    <ErrorBox error={action.error}/>
  </ScrollView>;
  return <Modal visible animationType="slide" onRequestClose={() => { if (sourceId && !action.busy) cancel(); else if (selected) select(''); else if (!action.busy) onClose(); }}>
    <SafeAreaView style={styles.page}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={styles.heading}>Olay örgüsü</Text><Text style={styles.muted}>{scenes.length} sahne · {graph.edges.length} bağlantı</Text></View><TextAction title="Listeye dön" disabled={action.busy} onPress={onClose}/></View>
        <SearchField value={query} onChangeText={setQuery} placeholder={sourceId ? 'Bağlanacak sahneyi ara…' : 'Haritada sahne bul…'}/>
        <ErrorBox error={loadError} retry={onReload}/>
        {!sourceId && <TextAction title={`Bağlantısız sahneler · ${isolated.length}`} onPress={() => setReview(!review)}/>}
        {review && !sourceId && <ScrollView style={{ maxHeight: 130 }} keyboardShouldPersistTaps="handled">{isolated.length ? isolated.map(s => <TextAction key={s._id} title={s.title} onPress={() => { jump(s._id); setReview(false); }}/>) : <Text style={styles.muted}>Her sahne en az bir başka sahneye bağlı.</Text>}</ScrollView>}
        {query ? <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled">
          {scenes.filter(s => s.title.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))).map(s => <TextAction key={s._id} title={s.title} onPress={() => { jump(s._id); if (sourceId) pick(s._id); }}/>) }
          {!scenes.some(s => s.title.toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))) && <Text style={styles.muted}>Sahne bulunamadı.</Text>}
        </ScrollView> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{graph.acts.map(act => <Chip key={act.id} title={act.label} selected={scene?.act === act.id} disabled={!graph.nodes.some(n => n.scene.act === act.id)} onPress={() => { const first = graph.nodes.find(n => n.scene.act === act.id); if (first) jump(first.id); }}/>)}</ScrollView>}
      </View>
      {source && <ScrollView style={{ maxHeight: height * .4, backgroundColor: colors.pale }} contentContainerStyle={{ padding: 12, gap: 8 }} keyboardShouldPersistTaps="handled"><Text style={styles.text}>{source.title} → {target?.title || 'Haritadan bir hedef seç'}</Text>
        {target && <><ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{Object.entries(edgeTypes).map(([id, label]) => <Chip key={id} title={label} selected={type === id} disabled={action.busy} onPress={() => setType(id as EdgeType)}/>)}</ScrollView>
          {existing ? <Text style={styles.muted}>Bu iki sahne zaten bağlı. Türünü değiştirmek için mevcut bağlantıyı önce kaldır.</Text> : <Button title="Bağlantıyı kaydet" busy={action.busy} onPress={() => action.run(async () => { await onConnection(sourceId, targetId, false, type); cancel(); jump(sourceId); })}/>}</>}
        <TextAction title="Bağlantı kurmaktan vazgeç" disabled={action.busy} onPress={cancel}/><ErrorBox error={action.error}/>
      </ScrollView>}
      {!scenes.length ? <View style={{ padding: 20 }}><Empty title="İlk sahneni ekle" description="Listeye dönerek sahne oluştur. Perdeler ve bağlantılar burada birlikte görünecek."/></View> : <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
        <GraphCanvas nodes={graph.nodes.map(n => ({ ...n, title: n.scene.title, eyebrow: `${n.scene.order + 1} · ${{ idea: 'Fikir', drafting: 'Taslak', writing: 'Yazılıyor', done: 'Tamam' }[n.scene.status] || n.scene.status}`, detail: n.scene.goal || n.scene.description }))} edges={graph.edges} bands={graph.acts.map((a, i) => ({ ...a, x: i * 310, width: 310 }))} selected={sourceId || selected} focus={focus} onSelect={pick}/>
        {!sourceId && detail}
      </View>}
      <Text style={[styles.muted, { paddingVertical: 8, paddingHorizontal: 16, fontSize: 12 }]}>Sürükle · İki parmakla yakınlaştır · Sahneye dokun</Text>
    </SafeAreaView>
  </Modal>;
}
