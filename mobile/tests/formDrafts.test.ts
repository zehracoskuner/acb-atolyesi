import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ disk: new Map<string, string>(), online: false }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => state.disk.get(key) ?? null,
  setItem: async (key: string, value: string) => { state.disk.set(key, value); },
  removeItem: async (key: string) => { state.disk.delete(key); },
  getAllKeys: async () => [...state.disk.keys()],
  multiGet: async (keys: string[]) => keys.map(key => [key, state.disk.get(key) ?? null]),
  multiRemove: async (keys: string[]) => { keys.forEach(key => state.disk.delete(key)); },
} }));
vi.mock('@react-native-community/netinfo', () => ({ default: { fetch: async () => ({ isConnected: state.online }) } }));
beforeEach(() => { vi.resetModules(); state.disk.clear(); state.online = false; vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://acb.example.test/api'); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe('form identity and device recovery', () => {
  it('keeps separate scene drafts across restart, record switches, work scopes and accounts', async () => {
    const { newFormDraft } = await import('../src/formDrafts');
    const one = newFormDraft('author', { kind: 'scenes', workId: 'work' });
    const two = newFormDraft('author', { kind: 'scenes', workId: 'work' });
    const other = newFormDraft('other', { kind: 'scenes', workId: 'work' });
    await one.edit({ title: 'Sabah', draftText: 'Birinci metin' }); await two.edit({ title: 'Akşam', draftText: 'İkinci metin' }); await other.edit({ title: 'Özel kayıt' });
    vi.resetModules();
    const { listFormDrafts, restoreFormDraft } = await import('../src/formDrafts');
    const scope = { kind: 'scenes' as const, workId: 'work' };
    expect(await listFormDrafts('author', scope)).toHaveLength(2); expect(await listFormDrafts('author', { ...scope, workId: 'another' })).toHaveLength(0);
    expect((await restoreFormDraft('author', scope, one.draft.localId)).draft.data.draftText).toBe('Birinci metin');
    expect((await restoreFormDraft('author', scope, two.draft.localId)).draft.data.draftText).toBe('İkinci metin');
    await expect(restoreFormDraft('author', scope, other.draft.localId)).rejects.toThrow('bulunamadı');
  });
  it.each(['scenes', 'notes'] as const)('migrates legacy shared %s forms without discarding their local edits', async kind => {
    const oldKey = `tool-form:author:work:${kind}:locations`;
    state.disk.set(oldKey, JSON.stringify({ _id: 'scene', title: 'Eski taslak', draftText: 'Korunacak metin', body: 'İlk satır\n<İkinci> & satır' }));
    const { migrateLegacyForms, listFormDrafts } = await import('../src/formDrafts');
    const scope = { kind, workId: 'work' }; await migrateLegacyForms('author', scope);
    const drafts = await listFormDrafts('author', scope);
    expect(drafts).toHaveLength(1); expect(drafts[0]).toMatchObject({ recordId: 'scene', dirty: true, version: null, data: { draftText: 'Korunacak metin' } });
    expect(state.disk.has(oldKey)).toBe(false);
    if (kind === 'notes') expect(drafts[0]?.data.body).toBe('<p>İlk satır<br>&lt;İkinci&gt; &amp; satır</p>');
  });
  it('opens a cached server record offline after restart without calling the API', async () => {
    const client = await import('../src/api'); client.configureSession('token'); client.setAccountId('author'); state.online = true;
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ saved: { recordId: 'note', version: 'one', data: { title: 'Öykü', content: '<p><strong>İlk</strong> metin.</p>' } } }) } as Response);
    const { openFormDraft } = await import('../src/formDrafts'); await openFormDraft('author', { kind: 'personal' }, 'note');
    vi.resetModules(); state.online = false; fetch.mockClear();
    const restarted = await import('../src/formDrafts'); const opened = await restarted.openFormDraft('author', { kind: 'personal' }, 'note');
    expect(opened.draft.data.content).toContain('<strong>İlk</strong>'); expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps world categories separate and clears only the selected account', async () => {
    const { newFormDraft, listFormDrafts, clearFormDrafts } = await import('../src/formDrafts');
    for (const user of ['author', 'other']) for (const category of ['locations', 'notes']) await newFormDraft(user, { kind: 'world', workId: 'work', category }).edit({ name: `${user} ${category}` });
    expect(await listFormDrafts('author', { kind: 'world', workId: 'work', category: 'notes' })).toHaveLength(1);
    await clearFormDrafts('author'); expect(await listFormDrafts('author', { kind: 'world', workId: 'work', category: 'notes' })).toHaveLength(0);
    expect(await listFormDrafts('other', { kind: 'world', workId: 'work', category: 'notes' })).toHaveLength(1);
  });
  it('compares a migrated record before sending any unversioned replacement', async () => {
    const client = await import('../src/api'); client.configureSession('token'); client.setAccountId('author'); state.online = true;
    state.disk.set('tool-form:author:work:scenes:locations', JSON.stringify({ _id: 'scene', title: 'Eski taslak', draftText: 'Cihazdaki özgün yazı' }));
    const forms = await import('../src/formDrafts'); const scope = { kind: 'scenes' as const, workId: 'work' };
    await forms.migrateLegacyForms('author', scope); const drafts = await forms.listFormDrafts('author', scope);
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ saved: { recordId: 'scene', version: 'current-version', data: { title: 'Sunucu kaydı', draftText: 'Başka cihazın yazısı' } } }) } as Response);
    const opened = await forms.restoreFormDraft('author', scope, drafts[0]!.localId); await opened.sync();
    expect(fetch).toHaveBeenCalledOnce(); expect(fetch.mock.calls[0]?.[1]?.method).toBe('GET');
    expect(opened.draft.data.draftText).toBe('Cihazdaki özgün yazı'); expect(opened.draft.conflict?.data.draftText).toBe('Başka cihazın yazısı');
  });
  it('removes a deleted record and its backups without deleting another cached record', async () => {
    const client = await import('../src/api'); client.configureSession('token'); client.setAccountId('author'); state.online = true;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async url => ({ ok: true, json: async () => ({ saved: { recordId: String(url).split('?')[0]!.split('/').at(-1), version: 'version', data: { title: 'Not', content: '<p>Metin</p>' } } }) }) as Response);
    const forms = await import('../src/formDrafts');
    const one = await forms.openFormDraft('author', { kind: 'personal' }, 'one');
    const two = await forms.openFormDraft('author', { kind: 'personal' }, 'two');
    const { formKey } = await import('../src/formDraftEngine');
    state.disk.set(formKey(one.draft) + ':backup:1', JSON.stringify(one.draft));
    await forms.discardFormRecord('author', { kind: 'personal' }, 'one');
    expect(state.disk.has(formKey(one.draft))).toBe(false); expect(state.disk.has(formKey(one.draft) + ':backup:1')).toBe(false);
    expect(state.disk.has(formKey(two.draft))).toBe(true);
    expect((await forms.listFormDrafts('author', { kind: 'personal' })).map(draft => draft.recordId)).toEqual(['two']);
  });
});
