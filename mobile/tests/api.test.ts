import { afterEach, describe, expect, it, vi } from 'vitest';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.resetModules(); });
describe('native API session isolation', () => {
  async function client() { vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://api.example.test/api'); vi.resetModules(); return import('../src/api'); }
  it('sends Bearer credentials while disabling ambient browser cookies', async () => {
    const m = await client(); m.configureSession('secure-token'); const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ items: [] }) } as Response);
    await m.api('/feed'); expect(fetch).toHaveBeenCalledWith('https://api.example.test/api/feed', expect.objectContaining({ credentials: 'omit', headers: expect.objectContaining({ Authorization: 'Bearer secure-token' }) }));
  });
  it('cannot expire a new account when an old request returns unauthorized', async () => {
    const m = await client(); const oldExpired = vi.fn(); const newExpired = vi.fn(); let resolve!: (r: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(r => { resolve = r; })); m.configureSession('old', oldExpired); const request = m.api('/auth/me');
    m.configureSession('new', newExpired); resolve({ ok: false, status: 401, json: async () => ({ message: 'expired' }) } as Response);
    await expect(request).rejects.toMatchObject({ status: 401 }); expect(oldExpired).not.toHaveBeenCalled(); expect(newExpired).not.toHaveBeenCalled();
  });
  it('expires the matching session and exposes connection failures as retryable errors', async () => {
    const m = await client(); const expired = vi.fn(); m.configureSession('old', expired);
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: 'expired' }) } as Response);
    await expect(m.api('/feed')).rejects.toMatchObject({ status: 401 }); expect(expired).toHaveBeenCalledOnce();
    fetch.mockRejectedValue(new TypeError('network offline')); await expect(m.api('/feed')).rejects.toMatchObject({ status: 0 });
  });
  it('does not put a late successful journal request into another account cache', async () => {
    const m = await client(); const store = await import('../src/communityStore');
    m.configureSession('old'); m.setAccountId('old');
    let resolve!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const pending = m.api('/logs', 'POST', { content: 'private journal', visibility: 'private' });
    m.configureSession('new'); m.setAccountId('new');
    resolve({ ok: true, json: async () => ({ item: { _id: 'secret', type: 'log', visibility: 'private' } }) } as Response);
    await pending; expect(store.getLog('secret')).toBeUndefined();
  });
  it('does not overwrite a confirmed journal like with a stale feed response', async () => {
    const m = await client(); const store = await import('../src/communityStore');
    m.setAccountId('viewer'); m.configureSession('token');
    store.ingestLog({ _id: 'entry', type: 'log', createdAt: '2026-10-29', likedByMe: false, likeCount: 0 });
    let resolve!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const pending = m.api('/feed?scope=mixed');
    store.receiveCommunity('/logs/entry/like', 'POST', { likedByMe: true, likeCount: 1 });
    resolve({ ok: true, json: async () => ({ items: [{ _id: 'entry', type: 'log', likedByMe: false, likeCount: 0 }] }) } as Response);
    await pending; expect(store.getLog('entry')).toMatchObject({ likedByMe: true, likeCount: 1 });
  });
});
