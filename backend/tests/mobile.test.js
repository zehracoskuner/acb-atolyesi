import { describe, it, expect, vi, afterEach } from 'vitest';
import { mobileLink } from '../services/mobileLinks.js';
import { validPushToken, reorderMobileScenes } from '../services/mobile.js';
import { pushMessage } from '../services/pushDelivery.js';
import Work from '../models/Work.js';
import Plot from '../models/Plot.js';
import legal from '../config/mobileLegal.json' with { type: 'json' };
import { readFileSync } from 'node:fs';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe('native API safety', () => {
  it('uses fixed deep links and encodes credentials without accepting redirect input', () => {
    vi.stubEnv('MOBILE_LINK_BASE', 'acbatolyesi://mobile-link');
    expect(mobileLink('reset', { email: 'çağrı@example.test', otp: '123456' })).toContain('/reset?email=%C3%A7a%C4%9Fr%C4%B1%40example.test');
    vi.stubEnv('MOBILE_LINK_BASE', 'javascript:alert(1)'); expect(() => mobileLink('verify', { token: 'x' })).toThrow();
  });
  it('validates native push addresses and sends no private notification text to lock screens', () => {
    expect(validPushToken('ExpoPushToken[abcdefghij_123]')).toBe(true); expect(validPushToken('https://attacker.test')).toBe(false);
    expect(pushMessage('ExpoPushToken[abcdefghij_123]', 'n')).toEqual(expect.objectContaining({ data: { notificationId: 'n' }, body: 'Atölyeden yeni bir bildirimin var.' }));
  });
  it('requires ownership and rejects incomplete/duplicate scene order', async () => {
    const id = '000000000000000000000001';
    await expect(reorderMobileScenes(id, id, { act: 'giris', expectedUpdatedAt: new Date().toISOString(), sceneIds: [id, id] })).rejects.toMatchObject({ status: 400 });
    vi.spyOn(Work, 'exists').mockResolvedValue(null);
    await expect(reorderMobileScenes(id, id, { act: 'giris', expectedUpdatedAt: new Date().toISOString(), sceneIds: [id] })).rejects.toMatchObject({ status: 403 });
  });
  it('detects concurrent scene edits instead of writing over them', async () => {
    const id = '000000000000000000000001'; vi.spyOn(Work, 'exists').mockResolvedValue({ _id: id });
    vi.spyOn(Plot, 'findOne').mockReturnValue({ lean: async () => ({ _id: id, scenes: [{ _id: id, act: 'giris' }] }) });
    const update = vi.spyOn(Plot, 'updateOne').mockResolvedValue({ matchedCount: 0 });
    const date = new Date().toISOString(); await expect(reorderMobileScenes(id, id, { act: 'giris', expectedUpdatedAt: date, sceneIds: [id] })).rejects.toMatchObject({ status: 409 });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ updatedAt: new Date(date) }), expect.anything(), expect.anything());
  });
  it('serves the complete current legal sections without changing the frontend', () => {
    for (const [id, filename] of [['terms', 'KullaniciSozlesmesi'], ['privacy', 'GizlilikPolitikasi'], ['ethics', 'EtikKurallar']]) {
      const source = readFileSync(new URL(`../../frontend/src/pages/${filename}.jsx`, import.meta.url), 'utf8');
      const sections = [...source.matchAll(/title:\s*"([^"]+)",[\s\S]*?content:\s*`([\s\S]*?)`/g)].map(m => ({ title: m[1], content: m[2] }));
      expect(legal.find(d => d.id === id)?.sections).toEqual(sections);
    }
  });
});
