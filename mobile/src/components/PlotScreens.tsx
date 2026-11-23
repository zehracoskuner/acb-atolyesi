import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { api } from '../api';
import { useResource } from '../useResource';
import { useFormDrafts } from '../useFormDrafts';
import type { Character, Scene, Work, World } from '../types';
import { plotActs, filterScenes, sceneLinks, sceneOrder, sceneStatuses, structures } from '../plot';
import { edgeTypes, plotLayout, type EdgeType } from '../plotMap';
import { Button, Chip, Empty, ErrorBox, Field, IconButton, Loading, Page, SearchField, TextAction, useAction, useUI } from '../ui';
import { GraphCanvas } from './GraphCanvas';
import { MemberGate } from './MemberGate';
import { FormDraftPanel } from './FormDraftPanel';

type PlotData = { plot: { scenes: Scene[]; updatedAt: string }; chapters: { _id: string; title: string }[] };
type Data = ReturnType<typeof usePlot>;
const path = (workId: string, suffix = '') => `/plot/${encodeURIComponent(workId)}${suffix}`;
function usePlot(workId: string) {
  const plot = useResource<PlotData>(`/plots/${workId}`);
  const world = useResource<{ world: World }>(`/world/${workId}`);
  const work = useResource<{ item: Work }>(`/works/${workId}`);
  const characters = useResource<{ items: Character[] }>(`/characters?workId=${workId}`);
  const scenes = useMemo(() => [...(plot.data?.plot.scenes || [])].sort(sceneOrder), [plot.data]);
  const acts = useMemo(() => plotActs(world.data?.world.structure, scenes), [world.data, scenes]);
  return { plot, world, work, characters, scenes, acts };
}
function Header({ workId, title, work, children }: React.PropsWithChildren<{ workId: string; title: string; work?: string }>) {
  const { styles } = useUI();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><IconButton icon="arrow-back-outline" label="Geri dön" onPress={() => router.canGoBack() ? router.back() : router.replace(`/studio/${workId}`)}/><View style={{ flex: 1 }}><Text accessibilityRole="header" numberOfLines={2} style={styles.heading}>{title}</Text>{!!work && <Text numberOfLines={2} style={styles.muted}>{work}</Text>}</View>{children}</View>;
}
function Choice(props: React.ComponentProps<typeof Chip>) { return <View style={{ maxWidth: '100%', flexShrink: 1 }}><Chip {...props}/></View>; }
function Home({ workId, data }: { workId: string; data: Data }) {
  const { styles, colors, wide } = useUI(); const { fontScale, height, width } = useWindowDimensions(); const sidePanel = wide || width > height; const { scenes, acts, plot, world, work, characters } = data;
  const [query, setQuery] = useState(''); const [filters, setFilters] = useState(false); const [act, setAct] = useState(''); const [status, setStatus] = useState(''); const [character, setCharacter] = useState('');
  const [list, setList] = useState(false); const [selected, select] = useState(''); const [focus, setFocus] = useState(''); const [collapsed, collapse] = useState<string[]>([]);
  const visible = useMemo(() => filterScenes(scenes, query, act, status, character), [scenes, query, act, status, character]);
  const graph = useMemo(() => plotLayout(visible, acts, fontScale), [visible, acts, fontScale]);
  const chosen = visible.find(s => s._id === selected);
  const add = (actId = act || acts[0]?.id || '') => router.push(path(workId, `/new?act=${encodeURIComponent(actId)}`));
  const rows = acts.flatMap(a => {
    const items = visible.filter(s => s.act === a.id);
    return [{ key: `act-${a.id}`, act: a, count: items.length, scene: null as Scene | null }, ...(collapsed.includes(a.id) ? [] : items.map(scene => ({ key: scene._id, act: a, count: 0, scene })))];
  });
  return <Page safeTop scroll={false}>
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, gap: 8 }}>
      <Header title="Olay Örgüsü" workId={workId} work={work.data?.item.title}><IconButton icon="add-outline" label="Yeni sahne ekle" onPress={() => add()}/></Header>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><View style={{ flex: 1 }}><SearchField value={query} onChangeText={setQuery} placeholder="Sahne ara…"/></View><IconButton icon="options-outline" label="Perde, karakter ve durum filtreleri" active={filters || !!act || !!status || !!character} onPress={() => setFilters(!filters)}/></View>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><Text style={[styles.muted, { flex: 1 }]}>{visible.length}/{scenes.length} sahne</Text><TextAction title={list ? 'Harita' : 'Liste'} icon={list ? 'git-branch-outline' : 'list-outline'} onPress={() => setList(!list)}/><TextAction title="Perdeler" onPress={() => router.push(path(workId, '/structure'))}/></View>
      {!filters && height >= 500 && !list && !!visible.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{acts.map(a => <Chip key={a.id} title={`${a.label} · ${visible.filter(s => s.act === a.id).length}`} selected={chosen?.act === a.id} onPress={() => { const first = visible.find(s => s.act === a.id); if (first) { setFocus(first._id); select(first._id); } else add(a.id); }}/>)}</ScrollView>}
      <ErrorBox error={plot.error || world.error || work.error} retry={() => { void plot.reload(); void world.reload(); void work.reload(); }}/>
    </View>
    {filters && <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>PERDE</Text><View style={styles.row}><Choice title="Tümü" selected={!act} onPress={() => setAct('')}/>{acts.map(a => <Choice key={a.id} title={a.label} selected={act === a.id} onPress={() => setAct(a.id)}/>)}</View>
      <Text style={styles.label}>DURUM</Text><View style={styles.row}><Choice title="Tümü" selected={!status} onPress={() => setStatus('')}/>{Object.entries(sceneStatuses).map(([id, label]) => <Choice key={id} title={label} selected={status === id} onPress={() => setStatus(id)}/>)}</View>
      <Text style={styles.label}>KARAKTER</Text><View style={styles.row}><Choice title="Tümü" selected={!character} onPress={() => setCharacter('')}/>{characters.data?.items.map(c => <Choice key={c._id} title={c.name} selected={character === c._id} onPress={() => setCharacter(c._id)}/>)}</View><ErrorBox error={characters.error} retry={characters.reload}/>
      <Button secondary title="Filtreleri temizle" onPress={() => { setAct(''); setStatus(''); setCharacter(''); setQuery(''); }}/><Button title="Haritaya dön" onPress={() => setFilters(false)}/>
    </ScrollView>}
    {!filters && (!plot.data && plot.loading ? <Loading/> : !scenes.length ? <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}><Empty title="Hikâyenin ilk sahnesi" description="Sahnelerini perdeler boyunca yerleştir, aralarındaki neden ve sonuçları bağla."/>{!world.data?.world.structure?.acts.length && <Button secondary title="Perde yapısını seç" onPress={() => router.push(path(workId, '/structure'))}/>}<Button title="Sahne ekle" onPress={() => add()}/></ScrollView>
      : !visible.length ? <View style={{ padding: 20 }}><Empty title="Bu aramada sahne yok" description="Aramayı veya filtreleri değiştir."/></View>
        : list ? <FlatList data={rows} keyExtractor={item => item.key} keyboardShouldPersistTaps="handled" initialNumToRender={8} windowSize={5} contentContainerStyle={{ padding: 16, gap: 10, width: '100%', maxWidth: 820, alignSelf: 'center' }} renderItem={({ item }) => item.scene ? <Pressable accessibilityRole="button" accessibilityLabel={`${item.scene.title}, sahneyi aç`} onPress={() => router.push(path(workId, `/${item.scene!._id}`))} style={styles.card}><Text numberOfLines={2} style={styles.heading}>{item.scene.order + 1}. {item.scene.title}</Text><Text style={styles.muted}>{sceneStatuses[item.scene.status] || item.scene.status}{item.scene.isAlternative ? ' · Alternatif dal' : ''}</Text>{!!item.scene.description && <Text numberOfLines={2} style={styles.text}>{item.scene.description}</Text>}{!!item.scene.characters?.length && <Text numberOfLines={2} style={styles.muted}>{item.scene.characters.slice(0, 2).map(c => c.name).join(', ')}{item.scene.characters.length > 2 ? ` +${item.scene.characters.length - 2}` : ''}</Text>}</Pressable> : <View style={styles.row}><View style={{ flex: 1 }}><TextAction title={`${collapsed.includes(item.act.id) ? '▸' : '▾'} ${item.act.label} · ${item.count}`} onPress={() => collapse(old => old.includes(item.act.id) ? old.filter(id => id !== item.act.id) : [...old, item.act.id])}/></View><IconButton icon="add-outline" label={`${item.act.label} perdesine sahne ekle`} onPress={() => add(item.act.id)}/></View>}/>
          : <View style={{ flex: 1, flexDirection: sidePanel ? 'row' : 'column' }}>
            <GraphCanvas nodes={graph.nodes.map(n => ({ ...n, title: n.scene.title, eyebrow: `${n.scene.order + 1} · ${sceneStatuses[n.scene.status] || n.scene.status}${n.scene.isAlternative ? ' · Alternatif' : ''}`, detail: n.scene.description || n.scene.goal }))} edges={graph.edges} bands={graph.acts.map((a, i) => ({ ...a, x: i * 310, width: 310 }))} selected={selected} focus={visible.some(s => s._id === focus) ? focus : visible[0]?._id} onSelect={id => { select(id); setFocus(id); }}/>
            {chosen && <ScrollView style={sidePanel ? { width: Math.min(310, width * .45), flexGrow: 0, borderLeftWidth: 1, borderColor: colors.line } : { maxHeight: height * .32, flexGrow: 0, borderTopWidth: 1, borderColor: colors.line }} contentContainerStyle={{ padding: 16, gap: 8 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text numberOfLines={2} style={[styles.heading, { flex: 1 }]}>{chosen.title}</Text><IconButton icon="close-outline" label="Sahne özetini kapat" onPress={() => select('')}/></View><Button title="Sahneyi aç" onPress={() => router.push(path(workId, `/${chosen._id}`))}/>{height >= 500 && <><Text style={styles.label}>{acts.find(a => a.id === chosen.act)?.label}</Text><Text numberOfLines={2} style={styles.text}>{chosen.description || chosen.goal || 'Sahnenin ayrıntılarını yazmaya başla.'}</Text></>}</ScrollView>}
          </View>)}
    {!filters && !list && !!visible.length && <Text style={[styles.muted, { padding: 10, textAlign: 'center' }]}>Sürükle · Yakınlaştır · Sahneye dokun</Text>}
  </Page>;
}

