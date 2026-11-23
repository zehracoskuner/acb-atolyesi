import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, AppState, BackHandler, Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, message } from './api';
import { useSession } from './session';
import { joinAtelier } from './components/MemberGate';
import { readPosition, trackReading, type ReadingPosition } from './reading';
import { defaultReaderPrefs, parseReaderPrefs, readerPalettes, resumeLocation, type ReaderBlock, type ReaderLocation, type ReaderPrefs } from './readerModel';
import { ReaderSurface, type ReaderMessage } from './components/ReaderSurface';
import { focusReaderControl, ReaderButton, ReaderField, ReaderSheet } from './components/ReaderControls';
import { ReaderComments } from './components/ReaderComments';
import type { Chapter, Work } from './types';
import { fonts, useUI } from './ui';

type ReadingChapter = Chapter & { media?: { type: string; url: string; caption?: string }[]; blocks: ReaderBlock[]; contentVersion: string };
type Panel = 'settings' | 'menu' | 'toc' | 'comments' | 'paragraph' | 'passages' | 'detached' | 'quote' | 'preface' | null;
type Loaded = { chapter: ReadingChapter; work: Work; chapters: Chapter[]; preview: boolean; initial: ReaderLocation };
// One explicit guest-to-member handoff; never imported as an account's saved history.
const guestResume = new Map<string, ReaderLocation>();
function ReaderContent({ workId, chapterId, mode, discussion, passage }: { workId: string; chapterId: string; mode?: string; discussion?: string; passage?: string }) {
  const { user } = useSession(), { dark } = useUI();
  const accountId = user?._id;
  const [prefs, setPrefs] = useState<ReaderPrefs>(defaultReaderPrefs), [prefsReady, setPrefsReady] = useState(false);
  const [loaded, setLoaded] = useState<Loaded | null>(null), [error, setError] = useState<unknown>(null), [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>(null), [paragraph, setParagraph] = useState<ReaderBlock>(), [selection, setSelection] = useState(''), [quote, setQuote] = useState(''), [notice, setNotice] = useState('');
  const [percent, setPercent] = useState(0), [focus, setFocus] = useState(false), [hidden, setHidden] = useState(false), [screenReader, setScreenReader] = useState(true), [reducedMotion, setReducedMotion] = useState(true);
  const [counts, setCounts] = useState<Record<number, number>>({}), [detachedCount, setDetachedCount] = useState(0), [like, setLike] = useState<{ liked: boolean; likeCount: number }>();
  const [commentTotal, setCommentTotal] = useState<number>();
  const likeRequest = useRef(0), summaryRequest = useRef(0);
  const acceptTotal = useCallback((total: number) => { summaryRequest.current++; setCommentTotal(total); }, []);
  const commentBack = useRef<(() => boolean) | null>(null), discussionOpened = useRef(false);
  const [library, setLibrary] = useState<boolean>(), [busy, setBusy] = useState(false), [actionError, setActionError] = useState(''), [progressError, setProgressError] = useState('');
  const [quotePolicy, setQuotePolicy] = useState<{ min: number; max: number; visibility: string }>();
  const location = useRef<ReaderLocation>({ scrollPosition: 0 }), restored = useRef(false), changed = useRef(false), generation = useRef(0), running = useRef(false);
  const lastSave = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null), fade = useRef(new Animated.Value(1)).current;
  const settingsButton = useRef<View>(null), menuButton = useRef<View>(null), tocButton = useRef<View>(null), commentsButton = useRef<View>(null), origin = useRef<View | null>(null);
  const c = readerPalettes[prefs.theme === 'system' ? dark ? 'dark' : 'light' : prefs.theme];
  const index = loaded?.chapters.findIndex(ch => ch._id === loaded.chapter._id) ?? -1;
  const previous = loaded?.chapters[index - 1], next = loaded?.chapters[index + 1];
  const prefsKey = `reader.preferences.v2:${user?._id || 'guest'}`;
  useEffect(() => { if (panel !== 'quote') return; let active = true; void api<{ min: number; max: number; visibility: string }>('/quotes/policy').then(value => { if (active) setQuotePolicy(value); }).catch(e => { if (active) setActionError(message(e)); }); return () => { active = false; }; }, [panel]);
  const join = (register = false) => {
    const sameTarget = loaded?.chapter._id === chapterId;
    if (sameTarget) {
      const anchor = location.current.anchor;
      const block = loaded?.chapter.blocks.find(b => b.id === anchor?.id);
      guestResume.set(`${workId}:${chapterId}`, { scrollPosition: 0, ...(anchor ? { anchor: { ...anchor, fraction: anchor.fraction * (block?.anchorScale ?? 1) } } : {}) });
    }
    save();
    joinAtelier({ pathname: '/read/[workId]/[chapterId]', params: { workId, chapterId, mode: sameTarget ? 'preview' : 'start',
      ...(['comments', 'paragraph', 'detached'].includes(panel || '') ? { discussion: panel!, passage: paragraph?.id } : {}) } }, register ? 'register' : 'login');
  };
  useEffect(() => { let active = true; AsyncStorage.getItem(prefsKey).then(value => { if (active) setPrefs(parseReaderPrefs(value)); }).catch(() => { if (active) setNotice('Tercihler alınamadı; varsayılan görünüm açık.'); }).finally(() => { if (active) setPrefsReady(true); }); return () => { active = false; }; }, [prefsKey]);
  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader); void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const a = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader), b = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { a.remove(); b.remove(); };
  }, []);
  useEffect(() => { Animated.timing(fade, { toValue: (hidden || focus) && !screenReader ? 0 : 1, duration: reducedMotion ? 0 : 180, useNativeDriver: true }).start(); }, [hidden, focus, screenReader, reducedMotion, fade]);
  const save = useCallback(() => {
    if (!user || !restored.current || !changed.current || !loaded || loaded.preview) return;
    const snapshot = { storyId: workId, chapterId: loaded.chapter._id, ...location.current, contentVersion: loaded.chapter.contentVersion };
    changed.current = false; lastSave.current = Date.now();
    void trackReading(user._id, snapshot).then(() => setProgressError('')).catch(e => setProgressError(e instanceof ApiError ? 'Konum cihazda saklandı; sunucu eşitlemesi bekliyor.' : 'Konum cihazda saklanamadı. Tekrar dene.'));
  }, [user, loaded, workId]);
  useEffect(() => { const sub = AppState.addEventListener('change', state => { if (state !== 'active') save(); }); return () => { sub.remove(); if (timer.current) clearTimeout(timer.current); save(); }; }, [save]);
  const load = useCallback(async () => {
    const request = ++generation.current; setLoading(true); setError(null);
    try {
      const [work, listing, response, local] = await Promise.all([
        api<{ item: Work }>(`/public/works/${workId}`), api<{ items: Chapter[] }>(`/public/works/${workId}/chapters?reader=1`),
        api<{ item: ReadingChapter; preview?: boolean }>(accountId ? `/public/works/${workId}/chapters/${chapterId}` : `/public/works/${workId}/preview`),
        accountId && mode === 'resume' ? readPosition(accountId, workId).catch(() => null) : Promise.resolve(null),
      ]);
      let saved: ReadingPosition | null = local;
      if (accountId && mode === 'resume') {
        try { const remote = await api<{ found: boolean; chapterId: string; scrollPosition: number; updatedAt: string; savedAt?: number }>(`/reading-progress/${workId}`);
          const remoteStamp = remote.savedAt || Date.parse(remote.updatedAt);
          if (remote.found && (!local || remoteStamp > local.savedAt)) saved = { storyId: workId, ...remote, savedAt: remoteStamp };
        } catch { /* Local progress remains available offline. */ }
      }
      if (request !== generation.current) return;
      if (!Array.isArray(response.item.blocks)) throw new Error('Okuma servisi güncellenmeli. Lütfen daha sonra tekrar dene.');
      if (mode === 'resume' && saved && saved.chapterId !== chapterId && listing.items.some(ch => ch._id === saved!.chapterId)) {
        router.replace({ pathname: '/read/[workId]/[chapterId]', params: { workId, chapterId: saved.chapterId, mode: 'resume' } }); return;
      }
      const initial = { ...(mode === 'preview' ? guestResume.get(`${workId}:${chapterId}`) || { scrollPosition: 0 } : resumeLocation(mode, response.item._id, saved)) };
      if (mode === 'preview' && accountId) guestResume.delete(`${workId}:${chapterId}`);
      if (saved?.contentVersion && saved.contentVersion !== response.item.contentVersion) delete initial.anchor;
      location.current = initial; setPercent(initial.scrollPosition);
      setLoaded({ chapter: response.item, work: work.item, chapters: listing.items, preview: !!response.preview, initial });
      if (!accountId && response.item._id !== chapterId) setNotice('Hedef bölüm için giriş yapabilirsin. Şu an eserin izin verilen önizlemesi açık.');
    } catch (e) { if (request === generation.current) setError(e); }
    finally { if (request === generation.current) setLoading(false); }
  }, [workId, chapterId, mode, accountId]);
  useEffect(() => { const requests = generation; void load(); return () => { requests.current++; }; }, [load]);
  const refreshComments = useCallback(() => {
    if (!loaded) return;
    const request = generation.current, summary = ++summaryRequest.current;
    void api<{ counts: Record<number, number>; detachedCount: number }>(`/inline-comments?chapterId=${loaded.chapter._id}&summary=1&contentVersion=${loaded.chapter.contentVersion}`).then(r => { if (request === generation.current) { setCounts(r.counts); setDetachedCount(r.detachedCount); } }).catch(e => { if (request === generation.current && e instanceof ApiError && e.status === 409) { setCounts({}); setNotice('Yeni bir sürüm yayınlandı. Menüden kontrol ederek geçebilirsin.'); } });
    void api<{ total: number }>(`/comments/chapter/${loaded.chapter._id}?summary=1`).then(r => { if (request === generation.current && summary === summaryRequest.current) setCommentTotal(r.total); }).catch(() => {});
  }, [loaded]);
  useEffect(() => { refreshComments(); if (!loaded) return;
    let active = true;
    const request = ++likeRequest.current;
    setLike(undefined);
    void api<{ liked: boolean; likeCount: number }>(`/chapters/${loaded.chapter._id}/like/check`).then(r => { if (active && request === likeRequest.current) setLike(r); }).catch(() => { if (active && request === likeRequest.current) setNotice('Beğeni durumu alınamadı; menüden yeniden yükleyebilirsin.'); });
    if (accountId) void api<{ inLibrary: boolean }>(`/library/check/${workId}`).then(r => { if (active) setLibrary(r.inLibrary); }).catch(() => {});
    return () => { active = false; };
  }, [loaded, accountId, workId, refreshComments]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refreshComments(); });
    return () => sub.remove();
  }, [refreshComments]);
  const close = () => { if (commentBack.current?.()) return; setPanel(null); setActionError(''); requestAnimationFrame(() => focusReaderControl(origin.current)); };
  const open = (p: Panel, control?: View | null) => { save(); origin.current = control || menuButton.current; setHidden(false); setActionError(''); setPanel(p); };
  useEffect(() => {
    if (!loaded || discussionOpened.current || !['comments', 'paragraph', 'detached'].includes(discussion || '')) return;
    discussionOpened.current = true;
    const block = loaded.chapter.blocks.find(b => b.id === passage);
    setParagraph(block); setPanel(discussion === 'paragraph' && !block ? 'detached' : discussion as Panel);
    origin.current = commentsButton.current;
  }, [loaded, discussion, passage]);
  const back = () => { save(); if (router.canGoBack()) router.back(); else router.replace(`/work/${workId}`); };
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { if (Keyboard.isVisible()) { Keyboard.dismiss(); return true; } if (panel) { close(); return true; } if (focus) { setFocus(false); setHidden(false); return true; } back(); return true; }); return () => sub.remove(); });
  const act = async (fn: () => Promise<void>) => { if (running.current) return; running.current = true; setBusy(true); setActionError(''); try { await fn(); } catch (e) { setActionError(message(e)); } finally { running.current = false; setBusy(false); } };
  const changePrefs = (value: ReaderPrefs) => { setPrefs(value); void AsyncStorage.setItem(prefsKey, JSON.stringify(value)).catch(() => setNotice('Tercih cihazda saklanamadı. Tekrar seçebilirsin.')); };
  const go = (id: string) => { save(); close(); router.replace({ pathname: '/read/[workId]/[chapterId]', params: { workId, chapterId: id, mode: 'start', entry: String(Date.now()) } }); };
  const checkVersion = () => void act(async () => {
    if (!loaded || loaded.preview) return;
    const response = await api<{ item: ReadingChapter }>(`/public/works/${workId}/chapters/${loaded.chapter._id}`);
    if (response.item.contentVersion === loaded.chapter.contentVersion && response.item.title === loaded.chapter.title) { setActionError('Son yayınlanmış sürümü okuyorsun.'); return; }
    Alert.alert('Yeni sürüm yayınlandı', 'Metni şimdi güncellemek ister misin? Okuma konumun mümkün olduğunca korunacak.', [{ text: 'Okumayı sürdür', style: 'cancel' }, { text: 'Yeni sürüme geç', onPress: () => { save(); restored.current = false; changed.current = false; setCounts({}); setLoaded({ ...loaded, chapter: response.item, initial: { ...location.current } }); close(); } }]);
  });
  const comments = () => open('comments', commentsButton.current);
  const onMessage = (data: ReaderMessage) => {
    if (data.ready) { restored.current = true; changed.current = true; save(); }
    if (data.selection !== undefined) { setSelection(data.selection); if (data.selection) setHidden(false); }
    if (data.position && restored.current) {
      location.current = data.position; changed.current = true; setPercent(data.position.scrollPosition);
      if (!screenReader && !focus && !selection) { if ((data.direction || 0) > 3) setHidden(true); else if ((data.direction || 0) < -3) setHidden(false); }
      if (Date.now() - lastSave.current >= 5000) save();
      if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(save, 1000);
    }
    if (data.paragraph !== undefined) { const block = loaded?.chapter.blocks.find(b => b.index === data.paragraph); if (block) { setParagraph(block); open('paragraph', commentsButton.current); } }
    if (data.action === 'next' && next) go(next._id);
    if (data.action === 'previous' && previous) go(previous._id);
    if (data.action === 'info') { save(); router.push(`/work/${workId}`); }
    if (data.action === 'author' && loaded?.work.author?._id) { save(); router.push(`/profile/${loaded.work.author._id}`); }
    if (data.action === 'comments') comments();
    if (data.action === 'login' || data.action === 'register') join(data.action === 'register');
    if (data.action === 'quote') { if (!user) join(); else { setQuote(data.selection || selection); open('quote', commentsButton.current); } }
    if (data.action === 'like') { if (!user) join(); else void act(async () => { const request = generation.current, revision = ++likeRequest.current; const id = loaded!.chapter._id;
      const current = like || await api<{ liked: boolean; likeCount: number }>(`/chapters/${id}/like/check`);
      if (request !== generation.current) return;
      setLike(current);
      const result = await api<{ liked: boolean; likeCount: number }>(`/chapters/${id}/like`, 'POST', { liked: !current.liked });
      if (request === generation.current && revision === likeRequest.current) setLike({ ...result, likeCount: Math.max(0, result.likeCount) });
    }); }
  };
  const button = (title: string, onPress: () => void, primary = false, disabled = false) => <ReaderButton palette={c} title={title} onPress={onPress} primary={primary} disabled={disabled || busy}/>;
  const text = { color: c.ink, fontFamily: fonts.body, fontSize: 16, lineHeight: 25 };
  const toolsHidden = (hidden || focus) && !screenReader;
  return <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }} edges={['top', 'bottom']}>
    <StatusBar style={c === readerPalettes.dark ? 'light' : 'dark'}/>
    <View style={{ borderBottomWidth: 1, borderColor: c.line, minHeight: 60 }}>
      <Animated.View pointerEvents={toolsHidden ? 'none' : 'auto'} accessibilityElementsHidden={toolsHidden} importantForAccessibility={toolsHidden ? 'no-hide-descendants' : 'auto'} style={{ opacity: fade, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Geri dön" onPress={back} style={{ minWidth: 48, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="arrow-back" size={22} color={c.ink}/></Pressable>
        <View style={{ flex: 1, paddingVertical: 8 }}><Text style={{ color: c.ink, fontFamily: fonts.medium, fontSize: 14 }}>{loaded?.work.title || 'Okuma'}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{loaded?.preview ? 'Misafir önizlemesi' : index >= 0 ? `Bölüm ${index + 1}` : 'Bölüm'}</Text></View>
        <Pressable ref={settingsButton} accessibilityRole="button" accessibilityLabel="Okuma ayarları" onPress={() => open('settings', settingsButton.current)} style={{ minWidth: 48, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.ink, fontFamily: fonts.reading, fontSize: 23 }}>Aa</Text></Pressable>
        <Pressable ref={menuButton} accessibilityRole="button" accessibilityLabel="Okuma menüsü" onPress={() => open('menu', menuButton.current)} style={{ minWidth: 48, minHeight: 52, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="ellipsis-horizontal" size={23} color={c.ink}/></Pressable>
      </Animated.View>
      {toolsHidden && <Pressable accessibilityRole="button" accessibilityLabel={focus ? 'Odak görünümünden çık' : 'Okuma araçlarını göster'} onPress={() => { setFocus(false); setHidden(false); }} style={{ position: 'absolute', right: 12, top: 4, minHeight: 48, padding: 12, justifyContent: 'center' }}><Text style={{ color: c.accent }}>{focus ? 'Odaktan çık' : 'Araçları göster'}</Text></Pressable>}
    </View>
    {loading && !loaded && <Text style={[text, { padding: 24 }]}>Bölüm hazırlanıyor…</Text>}
    {!!error && <View style={{ padding: 22, gap: 14 }}><Text style={text}>{error instanceof ApiError && error.status === 404 ? 'Bu bölüm kaldırılmış veya artık erişilemiyor. Eserden başka bir bölüm seçebilirsin.' : message(error)}</Text>{button('Tekrar dene', () => void load())}{button('Eserin bölümlerine dön', () => router.replace(`/work/${workId}`))}{error instanceof ApiError && error.status === 428 && button('Hassas içerik uyarısını kabul et', () => void act(async () => { await api(`/public/works/${workId}/mature-acknowledgement`, 'POST', {}); await load(); }))}</View>}
    {loaded && prefsReady && <ReaderSurface key={loaded.chapter.contentVersion + loaded.chapter.title} data={{ title: loaded.chapter.title, author: loaded.work.author?.kullaniciAdi || loaded.work.author?.username || 'Anonim yazar', media: loaded.chapter.media, authorLink: !!loaded.work.author?._id, number: loaded.preview ? 'MİSAFİR ÖNİZLEMESİ' : `BÖLÜM ${index + 1}`, blocks: loaded.chapter.blocks, preview: loaded.preview, previous: !!previous, next: !!next }} prefs={prefs} palette={c} location={loaded.initial} counts={counts} like={like} commentTotal={commentTotal} likeBusy={busy} onMessage={onMessage}/>}
    <Animated.View pointerEvents={toolsHidden ? 'none' : 'auto'} accessibilityElementsHidden={toolsHidden} importantForAccessibility={toolsHidden ? 'no-hide-descendants' : 'auto'} style={{ opacity: fade, minHeight: 56, borderTopWidth: 1, borderColor: c.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', gap: 4, paddingHorizontal: 8 }}>
      <Pressable ref={tocButton} accessibilityRole="button" accessibilityLabel="Bölümler" onPress={() => open('toc', tocButton.current)} style={{ minHeight: 48, padding: 10, justifyContent: 'center' }}><Text style={{ color: c.accent }}>Bölümler</Text></Pressable>
      {selection ? <Pressable accessibilityRole="button" accessibilityLabel="Seçilen metni alıntılarıma ekle" onPress={() => onMessage({ action: 'quote' })} style={{ minHeight: 48, flex: 1, justifyContent: 'center' }}><Text style={{ color: c.accent, textAlign: 'center' }}>Alıntılarıma ekle</Text></Pressable> : <Text accessibilityLabel={`Bölüm içindeki konum yüzde ${Math.round(percent)}`} style={{ color: c.muted, fontSize: 12, flex: 1, textAlign: 'center' }}>Bölüm içi %{Math.round(percent)}</Text>}
      <Pressable ref={commentsButton} accessibilityRole="button" accessibilityLabel="Bölüm yorumları" onPress={comments} style={{ minHeight: 48, padding: 10, justifyContent: 'center' }}><Text style={{ color: c.accent }}>Yorumlar{commentTotal !== undefined ? ` (${commentTotal})` : ''}</Text></Pressable>
    </Animated.View>
    {!!(notice || progressError || (!panel && actionError)) && <View style={{ position: 'absolute', bottom: 68, left: 22, right: 22, padding: 12, borderRadius: 12, backgroundColor: c.soft }}><Text accessibilityLiveRegion="polite" style={{ color: c.ink }}>{notice || progressError || actionError}</Text><ReaderButton title="Kapat" palette={c} onPress={() => { setNotice(''); setProgressError(''); setActionError(''); }}/></View>}
    {panel && <ReaderSheet title={{ settings: 'Okuma ayarları', menu: 'Okuma menüsü', toc: 'Bölümler', comments: 'Bölüm yorumları', paragraph: 'Paragraf yorumları', passages: 'Bir pasaj seç', detached: 'Önceki sürümdeki paragraf yorumları', quote: 'Alıntılarıma ekle', preface: 'Önsöz' }[panel]} palette={c} close={close} reducedMotion={reducedMotion} virtualized={['comments', 'paragraph', 'detached'].includes(panel)}>
      {panel === 'settings' && <><Text style={text}>Yazı boyutu · {prefs.size}</Text><View style={{ flexDirection: 'row', gap: 12 }}>{button('A−', () => changePrefs({ ...prefs, size: prefs.size - 1 }), false, prefs.size <= 14)}{button('A+', () => changePrefs({ ...prefs, size: prefs.size + 1 }), false, prefs.size >= 34)}</View><Text style={text}>Satır aralığı</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[1.5, 1.7, 1.9, 2.1].map(spacing => <ReaderButton key={spacing} title={String(spacing)} palette={c} selected={prefs.spacing === spacing} onPress={() => changePrefs({ ...prefs, spacing })}/>)}</View><View style={{ flexDirection: 'row', gap: 8 }}>{[true, false].map(serif => <ReaderButton key={String(serif)} title={serif ? 'Serif' : 'Sans serif'} palette={c} selected={prefs.serif === serif} onPress={() => changePrefs({ ...prefs, serif })}/>)}</View><Text style={text}>Okuma teması</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(['light', 'sepia', 'dark', 'system'] as const).map(theme => <ReaderButton key={theme} palette={c} title={{ light: 'Açık', sepia: 'Sepya', dark: 'Koyu', system: 'Uygulamayı izle' }[theme]} selected={prefs.theme === theme} onPress={() => changePrefs({ ...prefs, theme })}/>)}</View>{button(prefs.markers ? 'Paragraf yorum işaretlerini gizle' : 'Paragraf yorum işaretlerini göster', () => changePrefs({ ...prefs, markers: !prefs.markers }))}{button('Varsayılana dön', () => changePrefs(defaultReaderPrefs))}</>}
      {panel === 'menu' && <>{button('Yeni sürümü kontrol et', checkVersion, false, !loaded || loaded.preview)}{button(focus ? 'Odak görünümünden çık' : 'Odak görünümü', () => { setFocus(!focus); close(); })}{button('Eser bilgisi', () => { close(); save(); router.push(`/work/${workId}`); })}{button('Başlangıçtan oku', () => loaded?.chapters[0] && go(loaded.chapters[0]._id), false, !loaded)}{button('Paragraf yorumları', () => open('passages'))}{button(`Eski pasaj yorumları (${detachedCount})`, () => open('detached'))}{button(library ? 'Kütüphanemden çıkar' : 'Kütüphaneme ekle', () => !user ? join() : void act(async () => { const state = library ?? (await api<{ inLibrary: boolean }>(`/library/check/${workId}`)).inLibrary; await api(state ? `/library/${workId}` : '/library', state ? 'DELETE' : 'POST', { workId }); setLibrary(!state); }))}{button('Okuma listesine ekle', () => { if (!user) join(); else { close(); router.push({ pathname: '/lists', params: { workId } }); } })}{button('Alıntı ekle', () => { if (!user) join(); else { setQuote(selection); open('quote'); } })}{button('Beğeni durumunu yenile', () => void act(async () => { setLike(await api(`/chapters/${loaded?.chapter._id}/like/check`)); }), false, !loaded)}{button('Bölümü şikâyet et', () => { if (!user) join(); else { close(); router.push({ pathname: '/report', params: { targetType: 'chapter', targetId: loaded?.chapter._id || chapterId } }); } })}</>}
      {panel === 'toc' && loaded && <ReaderContents chapters={loaded.chapters} activeId={loaded.chapter._id} palette={c} select={go} preface={!!loaded.work.preface} openPreface={() => open('preface')}/>}
      {panel === 'preface' && <Text selectable style={text}>{loaded?.work.preface}</Text>}
      {panel === 'passages' && loaded?.chapter.blocks.filter(b => b.text).map(b => <View key={`${b.id}:${b.index}`} style={{ gap: 8 }}><Text style={text}>{b.text.slice(0, 160)}{b.text.length > 160 ? '…' : ''}</Text>{button(`${counts[b.index] || 0} yorum · Pasajı aç`, () => { setParagraph(b); open('paragraph'); })}</View>)}
      {['comments', 'paragraph', 'detached'].includes(panel) && loaded && <ReaderComments key={`${panel}:${paragraph?.id || ''}`} workId={workId} chapterId={loaded.chapter._id} userId={user?._id} palette={c} block={panel === 'paragraph' ? paragraph : undefined} detached={panel === 'detached'} version={loaded.chapter.contentVersion} workTitle={loaded.work.title} chapterTitle={loaded.chapter.title} onChanged={refreshComments} onTotal={acceptTotal} onLogin={() => join()} backHandler={commentBack} onProfile={id => { save(); setPanel(null); router.push(`/profile/${id}`); }}/ >}
      {panel === 'quote' && loaded && <><Text style={text}>{loaded.work.title} · {loaded.work.author?.kullaniciAdi || loaded.work.author?.username || 'Anonim yazar'}</Text><Text style={{ color: c.muted }}>Bu alıntı profilinde herkese açık görünür. Metni seçerek aktarabilir veya kopyalayıp buraya yapıştırabilirsin.</Text><ReaderField label={quotePolicy ? `Alıntı · ${quotePolicy.min}–${quotePolicy.max} karakter` : "Alıntı sınırları yükleniyor…"} palette={c} value={quote} onChangeText={setQuote}/><Text style={{ color: c.muted }}>{quote.trim().length} / {quotePolicy?.max ?? "…"} · Metin otomatik kısaltılmaz.</Text>{button('Alıntıyı kaydet', () => void act(async () => { await api('/quotes', 'POST', { workId, text: quote, workTitle: loaded.work.title, authorName: loaded.work.author?.kullaniciAdi || loaded.work.author?.username || 'Anonim yazar', genre: loaded.work.genres?.[0] || loaded.work.universe?.genres?.[0] }); setNotice('Alıntın profiline kaydedildi.'); setQuote(''); close(); }), true, !quotePolicy || quote.trim().length < quotePolicy.min || quote.trim().length > quotePolicy.max)}</>}
      {!!actionError && <Text accessibilityRole="alert" style={text}>{actionError}</Text>}
    </ReaderSheet>}
  </SafeAreaView>;
}
function ReaderContents({ chapters, activeId, palette, select, preface, openPreface }: { chapters: Chapter[]; activeId: string; palette: typeof readerPalettes.light; select: (id: string) => void; preface: boolean; openPreface: () => void }) {
  const scroll = useRef<ScrollView>(null), activeY = useRef(0);
  return <ScrollView ref={scroll} nestedScrollEnabled style={{ maxHeight: 460 }} onContentSizeChange={() => scroll.current?.scrollTo({ y: Math.max(0, activeY.current - 80), animated: false })} contentContainerStyle={{ gap: 10 }}>
    {preface && <ReaderButton title="Önsöz" palette={palette} onPress={openPreface}/>}
    {chapters.map((ch, i) => <View key={ch._id} onLayout={event => { if (ch._id === activeId) { activeY.current = event.nativeEvent.layout.y; scroll.current?.scrollTo({ y: Math.max(0, activeY.current - 80), animated: false }); } }}><ReaderButton title={`${i + 1}. ${ch.title}${ch._id === activeId ? ' · Okuyorsun' : ''}`} selected={ch._id === activeId} palette={palette} onPress={() => select(ch._id)}/></View>)}
  </ScrollView>;
}
export default function Reader() {
  const { workId, chapterId, mode, entry, discussion, passage } = useLocalSearchParams<{ workId: string; chapterId: string; mode?: string; entry?: string; discussion?: string; passage?: string }>(); const { user } = useSession();
  return <ReaderContent key={`${user?._id || 'guest'}:${workId}:${chapterId}:${mode}:${entry}`} workId={workId} chapterId={chapterId} mode={mode} discussion={discussion} passage={passage}/>;
}
