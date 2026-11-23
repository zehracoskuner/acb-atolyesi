import AsyncStorage from '@react-native-async-storage/async-storage';
import { listDrafts } from './storage';
import type { Draft } from './draftEngine';

export type StudioWork = { _id: string; title: string };
export const studioIndexKey = (userId: string) => `studio-index:${userId}`;

export async function readStudioIndex(userId: string): Promise<StudioWork[]> {
  const raw = await AsyncStorage.getItem(studioIndexKey(userId));
  if (!raw) return [];
  const index: unknown = JSON.parse(raw);
  if (!Array.isArray(index) || index.some(work => !work || typeof work._id !== 'string' || typeof work.title !== 'string')) {
    throw new Error('Cihazdaki eser adları okunamadı. Kayıtlı bölümlerini yine de açabilirsin.');
  }
  return index;
}

export async function cacheStudioIndex(userId: string, works: StudioWork[]) {
  // Keep labels for existing local copies even if an item leaves the server list.
  const index = new Map((await readStudioIndex(userId)).map(work => [work._id, work]));
  for (const { _id, title } of works) index.set(_id, { _id, title });
  await AsyncStorage.setItem(studioIndexKey(userId), JSON.stringify([...index.values()]));
}

export async function readDeviceStudio(userId: string) {
  // Local chapters remain available even if their optional title index is damaged.
  const [drafts, index] = await Promise.all([
    listDrafts(userId),
    readStudioIndex(userId).then(works => ({ works, error: null as unknown }), error => ({ works: [] as StudioWork[], error })),
  ]);
  return { drafts, works: index.works, indexError: index.error };
}

export function groupDeviceDrafts(drafts: Draft[], works: StudioWork[]) {
  const titles = new Map(works.map(work => [work._id, work.title]));
  const groups = new Map<string, { workId: string; title?: string; drafts: Draft[] }>();
  for (const draft of [...drafts].sort((a, b) => b.editedAt - a.editedAt)) {
    let group = groups.get(draft.workId);
    if (!group) { group = { workId: draft.workId, title: titles.get(draft.workId), drafts: [] }; groups.set(draft.workId, group); }
    group.drafts.push(draft);
  }
  return [...groups.values()];
}