function Structure({ workId, data }: { workId: string; data: Data }) {
  const { styles } = useUI(); const action = useAction(); const [success, setSuccess] = useState(''); const [name, setName] = useState('');
  const blocked = !!(data.world.error || data.plot.error) || !data.world.data || !data.plot.data;
  const save = (structure: NonNullable<World['structure']>) => action.run(async () => {
    const previousActs = data.acts.filter(a => data.scenes.some(s => s.act === a.id) && !structure.acts.some(next => next.id === a.id));
    await api(`/world/${workId}`, 'PATCH', { structure: { ...structure, acts: [...structure.acts, ...previousActs] } });
    await data.world.reload(); setSuccess('Perde yapısı kaydedildi. Mevcut sahnelerin ve bağlantıların korundu.');
  });
  const current = data.world.data?.world.structure;
  return <><Text style={styles.text}>Hikâyenin yapısını seç. Yapıyı değiştirince eski perdelerdeki sahneler haritada kalır; onları Taşı ile yeni perdelere alabilirsin.</Text>{structures.map(s => <Button key={s.templateId} title={`${current?.templateId === s.templateId ? '✓ ' : ''}${s.label}`} secondary disabled={blocked} busy={action.busy} onPress={() => save({ templateId: s.templateId, acts: s.acts.map((a, i) => ({ ...a, color: ['#6d28d9', '#0891b2', '#b45309'][i % 3], roman: String(i + 1) })) })}/>)}
    <Text style={styles.heading}>Perdeler</Text>{data.acts.map(a => <Text key={a.id} style={styles.text}>{a.label}</Text>)}<Field label="Yeni perde adı" value={name} onChangeText={setName} maxLength={100}/><Button secondary title="Perde ekle" busy={action.busy} disabled={blocked || !name.trim()} onPress={() => save({ templateId: 'serbest', acts: [...data.acts, { id: `perde-${Date.now().toString(36)}`, label: name.trim() }] })}/><ErrorBox error={action.error}/>{!!success && <Text accessibilityLiveRegion="polite" style={styles.text}>{success}</Text>}</>;
}

