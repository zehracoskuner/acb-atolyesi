import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Scene } from '../types';
import { connectionTargets, sceneIndex, type Act } from '../scenes';
import { Button, Empty, ErrorBox, Field, useAction, useUI } from '../ui';
import { SceneMap } from './SceneMap';
import type { EdgeType } from '../plotMap';

type Props = {
  scenes: Scene[]; acts: Act[]; filter: string; header: ReactNode; busy: boolean; editing: boolean;
  loadError?: unknown; onReload?: () => void;
  onEdit: (scene: Scene) => void; onDelete: (id: string) => void; onReorder: (scene: Scene, offset: number) => void;
  onConnection: (sceneId: string, targetId: string, remove: boolean, type?: EdgeType) => Promise<void>;
};
export function SceneList({ scenes, acts, filter, header, busy, editing, onEdit, onDelete, onReorder, onConnection, loadError, onReload }: Props) {
  const { styles } = useUI();
  const [mapOpen, setMapOpen] = useState(false);
  const action = useAction(); const [panel, setPanel] = useState<{ sourceId: string; mode: 'add' | 'existing' } | null>(null);
  const [query, setQuery] = useState('');
  const index = useMemo(() => sceneIndex(scenes), [scenes]);
  const source = panel ? index.byId.get(panel.sourceId) : undefined;
  const targets = useMemo(() => source && panel ? connectionTargets(scenes, source, query, panel.mode) : [], [scenes, source, panel, query]);
  const visible = useMemo(() => scenes.filter(scene => !filter || scene.act === filter), [scenes, filter]);
  const open = (sourceId: string, mode: 'add' | 'existing') => { setQuery(''); setPanel({ sourceId, mode }); };
  const label = (scene: Scene) => acts.find(act => act.id === scene.act)?.label || 'Diğer perde';
  return <>
    <FlatList data={visible} keyExtractor={scene => scene._id} contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={6} maxToRenderPerBatch={6} windowSize={5}
      ListHeaderComponent={<View style={{ gap: 16 }}>{header}<Button title="Sahne haritasını aç" icon="git-network-outline" onPress={() => setMapOpen(true)}/></View>}
      ListEmptyComponent={<Empty title={filter ? 'Bu perdede henüz sahne yok.' : 'Hikâyeni sahnelere ayır.'} description="Yeni sahne ekle veya başka bir perdeyi seç."/>}
      renderItem={({ item: scene }) => {
        const links = (scene.connections || []).filter(connection => index.byId.has(connection.target));
        return <View style={styles.card}>
          <Text style={styles.label}>{label(scene)} · {({ idea: 'Fikir', drafting: 'Taslak', writing: 'Yazılıyor', done: 'Tamamlandı' } as Record<string, string>)[scene.status] || 'Fikir'}</Text>
          <Text accessibilityRole="header" style={styles.heading}>{scene.title}</Text>
          {!!scene.description && <Text numberOfLines={4} style={styles.text}>{scene.description}</Text>}
          {!!scene.goal && <Text numberOfLines={3} style={styles.muted}>{scene.goal}</Text>}
          <View style={styles.row}>
            <Button secondary title="↑ Yukarı" busy={busy} disabled={index.bounds.get(scene._id)?.first} onPress={() => onReorder(scene, -1)}/>
            <Button secondary title="↓ Aşağı" busy={busy} disabled={index.bounds.get(scene._id)?.last} onPress={() => onReorder(scene, 1)}/>
            <Button secondary title="Düzenle" busy={editing} onPress={() => onEdit(scene)}/>
          </View>
          <Text style={styles.muted}>{links.length ? `Sonraki sahneler (${links.length})` : 'Henüz başka sahneye bağlanmadı.'}</Text>
          {links.slice(0, 3).map(link => <Text key={link.target} numberOfLines={2} style={styles.text}>→ {index.byId.get(link.target)!.title}</Text>)}
          <Button secondary title="Bağlantı ekle" onPress={() => open(scene._id, 'add')}/>
          {links.length > 0 && <Button secondary title={`Bağlantıları yönet (${links.length})`} onPress={() => open(scene._id, 'existing')}/>}
          <Button secondary title="Sahneyi sil" onPress={() => onDelete(scene._id)}/>
        </View>;
      }}/>
    {mapOpen && <SceneMap scenes={scenes} acts={acts} onClose={() => setMapOpen(false)} onEdit={onEdit} onConnection={onConnection} loadError={loadError} onReload={onReload}/>}
    <Modal visible={!!source} animationType="slide" onRequestClose={() => setPanel(null)}>
      <SafeAreaView style={styles.page}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <Text accessibilityRole="header" style={styles.heading}>{panel?.mode === 'existing' ? 'Sahne bağlantıları' : 'Sonraki sahneyi seç'}</Text>
            <Text numberOfLines={2} style={styles.muted}>{source?.title}</Text>
            <Button secondary title="Sahnelere dön" onPress={() => setPanel(null)}/>
            <Field label="Sahne ara" placeholder="Başlık, açıklama veya amaç" value={query} onChangeText={setQuery} autoCorrect={false}/>
            <ErrorBox error={action.error}/>
          </View>
          <FlatList data={targets} keyExtractor={scene => scene._id} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
            initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5}
            ListEmptyComponent={<Empty title={query ? 'Aramana uygun sahne bulunamadı.' : panel?.mode === 'existing' ? 'Bağlantı kalmadı.' : 'Bağlanabilecek başka sahne yok.'}/>}
            renderItem={({ item: target }) => <View style={styles.card}>
              <Text style={styles.muted}>{label(target)}</Text><Text style={styles.heading}>{target.title}</Text>
              {!!target.description && <Text numberOfLines={2} style={styles.text}>{target.description}</Text>}
              <Button secondary title={panel?.mode === 'existing' ? 'Bu bağlantıyı kaldır' : 'Bu sahneye bağla'} busy={action.busy} onPress={() => action.run(async () => {
                if (!source || !panel) return;
                await onConnection(source._id, target._id, panel.mode === 'existing');
                if (panel.mode === 'add') setPanel(null);
              })}/>
            </View>}/>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </>;
}
