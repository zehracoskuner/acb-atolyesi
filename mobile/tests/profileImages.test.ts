import { afterEach, describe, expect, it, vi } from 'vitest';
const { pick, request } = vi.hoisted(() => ({ pick: vi.fn(), request: vi.fn() }));
vi.mock('expo-image-picker', () => ({ launchImageLibraryAsync: pick }));
vi.mock('../src/api', () => ({ api: request }));
import { pickAndUpload } from '../src/images';
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
describe('profile image upload', () => {
  it('does not send anything when selection is cancelled', async () => { pick.mockResolvedValue({ canceled: true }); expect(await pickAndUpload('/user/avatar', 'avatar')).toBeNull(); expect(request).not.toHaveBeenCalled(); });
  it.each([{ mimeType: 'image/png', fileSize: 6 * 1024 * 1024 }, { mimeType: 'image/gif', fileSize: 1000 }])('rejects unsupported assets before uploading: %j', async asset => {
    pick.mockResolvedValue({ assets: [{ uri: 'file:///image', ...asset }] }); await expect(pickAndUpload('/user/banner', 'banner')).rejects.toThrow(); expect(request).not.toHaveBeenCalled();
  });
  it('propagates an upload failure and returns only a confirmed server URL', async () => {
    vi.stubGlobal('FormData', class { append = vi.fn(); }); pick.mockResolvedValue({ assets: [{ uri: 'file:///chosen.png', mimeType: 'image/png', fileSize: 100 }] });
    request.mockRejectedValueOnce(new Error('Yükleme başarısız')); await expect(pickAndUpload('/user/avatar', 'avatar')).rejects.toThrow('Yükleme başarısız');
    request.mockResolvedValueOnce({ avatarUrl: 'https://images.example.test/confirmed.png' }); expect(await pickAndUpload('/user/avatar', 'avatar')).toEqual({ avatarUrl: 'https://images.example.test/confirmed.png' });
  });
});