function Detail({ workId, scene, data }: { workId: string; scene: Scene; data: Data }) {
  const { styles } = useUI(); const action = useAction(); const [menu, setMenu] = useState(false);
  const links = sceneLinks(data.scenes, scene._id);
  const forget = useFormDrafts({ kind: 'scenes', workId }).forget;
  return <><View style={styles.row}><Text style={styles.label}>{sceneStatuses[scene.status] || scene.status} · {data.acts.find(a => a.id === scene.act)?.label}</Text><IconButton icon="ellipsis-horizontal" label="Sahne işlemleri" onPress={() => setMenu(!menu)}/></View>
    {menu && <View style={styles.card}><TextAction title="Sahneyi taşı" onPress={() => router.push(path(workId, `/${scene._id}/move`))}/><TextAction title="Sahneyi sil" disabled={action.busy} onPress={() => Alert.alert(`“${scene.title}” silinsin mi?`, 'Sahne ve ona gelen/giden bağlantılar silinir. Bağlı bölüm silinmez.', [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sahneyi sil', style: 'destructive', onPress: () => action.run(async () => { await api(`/plots/${workId}/scenes/${scene._id}`, 'DELETE'); await forget(scene._id); router.replace(path(workId)); }) }])}/></View>}
    <Button title="Sahneyi düzenle" icon="create-outline" onPress={() => router.push(path(workId, `/${scene._id}/edit`))}/>
    {!!scene.isAlternative && <Text style={styles.label}>ALTERNATİF DAL</Text>}{!!scene.time && <Text style={styles.text}>Zaman · {scene.time}</Text>}
    {scene.title.length > 70 && <Text selectable style={styles.heading}>{scene.title}</Text>}<Text style={styles.heading}>Özet</Text><Text selectable style={styles.prose}>{scene.description || 'Henüz özet eklenmedi.'}</Text>
    <Text style={styles.heading}>Amaç</Text><Text selectable style={styles.text}>{scene.goal || 'Henüz amaç eklenmedi.'}</Text>
    <Text style={styles.heading}>Karakterler</Text>{scene.characters?.length ? <View style={styles.row}>{scene.characters.map(c => <Choice key={c._id} title={c.name} onPress={() => router.push(`/characters/${workId}/${c._id}`)}/>)}</View> : <Text style={styles.muted}>Bu sahneye karakter eklenmedi.</Text>}
    {!!scene.chapter && <Button secondary title={`Bağlı bölümü aç · ${data.plot.data?.chapters?.find(c => c._id === scene.chapter)?.title || 'Bölüm'}`} onPress={() => router.push({ pathname: '/write/[id]', params: { id: scene.chapter!, workId } })}/>}
    <Text style={styles.heading}>Sahne metni</Text><Text selectable style={styles.prose}>{scene.draftText || 'Sahne metnini düzenleme ekranında yazabilirsin.'}</Text>
    <Text style={styles.muted}>Sahne metni planlama içindir. Bölüm içeriğini ve yayın durumunu değiştirmez.</Text>
    <Text style={styles.heading}>Bağlantılar</Text><Button secondary title="Bağlantı ekle" icon="git-branch-outline" onPress={() => router.push(path(workId, `/${scene._id}/connect`))}/>
    {[true, false].map(outgoing => <View key={String(outgoing)} style={{ gap: 8 }}><Text style={styles.label}>{outgoing ? 'GİDEN' : 'GELEN'}</Text>{!links.some(l => l.outgoing === outgoing) && <Text style={styles.muted}>Bağlantı yok.</Text>}{links.filter(l => l.outgoing === outgoing).map(l => <View key={`${l.source._id}:${l.target._id}`} style={styles.card}><Text style={styles.muted}>{edgeTypes[l.type as EdgeType] || l.type} · {outgoing ? 'Bu sahneden gider' : 'Bu sahneye gelir'}</Text><TextAction title={outgoing ? `→ ${l.target.title}` : `← ${l.source.title}`} onPress={() => router.push(path(workId, `/${outgoing ? l.target._id : l.source._id}`))}/><TextAction title="Bağlantıyı kaldır" disabled={action.busy} onPress={() => Alert.alert('Bağlantı kaldırılsın mı?', `${l.source.title} → ${l.target.title}. İki sahne de korunur.`, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Kaldır', style: 'destructive', onPress: () => action.run(async () => { await api(`/plots/${workId}/scenes/${l.source._id}/disconnect`, 'PATCH', { targetId: l.target._id }); await data.plot.reload(); }) }])}/></View>)}</View>)}<ErrorBox error={action.error}/>
  </>;
}

function Edit({ workId, sceneId, initialAct, data }: { workId: string; sceneId?: string; initialAct?: string; data: Data }) {
  const { styles } = useUI(); const editor = useFormDrafts({ kind: 'scenes', workId }); const action = useAction(); const navigation = useNavigation();
  const [details, setDetails] = useState(false); const [recover, setRecover] = useState(false);
  useEffect(() => { void editor.start(sceneId); /* The route is keyed by work and scene. */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const engine = editor.engine; const draft = engine?.draft; const form = draft?.data;
  const [initialized, initialize] = useState(false);
  useEffect(() => { if (engine && !sceneId && !initialized) { editor.update({ act: initialAct || data.acts[0]?.id || 'perde1' }); initialize(true); } }, [engine, sceneId, initialized, initialAct, data.acts, editor]);
  usePreventRemove(!!draft?.dirty || !!engine?.busy, ({ data: event }) => {
    if (engine?.busy || engine?.diskError) { Alert.alert('Kayıt sürüyor', 'Cihaz kaydı tamamlanana kadar bekle veya kayıt hatasını tekrar dene.'); return; }
    Alert.alert('Sunucuya kaydedilmemiş değişiklikler', 'Cihaz taslağın korunacak. Düzenlemeden çıkılsın mı?', [{ text: 'Devam et', style: 'cancel' }, { text: 'Taslağı koru ve çık', onPress: () => action.run(async () => { await editor.close(); navigation.dispatch(event.action); }) }]);
  });
  if (!engine || !form) return <><Loading/><ErrorBox error={editor.error} retry={() => { void editor.start(sceneId); }}/></>;
  const acts = [...data.acts]; if (!acts.some(a => a.id === form.act)) acts.push({ id: form.act, label: form.act });
  return <><FormDraftPanel editor={editor} actNames={Object.fromEntries(acts.map(a => [a.id, a.label]))} characterNames={Object.fromEntries((data.characters.data?.items || []).map(c => [c._id, c.name]))}/>
    {!draft?.conflict && <><Field label="Başlık *" value={form.title} maxLength={200} onChangeText={title => editor.update({ title })}/><Field label="Özet" multiline maxLength={2000} value={form.description} onChangeText={description => editor.update({ description })}/>
      <Text style={styles.label}>PERDE</Text>{sceneId ? <><Text style={styles.text}>{acts.find(a => a.id === form.act)?.label}</Text><Text style={styles.muted}>Perde ve sırayı değiştirmek için sahne detayındaki Taşı işlemini kullan.</Text></> : <View style={styles.row}>{acts.map(a => <Choice key={a.id} title={a.label} selected={form.act === a.id} onPress={() => editor.update({ act: a.id })}/>)}</View>}
      <TextAction title={details ? 'Diğer ayrıntıları kapat' : 'Diğer ayrıntılar · amaç, durum, karakterler, hacim'} onPress={() => setDetails(!details)}/>
      {details && <><Field label="Sahnenin amacı" value={form.goal} multiline maxLength={500} onChangeText={goal => editor.update({ goal })}/><View style={styles.row}>{Object.entries(sceneStatuses).map(([id, label]) => <Choice key={id} title={label} selected={form.status === id} onPress={() => editor.update({ status: id })}/>)}</View><Text style={styles.label}>KARAKTERLER</Text><View style={styles.row}>{data.characters.data?.items.map(c => <Choice key={c._id} title={c.name} selected={form.characters.includes(c._id)} onPress={() => editor.update({ characters: form.characters.includes(c._id) ? form.characters.filter(id => id !== c._id) : [...form.characters, c._id] })}/>)}</View><ErrorBox error={data.characters.error} retry={data.characters.reload}/><Text style={styles.label}>HACİM</Text><View style={styles.row}>{Object.entries({ '': 'Belirtilmedi', short: 'Kısa', medium: 'Orta', long: 'Uzun' }).map(([id, label]) => <Choice key={id} title={label} selected={form.volume === id} onPress={() => editor.update({ volume: id })}/>)}</View></>}
      <Field label="Sahne metni" multiline value={form.draftText} maxLength={50000} style={{ minHeight: 360 }} onChangeText={draftText => editor.update({ draftText })}/><Text style={styles.muted}>Yazdıkların cihazda korunur. Sunucuya göndermek için Kaydet düğmesine dokun.</Text>
      <Button title="Kaydet" busy={engine.busy || action.busy} disabled={!form.title.trim()} onPress={() => action.run(async () => { await editor.save(); })}/>
      {!!draft?.recordId && !draft.dirty && <Button secondary title="Sahneye dön" onPress={() => router.replace(path(workId, `/${draft.recordId}`))}/>}
    </>}
    <TextAction title="Cihazdaki diğer taslaklar" onPress={() => setRecover(!recover)}/>{recover && editor.drafts.filter(d => d.dirty && d.localId !== draft?.localId).map(d => <Button key={d.localId} secondary title={d.data.title || 'Başlıksız cihaz taslağı'} onPress={() => { void editor.start(undefined, d.localId); }}/>) }<ErrorBox error={action.error}/>
  </>;
}

function Move({ workId, scene, data }: { workId: string; scene: Scene; data: Data }) {
  const { styles } = useUI(); const action = useAction(); const [act, setAct] = useState(scene.act); const [before, setBefore] = useState('end'); const [saved, save] = useState(false);
  const targets = data.scenes.filter(s => s.act === act && s._id !== scene._id);
  return <><Text style={styles.text}>{scene.title}</Text><Text style={styles.label}>HEDEF PERDE</Text><View style={styles.row}>{data.acts.map(a => <Choice key={a.id} title={a.label} selected={act === a.id} onPress={() => { setAct(a.id); setBefore('end'); save(false); }}/>)}</View><Text style={styles.label}>KONUM</Text><View style={styles.row}>{[{ id: 'start', title: 'En başa' }, { id: 'end', title: 'En sona' }, ...targets.map(s => ({ id: s._id, title: `${s.title} öncesine` }))].map(t => <Choice key={t.id} title={t.title} disabled={action.busy} selected={before === t.id} onPress={() => { setBefore(t.id); save(false); }}/>)}</View><Text style={styles.muted}>Arama veya filtre dışında kalan sahneler de sıralamada korunur. Bağlantılar ve bölümler değişmez.</Text><Button title="Taşımayı kaydet" busy={action.busy} disabled={saved} onPress={() => action.run(async () => { try { await api(`/mobile/plots/${workId}/move`, 'POST', { sceneId: scene._id, act, beforeId: before === 'end' ? null : before === 'start' ? targets[0]?._id || null : before, expectedUpdatedAt: data.plot.data?.plot.updatedAt }); save(true); } finally { await data.plot.reload(); } })}/><ErrorBox error={action.error}/>{saved && <><Text accessibilityLiveRegion="polite" style={styles.text}>Sahne taşındı.</Text><Button secondary title="Sahneye dön" onPress={() => router.back()}/></>}</>;
}
function Connect({ workId, scene, data }: { workId: string; scene: Scene; data: Data }) {
  const { styles } = useUI(); const action = useAction(); const [query, setQuery] = useState(''); const [target, setTarget] = useState(''); const [type, setType] = useState<EdgeType>('sonuc'); const [saved, save] = useState(false);
  const targets = data.scenes.filter(s => s._id !== scene._id && !scene.connections?.some(l => l.target === s._id) && s.title.toLocaleLowerCase('tr').includes(query.trim().toLocaleLowerCase('tr')));
  if (saved) return <><Text accessibilityLiveRegion="polite" style={styles.text}>Bağlantı kaydedildi.</Text><Button title="Sahneye dön" onPress={() => router.back()}/></>;
  return <><Text style={styles.heading}>{scene.title} → {data.scenes.find(s => s._id === target)?.title || 'Hedef sahne'}</Text><SearchField value={query} onChangeText={setQuery} placeholder="Bağlanacak sahneyi ara…"/><View style={styles.row}>{targets.map(s => <Choice key={s._id} title={s.title} disabled={action.busy} selected={target === s._id} onPress={() => setTarget(s._id)}/>)}</View>{!targets.length && <Text style={styles.muted}>Uygun sahne yok. Mevcut bağlantılar ve bu sahne hedeflerden çıkarıldı.</Text>}<Text style={styles.label}>BAĞLANTI TÜRÜ</Text><View style={styles.row}>{Object.entries(edgeTypes).map(([id, label]) => <Choice key={id} title={label} disabled={action.busy} selected={type === id} onPress={() => setType(id as EdgeType)}/>)}</View><Button title="Bağlantıyı kaydet" busy={action.busy} disabled={!target} onPress={() => action.run(async () => { await api(`/plots/${workId}/scenes/${scene._id}/connect`, 'PATCH', { targetId: target, edgeType: type }); save(true); await data.plot.reload(); })}/><ErrorBox error={action.error}/></>;
}
type Screen = 'home' | 'detail' | 'edit' | 'new' | 'move' | 'connect' | 'structure';
function ScreenBody({ screen, workId, id, act }: { screen: Screen; workId: string; id?: string; act?: string }) {
  const data = usePlot(workId); const { styles } = useUI(); const scene = data.scenes.find(s => s._id === id);
  if (screen === 'home') return <Home workId={workId} data={data}/>;
  const title = screen === 'new' ? 'Yeni sahne' : screen === 'structure' ? 'Perde yapısı' : screen === 'move' ? 'Sahneyi taşı' : screen === 'connect' ? 'Bağlantı ekle' : scene?.title || 'Sahne';
  return <Page safeTop contentStyle={{ maxWidth: 820 }}><Header workId={workId} title={title} work={data.work.data?.item.title}/><ErrorBox error={data.plot.error || data.world.error} retry={() => { void data.plot.reload(); void data.world.reload(); }}/>
    {screen === 'new' && !data.world.data?.world.structure?.acts.length ? data.world.loading ? <Loading/> : data.world.error ? null : <Structure workId={workId} data={data}/> : screen === 'new' || screen === 'edit' ? <Edit workId={workId} sceneId={screen === 'edit' ? id : undefined} initialAct={act} data={data}/>
      : screen === 'structure' ? data.world.loading && !data.world.data ? <Loading/> : <Structure workId={workId} data={data}/>
        : data.plot.loading && !scene ? <Loading/> : !scene ? <Text style={styles.text}>Sahne bulunamadı. Silinmiş veya bu esere ait olmayabilir.</Text>
          : screen === 'move' ? <Move workId={workId} scene={scene} data={data}/> : screen === 'connect' ? <Connect workId={workId} scene={scene} data={data}/> : <Detail workId={workId} scene={scene} data={data}/>}</Page>;
}
export function PlotRoute({ screen }: { screen: Screen }) {
  const { workId, id, act } = useLocalSearchParams<{ workId: string; id?: string; act?: string }>();
  return <MemberGate title="Olay Örgüsü"><Stack.Screen options={{ headerShown: false }}/><ScreenBody key={`${workId}:${id || screen}`} screen={screen} workId={workId} id={id} act={act}/></MemberGate>;
}
