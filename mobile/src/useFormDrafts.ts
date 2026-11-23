import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import { useSession } from './session';
import { useSync } from './sync';
import { discardFormRecord, listFormDrafts, memoryFormDrafts, migrateLegacyForms, newFormDraft, openFormDraft, restoreFormDraft, subscribeForms } from './formDrafts';
import { type FormDraft, type FormDraftEngine, type FormScope, type FormValues } from './formDraftEngine';

export function useFormDrafts(scope: FormScope, autoSave = false) {
  const { user } = useSession(); const { online } = useSync();
  const [engine, setEngine] = useState<FormDraftEngine | null>(null); const [drafts, setDrafts] = useState<FormDraft[]>([]);
  const [error, setError] = useState<unknown>(null); const [busy, setBusy] = useState(false); const [, render] = useState(0);
  const active = useRef<FormDraftEngine | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0); const loading = useRef(false);
  const userId = user?._id; const { kind, workId, category } = scope;
  const scopeKey = `${userId}:${kind}:${workId || ''}:${category || ''}`;
  const currentScope = useRef(scopeKey); currentScope.current = scopeKey;
  const refresh = useCallback(async () => {
    if (!userId || currentScope.current !== scopeKey) return;
    const request = generation.current; const saved = await listFormDrafts(userId, { kind, workId, category });
    if (request === generation.current && currentScope.current === scopeKey) setDrafts(saved);
  }, [userId, kind, workId, category, scopeKey]);
  useEffect(() => {
    let mounted = true;
    if (userId) void migrateLegacyForms(userId, { kind, workId, category }).then(() => { if (mounted) void refresh().catch(setError); }).catch(failure => { if (mounted) setError(failure); });
    const unsubscribe = subscribeForms(() => { if (mounted && userId) { render(value => value + 1); setDrafts(memoryFormDrafts(userId, { kind, workId, category })); } });
    const invalidate = () => { generation.current++; };
    return () => { mounted = false; invalidate(); unsubscribe(); };
  }, [userId, kind, workId, category, refresh]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') void active.current?.persist().catch(setError); });
    return () => { sub.remove(); if (timer.current) clearTimeout(timer.current); };
  }, []);
  const flush = async () => {
    if (timer.current) clearTimeout(timer.current);
    const current = active.current;
    if (current) await current.persist().catch(() => current.keep());
  };
  usePreventRemove(!!engine?.diskError, () => setError(new Error('Cihaz kaydı başarısız. Kaydı tekrar dene veya metni kopyalayarak koru.')));
  const activate = (next: FormDraftEngine | null) => { active.current = next; setEngine(next); };
  const start = async (recordId?: string, localId?: string) => {
    if (!userId || loading.current) return;
    loading.current = true; const request = ++generation.current; setBusy(true); setError(null);
    try {
      await flush();
      const next = localId ? await restoreFormDraft(userId, scope, localId) : recordId ? await openFormDraft(userId, scope, recordId) : newFormDraft(userId, scope);
      if (request !== generation.current) return;
      activate(next); await next.keep(); await refresh();
    } catch (failure) { if (request === generation.current) setError(failure); }
    finally { loading.current = false; if (request === generation.current) setBusy(false); }
  };
  const save = async () => {
    const current = active.current;
    if (!current) return;
    setError(null);
    try { await flush(); if (online) await current.sync(); await refresh(); }
    catch (failure) { if (active.current === current) setError(failure); }
  };
  const update = (patch: Partial<FormValues>) => {
    const current = active.current;
    if (!current) return;
    void current.edit(patch).then(() => { if (active.current === current) setError(null); }).catch(setError);
    if (timer.current) clearTimeout(timer.current);
    if (autoSave && online) timer.current = setTimeout(() => { void save(); }, 1400);
  };
  const close = async () => { await flush(); generation.current++; setBusy(false); activate(null); setError(null); await refresh(); };
  const resolve = async (choice: 'local' | 'remote') => {
    const current = active.current;
    if (!current) return;
    try { await current.resolve(choice); if (online) await current.sync(); if (active.current === current) setError(null); await refresh(); }
    catch (failure) { if (active.current === current) setError(failure); }
  };
  const forget = async (recordId: string) => {
    if (!userId) return;
    if (timer.current) clearTimeout(timer.current);
    await discardFormRecord(userId, scope, recordId);
    if (active.current?.draft.recordId === recordId || active.current?.draft.conflict?.recordId === recordId) activate(null);
    await refresh();
  };
  const retrySave = useRef(save); retrySave.current = save;
  useEffect(() => { if (autoSave && online && engine?.draft.dirty) void retrySave.current(); }, [autoSave, online, engine]);
  return { engine, drafts, error: engine?.diskError || error || engine?.error, busy, start, update, save, close, resolve, forget, refresh };
}
