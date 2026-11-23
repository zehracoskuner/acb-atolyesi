import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { api, activeAccountId } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DraftEngine, draftKey, fromChapter, reconcile, saveFields, type Draft } from './draftEngine';
import { draftStorage, listDrafts } from './storage';
import type { Chapter } from './types';
import { useSession } from './session';
import { syncReading } from './reading';
import { studioIndexKey } from './studioStorage';
import { clearFormDrafts } from './formDrafts';
import { syncIssue, stopsSync, SyncBatchError, type SyncIssue, type SyncReport } from './syncResult';
const engines = new Map<string, DraftEngine>();
const opening = new Map<string, Promise<DraftEngine>>();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(fn => fn());
function engineFor(draft: Draft) {
  const key = draftKey(draft.userId, draft.chapterId, draft.workId);
  if (!engines.has(key)) engines.set(key, new DraftEngine(draft, draftStorage, async d => {
    if (activeAccountId() !== d.userId) throw new Error('Taslağın hesabıyla yeniden giriş yap.');
    const result = await api<{ item: Chapter }>(`/chapters/${d.chapterId}`, 'PUT', saveFields(d));
    return result.item;
  }, changed));
  return engines.get(key)!;
}
export async function openDraft(userId: string, chapterId: string, workId: string) {
  const key = draftKey(userId, chapterId, workId);
  if (opening.has(key)) return opening.get(key)!;
  const task = loadDraft(userId, chapterId, workId).finally(() => opening.delete(key));
  opening.set(key, task); return task;
}
async function loadDraft(userId: string, chapterId: string, workId: string) {
  const key = draftKey(userId, chapterId, workId);
  if (engines.has(key)) {
    const existing = engines.get(key)!;
    const network = await NetInfo.fetch();
    if (network.isConnected === false || network.isInternetReachable === false) return existing;
    try { const { item } = await api<{ item: Chapter }>(`/chapters/${chapterId}`); await existing.refreshRemote(item); }
    catch (error) { if ((error as { status?: number }).status !== 0) throw error; }
    return existing;
  }
  let local = await draftStorage.read(key);
  if (!local) {
    const legacyKey = draftKey(userId, chapterId);
    const legacy = await draftStorage.read(legacyKey);
    if (legacy?.workId === workId) {
      await draftStorage.write(key, legacy);
      await AsyncStorage.removeItem(legacyKey);
      local = legacy;
    }
  }
  if (local) {
    const network = await NetInfo.fetch();
    if (network.isConnected === false || network.isInternetReachable === false) { const e = engineFor(local); e.recoveryPending = local.dirty; return e; }
  }
  let draft: Draft;
  try {
    const { item } = await api<{ item: Chapter }>(`/chapters/${chapterId}`);
    draft = local ? reconcile(local, item, true) : fromChapter(item, userId, workId);
  } catch (error) {
    // Only connectivity failures may use the offline copy. Do not bypass authorization.
    if (!local || (error as { status?: number }).status !== 0) throw error;
    const e = engineFor(local); e.recoveryPending = local.dirty; return e;
  }
  await draftStorage.write(key, draft);
  return engineFor(draft);
}
export async function discardLocalDrafts(userId: string) {
  await clearFormDrafts(userId);
  const owned = [...engines.entries()].filter(([, e]) => e.draft.userId === userId);
  await Promise.all(owned.map(([, e]) => e.dispose()));
  const keys = (await AsyncStorage.getAllKeys()).filter(k => k.startsWith(`draft:${userId}:`) || k.startsWith(`tool-form:${userId}:`) || k === studioIndexKey(userId));
  await AsyncStorage.multiRemove(keys); owned.forEach(([key]) => engines.delete(key)); changed();
}
export async function removeChapterDraft(userId: string, workId: string, chapterId: string) {
  const key = draftKey(userId, chapterId, workId);
  const engine = engines.get(key);
  if (engine) await engine.dispose();
  await AsyncStorage.multiRemove([key, draftKey(userId, chapterId)]);
  engines.delete(key); changed();
}
export async function syncAccount(userId: string): Promise<SyncReport> {
  const report: SyncReport = { issues: [], stopped: false };
  let drafts: Draft[] = [];
  try { drafts = await listDrafts(userId); }
  catch (error) { report.issues.push(syncIssue('storage', 'chapters', 'Cihazdaki bölümler', error)); }
  for (const draft of drafts) {
    if (activeAccountId() !== userId) { report.stopped = true; return report; }
    try {
      const key = draftKey(draft.userId, draft.chapterId, draft.workId);
      const engine = engines.get(key) || await openDraft(userId, draft.chapterId, draft.workId);
      if (engine.recoveryPending) {
        const { item } = await api<{ item: Chapter }>(`/chapters/${draft.chapterId}`);
        await engine.refreshRemote(item);
      }
      if (!engine.draft.dirty || engine.draft.conflict) continue;
      await engine.sync();
    }
    catch (error) {
      report.issues.push(syncIssue('chapter', draft.chapterId, draft.title, error));
      if (await stopsSync(error)) { report.stopped = true; return report; }
    }
  }
  const reading = await syncReading(userId);
  report.issues.push(...reading.issues); report.stopped = reading.stopped;
  return report;
}
const Context = createContext({ online: true, tick: 0, sync: async () => {}, error: null as unknown, issues: [] as SyncIssue[] });
export const useSync = () => useContext(Context);
export function SyncProvider({ children }: React.PropsWithChildren) {
  const { user } = useSession(); const [online, setOnline] = useState(true); const [tick, setTick] = useState(0); const [error, setError] = useState<unknown>(null);
  const syncing = useRef(false);
  const sync = async () => {
    if (!user || !online || syncing.current) return;
    syncing.current = true;
    try {
      const report = await syncAccount(user._id);
      // A completed request from an old session must not update the new account's UI.
      if (activeAccountId() === user._id) {
        setError(report.issues.length || report.stopped ? new SyncBatchError(report.issues, report.stopped) : null);
        changed();
      }
    } catch (e) { if (activeAccountId() === user._id) setError(e); } finally { syncing.current = false; }
  };
  useEffect(() => { setError(null); }, [user?._id]);
  useEffect(() => { const cb = () => setTick(t => t + 1); listeners.add(cb); return () => { listeners.delete(cb); }; }, []);
  useEffect(() => NetInfo.addEventListener(state => setOnline(state.isConnected !== false && state.isInternetReachable !== false)), []);
  useEffect(() => {
    void sync(); const timer = setInterval(() => { void sync(); }, 30000);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void sync(); else engines.forEach(e => { void e.persist().catch(setError); }); });
    return () => { clearInterval(timer); sub.remove(); };
  // The current user and connectivity own the synchronization lifecycle.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, online]);
  return <Context.Provider value={{ online, tick, sync, error, issues: error instanceof SyncBatchError ? error.issues : [] }}>{children}</Context.Provider>;
}
