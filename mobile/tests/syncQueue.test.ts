import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chapter } from '../src/types';

const state = vi.hoisted(() => ({ disk: new Map<string, string>(), online: true }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => state.disk.get(key) ?? null,
  setItem: async (key: string, value: string) => { state.disk.set(key, value); },
  removeItem: async (key: string) => { state.disk.delete(key); },
  getAllKeys: async () => [...state.disk.keys()],
  multiGet: async (keys: string[]) => keys.map(key => [key, state.disk.get(key) ?? null]),
  multiRemove: async (keys: string[]) => { keys.forEach(key => state.disk.delete(key)); },
} }));
vi.mock('@react-native-community/netinfo', () => ({ default: { fetch: async () => ({ isConnected: state.online, isInternetReachable: state.online }) } }));
vi.mock('react-native', () => ({ AppState: {} }));
vi.mock('../src/session', () => ({ useSession: vi.fn() }));

const chapter: Chapter = { _id: 'bad', title: 'Sorunlu bölüm', content: '<p>Çığlık değil, <strong>sessizlik</strong>.</p>', revision: 3 };
const response = (status: number, data: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => data }) as Response;
beforeEach(() => { vi.resetModules(); state.disk.clear(); state.online = true; vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://acb.example.test/api'); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

async function setup() {
  const client = await import('../src/api'); client.configureSession('author-token'); client.setAccountId('author');
  const { fromChapter, draftKey: key } = await import('../src/draftEngine');
  const draftKey = (user: string, chapter: string) => key(user, chapter, 'work');
  const { openDraft, syncAccount } = await import('../src/sync');
  for (const id of ['bad', 'good']) {
    const draft = fromChapter({ ...chapter, _id: id, content: '', title: id === 'bad' ? 'Sorunlu bölüm' : 'Sağlam bölüm' }, 'author', 'work');
    state.disk.set(draftKey('author', id), JSON.stringify(draft));
    state.online = false;
    const engine = await openDraft('author', id, 'work');
    await engine.edit(draft.title, chapter.content);
    state.online = true;
  }
  const { readingKey } = await import('../src/reading');
  for (const storyId of ['removed-story', 'healthy-story']) state.disk.set(readingKey('author', storyId), JSON.stringify({ storyId, chapterId: `${storyId}-chapter`, scrollPosition: 63, savedAt: 123, synced: false }));
  state.disk.set(readingKey('other', 'private-story'), JSON.stringify({ storyId: 'private-story', chapterId: 'private-chapter', scrollPosition: 42, savedAt: 123 }));
  return { client, draftKey, readingKey, syncAccount };
}

describe('independent background synchronization records', () => {
  it.each([403, 404, 422, 500])('continues after a chapter HTTP %s and a removed reading record, including subsequent retries', async status => {
    const { syncAccount, draftKey, readingKey } = await setup();
    let repaired = false;
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      const path = new URL(String(url)).pathname; const body = JSON.parse(String(options?.body));
      if (path === '/api/chapters/bad' && !repaired) return response(status, { message: 'Bu bölüm eşitlenemedi.' });
      if (path === '/api/reading-progress') return !repaired && body.storyId === 'removed-story'
        ? response(404, { message: 'Bölüm yayından kaldırılmış.' }) : response(200, { ok: true });
      return response(200, { item: { ...chapter, ...body, revision: 4 } });
    });
    const result = await syncAccount('author');
    expect(result.stopped).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({ kind: 'chapter', id: 'bad', label: 'Sorunlu bölüm', status }),
      expect.objectContaining({ kind: 'reading', id: 'removed-story', status: 404 }),
    ]);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(JSON.parse(state.disk.get(draftKey('author', 'bad'))!)).toMatchObject({ dirty: true, content: chapter.content, baseRevision: 3 });
    expect(JSON.parse(state.disk.get(draftKey('author', 'good'))!)).toMatchObject({ dirty: false, content: chapter.content, baseRevision: 4 });
    expect(JSON.parse(state.disk.get(readingKey('author', 'removed-story'))!)).toMatchObject({ synced: false, scrollPosition: 63 });
    expect(JSON.parse(state.disk.get(readingKey('author', 'healthy-story'))!)).toMatchObject({ synced: true, scrollPosition: 63 });
    expect(JSON.parse(state.disk.get(readingKey('other', 'private-story'))!).synced).toBeUndefined();

    fetch.mockClear(); const retry = await syncAccount('author');
    expect(retry.issues).toHaveLength(2); expect(fetch).toHaveBeenCalledTimes(2);
    repaired = true; fetch.mockClear();
    expect(await syncAccount('author')).toEqual({ issues: [], stopped: false });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(state.disk.get(draftKey('author', 'bad'))!).dirty).toBe(false);
    expect(JSON.parse(state.disk.get(readingKey('author', 'removed-story'))!).synced).toBe(true);
  });

  it('stops the whole batch after a matching 401 and keeps every pending local record', async () => {
    const { client, syncAccount } = await setup();
    const expire = vi.fn(() => { client.configureSession(null); client.setAccountId(null); }); client.configureSession('author-token', expire);
    const before = new Map(state.disk);
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(401, { message: 'Oturum sona erdi.' }));
    const result = await syncAccount('author');
    expect(result.stopped).toBe(true); expect(result.issues[0]).toMatchObject({ id: 'bad', status: 401 });
    expect(expire).toHaveBeenCalledOnce(); expect(fetch).toHaveBeenCalledOnce(); expect(state.disk).toEqual(before);
  });

  it('stops the reading batch on 401 without attempting the next reading record', async () => {
    const { syncAccount, draftKey, readingKey } = await setup();
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => String(url).endsWith('/reading-progress')
      ? response(401, { message: 'Oturum sona erdi.' }) : response(200, { item: { ...chapter, ...JSON.parse(String(options?.body)), revision: 4 } }));
    const result = await syncAccount('author');
    expect(result.stopped).toBe(true); expect(result.issues).toEqual([expect.objectContaining({ kind: 'reading', id: 'removed-story', status: 401 })]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse(state.disk.get(draftKey('author', 'good'))!).dirty).toBe(false);
    expect(JSON.parse(state.disk.get(readingKey('author', 'healthy-story'))!).synced).toBe(false);
  });

  it('does not send later records using another account after an account switch', async () => {
    const { client, syncAccount, draftKey } = await setup();
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      client.configureSession('other-token'); client.setAccountId('other');
      return response(500, { message: 'Önceki isteğin hatası.' });
    });
    const result = await syncAccount('author');
    expect(result.stopped).toBe(true); expect(fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(state.disk.get(draftKey('author', 'good'))!).dirty).toBe(true);
  });

  it('stops on connectivity failure rather than timing out on every record', async () => {
    const { syncAccount } = await setup(); const before = new Map(state.disk);
    state.online = false;
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
    const result = await syncAccount('author');
    expect(result.stopped).toBe(true); expect(result.issues[0]?.status).toBe(0); expect(fetch).toHaveBeenCalledOnce(); expect(state.disk).toEqual(before);
  });

  it('continues after one request loses its response while the device remains connected', async () => {
    const { syncAccount, draftKey, readingKey } = await setup();
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (String(url).endsWith('/chapters/bad')) throw new TypeError('response lost');
      return String(url).endsWith('/reading-progress') ? response(200, { ok: true })
        : response(200, { item: { ...chapter, ...JSON.parse(String(options?.body)), revision: 4 } });
    });
    const result = await syncAccount('author');
    expect(result.stopped).toBe(false); expect(result.issues).toEqual([expect.objectContaining({ kind: 'chapter', id: 'bad', status: 0 })]);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(JSON.parse(state.disk.get(draftKey('author', 'bad'))!).dirty).toBe(true);
    expect(JSON.parse(state.disk.get(draftKey('author', 'good'))!).dirty).toBe(false);
    expect(JSON.parse(state.disk.get(readingKey('author', 'healthy-story'))!).synced).toBe(true);
  });

  it('stops for a required terms acceptance even though a record-specific 403 is retryable independently', async () => {
    const { syncAccount } = await setup();
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(403, { code: 'TERMS_ACCEPTANCE_REQUIRED', message: 'Sözleşme kabulü gerekiyor.' }));
    expect((await syncAccount('author')).stopped).toBe(true); expect(fetch).toHaveBeenCalledOnce();
  });

  it('isolates an unreadable reading record and still syncs the next one', async () => {
    const { syncAccount, readingKey } = await setup();
    state.disk.set(readingKey('author', 'removed-story'), '{unreadable');
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => String(url).endsWith('/reading-progress')
      ? response(200, { ok: true }) : response(200, { item: { ...chapter, ...JSON.parse(String(options?.body)), revision: 4 } }));
    const result = await syncAccount('author');
    expect(result.stopped).toBe(false); expect(result.issues).toEqual([expect.objectContaining({ kind: 'reading', id: 'removed-story' })]);
    expect(state.disk.get(readingKey('author', 'removed-story'))).toBe('{unreadable');
    expect(JSON.parse(state.disk.get(readingKey('author', 'healthy-story'))!).synced).toBe(true);
  });
});
