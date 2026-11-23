import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chapter } from '../src/types';

const state = vi.hoisted(() => ({
  disk: new Map<string, string>(), online: true,
  push: vi.fn(), actions: [] as (() => void)[],
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => state.disk.get(key) ?? null,
  setItem: async (key: string, value: string) => { state.disk.set(key, value); },
  removeItem: async (key: string) => { state.disk.delete(key); },
  getAllKeys: async () => [...state.disk.keys()],
  multiGet: async (keys: string[]) => keys.map(key => [key, state.disk.get(key) ?? null]),
  multiRemove: async (keys: string[]) => { keys.forEach(key => state.disk.delete(key)); },
} }));
vi.mock('@react-native-community/netinfo', () => ({ default: {
  fetch: async () => ({ isConnected: state.online, isInternetReachable: state.online }),
} }));
vi.mock('react-native', () => ({
  AppState: {},
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
vi.mock('expo-router', () => ({ router: { push: state.push } }));
vi.mock('../src/session', () => ({ useSession: vi.fn() }));
vi.mock('../src/ui', () => ({ useUI: () => ({ styles: {} }), Button: ({ title, onPress }: { title: string; onPress: () => void }) => {
  state.actions.push(onPress); return <button>{title}</button>;
} }));

const chapter: Chapter = { _id: 'chapter-1', title: 'İlk bölüm', content: '<p>İstanbul <strong>ışıkları</strong>.</p>', revision: 3 };
beforeEach(() => { vi.resetModules(); vi.restoreAllMocks(); state.disk.clear(); state.actions = []; state.push.mockClear(); state.online = true; vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://acb.example.test/api'); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('device studio after an offline restart', () => {
  it('offers recovery before background sync can overwrite different server text after restarting', async () => {
    const { draftKey, fromChapter } = await import('../src/draftEngine');
    const local = { ...fromChapter(chapter, 'author', 'work'), dirty: true, title: 'Yerel başlık', content: '<p>Çevrimdışı çalışma</p>' };
    state.disk.set(draftKey('author', chapter._id, 'work'), JSON.stringify(local));
    const client = await import('../src/api'); client.configureSession('token'); client.setAccountId('author');
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({ item: chapter }) } as Response);
    const { openDraft, syncAccount } = await import('../src/sync');
    await syncAccount('author');
    const engine = await openDraft('author', chapter._id, 'work');
    expect(engine.draft.content).toBe(local.content); expect(engine.draft.conflict?.content).toBe(chapter.content);
    expect(fetch.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
    await engine.resolve('local');
    const backup = [...state.disk.entries()].find(([key]) => key.includes(':backup:'));
    expect(JSON.parse(backup![1]).conflict.content).toBe(chapter.content);
  });
  it('lists and opens a fully synced chapter after memory is cleared, then preserves new offline writing', async () => {
    const client = await import('../src/api'); client.configureSession('token'); client.setAccountId('author');
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
      const body = options?.body ? JSON.parse(String(options.body)) : null;
      return { ok: true, json: async () => ({ item: body ? { ...chapter, ...body, revision: 4 } : chapter }) } as Response;
    });
    const firstSession = await import('../src/sync');
    const index = await import('../src/studioStorage');
    await index.cacheStudioIndex('author', [{ _id: 'work-1', title: 'Yağmurun Öyküsü' }]);
    const opened = await firstSession.openDraft('author', chapter._id, 'work-1');
    const html = '<h2>Çağrı</h2><p>Üç <em>şehir</em>.</p>';
    await opened.edit('Üç şehir', html); await opened.sync();
    expect(opened.draft.dirty).toBe(false);

    // Keep serialized device storage but discard the module-level engine map.
    vi.resetModules(); state.online = false; fetch.mockClear();
    const { readDeviceStudio } = await import('../src/studioStorage');
    const saved = await readDeviceStudio('author');
    const { LocalDraftShelf } = await import('../src/components/LocalDraftShelf');
    const markup = renderToStaticMarkup(<LocalDraftShelf drafts={saved.drafts} works={saved.works}/>);
    expect(markup).toContain('Yağmurun Öyküsü'); expect(markup).toContain('Üç şehir');
    expect(markup).toContain('son eşitleme tamamlandı'); expect(state.actions).toHaveLength(1);
    state.actions[0]!();
    expect(state.push).toHaveBeenCalledWith({ pathname: '/write/[id]', params: { id: 'chapter-1', workId: 'work-1' } });
    const secondSession = await import('../src/sync');
    const reopened = await secondSession.openDraft('author', 'chapter-1', 'work-1');
    expect(reopened.draft.content).toBe(html); expect(reopened.draft.baseRevision).toBe(4);
    await reopened.edit('Üç şehir', html + '<p>Çevrimdışı yeni cümle.</p>');
    expect(fetch).not.toHaveBeenCalled();
    vi.resetModules();
    const thirdSession = await import('../src/sync');
    const again = await thirdSession.openDraft('author', 'chapter-1', 'work-1');
    expect(again.draft.content).toContain('Çevrimdışı yeni cümle.'); expect(again.draft.dirty).toBe(true);
  });

  it('keeps clean, pending and conflicted chapters visible, without another account or backups', async () => {
    const { fromChapter, draftKey } = await import('../src/draftEngine');
    const { draftStorage } = await import('../src/storage');
    for (const [id, patch] of [
      ['clean', {}], ['pending', { dirty: true }], ['conflict', { dirty: true, conflict: chapter }],
    ] as const) await draftStorage.write(draftKey('author', id), { ...fromChapter({ ...chapter, _id: id, title: id }, 'author', 'work'), ...patch });
    await draftStorage.write(draftKey('other', 'private'), fromChapter({ ...chapter, title: 'Başkasının metni' }, 'other', 'private-work'));
    await draftStorage.write(draftKey('author', 'clean') + ':backup:1', fromChapter(chapter, 'author', 'work'));
    const { cacheStudioIndex, readDeviceStudio } = await import('../src/studioStorage');
    await cacheStudioIndex('other', [{ _id: 'work', title: 'Başkasının eseri' }]);
    const saved = await readDeviceStudio('author');
    const { LocalDraftShelf } = await import('../src/components/LocalDraftShelf');
    const markup = renderToStaticMarkup(<LocalDraftShelf drafts={saved.drafts} works={saved.works}/>);
    expect(saved.drafts).toHaveLength(3); expect(state.actions).toHaveLength(3);
    expect(markup).toContain('son eşitleme tamamlandı'); expect(markup).toContain('eşitleme bekliyor'); expect(markup).toContain('Sürüm çakışması');
    expect(markup).not.toContain('Başkasının');
  });

  it('opens old local chapters without an index and survives an unreadable title cache', async () => {
    const { fromChapter, draftKey } = await import('../src/draftEngine');
    const { draftStorage } = await import('../src/storage');
    const { readDeviceStudio, studioIndexKey } = await import('../src/studioStorage');
    await draftStorage.write(draftKey('author', chapter._id), fromChapter(chapter, 'author', 'work'));
    expect((await readDeviceStudio('author')).drafts).toHaveLength(1);
    state.disk.set(studioIndexKey('author'), '{broken');
    const saved = await readDeviceStudio('author');
    expect(saved.drafts[0]?.content).toBe(chapter.content); expect(saved.indexError).toBeInstanceOf(Error);
    state.disk.set(studioIndexKey('author'), '{"unexpected":"shape"}');
    expect((await readDeviceStudio('author')).drafts).toHaveLength(1);
    state.online = false;
    const { openDraft } = await import('../src/sync');
    expect((await openDraft('author', chapter._id, 'work')).draft.content).toBe(chapter.content);
  });

  it('clears only the selected account’s local chapters and cached work labels', async () => {
    const { fromChapter, draftKey } = await import('../src/draftEngine');
    const { draftStorage } = await import('../src/storage');
    const { cacheStudioIndex, readDeviceStudio } = await import('../src/studioStorage');
    for (const user of ['author', 'other']) {
      await draftStorage.write(draftKey(user, chapter._id), fromChapter(chapter, user, 'work'));
      await cacheStudioIndex(user, [{ _id: 'work', title: user }]);
    }
    const { discardLocalDrafts } = await import('../src/sync'); await discardLocalDrafts('author');
    expect(await readDeviceStudio('author')).toEqual({ drafts: [], works: [], indexError: null });
    expect((await readDeviceStudio('other')).drafts).toHaveLength(1);
    expect((await readDeviceStudio('other')).works[0]?.title).toBe('other');
  });
});
