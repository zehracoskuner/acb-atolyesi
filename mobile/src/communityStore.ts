import type { FeedItem } from './types';

export type CommunityEvent = { kind: 'reset' | 'access' | 'change' | 'busy'; id?: string; item?: FeedItem; created?: boolean; deleted?: boolean };
const listeners = new Set<(event: CommunityEvent) => void>();
const logs = new Map<string, FeedItem | null>();
const pending = new Set<string>();
let revision = 0;
let epoch = 0;
export const communityEpoch = () => epoch;
export const communityRevision = () => revision;
export const subscribeCommunity = (listener: (event: CommunityEvent) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function emit(event: CommunityEvent) { for (const listener of listeners) listener(event); }
export function clearCommunity(kind: 'reset' | 'access' = 'reset') {
  epoch++; revision++; logs.clear(); pending.clear(); emit({ kind });
}
export const getLog = (id: string) => logs.get(id);
export const logBusy = (id: string) => pending.has(id);
export function lockLog(id: string) { if (pending.has(id)) return false; pending.add(id); emit({ kind: 'busy', id }); return true; }
export function unlockLog(id: string) { pending.delete(id); emit({ kind: 'busy', id }); }
export function ingestLog(item: FeedItem) {
  const previous = logs.get(item._id);
  const next = { ...previous, ...item, type: 'log' as const };
  logs.set(item._id, next); emit({ kind: 'change', id: item._id, item: next });
}
// Both profile and discovery use these same normalized journals. Chapters never
// enter this map, even when Mongo IDs happen to be identical across collections.
export function receiveCommunity(path: string, method: string, result: any) {
  if (method === 'GET') {
    if (/^\/feed(?:\?|\/top-logs)/.test(path)) for (const item of result.items || []) { if (!item.type || item.type === 'log') ingestLog(item); }
    else if (/^\/logs\/[^/]+(?:\?|$)/.test(path)) for (const item of result.items || []) ingestLog(item);
    else if (/^\/logs\/[^/]+\/detail$/.test(path) && result.item) ingestLog(result.item);
    return;
  }
  if (/^\/public\/profile\/[^/]+\/follow$/.test(path)) { clearCommunity('access'); return; }
  if (!path.startsWith('/logs')) return;
  revision++;
  if (path === '/logs' && method === 'POST' && result.item) {
    ingestLog(result.item); emit({ kind: 'change', id: result.item._id, item: { ...result.item, type: 'log' }, created: true }); return;
  }
  const match = path.match(/^\/logs\/([^/]+)(.*)$/); if (!match) return;
  const id = match[1]!, suffix = match[2] || '', previous = logs.get(id);
  if (!suffix && method === 'DELETE') { logs.set(id, null); emit({ kind: 'change', id, deleted: true }); }
  else if (!suffix && method === 'PATCH' && result.item) ingestLog({ ...previous, ...result.item });
  else if (suffix === '/like' && previous) ingestLog({ ...previous, likeCount: result.likeCount, likedByMe: result.likedByMe });
  else if (suffix.startsWith('/comments') && previous && ['POST', 'DELETE'].includes(method)) {
    ingestLog({ ...previous, commentCount: Math.max(0, (previous.commentCount || 0) + (method === 'POST' ? 1 : -1)) });
  }
}

export const feedKey = (item: FeedItem) => `${item.type}:${item._id}`;
export function mergeFeed(current: FeedItem[], incoming: FeedItem[]) {
  return [...new Map([...current, ...incoming].map(item => [feedKey(item), item])).values()];
}
export function orderFeed(items: FeedItem[]) {
  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b._id.localeCompare(a._id) || a.type.localeCompare(b.type));
}
