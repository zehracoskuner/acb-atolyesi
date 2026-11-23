import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api, activeAccountId, ApiError } from './api';
import { emptyForm, formKey, FormDraftEngine, normalizeForm, type FormDraft, type FormScope, type RemoteForm } from './formDraftEngine';

const engines = new Map<string, FormDraftEngine>();
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(listener => listener());
export function subscribeForms(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
const matching = (d: FormDraft, userId: string, scope: FormScope) => d.userId === userId && d.kind === scope.kind && d.workId === scope.workId && d.category === scope.category;
const write = async (key: string, draft: FormDraft) => AsyncStorage.setItem(key, JSON.stringify(draft));
function engineFor(draft: FormDraft) {
  const key = formKey(draft);
  if (!engines.has(key)) engines.set(key, new FormDraftEngine(draft, write, async sent => {
    if (activeAccountId() !== sent.userId) throw new Error('Bu taslağın hesabıyla yeniden giriş yap.');
    if (sent.recordId && !sent.version) {
      // A migrated shared form has no trustworthy server baseline. Compare it
      // explicitly before sending any replacement text.
      const query = new URLSearchParams({ ...(sent.workId ? { workId: sent.workId } : {}), ...(sent.category ? { category: sent.category } : {}) });
      const { saved } = await api<{ saved: RemoteForm }>(`/mobile/tools/${sent.kind}/${sent.recordId}?${query}`);
      throw new ApiError(409, 'Eski cihaz taslağını sunucudaki kayıtla karşılaştır.', { current: { ...saved, data: normalizeForm(saved.data) } });
    }
    const partial = sent.kind === 'scenes' && !!sent.recordId && !!sent.baseData;
    const data = partial ? Object.fromEntries(Object.entries(sent.data).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(sent.baseData![key as keyof typeof sent.data]))) : sent.data;
    const { saved } = await api<{ saved: RemoteForm }>(`/mobile/tools/${sent.kind}`, 'POST', {
      recordId: sent.recordId, draftId: sent.localId, expectedVersion: sent.version,
      workId: sent.workId, category: sent.category, data, partial,
    });
    return { ...saved, data: normalizeForm(saved.data) };
  }, changed));
  return engines.get(key)!;
}
let counter = 0;
export function newFormDraft(userId: string, scope: FormScope) {
  const draft: FormDraft = { ...scope, userId, localId: `${Date.now().toString(36)}-${(++counter).toString(36)}-${Math.random().toString(36).slice(2)}`,
    data: { ...emptyForm, characters: [] }, version: null, dirty: true, editedAt: Date.now() };
  return engineFor(draft);
}
export function memoryFormDrafts(userId: string, scope: FormScope) {
  return [...engines.values()].map(engine => engine.draft).filter(draft => matching(draft, userId, scope)).sort((a, b) => b.editedAt - a.editedAt);
}
export async function listFormDrafts(userId: string, scope: FormScope): Promise<FormDraft[]> {
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(`form-draft:${userId}:`) && !key.includes(':backup:'));
  for (const [, raw] of await AsyncStorage.multiGet(keys)) if (raw) {
    const draft: FormDraft = JSON.parse(raw);
    if (matching(draft, userId, scope)) engineFor(draft);
  }
  return memoryFormDrafts(userId, scope);
}
export async function restoreFormDraft(userId: string, scope: FormScope, localId: string) {
  const draft = (await listFormDrafts(userId, scope)).find(item => item.localId === localId);
  if (!draft) throw new Error('Cihaz taslağı bulunamadı.');
  return engineFor(draft);
}
export async function openFormDraft(userId: string, scope: FormScope, recordId: string) {
  const local = (await listFormDrafts(userId, scope)).find(draft => draft.recordId === recordId);
  const existing = local && engineFor(local);
  const network = await NetInfo.fetch();
  if (existing && (network.isConnected === false || network.isInternetReachable === false)) return existing;
  await existing?.settle();
  try {
    const query = new URLSearchParams({ ...(scope.workId ? { workId: scope.workId } : {}), ...(scope.category ? { category: scope.category } : {}) });
    const { saved } = await api<{ saved: RemoteForm }>(`/mobile/tools/${scope.kind}/${recordId}?${query}`);
    const remote = { ...saved, data: normalizeForm(saved.data) };
    const localId = `record-${scope.kind}-${scope.workId || 'self'}-${scope.category || 'all'}-${recordId}`;
    const engine = existing || engineFor({ ...scope, userId, localId, ...remote, dirty: false, editedAt: Date.now() });
    await engine.refresh(remote); return engine;
  } catch (error) { if (existing && (error as { status?: number }).status === 0) return existing; throw error; }
}
export async function migrateLegacyForms(userId: string, scope: FormScope) {
  if (!scope.workId) return;
  const prefix = `tool-form:${userId}:${scope.workId}:${scope.kind}:`;
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(prefix) && (scope.kind !== 'world' || key.endsWith(`:${scope.category}`)));
  for (const [key, raw] of await AsyncStorage.multiGet(keys)) if (raw) {
    const legacy = JSON.parse(raw); const localId = `legacy-${scope.kind}-${scope.workId}-${key.slice(prefix.length)}`;
    if (scope.kind === 'notes' && legacy.body) legacy.body = `<p>${String(legacy.body).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/\r\n?/g, '\n').replaceAll('\n', '<br>')}</p>`;
    const draft: FormDraft = { ...scope, userId, localId, recordId: legacy._id, version: null, data: normalizeForm(legacy), dirty: true, editedAt: Date.now() };
    if (!await AsyncStorage.getItem(formKey(draft))) await write(formKey(draft), draft);
    await AsyncStorage.removeItem(key);
  }
}
export async function clearFormDrafts(userId: string) {
  const owned = [...engines.entries()].filter(([, engine]) => engine.draft.userId === userId);
  await Promise.all(owned.map(([, engine]) => engine.dispose()));
  const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith(`form-draft:${userId}:`));
  await AsyncStorage.multiRemove(keys); owned.forEach(([key]) => engines.delete(key)); changed();
}
export async function discardFormRecord(userId: string, scope: FormScope, recordId: string) {
  const drafts = (await listFormDrafts(userId, scope)).filter(draft => draft.recordId === recordId || draft.conflict?.recordId === recordId);
  const prefixes = drafts.map(formKey);
  await Promise.all(prefixes.map(key => engines.get(key)!.dispose()));
  const keys = (await AsyncStorage.getAllKeys()).filter(key => prefixes.some(prefix => key === prefix || key.startsWith(`${prefix}:backup:`)));
  await AsyncStorage.multiRemove(keys); prefixes.forEach(key => engines.delete(key)); changed();
}
