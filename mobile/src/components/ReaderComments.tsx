import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Image, Keyboard, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError, message } from '../api';
import type { Comment } from '../types';
import type { ReaderBlock, ReaderPalette } from '../readerModel';
import { focusReaderControl, ReaderButton, ReaderField } from './ReaderControls';

type Inline = Comment & { paragraphText?: string; attached?: boolean; previousPassage?: boolean };
type Drafts = { root: string; replies: Record<string, string>; edit?: { id: string; original: string; text: string } };
type Listing = { items: Inline[]; total: number; page: number; pages: number };
type Props = {
  chapterId: string; workId: string; userId?: string; block?: ReaderBlock; detached?: boolean;
  version: string; palette: ReaderPalette; workTitle: string; chapterTitle: string;
  onChanged: () => void; onTotal: (total: number) => void; onLogin: () => void;
  onProfile: (id: string) => void; backHandler: React.MutableRefObject<(() => boolean) | null>;
};
const emptyDrafts = (): Drafts => ({ root: '', replies: {} });
const unique = (items: Inline[]) => [...new Map(items.map(item => [item._id, item])).values()];

export function ReaderComments({ chapterId, workId, userId, block, detached, version, palette: c, workTitle, chapterTitle, onChanged, onTotal, onLogin, onProfile, backHandler }: Props) {
  const inline = !!block || !!detached, limit = inline ? 1000 : 2000;
  const [items, setItems] = useState<Inline[]>([]), [total, setTotal] = useState<number>(), [page, setPage] = useState(0), [pages, setPages] = useState(1);
  const [drafts, setDrafts] = useState<Drafts>(emptyDrafts), [draftReady, setDraftReady] = useState(false);
  const [reply, setReply] = useState<{ id: string; name: string }>(), [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}), [menu, setMenu] = useState<Inline>(), [confirm, setConfirm] = useState<Inline>(), [report, setReport] = useState<Inline>();
  const [expandedPassages, setExpandedPassages] = useState<Record<string, boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({}), [reason, setReason] = useState(''), [description, setDescription] = useState('');
  const [error, setError] = useState(''), [authError, setAuthError] = useState(false), [loadError, setLoadError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const running = useRef(false), fetching = useRef(false), generation = useRef(0), alive = useRef(true), draftTouched = useRef(false), draftWrites = useRef(Promise.resolve());
  const dialogHeading = useRef<Text>(null);
  const draftKey = `reader.comment.draft.v1:${userId || 'guest'}:${workId}:${chapterId}:${inline ? detached ? 'old' : `${block!.id}:${block!.index}:${version}` : 'chapter'}`;
  const endpoint = inline ? `/inline-comments?chapterId=${chapterId}&paragraphIndex=${detached ? -1 : block!.index}&contentVersion=${version}` : `/comments/chapter/${chapterId}?limit=20`;
  const edit = drafts.edit, text = edit ? edit.text : reply ? drafts.replies[reply.id] || '' : drafts.root;
  const setText = (value: string) => { draftTouched.current = true; setDrafts(d => d.edit ? { ...d, edit: { ...d.edit, text: value } } : reply ? { ...d, replies: { ...d.replies, [reply.id]: value } } : { ...d, root: value }); };
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(draftKey).then(value => {
      if (active && !draftTouched.current && value) {
        const d = JSON.parse(value);
        if (typeof d.root === 'string' && d.replies && typeof d.replies === 'object') setDrafts(d);
      }
    }).catch(() => { if (active) setNotice('Yerel yorum taslağı alınamadı.'); }).finally(() => { if (active) setDraftReady(true); });
    return () => { active = false; };
  }, [draftKey]);
  useEffect(() => {
    if (!draftReady || !userId) return;
    // Ordered writes prevent an older keystroke from restoring a sent draft.
    draftWrites.current = draftWrites.current.catch(() => {}).then(() => {
      if (!drafts.root && !drafts.edit && !Object.values(drafts.replies).some(Boolean)) return AsyncStorage.removeItem(draftKey);
      return AsyncStorage.setItem(draftKey, JSON.stringify(drafts));
    }).catch(() => { if (alive.current) setNotice('Taslak cihazda saklanamadı.'); });
  }, [draftKey, draftReady, drafts, userId]);

  const load = useCallback(async (target = 1, append = false) => {
    if (fetching.current || running.current) return;
    fetching.current = true; const request = ++generation.current; setLoading(true); setLoadError('');
    try {
      const result = await api<Listing>(`${endpoint}&page=${target}`);
      if (!alive.current || request !== generation.current) return;
      setItems(previous => unique(append ? [...previous, ...result.items] : result.items));
      setPage(target); setPages(result.pages || 0); setTotal(result.total);
      if (!inline) onTotal(result.total);
    } catch (e) { if (alive.current && request === generation.current) setLoadError(message(e)); }
    finally { fetching.current = false; if (alive.current && request === generation.current) setLoading(false); }
  }, [endpoint, inline, onTotal]);
  useEffect(() => { const requests = generation; alive.current = true; void load(); return () => { alive.current = false; requests.current++; }; }, [load]);

  useEffect(() => {
    if (!menu && !confirm && !report) return;
    focusReaderControl(dialogHeading.current);
  }, [menu, confirm, report]);
  backHandler.current = () => {
    if (Keyboard.isVisible()) { Keyboard.dismiss(); return true; }
    if (running.current) { setNotice('İşlem tamamlanıyor…'); return true; }
    if (confirm) { setConfirm(undefined); return true; }
    if (report) { setReport(undefined); return true; }
    if (menu) { setMenu(undefined); return true; }
    // Edits and unsent text persist; closing never implicitly cancels them.
    return false;
  };
  useEffect(() => () => { backHandler.current = null; }, [backHandler]);

  const act = async (fn: () => Promise<void>, refresh = false) => {
    if (!userId) { onLogin(); return; }
    if (running.current || fetching.current) return;
    running.current = true; setBusy(true); setError(''); setAuthError(false); setNotice('');
    try { await fn(); if (alive.current && refresh) { running.current = false; await load(); onChanged(); } }
    catch (e) { if (alive.current) { setError(message(e)); if (e instanceof ApiError && e.status === 401) { setAuthError(true); setNotice('Oturumun sona erdi. Yeniden giriş yapabilirsin.'); } } }
    finally { running.current = false; if (alive.current) setBusy(false); }
  };
  const button = (title: string, onPress: () => void, disabled = false) => <ReaderButton title={title} palette={c} onPress={onPress} disabled={busy || loading || disabled}/>;
  const cancel = () => {
    if (edit) { setDrafts(d => ({ ...d, edit: undefined })); return; }
    if (reply) {
      if (text) Alert.alert('Yanıt taslağı silinsin mi?', 'Gönderilmemiş yanıtın temizlenecek.', [{ text: 'Yazmaya devam et', style: 'cancel' }, { text: 'Taslağı sil', style: 'destructive', onPress: () => { setDrafts(d => ({ ...d, replies: { ...d.replies, [reply.id]: '' } })); setReply(undefined); } }]);
      else setReply(undefined);
      return;
    }
    if (text) Alert.alert('Yorum taslağı silinsin mi?', 'Gönderilmemiş metnin temizlenecek.', [{ text: 'Yazmaya devam et', style: 'cancel' }, { text: 'Taslağı sil', style: 'destructive', onPress: () => { setText(''); setFocused(false); Keyboard.dismiss(); } }]);
    else { setFocused(false); Keyboard.dismiss(); }
  };
  const send = () => void act(async () => {
    const path = edit ? `/${inline ? 'inline-comments' : 'comments'}/${edit.id}` : inline ? '/inline-comments' : `/comments/chapter/${chapterId}`;
    const result = await api<{ item: Inline }>(path, edit ? 'PATCH' : 'POST', { content: text.trim(), workId, chapterId,
      ...(!edit && reply ? { parentId: reply.id } : {}),
      ...(block && !edit ? { paragraphIndex: block.index, blockId: block.id, contentVersion: version } : {}) });
    if (!alive.current) return;
    const published = !result.item.status || result.item.status === 'published';
    if (published) setItems(previous => edit ? previous.map(item => item._id === edit.id ? { ...item, ...result.item, replies: item.replies } : { ...item, replies: item.replies?.map(child => child._id === edit.id ? { ...child, ...result.item } : child) })
      : reply ? previous.map(item => item._id === reply.id ? { ...item, replies: unique([...(item.replies || []), result.item]) } : item)
      : unique(inline ? [...previous, result.item] : [result.item, ...previous]));
    if (published && !edit && !reply) setTotal(previous => (previous || 0) + 1);
    const sentReply = reply;
    setDrafts(d => edit ? { ...d, edit: undefined } : sentReply ? { ...d, replies: { ...d.replies, [sentReply.id]: '' } } : { ...d, root: '' });
    if (sentReply) setExpanded(v => ({ ...v, [sentReply.id]: true }));
    setReply(undefined); setFocused(false); Keyboard.dismiss(); setNotice(published ? 'Yorumun kaydedildi.' : 'Yorumun inceleme için alındı.'); onChanged();
  });
  const toggleLike = (item: Inline) => void act(async () => {
    const result = await api<{ liked: boolean; likeCount: number }>(`/comments/${item._id}/like`, 'POST', { liked: !item.isLiked });
    if (!alive.current) return;
    const update = (i: Inline): Inline => i._id === item._id ? { ...i, isLiked: result.liked, likeCount: Math.max(0, result.likeCount) } : { ...i, replies: i.replies?.map(update) };
    setItems(previous => previous.map(update));
  });
  const openReport = (item: Inline) => {
    if (!userId) { onLogin(); return; }
    setMenu(undefined); setReport(item); setReason(''); setDescription(''); setError('');
    void api<{ reasons: Record<string, string> }>('/reports/reasons').then(r => {
      if (alive.current) setReasons(Object.fromEntries(Object.entries(r.reasons).filter(([key]) => key !== 'telif_ihlali')));
    }).catch(e => { if (alive.current) setError(message(e)); });
  };
  const dialog = menu || confirm || report;
  if (dialog) return <View accessibilityViewIsModal style={{ flex: 1, gap: 12 }}>
    <Text ref={dialogHeading} accessibilityRole="header" style={{ color: c.ink, fontSize: 20 }}>{confirm ? 'Bu yorumu silmek istediğine emin misin?' : report ? 'Yorumu şikâyet et' : 'Yorum menüsü'}</Text>
    <Text numberOfLines={3} style={{ color: c.muted }}>{dialog.content?.slice(0, 160)}</Text>
    {menu && (menu.author?._id === userId ? <>{button('Düzenle', () => { setDrafts(d => ({ ...d, edit: { id: menu._id, original: menu.content, text: menu.content } })); setReply(undefined); setMenu(undefined); setFocused(true); })}{button('Sil', () => { setConfirm(menu); setMenu(undefined); })}</> : button('Şikâyet et', () => openReport(menu)))}
    {confirm && <>{!!confirm.replies?.length && <Text style={{ color: c.ink }}>Yanıtlar korunacak, yorumun kaldırıldığı bilgisi görünecek.</Text>}{button('Sil', () => void act(async () => { await api(`/${inline ? 'inline-comments' : 'comments'}/${confirm._id}`, 'DELETE'); if (alive.current) { setConfirm(undefined); setDrafts(d => d.edit?.id === confirm._id ? { ...d, edit: undefined } : d); } }, true))}</>}
    {report && <FlatList data={Object.entries(reasons)} keyExtractor={item => item[0]} keyboardShouldPersistTaps="handled" renderItem={({ item: [key, label] }) => <ReaderButton palette={c} title={label} selected={reason === key} onPress={() => setReason(key)} disabled={busy}/>} ListHeaderComponent={<ReaderField compact={!!block} palette={c} label="Açıklama (isteğe bağlı, en fazla 500 karakter)" value={description} onChangeText={setDescription}/>} ListFooterComponent={<>{!Object.keys(reasons).length && button('Nedenleri tekrar yükle', () => openReport(report))}<ReaderButton palette={c} primary title={busy ? 'Gönderiliyor…' : 'Şikâyeti gönder'} disabled={busy || !reason || description.trim().length > 500} onPress={() => void act(async () => { await api('/reports', 'POST', { targetType: 'comment', targetId: report._id, reason, description: description.trim() }); if (alive.current) { setReport(undefined); setNotice('Şikâyetin incelemeye alındı.'); } })}/></>}/>}
    {!!error && <Text accessibilityRole="alert" style={{ color: c.ink }}>{error}</Text>}
    {button('Vazgeç', () => { setMenu(undefined); setConfirm(undefined); setReport(undefined); setError(''); })}
  </View>;

  const rows: { item: Inline; root: Inline; nested: boolean }[] = items.flatMap(item => [{ item, root: item, nested: false }, ...(expanded[item._id] ? (item.replies || []).map(child => ({ item: child, root: item, nested: true })) : [])]);
  const composer = <View style={{ borderTopWidth: 1, borderColor: c.line, paddingTop: block ? 8 : 10, gap: 8 }}>
    {!userId ? button('Yorum yapmak için giriş yap', onLogin) : (!detached || edit) && <>
      {reply && <Text style={{ color: c.ink }}>@{reply.name} kullanıcısına yanıt</Text>}
      {reply && button('Yanıtı kapat · taslağı koru', () => setReply(undefined))}
      {(focused || text || edit || reply) ? <><ReaderField key={edit?.id || reply?.id || 'root'} compact={!!block} autoFocus={focused} palette={c} editable={!busy && draftReady} label={edit ? 'Yorumunu düzenle' : block ? 'Bu paragraf hakkında düşüncelerini yaz…' : 'Bu bölüm hakkında düşüncelerini yaz…'} value={text} onChangeText={setText} onFocus={() => setFocused(true)}/>
        {text.length >= limit - 200 && <Text accessibilityLiveRegion="polite" style={{ color: c.ink }}>{text.length} / {limit}{text.length > limit ? ` · En fazla ${limit} karakter yazabilirsin.` : ''}</Text>}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>{button('Vazgeç', cancel)}<ReaderButton primary palette={c} title={busy ? 'Gönderiliyor…' : edit ? 'Değişikliği kaydet' : 'Gönder'} disabled={busy || loading || !draftReady || !text.trim() || text.length > limit || (!!edit && text.trim() === edit.original.trim())} onPress={send}/></View>
      </> : button(block ? 'Bu paragrafa yorum yaz…' : 'Bu bölüm hakkında düşüncelerini yaz…', () => setFocused(true))}
    </>}
  </View>;
  const paragraphContext = block && <View style={{ gap: 7, paddingBottom: 7 }}>
    <View style={{ backgroundColor: c.soft, borderLeftWidth: 3, borderColor: c.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
      <Text numberOfLines={2} selectable style={{ color: c.ink, lineHeight: 20 }}>“{block.text.length > 160 ? `${block.text.slice(0, 160)}…` : block.text}”</Text>
    </View>
    {total !== undefined && <Text style={{ color: c.muted }}>{total} yorum</Text>}
  </View>;
  return <View style={{ flex: 1, gap: block ? 7 : 10 }}>
    {!block && <>
      <Text style={{ color: c.ink }}>{workTitle} · {chapterTitle}</Text>
      <Text style={{ color: c.muted }}>{total === undefined ? 'Yorum sayısı yükleniyor…' : `${total} ${inline ? 'yorum' : 'ana yorum'}`}</Text>
    </>}
    {detached && <Text style={{ color: c.muted }}>Önceki sürümdeki paragraf yorumları. Eşleşmesi doğrulanamayan yorumlar güncel metne taşınmaz.</Text>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={{ color: c.ink }}>{notice}</Text>}
    {!!error && <><Text accessibilityRole="alert" style={{ color: c.ink }}>{error}</Text>{authError && button('Yeniden giriş yap', onLogin)}</>}
    <FlatList data={rows} keyExtractor={row => row.item._id} removeClippedSubviews={false} keyboardShouldPersistTaps="handled" refreshing={loading} onRefresh={() => void load()} contentContainerStyle={{ paddingBottom: 12 }}
      ListHeaderComponent={paragraphContext}
      ListEmptyComponent={!loading && !loadError ? <Text style={{ color: c.muted }}>Henüz yorum yok. İlk yorumu sen yaz.</Text> : null}
      ListFooterComponent={<>{loading && <Text style={{ color: c.muted }}>Yorumlar yükleniyor…</Text>}{!!loadError && <><Text accessibilityRole="alert" style={{ color: c.ink }}>Yorumlar yüklenemedi. {loadError}</Text>{button('Tekrar dene', () => void load(page || 1, page > 1))}</>}{page < pages && !loadError && button('Daha fazla yorum', () => void load(page + 1, true))}</>}
      renderItem={({ item: { item, root, nested } }) => <View style={{ gap: 8, paddingVertical: 12, marginLeft: nested ? 18 : 0, borderTopWidth: 1, borderColor: c.line }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.author?.kullaniciAdi || 'Okuyucu'} profili`} disabled={!item.author?._id} onPress={() => item.author && onProfile(item.author._id)} style={{ minHeight: 48, flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {item.author?.avatarUrl ? <Image source={{ uri: item.author.avatarUrl, cache: 'force-cache' }} accessibilityIgnoresInvertColors style={{ width: 36, height: 36, borderRadius: 18 }}/> : <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.soft, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: c.ink }}>{item.author?.kullaniciAdi?.slice(0, 1) || '?'}</Text></View>}
            <View style={{ flexShrink: 1 }}><Text style={{ color: c.ink }}>{item.author?.kullaniciAdi || 'Okuyucu'}</Text><Text style={{ color: c.muted }}>{item.createdAt ? new Date(item.createdAt).toLocaleString('tr-TR') : ''}{item.isEdited || (inline && item.updatedAt !== item.createdAt) ? ' · düzenlendi' : ''}</Text></View>
          </Pressable>
          {!item.isDeleted && <ReaderButton palette={c} title="⋯" accessibilityLabel="Yorum menüsü" disabled={busy || loading} onPress={() => { if (!userId) onLogin(); else if (edit) setNotice('Önce açık düzenlemeyi kaydet veya iptal et.'); else setMenu(item); }}/ >}
        </View>
        {detached && <Text selectable style={{ color: c.muted, fontStyle: 'italic' }}>{item.paragraphText || 'Bu eski yorumun paragrafı doğrulanamıyor.'}</Text>}
        <Text selectable accessibilityLabel={item.isDeleted ? 'Bu yorum kaldırıldı' : undefined} style={{ color: c.ink, fontSize: 17, lineHeight: 27, flexShrink: 1 }}>{item.isDeleted ? '[Bu yorum kaldırıldı]' : item.content}</Text>
        {item.previousPassage && <>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: !!expandedPassages[item._id] }} onPress={() => setExpandedPassages(values => ({ ...values, [item._id]: !values[item._id] }))} style={{ alignSelf: 'flex-start', paddingVertical: 8 }}>
            <Text style={{ color: c.accent }}>Önceki sürüme yazıldı</Text>
          </Pressable>
          {expandedPassages[item._id] && <Text selectable style={{ color: c.muted, fontStyle: 'italic' }}>{item.paragraphText}</Text>}
        </>}
        {!inline && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {!item.isDeleted && <><ReaderButton palette={c} title={`${item.isLiked ? '♥ Beğenildi' : '♡ Beğen'}${item.likeCount ? ` · ${item.likeCount}` : ''}`} accessibilityLabel={item.isLiked ? 'Yorum beğenisini geri al' : 'Yorumu beğen'} selected={item.isLiked} disabled={busy || loading} onPress={() => toggleLike(item)}/>{!root.isDeleted && button('Yanıtla', () => { if (!userId) { onLogin(); return; } if (edit) { setNotice('Önce açık düzenlemeyi kaydet veya iptal et.'); return; } setReply({ id: root._id, name: item.author?.kullaniciAdi || 'Okuyucu' }); setFocused(true); })}</>}
          {!nested && !!item.replies?.length && button(expanded[item._id] ? 'Yanıtları gizle' : `${item.replies.length} yanıtı göster`, () => setExpanded(v => ({ ...v, [item._id]: !v[item._id] })))}
        </View>}
      </View>}/>
    {composer}
  </View>;
}
