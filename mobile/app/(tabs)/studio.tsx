import { MemberGate } from '../../src/components/MemberGate';
import { StudioWorkContent } from '../studio/[id]';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Text, View } from 'react-native';
import { api } from '../../src/api';
import { useResource } from '../../src/useResource';
import { useSession } from '../../src/session';
import { useSync } from '../../src/sync';
import { cacheStudioIndex, readDeviceStudio } from '../../src/studioStorage';
import { LocalDraftShelf } from '../../src/components/LocalDraftShelf';
import type { Work } from '../../src/types';
import { StudioProject } from '../../src/components/StudioProject';
import { WorkCard } from '../../src/components/WorkCard';
import { Button, Empty, ErrorBox, Field, Loading, Chip, MenuRow, Page, Title, useAction, useUI } from '../../src/ui';
function StudioContent() {
  const { styles, wide, colors } = useUI();
  const [filter, setFilter] = useState("all");
  const [selectedWork, setSelectedWork] = useState<string | null>(null);
  const resource = useResource<{ items: Work[] }>('/works'); const action = useAction(); const { user } = useSession(); const sync = useSync();
  const [creating, setCreating] = useState(false); const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [device, setDevice] = useState<(Awaited<ReturnType<typeof readDeviceStudio>> & { userId: string }) | null>(null);
  const [localError, setLocalError] = useState<unknown>(null); const [localLoading, setLocalLoading] = useState(false); const generation = useRef(0);
  const userId = user?._id;
  const focused = useIsFocused();
  const cancelLocalLoad = useCallback(() => { generation.current++; }, []);
  const reloadLocal = useCallback(async () => {
    const request = ++generation.current;
    if (!userId) return;
    setLocalLoading(true); setLocalError(null);
    try {
      // Read chapters first, independently of the API and its timeout.
      const saved = await readDeviceStudio(userId);
      if (request !== generation.current) return;
      setDevice({ ...saved, userId }); setLocalError(saved.indexError);
      if (resource.data) {
        await cacheStudioIndex(userId, resource.data.items);
        const updated = await readDeviceStudio(userId);
        if (request === generation.current) { setDevice({ ...updated, userId }); setLocalError(updated.indexError); }
      }
    } catch (error) { if (request === generation.current) setLocalError(error); }
    finally { if (request === generation.current) setLocalLoading(false); }
  }, [userId, resource.data]);
  useEffect(() => {
    if (!focused) return;
    void reloadLocal();
    return cancelLocalLoad;
  }, [focused, reloadLocal, cancelLocalLoad, sync.tick]);
  const local = device?.userId === userId ? device : null;
  const visibleWorks = resource.data?.items.filter(w => filter === "all" || (filter === "published" ? w.status === "published" : w.status !== "published")) || [];
  const activeWork = visibleWorks.find(w => w._id === selectedWork) || visibleWorks[0];
  return <Page><View style={[styles.row, { justifyContent: "space-between" }]}><Title>Atölye</Title><Button icon={creating ? 'close-outline' : 'add-outline'} title={creating ? 'Vazgeç' : 'Yeni eser'} disabled={!sync.online} onPress={() => setCreating(!creating)}/></View>
    {!sync.online && <Text style={styles.muted}>Cihazdaki bölümlerinde yazmaya devam edebilirsin. Yeni eser ve bölüm oluşturmak için internete bağlan.</Text>}
    {creating && <View style={styles.card}><Field label="Eser adı" value={title} onChangeText={setTitle}/><Field label="Kısa açıklama" multiline value={description} onChangeText={setDescription}/><Button title="Eserimi oluştur" busy={action.busy} disabled={!title.trim() || !sync.online} onPress={() => action.run(async () => {
      const { item } = await api<{ item: Work }>('/works', 'POST', { title, description }); setCreating(false); setTitle(''); router.push(`/studio/${item._id}`);
    })}/></View>}<ErrorBox error={action.error}/>
    {localLoading && !local && <Loading/>}<ErrorBox error={localError} retry={reloadLocal}/>
    {local && <LocalDraftShelf drafts={local.drafts} works={local.works} issues={sync.issues}/>}
    {!sync.online && local?.drafts.length === 0 && <Empty title="Bu cihazda kayıtlı bölüm yok." description="İnternete bağlandığında bir bölümünü editörde aç. Cihaz kopyası sonraki çevrimdışı kullanımda burada görünecek."/>}
    <ErrorBox error={sync.error} retry={sync.sync}/>{sync.online && resource.loading && <Loading/>}{sync.online && <ErrorBox error={resource.error} retry={resource.reload}/>}
    {sync.online && !!resource.data?.items.length && <View style={{ gap: 0 }}><View style={[styles.row, { marginBottom: 18 }]}>{[{ id: "all", label: "Tümü" }, { id: "draft", label: "Taslaklar" }, { id: "published", label: "Yayında" }].map(f => <Chip key={f.id} title={f.label} selected={filter === f.id} onPress={() => { setFilter(f.id); setSelectedWork(null); }}/>)}</View><View style={{ flexDirection: wide ? "row" : "column", gap: 24 }}><View style={{ width: wide ? 300 : "100%" }}>{visibleWorks.map((w, i) => !wide && i === 0 ? <StudioProject key={w._id} work={w}/> : <WorkCard key={w._id} work={w} studio onPress={wide ? () => setSelectedWork(w._id) : undefined}/>)}</View>{wide && activeWork && <View style={{ flex: 1, minWidth: 0, borderLeftWidth: 1, borderColor: colors.line, paddingLeft: 24 }}><StudioWorkContent key={activeWork._id} id={activeWork._id}/></View>}</View></View>}{sync.online && resource.data?.items.length === 0 && !local?.drafts.length && <Empty title="İlk hikâyene yer aç." description="Bir eser oluşturup ilk bölümünü yaz."/>}
    {sync.online && resource.data && resource.data.items.length > 0 && !visibleWorks.length && <Empty title="Bu filtrede eser yok"/>}<MenuRow title="Notlar" detail="Eserlerinden bağımsız notların" icon="journal-outline" onPress={() => router.push('/notes')}/>
  </Page>;
}

export default function Studio() { return <MemberGate title="Atölye" returnTo="/studio"><StudioContent/></MemberGate>; }
