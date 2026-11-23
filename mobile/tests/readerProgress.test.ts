import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { resumeLocation } from '../src/readerModel';
const state = vi.hoisted(() => ({ disk: new Map<string, string>(), account: 'a', send: vi.fn() }));
vi.mock('@react-native-community/netinfo', () => ({ default: { fetch: async () => ({ isConnected: true }) } }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: async (k: string) => state.disk.get(k) || null, setItem: async (k: string, v: string) => { state.disk.set(k, v); }, getAllKeys: async () => [...state.disk.keys()] } }));
vi.mock('../src/api', () => ({ api: (...args: unknown[]) => state.send(...args), activeAccountId: () => state.account, message: (e: Error) => e.message, ApiError: class extends Error {} }));
beforeEach(() => { vi.resetModules(); state.disk.clear(); state.account = 'a'; state.send.mockReset().mockResolvedValue({ ok: true }); });
afterEach(() => vi.restoreAllMocks());
describe('reader entry and durable progress', () => {
  it('restores only explicit resume; chapter links and TOC selection start at zero', () => {
    const saved = { chapterId: 'c', scrollPosition: 73, anchor: { id: 'block', fraction: .4 } };
    expect(resumeLocation('resume', 'c', saved)).toEqual(saved);
    for (const mode of [undefined, 'start']) expect(resumeLocation(mode, 'c', saved)).toEqual({ scrollPosition: 0 });
    expect(resumeLocation('resume', 'another', saved)).toEqual({ scrollPosition: 0 });
  });
  it('persists a newer chapter while the old request is in flight and prevents the old receipt overwriting it', async () => {
    const { trackReading, readPosition } = await import('../src/reading');
    let release!: () => void;
    state.send.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({ ok: true }); }));
    const first = trackReading('a', { storyId: 'w', chapterId: 'old', scrollPosition: 90 });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const second = trackReading('a', { storyId: 'w', chapterId: 'new', scrollPosition: 0 });
    await vi.waitFor(async () => expect((await readPosition('a', 'w'))?.chapterId).toBe('new'));
    release(); await Promise.all([first, second]);
    expect(await readPosition('a', 'w')).toMatchObject({ chapterId: 'new', scrollPosition: 0, synced: true });
    expect(state.send.mock.calls.map(call => call[2].chapterId)).toEqual(['old', 'new']);
  });
  it('retains offline anchors, isolates accounts and retries with the original timestamp', async () => {
    const { trackReading, readPosition, syncReading } = await import('../src/reading');
    state.send.mockRejectedValueOnce(new Error('offline'));
    await expect(trackReading('a', { storyId: 'w', chapterId: 'c', scrollPosition: 63, anchor: { id: 'block', fraction: .3 } })).rejects.toThrow('offline');
    const saved = await readPosition('a', 'w'); expect(saved).toMatchObject({ synced: false, anchor: { id: 'block', fraction: .3 } });
    expect(await readPosition('b', 'w')).toBeNull(); state.send.mockResolvedValue({ ok: true });
    await syncReading('a'); expect((await readPosition('a', 'w'))?.savedAt).toBe(saved?.savedAt);
    state.account = 'b'; state.send.mockClear(); await trackReading('a', { storyId: 'w', chapterId: 'c', scrollPosition: 70 }); expect(state.send).not.toHaveBeenCalled();
  });
  it('does not replay a stale queued snapshot over newer local reading', async () => {
    const { trackReading, readPosition } = await import('../src/reading');
    await trackReading('a', { storyId: 'w', chapterId: 'current', scrollPosition: 50 });
    state.send.mockClear(); await trackReading('a', { storyId: 'w', chapterId: 'old', scrollPosition: 10, savedAt: 1 }, true);
    expect((await readPosition('a', 'w'))?.chapterId).toBe('current'); expect(state.send).not.toHaveBeenCalled();
  });
});
