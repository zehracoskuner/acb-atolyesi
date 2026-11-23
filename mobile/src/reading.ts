import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, activeAccountId } from './api';
import { syncIssue, stopsSync, type SyncReport } from './syncResult';
export interface ReadingPosition { storyId: string; chapterId: string; scrollPosition: number; savedAt: number; synced?: boolean; anchor?: { id: string; fraction: number }; contentVersion?: string }
const queue = new Map<string, Promise<void>>();
const storage = new Map<string, Promise<void>>();
let lastStamp = 0;
function onDisk(key: string, write: () => Promise<void>) {
  const next = (storage.get(key) || Promise.resolve()).catch(() => {}).then(write);
  storage.set(key, next); return next.finally(() => { if (storage.get(key) === next) storage.delete(key); });
}
export const readingKey = (userId: string, storyId: string) => `reading:${userId}:${storyId}`;
export async function readPosition(userId: string, storyId: string) {
  const raw = await AsyncStorage.getItem(readingKey(userId, storyId)); return raw ? JSON.parse(raw) as ReadingPosition : null;
}
export async function trackReading(userId: string, position: Omit<ReadingPosition, 'savedAt'> & { savedAt?: number }, retry = false) {
  const key = readingKey(userId, position.storyId);
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  const snapshot: ReadingPosition = { ...position, synced: false, savedAt: retry && position.savedAt ? position.savedAt : lastStamp };
  // Persist immediately, independently of a slow previous network request.
  const persisted = onDisk(key, async () => {
    const current = await readPosition(userId, position.storyId);
    if (!retry || !current || current.savedAt <= snapshot.savedAt) await AsyncStorage.setItem(key, JSON.stringify(snapshot));
  });
  const next = (queue.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
    await persisted;
    if ((await readPosition(userId, position.storyId))?.savedAt !== snapshot.savedAt) return;
    if (activeAccountId() !== userId) return;
    await api('/reading-progress', 'POST', snapshot);
    await onDisk(key, async () => {
      if ((await readPosition(userId, position.storyId))?.savedAt === snapshot.savedAt)
        await AsyncStorage.setItem(key, JSON.stringify({ ...snapshot, synced: true }));
    });
  });
  queue.set(key, next); try { await next; } finally { if (queue.get(key) === next) queue.delete(key); }
}
export async function syncReading(userId: string): Promise<SyncReport> {
  const report: SyncReport = { issues: [], stopped: false };
  let keys: string[];
  try { keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(`reading:${userId}:`)); }
  catch (error) { report.issues.push(syncIssue('storage', 'reading', 'Okuma kayıtları', error)); return report; }
  for (const key of keys) {
    if (activeAccountId() !== userId) { report.stopped = true; break; }
    if (queue.has(key)) continue;
    const storyId = key.slice(`reading:${userId}:`.length);
    try {
      // Read when this record is reached, rather than retrying a stale batch snapshot.
      const position = await readPosition(userId, storyId);
      if (activeAccountId() !== userId) { report.stopped = true; break; }
      if (position && !position.synced && !queue.has(key)) await trackReading(userId, position, true);
    } catch (error) {
      report.issues.push(syncIssue('reading', storyId, 'Okuma ilerlemesi', error));
      if (await stopsSync(error)) { report.stopped = true; break; }
    }
  }
  return report;
}
