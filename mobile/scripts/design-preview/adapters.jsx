import { Alert, Keyboard } from 'react-native';
Keyboard.isVisible ||= () => false;
Alert.alert = (title, message, buttons = []) => { if (window.confirm(title + '\n' + (message || ''))) buttons.find(b => b.style !== 'cancel')?.onPress?.(); };
import React, { useEffect, useState } from 'react';
import { setAccountId } from '../../src/api';
import { DraftEngine, fromChapter } from '../../src/draftEngine';
export { groupDeviceDrafts } from '../../src/studioStorage.ts';
export const user = { _id: 'visual-author', kullaniciAdi: new URLSearchParams(window.location.search).has('long') ? 'uzun_bir_kullanici_adi_12345' : 'deniz_yazar', email: 'deniz@example.test', profileComplete: true, bio: 'Kelimelerin peşinde. Biraz şehir, biraz düş, biraz da yol.', canChooseUsername: false };
setAccountId(user._id);
const incompleteUser = { ...user, kullaniciAdi: 'google_1234567890', profileComplete: false, canChooseUsername: true, authProvider: 'google' };
const works = [
  { _id: 'visual-1', title: 'Şehrin Unuttuğu Sesler', author: { _id: 'visual-author', kullaniciAdi: 'deniz_yazar' }, genres: ['Öykü', 'Dram'], chapterCount: 8, status: 'published', description: 'Bazı sokaklar bir yere çıkmaz. Bazılarıysa insanın yıllardır unuttuğunu sandığı bir kapıyı açar. İstanbul’un arka sokaklarında birbirine değen hayatların hikâyesi.' },
  { _id: 'visual-2', title: 'Bir Başka Gökyüzü', author: { _id: 'other', kullaniciAdi: 'ece_kalem' }, genres: ['Fantastik'], chapterCount: 12, status: 'draft' },
  { _id: 'visual-3', title: 'Kıyıda Kalanlar', author: { _id: 'other2', kullaniciAdi: 'arda_s' }, genres: ['Roman', 'Dram'], chapterCount: 4, status: 'draft' },
];
const chapter = { _id: 'visual-chapter', title: 'Sokağın Sonundaki Işık', content: '<p>Sabah, şehrin henüz kendine gelmediği bir saatte başladı. Pencerenin önünde duran fincandan yükselen buhar, dışarıdaki sisle aynı renkteydi.</p><p>Defterini açtı. Dün yarım bıraktığı cümle hâlâ oradaydı; bitmesini bekleyen bir yol gibi.</p><blockquote>İnsan bazen bir yere varmak için değil, kendi sesini duymak için yürür.</blockquote><p>Sokağın sonundaki ışık yanıyordu. Birinin, bütün gece o masada oturduğunu düşündü. Belki de her hikâye, bir başkasının uykusuzluğuna açılan küçük bir pencereydi.</p>', revision: 2, status: 'draft' };
const feed = [
  { _id: 'log-1', type: 'log', author: { _id: 'other', kullaniciAdi: 'ece_kalem' }, createdAt: new Date().toISOString(), content: 'Bugün bir karakterimin sesini ilk kez gerçekten duydum. Bazen hikâyeyi ilerletmek için yazmayı bırakıp biraz dinlemek gerekiyormuş.', likeCount: 12, likedByMe: false, relatedWork: works[1] },
  { _id: 'chapter-2', type: 'chapter', author: { _id: 'other2', kullaniciAdi: 'arda_s' }, createdAt: new Date().toISOString(), chapter: { title: 'Denize Bakan Pencere' }, work: works[2], likeCount: 7, likedByMe: true },
];
const sync = { online: true, tick: 0, issues: [], error: null, sync: async () => {} };
export const useSession = () => ({ user: new URLSearchParams(window.location.search).has('guest') ? null : window.location.hash.includes('/auth/complete') ? incompleteUser : user, loading: false, expired: false, logout: async () => {}, refresh: async () => {}, setLogin: async () => {} });
export const useSync = () => sync;
export const removeChapterDraft = async () => {};
export default { fetch: async () => ({ isConnected: true, isInternetReachable: true }) };
export const useIsFocused = () => true;
export const useFocusEffect = callback => useEffect(callback, [callback]);
export const usePreventRemove = (enabled, callback) => { useEffect(() => { window.__characterGuard = enabled ? callback : null; return () => { window.__characterGuard = null; }; }, [enabled, callback]); };
export const useNavigation = () => ({ dispatch: action => action(), addListener: () => () => {} });
const href = target => typeof target === 'string' ? target : target.pathname.replace(/\[([^\]]+)\]/g, (_, key) => target.params?.[key] || key) + '?' + new URLSearchParams(target.params);
export const router = { canGoBack: () => true, back: () => window.__characterGuard ? window.__characterGuard({ data: { action: () => history.back() } }) : history.back(), push: target => { window.location.hash = href(target); }, replace: target => { window.location.hash = href(target); } };
export const Stack = Object.assign(({ children }) => <>{children}</>, { Screen: () => null });
export const useLocalSearchParams = () => location.hash.startsWith('#/read/') ? { workId: location.hash.split('/')[2], chapterId: location.hash.split('/')[3]?.split('?')[0], ...Object.fromEntries(new URLSearchParams(location.hash.split('?')[1])) } : /^#\/(characters|plot)\//.test(location.hash) ? { workId: location.hash.split('/')[2], id: location.hash.split('/')[3]?.split('?')[0], ...Object.fromEntries(new URLSearchParams(location.hash.split('?')[1])) } : ({ mode: window.location.hash.split('/')[2]?.split('?')[0] || 'login', id: 'visual-1', workId: 'visual-1', chapterId: chapter._id });
export const readDeviceStudio = async () => ({ drafts: [], works, indexError: null });
export const cacheStudioIndex = async () => {};
export const pickAndUpload = async () => null;
export const GoogleSignin = {};
export const openDraft = async () => new DraftEngine(fromChapter(chapter, user._id, 'visual-1'), { read: async () => null, write: async () => {} }, async d => ({ ...chapter, title: d.title, content: d.content, revision: d.baseRevision + 1 }), () => {});
function result(path) {
  if (!path) return null;
  if (path.includes('feed?')) return { items: path.includes('following') ? feed.slice(0, 1) : feed, hasMore: false };
  if (path === '/works/genres') return { genres: ['Öykü', 'Roman', 'Fantastik', 'Dram', 'Deneme'].map(genre => ({ genre, count: 3 })) };
  if (path.startsWith('/works/discover')) { const q = new URLSearchParams(path.split('?')[1]); const items = works.filter(w => w.title.toLocaleLowerCase('tr').includes((q.get('q') || '').toLocaleLowerCase('tr')) && (!q.get('genres') || w.genres.includes(q.get('genres')))); return { items, pagination: { totalPages: 1, total: items.length } }; }
  if (path.startsWith('/search/users')) return { items: [user] };
  if (path === '/user/profile') return { user, stats: { totalWorks: 3, totalViews: 1240, totalLikes: 86, totalWords: 18420 } };
  if (path.startsWith('/public/profile/')) return path.endsWith('/works') ? { items: works.slice(1) } : { user: { ...user, _id: 'other', followerCount: 42, followingCount: 18, isFollowedByMe: false } };
  if (path.startsWith('/notifications?')) return { unreadCount: 1, items: [{ _id: 'notice-1', text: 'ece_kalem günlük notunu beğendi.', type: 'like', log: 'log-1', read: false, createdAt: new Date().toISOString() }, { _id: 'notice-2', text: 'Atölyeye hoş geldin. İlk hikâyene yer aç.', read: true, createdAt: new Date().toISOString() }] };
  if (path === '/library') return { items: works.slice(1) };
  if (path.startsWith('/library/check')) return { inLibrary: false };
  if (path.startsWith('/likes/check')) return { liked: false, likeCount: 24 };
  if (path === '/reading-progress') return { items: [{ story: works[0], chapter, scrollPosition: 38 }] };
  if (path.startsWith('/reading-progress/')) return { found: false };
  if (/\/chapters\//.test(path)) return { item: chapter };
  if (path.endsWith('/chapters')) return { items: [chapter, { ...chapter, _id: 'chapter-two', title: 'Unutulmuş Bir Mektup' }] };
  if (path === '/user/works') return { items: works };
  if (path.startsWith('/logs/')) return { items: feed.filter(i=>i.type==='log'), hasMore: false };
  if (path === '/works') return { items: works.filter(w => w.author._id === user._id) };
  if (path.startsWith('/works/') || path.startsWith('/public/works/')) return { item: works[0] };
  if (path === '/mobile/config') return { termsVersion: 'test', legal: [], features: {} };
  return { items: [] };
}
export function useResource(path) {
  const characterQA = /^#\/(characters|plot)\//.test(location.hash);
  const [data, setData] = useState(() => characterQA ? null : result(path));
  const [loading, setLoading] = useState(characterQA); const [error, setError] = useState(null);
  const reload = async () => {
    if (!characterQA) { setData(result(path)); return; }
    setLoading(true); setError(null);
    try { const response = await fetch('https://visual-qa.invalid/api' + path); const body = await response.json(); if (!response.ok) throw new Error(body.message); setData(body); }
    catch (e) { setError(e); } finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [path]);
  return { data, loading, error, setData, reload };
}
