import { useRef, useState, type ComponentProps } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { api } from '../api';
import type { Character, Work } from '../types';
import { characterFields, characterPatch, deleteCharacterRelation, relationshipBody, relationshipTypes, relationPerspective, saveCharacter, type CharacterRelation } from '../characters';
import { useResource } from '../useResource';
import { Button, Chip, Empty, ErrorBox, Field, IconButton, Loading, Page, SearchField, TextAction, useAction, useUI } from '../ui';
import { MemberGate } from './MemberGate';

function Choice(props: ComponentProps<typeof Chip>) { return <View style={{ maxWidth: '100%', flexShrink: 1 }}><Chip {...props}/></View>; }
type Screen = 'list' | 'detail' | 'edit' | 'new' | 'relation';
const path = (workId: string, suffix = '') => `/characters/${encodeURIComponent(workId)}${suffix}`;
function useUnsaved(dirty: boolean, busy: boolean) {
  const navigation = useNavigation();
  usePreventRemove(dirty || busy, ({ data }) => {
    if (busy) { Alert.alert('Kaydediliyor', 'İşlem tamamlanana kadar bekle.'); return; }
    Alert.alert('Değişiklikler kaydedilmedi', 'Kaydetmeden çıkmak istiyor musun?', [{ text: 'Düzenlemeye devam et', style: 'cancel' }, { text: 'Kaydetmeden çık', style: 'destructive', onPress: () => navigation.dispatch(data.action) }]);
  });
}
function Initial({ character }: { character: Character }) {
  const { fontScale } = useWindowDimensions(); const size = Math.max(48, 40 * fontScale);
  const { colors, styles } = useUI(); const color = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(character.color || '') ? character.color! : colors.accent;
  return <View style={{ width: size, height: size, borderRadius: 14, borderWidth: 3, borderColor: color, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}><Text style={[styles.heading, { fontSize: 23 }]}>{character.name.trim().slice(0, 1).toLocaleUpperCase('tr')}</Text></View>;
}
function Header({ title, work, workId, add }: { title: string; work?: string; workId: string; add?: boolean }) {
  const { styles } = useUI();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><IconButton icon="arrow-back-outline" label="Geri dön" onPress={() => router.canGoBack() ? router.back() : router.replace(`/studio/${workId}`)}/><View style={{ flex: 1, gap: 4 }}><Text accessibilityRole="header" style={styles.heading}>{title}</Text>{!!work && <Text style={styles.muted}>{work}</Text>}</View>{add && <IconButton icon="add-outline" label="Yeni karakter ekle" onPress={() => router.push(path(workId, '/new'))}/>}</View>;
}
function CharacterForm({ workId, original }: { workId: string; original?: Character }) {
  const { styles } = useUI(); const action = useAction();
  const [base, setBase] = useState(original); const [draft, setDraft] = useState(() => characterFields(original)); const [success, setSuccess] = useState('');
  const dirty = Object.keys(characterPatch(characterFields(base), draft)).length > 0;
  useUnsaved(dirty, action.busy);
  const update = (key: keyof typeof draft, value: string) => { setSuccess(''); setDraft(previous => ({ ...previous, [key]: value })); };
  return <View style={{ gap: 18 }}>
    <Field label="Ad *" value={draft.name} onChangeText={v => update('name', v)} editable={!action.busy}/>
    <Field label="Rol" value={draft.role} onChangeText={v => update('role', v)} editable={!action.busy}/>
    <Field label="Renk (ör. #7dd3fc)" autoCapitalize="none" autoCorrect={false} value={draft.color} onChangeText={v => update('color', v)} editable={!action.busy}/>
    <View style={styles.row}>{['#7dd3fc', '#86b89e', '#d6a36d', '#b2a1cf', '#e39b9b'].map(color => <Choice key={color} title={color} selected={draft.color === color} disabled={action.busy} onPress={() => update('color', color)}/>)}</View>
    <Field label="Notlar" multiline value={draft.notes} onChangeText={v => update('notes', v)} editable={!action.busy} style={{ minHeight: 240 }}/>
    <ErrorBox error={action.error}/>{!!success && <Text accessibilityLiveRegion="polite" style={styles.text}>{success}</Text>}
    <Button title="Kaydet" busy={action.busy} disabled={!draft.name.trim() || !dirty} onPress={() => action.run(async () => {
      if (draft.color && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(draft.color.trim()) && draft.color !== base?.color) throw new Error('Rengi #RGB veya #RRGGBB biçiminde yaz.');
      const saved = await saveCharacter(workId, draft, base); setBase(saved.item); setDraft(characterFields(saved.item)); setSuccess('Karakter kaydedildi.');
    })}/>
    {!!base && <TextAction title="Karakter detayına git" disabled={action.busy} onPress={() => router.replace(path(workId, `/${base._id}`))}/>}
  </View>;
}
function RelationForm({ workId, source, characters, relations, initialTarget }: { workId: string; source: Character; characters: Character[]; relations: CharacterRelation[]; initialTarget?: string }) {
  const { styles } = useUI(); const action = useAction(); const [initialTargetValue] = useState(() => initialTarget && characters.some(c => c._id === initialTarget && c._id !== source._id) ? initialTarget : ''); const [target, setTarget] = useState(initialTargetValue); const [query, setQuery] = useState('');
  const [custom, setCustom] = useState(false); const [type, setType] = useState(''); const [direction, setDirection] = useState('outgoing'); const [strength, setStrength] = useState(3); const [label, setLabel] = useState(''); const [saved, setSaved] = useState(false);
  useUnsaved(!saved && (target !== initialTargetValue || !!type || !!label || direction !== 'outgoing' || strength !== 3), action.busy);
  const types = [...new Set([...Object.keys(relationshipTypes), ...relations.map(r => r.type)])];
  const targets = characters.filter(c => c._id !== source._id && c.name.toLocaleLowerCase('tr').includes(query.trim().toLocaleLowerCase('tr')));
  if (saved) return <View style={{ gap: 16 }}><Text accessibilityLiveRegion="polite" style={styles.text}>İlişki kaydedildi.</Text><Button title="Karaktere dön" onPress={() => router.back()}/></View>;
  return <View style={{ gap: 16 }}><Text numberOfLines={2} style={styles.heading}>{source.name}</Text>
    <SearchField value={query} onChangeText={setQuery} placeholder="Diğer karakteri ara…"/>
    <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled"><View style={styles.row}>{targets.map(c => <Choice key={c._id} title={c.name} selected={target === c._id} disabled={action.busy} onPress={() => setTarget(c._id)}/>)}</View></ScrollView>{!!target && <Text style={styles.muted}>Seçilen: {characters.find(c => c._id === target)?.name}</Text>}
    {!!query && !targets.length && characters.length > 1 && <Text style={styles.muted}>Aramana uygun başka karakter bulunamadı.</Text>}
    {characters.length < 2 && <Text style={styles.muted}>İlişki kurmak için bu esere başka bir karakter ekle.</Text>}
    <Text style={styles.text}>İlişki türü</Text><View style={styles.row}>{types.map(key => <Choice key={key} title={relationshipTypes[key] || key} selected={type === key} disabled={action.busy} onPress={() => { setType(key); setCustom(!relationshipTypes[key]); }}/>)}</View>
    <TextAction title="Özel ilişki türü kullan" disabled={action.busy} onPress={() => { setCustom(true); setType(''); }}/>{custom && <Field label="Özel ilişki türü" maxLength={80} value={type} onChangeText={setType} editable={!action.busy}/>}
    <Text style={styles.text}>Yön · {source.name} açısından</Text><View style={styles.row}>{[['outgoing', 'Giden →'], ['incoming', 'Gelen ←'], ['mutual', 'Karşılıklı ↔']].map(([id, title]) => <Choice key={id} title={title!} selected={direction === id} disabled={action.busy} onPress={() => setDirection(id!)}/>)}</View>
    <Text style={styles.text}>Güç · {strength}/5</Text><View style={styles.row}>{[1, 2, 3, 4, 5].map(n => <Choice key={n} title={String(n)} selected={strength === n} disabled={action.busy} onPress={() => setStrength(n)}/>)}</View>
    <Field label="Açıklama" value={label} onChangeText={setLabel} maxLength={200} multiline editable={!action.busy}/>
    <ErrorBox error={action.error}/><Button title="İlişkiyi kaydet" busy={action.busy} disabled={!target || !type.trim()} onPress={() => action.run(async () => { if (!characters.some(c => c._id === target && c._id !== source._id)) throw new Error('Bu eserden başka bir karakter seç.'); await api('/relationships', 'POST', relationshipBody(workId, source._id, target, type, direction, strength, label)); setSaved(true); })}/>
  </View>;
}
function Content({ screen, workId, id, target }: { screen: Screen; workId: string; id?: string; target?: string }) {
  const { styles, colors } = useUI(); const action = useAction(); const [query, setQuery] = useState(''); const [menu, setMenu] = useState(false);
  const work = useResource<{ item: Work }>(`/works/${encodeURIComponent(workId)}`);
  const people = useResource<{ items: Character[] }>(`/characters?workId=${encodeURIComponent(workId)}`);
  const relations = useResource<{ items: CharacterRelation[] }>(`/relationships?workId=${encodeURIComponent(workId)}`);
  const characters = people.data?.items || []; const allRelations = relations.data?.items || []; const character = characters.find(c => c._id === id);
  const deleted = useRef(false);
  const header = <Header title={screen === 'list' ? 'Karakterler' : screen === 'new' ? 'Yeni karakter' : screen === 'edit' ? 'Karakteri düzenle' : screen === 'relation' ? 'İlişki ekle' : 'Karakter'} work={work.data?.item.title} workId={workId} add={screen === 'list'}/>;
  const status = <><ErrorBox error={work.error} retry={work.reload}/><ErrorBox error={people.error} retry={people.reload}/><ErrorBox error={relations.error} retry={relations.reload}/><ErrorBox error={action.error}/></>;
  if (!people.data && people.loading) return <Page safeTop>{header}<Loading/></Page>;
  if (!people.data) return <Page safeTop>{header}{status}</Page>;
  if (screen === 'list') {
    const found = characters.filter(c => c.name.toLocaleLowerCase('tr').includes(query.trim().toLocaleLowerCase('tr')));
    return <Page safeTop scroll={false}><FlatList data={found} keyExtractor={c => c._id} contentContainerStyle={[styles.content, { maxWidth: 760, gap: 12 }]} keyboardShouldPersistTaps="handled" ListHeaderComponent={<View style={{ gap: 16 }}>{header}{status}<Button secondary icon="git-network-outline" title="Karakter haritası" onPress={() => router.push(path(workId, '/map'))}/><SearchField value={query} onChangeText={setQuery} placeholder="Karakter adı ara…"/></View>} ListEmptyComponent={<Empty title={characters.length ? 'Arama sonucu yok.' : 'Henüz karakter yok.'} description={characters.length ? 'Başka bir adla tekrar ara.' : 'Üstteki ekleme düğmesiyle ilk karakterini oluştur.'}/>} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, karakter detayını aç`} onPress={() => router.push(path(workId, `/${item._id}`))} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, minHeight: 80, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: colors.card, opacity: pressed ? .7 : 1 })}><Initial character={item}/><View style={{ flex: 1, gap: 3 }}><Text numberOfLines={2} style={[styles.heading, { fontSize: 20, lineHeight: 27 }]}>{item.name}</Text>{!!item.role && <Text numberOfLines={2} style={styles.muted}>{item.role}</Text>}<Text style={styles.muted}>{relations.data ? `${allRelations.filter(r => r.from === item._id || r.to === item._id).length} ilişki` : relations.loading ? 'İlişkiler yükleniyor…' : 'İlişki sayısı yüklenemedi'}</Text></View></Pressable>}/></Page>;
  }
  if (screen === 'new') return <Page safeTop contentStyle={{ maxWidth: 760 }}>{header}{status}<CharacterForm workId={workId}/></Page>;
  if (!character) return <Page safeTop>{header}{status}<Empty title="Karakter bulunamadı." description="Bu eserde karakter silinmiş veya erişimin değişmiş olabilir."/></Page>;
  if (screen === 'edit') return <Page safeTop contentStyle={{ maxWidth: 760 }}>{header}{status}<CharacterForm workId={workId} original={character}/></Page>;
  if (screen === 'relation') return <Page safeTop contentStyle={{ maxWidth: 760 }}>{header}{status}<RelationForm workId={workId} source={character} characters={characters} relations={allRelations} initialTarget={target}/></Page>;
  const links = allRelations.filter(r => r.from === id || r.to === id);
  return <Page safeTop contentStyle={{ maxWidth: 760 }}>{header}{status}<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Initial character={character}/><View style={{ flex: 1 }}><Text accessibilityRole="header" style={styles.title}>{character.name}</Text>{!!character.role && <Text style={styles.muted}>{character.role}</Text>}</View><IconButton icon="ellipsis-horizontal" label="Karakter işlemleri" onPress={() => setMenu(!menu)}/></View>
    <Button secondary title="Düzenle" onPress={() => router.push(path(workId, `/${id}/edit`))}/>
    {menu && <TextAction title="Karakteri sil" disabled={action.busy} onPress={() => Alert.alert(`“${character.name}” silinsin mi?`, 'Karakter silinecek. Bu işlem geri alınamaz.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => action.run(async () => { if (deleted.current) return; await api(`/characters/${encodeURIComponent(character._id)}?workId=${encodeURIComponent(workId)}`, 'DELETE'); deleted.current = true; router.replace(path(workId)); }) }])}/>}
    <Text accessibilityRole="header" style={styles.heading}>Notlar</Text><Text selectable style={styles.prose}>{character.notes || 'Henüz not eklenmemiş.'}</Text>
    <Text accessibilityRole="header" style={styles.heading}>İlişkiler</Text><Button secondary title="İlişki ekle" onPress={() => router.push(path(workId, `/${id}/relation`))}/>
    {relations.loading && !relations.data ? <Loading/> : !relations.error && !links.length && <Text style={styles.muted}>Henüz ilişki yok.</Text>}
    {links.map(r => { const perspective = relationPerspective(r, character._id); const other = characters.find(c => c._id === perspective.otherId); return <View key={r._id} style={styles.card}>{other ? <TextAction title={other.name} onPress={() => router.push(path(workId, `/${other._id}`))}/> : <Text style={styles.text}>Silinmiş karakter</Text>}<Text style={styles.text}>{relationshipTypes[r.type] || r.type}</Text><Text style={styles.muted}>{perspective.direction} · Güç {r.strength ?? 3}/5</Text>{!!r.label && <Text style={styles.text}>{r.label}</Text>}<TextAction title="İlişkiyi sil" disabled={action.busy} onPress={() => Alert.alert('İlişki silinsin mi?', `${character.name} — ${other?.name || 'Silinmiş karakter'}: ${relationshipTypes[r.type] || r.type}`, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => action.run(async () => { await deleteCharacterRelation(workId, r._id); relations.setData(previous => previous ? { items: previous.items.filter(item => item._id !== r._id) } : previous); await relations.reload(); }) }])}/></View>; })}
  </Page>;
}
export function CharacterRoute({ screen }: { screen: Screen }) {
  const params = useLocalSearchParams<{ workId: string; id?: string; target?: string }>(); const workId = typeof params.workId === 'string' ? params.workId : ''; const id = typeof params.id === 'string' ? params.id : undefined;
  return <MemberGate title="Karakterler"><Stack.Screen options={{ headerShown: false }}/>{workId ? <Content key={`${screen}:${workId}:${id || ''}`} screen={screen} workId={workId} id={id} target={typeof params.target === 'string' ? params.target : undefined}/> : <Page safeTop><Empty title="Eser seçilmedi."/></Page>}</MemberGate>;
}
