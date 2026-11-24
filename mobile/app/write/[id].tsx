import { MemberGate } from '../../src/components/MemberGate';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import RenderHTML from 'react-native-render-html';
import { usePreventRemove } from '@react-navigation/native';
import { api, message } from '../../src/api';
import { useSession } from '../../src/session';
import { openDraft, useSync } from '../../src/sync';
import { DraftEngine, words } from '../../src/draftEngine';
import { RichEditor, type EditorHandle } from '../../src/components/RichEditor';
import { Button, ErrorBox, IconButton, Loading, Page, Title, useUI } from '../../src/ui';
import type { Chapter } from '../../src/types';
import { listDrafts } from '../../src/storage';

const stateLabel = (status?: string) => ({ draft: 'Taslak', published: 'Yayında', pending_review: 'İncelemede', rejected: 'Reddedildi' })[status || 'draft'] || 'Taslak';
function WriterRoute({ id, workId }: { id: string; workId: string }) {
  const { colors, styles } = useUI(); const { user } = useSession(); const { tick, online } = useSync(); const navigation = useNavigation();
  const [engine, setEngine] = useState<DraftEngine | null>(null); const [error, setError] = useState<unknown>(null);
  const [sheet, setSheet] = useState<'menu' | 'chapters' | 'preview' | null>(null); const [chapters, setChapters] = useState<Chapter[]>([]);
  const [keyboard, setKeyboard] = useState(false); const [formats, setFormats] = useState(false); const [unsupported, setUnsupported] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false); const lock = useRef(false); const mounted = useRef(true); const confirming = useRef(false);
  const [canLeave, setCanLeave] = useState(false); const exitAction = useRef<Parameters<typeof navigation.dispatch>[0] | null>(null);
  const editor = useRef<EditorHandle>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const { width } = useWindowDimensions();
  const [editorEpoch, setEditorEpoch] = useState(0);
  const onlineRef = useRef(online); onlineRef.current = online;
  const wordCount = useMemo(() => words(engine?.draft.content || ''), [engine?.draft.content]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const fail = (e: unknown) => { if (mounted.current) setError(e); };
  const save = async (target: DraftEngine) => {
    if (mounted.current) setSaving(true);
    try {
      await target.persist().catch(() => target.retryPersist());
      if (onlineRef.current) await target.sync();
      if (mounted.current) setError(null);
    } catch (e) { fail(e); } finally { if (mounted.current) setSaving(false); }
  };
  usePreventRemove(!!engine && !canLeave, ({ data }) => {
    if (!engine || lock.current) return;
    Keyboard.dismiss();
    void Promise.resolve(editor.current?.flush()).then(() => engine.persist().catch(() => engine.retryPersist())).then(() => {
      exitAction.current = data.action; setCanLeave(true);
    }).catch(fail);
  });
  useEffect(() => { if (canLeave && exitAction.current) navigation.dispatch(exitAction.current); }, [canLeave, navigation]);
  useEffect(() => {
    if (!user) return; let active = true;
    void openDraft(user._id, id, workId).then(e => { if (active) setEngine(e); }).catch(fail);
    return () => { active = false; };
  // Account/chapter identity owns the editor, never a synchronization tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, id, workId]);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    const back = BackHandler.addEventListener('hardwareBackPress', () => { if (Keyboard.isVisible()) { Keyboard.dismiss(); return true; } return false; });
    return () => { show.remove(); hide.remove(); back.remove(); };
  }, []);
  useEffect(() => {
    if (!engine) return;
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') void save(engine); });
    return () => { sub.remove(); if (timer.current) clearTimeout(timer.current); void engine.persist().then(() => engine.sync()).catch(() => {}); };
  // Every edit reaches the disk before the network, including offline.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);
  const edit = (title: string, content: string, organic: boolean) => {
    if (!engine || (title === engine.draft.title && content === engine.draft.content)) return;
    setError(null); void engine.edit(title, content, organic).catch(fail);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(engine); }, 1500);
  };
  const run = async (task: () => Promise<void>) => { if (lock.current) return; lock.current = true; setBusy(true); setError(null); try { await task(); } catch (e) { fail(e); } finally { lock.current = false; if (mounted.current) setBusy(false); } };
  const select = async (chapterId: string) => {
    if (!engine || chapterId === id) { setSheet(null); return; }
    await engine.persist().catch(() => engine.retryPersist()); setSheet(null);
    lock.current = false;
    router.replace({ pathname: '/write/[id]', params: { id: chapterId, workId } });
  };
  const showChapters = () => {
    setSheet('chapters');
    void (async () => {
      if (user) {
        const local = (await listDrafts(user._id)).filter(d => d.workId === workId);
        setChapters(local.map(d => ({ _id: d.chapterId, title: d.title, content: d.content, revision: d.baseRevision, status: d.status, reviewStatus: d.reviewStatus, order: d.order })).sort((a, b) => (a.order || 0) - (b.order || 0)));
      }
      if (online) setChapters((await api<{ items: Chapter[] }>(`/chapters?workId=${encodeURIComponent(workId)}`)).items);
    })().catch(fail);
  };
  const publish = async (unpublish = false) => {
    if (!engine || lock.current || confirming.current) return;
    confirming.current = true;
    try { await editor.current?.flush(); } catch (e) { confirming.current = false; fail(e); return; }
    const confirmed = { title: engine.draft.title, content: engine.draft.content };
    Alert.alert(`“${confirmed.title}”`, unpublish ? 'Bölüm okurlardan kaldırılıp taslağa alınacak. Devam etmek istiyor musun?' : engine.draft.status === 'published' ? 'Değişiklikler okurlara yansıyacak. Yayınlamak istiyor musun?' : 'Bu bölümü yayınlamak istiyor musun?', [
      { text: 'Vazgeç', style: 'cancel', onPress: () => { confirming.current = false; } }, { text: unpublish ? 'Yayından kaldır' : 'Yayınla', style: unpublish ? 'destructive' : 'default', onPress: () => { confirming.current = false; void run(async () => {
        setSheet(null); if (!online) throw new Error('Yayınlamak için internet bağlantısı gerekli.');
        await engine.persist().catch(() => engine.retryPersist());
        await engine.publish(confirmed, async d => (await api<{ item: Chapter }>(`/chapters/${d.chapterId}/status?editor=1`, 'PATCH', { status: unpublish ? 'draft' : 'published', workId: d.workId, expectedRevision: d.baseRevision })).item);
      }); } },
    ]);
  };
  void tick;
  if (!engine) return <Page safeTop><Loading/><ErrorBox error={error} retry={() => { if (user) void openDraft(user._id, id, workId).then(setEngine).catch(fail); }}/></Page>;
  const d = engine.draft;
  const status = engine.localState === 'failed' ? 'Kaydedilemedi · tekrar dene' : saving || engine.localState === 'pending' ? 'Kaydediliyor…' : d.dirty || d.conflict ? 'Cihazda saklandı · eşitleme bekliyor' : 'Sunucuya kaydedildi';
  const unpublished = d.status === 'published' && (d.hasUnpublishedChanges || d.dirty);
  const command = (name: string, value = '') => editor.current?.command(name, value);
  const tool = (label: string, icon: React.ComponentProps<typeof Feather>['name'], name: string, value = '') => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => command(name, value)} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><Feather name={icon} size={20} color={colors.ink}/></Pressable>;
  return <SafeAreaView style={styles.page} edges={['top', 'bottom']}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, borderBottomWidth: 1, borderColor: colors.line }}>
      <IconButton icon="arrow-back" label="Geri" onPress={() => router.back()}/>
      <Pressable accessibilityRole="button" accessibilityLabel={`Bölüm seç: ${d.title}`} onPress={showChapters} style={{ flex: 1, minHeight: 52, justifyContent: 'center', paddingHorizontal: 8 }}><Text numberOfLines={1} style={styles.text}>{d.title || 'Bölüm'} ▾</Text><Text accessibilityLiveRegion="polite" style={[styles.muted, { fontSize: 11, lineHeight: 17 }]}>{status}</Text></Pressable>
      <IconButton icon="ellipsis-horizontal" label="Bölüm menüsü" onPress={() => setSheet('menu')}/>
    </View>
    {(unpublished || d.reviewStatus || d.status === 'pending_review' || d.status === 'rejected') && <View style={{ paddingHorizontal: 18, paddingVertical: 4 }}>
      {unpublished && <Pressable accessibilityRole="button" disabled={busy} onPress={() => publish()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[styles.muted, { fontSize: 12 }]}>Yayınlanmamış değişiklikler var · <Text style={{ color: colors.accent }}>Değişiklikleri yayınla</Text></Text></Pressable>}
      {(d.reviewStatus || d.status === 'pending_review' || d.status === 'rejected') && <Text style={styles.muted}>{stateLabel(d.reviewStatus || d.status)}{d.status === 'published' ? ' · Mevcut yayın okurlara açık' : ''}{d.reviewNote ? ` · ${d.reviewNote}` : ''}</Text>}
    </View>}
    {!!error && <Pressable onPress={() => { void save(engine); }} style={{ paddingHorizontal: 18, minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.rust }}>{message(error)} · Tekrar dene</Text></Pressable>}
    {d.conflict ? <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}><Title description="Yerel taslak ve sunucu farklı. Seçimden önce iki sürümün yedeği cihazda saklanır.">Yazını kurtar</Title>
      <Text style={styles.heading}>Cihaz: {d.title}</Text><RenderHTML contentWidth={width - 40} source={{ html: d.content }} baseStyle={{ color: colors.ink }}/>
      <Text style={styles.heading}>Sunucu: {d.conflict.title}</Text><RenderHTML contentWidth={width - 40} source={{ html: d.conflict.content }} baseStyle={{ color: colors.ink }}/>
      <Button busy={busy} title="Cihazdaki yazıyla devam et" onPress={() => { void run(async () => { await engine.resolve('local'); setEditorEpoch(n => n + 1); await save(engine); }); }}/>
      <Button busy={busy} secondary title="Sunucudaki yazıyla devam et" onPress={() => { void run(async () => { await engine.resolve('remote'); setEditorEpoch(n => n + 1); }); }}/>
    </ScrollView> : <>
      {unsupported && <Text style={[styles.muted, { padding: 12 }]}>Bu metinde mobil editörün desteklemediği içerik var. Kaybı önlemek için metin salt okunur açıldı. Önizleyebilir veya web editöründe düzenleyebilirsin.</Text>}
      <RichEditor key={`${id}:${editorEpoch}`} ref={editor} initial={d.content} title={d.title} position={d.position} onPosition={position => { void engine.rememberPosition(position).catch(fail); }} onUnsupported={() => setUnsupported(true)} onPasteBlocked={() => Alert.alert('Yapıştırma durduruldu', 'Panodaki bazı biçimler desteklenmiyor. İçeriği kaybetmemek için web editörünü kullan veya düz metin olarak yapıştır.')} onChange={(html, organic, title) => edit(title ?? engine.draft.title, html, organic)} onBlur={() => { void save(engine); }}/>
      {!keyboard && <Text style={[styles.muted, { fontSize: 12, paddingHorizontal: 20, paddingVertical: 6 }]}>{wordCount} kelime · {stateLabel(d.status)}</Text>}
      {formats && <View style={[styles.row, { paddingHorizontal: 8, backgroundColor: colors.paper }]}>{tool('Altı çizili', 'underline', 'underline')}{tool('Başlık', 'type', 'formatBlock', 'h2')}{tool('Paragraf', 'file-text', 'formatBlock', 'p')}{tool('Madde listesi', 'list', 'insertUnorderedList')}{tool('Numaralı liste', 'hash', 'insertOrderedList')}{tool('Sola hizala', 'align-left', 'justifyLeft')}{tool('Ortala', 'align-center', 'justifyCenter')}{tool('Sağa hizala', 'align-right', 'justifyRight')}{tool('İki yana hizala', 'align-justify', 'justifyFull')}{tool('Alıntı', 'message-square', 'formatBlock', 'blockquote')}</View>}
      <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={{ maxHeight: 50, borderTopWidth: 1, borderColor: colors.line }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-evenly' }}>
        {tool('Geri al', 'corner-up-left', 'undo')}{tool('Yinele', 'corner-up-right', 'redo')}{tool('Kalın', 'bold', 'bold')}{tool('İtalik', 'italic', 'italic')}<IconButton icon="options-outline" label="Diğer biçimler" active={formats} onPress={() => setFormats(v => !v)}/>
      </ScrollView>
    </>}
    <Modal visible={sheet !== null} animationType="slide" onRequestClose={() => setSheet(null)}><SafeAreaView style={styles.page}><View style={[styles.row, { justifyContent: 'space-between', paddingHorizontal: 16 }]}><Text style={styles.heading}>{sheet === 'chapters' ? 'Bölümler' : sheet === 'preview' ? 'Önizleme · güncel cihaz metni' : d.title}</Text><IconButton icon="close" label="Kapat" onPress={() => setSheet(null)}/></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        {sheet === 'chapters' && <>{chapters.map(ch => <Pressable key={ch._id} accessibilityRole="button" onPress={() => { void run(() => select(ch._id)); }} style={{ minHeight: 60, justifyContent: 'center', borderBottomWidth: 1, borderColor: colors.line }}><Text style={styles.text}>{ch.order}. {ch._id === id ? d.title : ch.title}</Text><Text style={styles.muted}>{stateLabel(ch.status)}{ch.reviewStatus ? ` · ${stateLabel(ch.reviewStatus)}` : ''}</Text></Pressable>)}<Button title="Yeni bölüm" busy={busy} onPress={() => { void run(async () => { await engine.persist(); const r = await api<{ item: Chapter }>('/chapters', 'POST', { workId, title: `Bölüm ${chapters.length + 1}` }); await select(r.item._id); }); }}/><Button secondary title="Bölümleri yönet · sıralama ve silme" onPress={() => { setSheet(null); router.push(`/studio/${workId}`); }}/></>}
        {sheet === 'preview' && <><Text style={styles.title}>{d.title}</Text><RenderHTML contentWidth={Math.min(width - 40, 720)} source={{ html: d.content }} baseStyle={{ fontSize: 19, lineHeight: 32, color: colors.ink }}/></>}
        {sheet === 'menu' && <><Button title="Şimdi kaydet" busy={busy || saving} onPress={() => { void run(async () => { await editor.current?.flush(); await save(engine); }); }}/><Button secondary title="Önizle" busy={busy} onPress={() => { void run(async () => { await editor.current?.flush(); setSheet('preview'); }); }}/><Button title={d.status === 'published' ? 'Değişiklikleri yayınla' : 'Yayınla'} disabled={d.status === 'published' && !unpublished} busy={busy} onPress={() => publish()}/>{(d.status === 'published' || d.status === 'pending_review') && <Button secondary title="Yayından kaldır / taslağa al" busy={busy} onPress={() => publish(true)}/>}<Text style={styles.muted}>{status}</Text></>}
        <ErrorBox error={error}/>
      </ScrollView></SafeAreaView></Modal>
  </KeyboardAvoidingView></SafeAreaView>;
}
export default function Writer() { const { id, workId } = useLocalSearchParams<{ id: string; workId: string }>(); return <MemberGate title="Bölüm düzenle"><WriterRoute key={`${workId}:${id}`} id={id} workId={workId}/></MemberGate>; }
