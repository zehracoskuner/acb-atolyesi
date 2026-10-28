import { describe, it, expect, vi, afterEach } from 'vitest';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import webpush from 'web-push';
import { validateSubscription, webPushPayload, webPushConfig } from '../services/webPush.js';
const keys = { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64)]).toString('base64url'), auth: Buffer.alloc(16).toString('base64url') };
afterEach(() => vi.unstubAllEnvs());
describe('Web Push boundaries', () => {
  it('accepts known providers and rejects arbitrary/internal endpoints and malformed keys', () => {
    for (const host of ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com', 'wns2-db5p.notify.windows.com']) {
      expect(validateSubscription({ endpoint: `https://${host}/push/test`, keys }).keys).toEqual(keys);
    }
    for (const endpoint of ['http://fcm.googleapis.com/a', 'https://127.0.0.1/a', 'https://fcm.googleapis.com.evil.test/a', 'https://evil.test/a', 'https://user:pass@fcm.googleapis.com/a', 'https://fcm.googleapis.com:8443/a']) {
      expect(() => validateSubscription({ endpoint, keys })).toThrow();
    }
    expect(() => validateSubscription({ endpoint: 'https://fcm.googleapis.com/a', keys: { ...keys, auth: 'bad' } })).toThrow();
  });
  it('keeps private content out of push payloads and private keys out of client config', () => {
    expect(webPushPayload({ _id: 'id', text: 'secret moderation text' })).not.toContain('secret');
    const pair = webpush.generateVAPIDKeys();
    vi.stubEnv('WEB_PUSH_PUBLIC_KEY', pair.publicKey); vi.stubEnv('WEB_PUSH_PRIVATE_KEY', pair.privateKey); vi.stubEnv('WEB_PUSH_SUBJECT', 'mailto:admin@example.com');
    expect(webPushConfig().publicKey).toBe(pair.publicKey);
    vi.stubEnv('WEB_PUSH_PRIVATE_KEY', ''); expect(webPushConfig()).toBeNull();
  });
  it('shows a persistent notification, signals only the focused window for sound and uses a fixed safe destination', async () => {
    const handlers = {}; const showNotification = vi.fn(); const postMessage = vi.fn(); const background = vi.fn(); const openWindow = vi.fn();
    const self = { addEventListener: (type, fn) => { handlers[type] = fn; }, registration: { showNotification }, location: { origin: 'https://atelier.test' }, clients: {
      matchAll: vi.fn().mockResolvedValue([{ id: 'a', focused: true, visibilityState: 'visible', postMessage }, { id: 'b', focused: false, postMessage: background }]), openWindow,
    } };
    vm.runInNewContext(readFileSync(new URL('../../frontend/public/push-sw.js', import.meta.url), 'utf8'), { self, URL });
    let pending;
    handlers.push({ data: { json: () => ({ notificationId: 'a'.repeat(24), url: 'https://evil.test', body: 'secret' }) }, waitUntil: promise => { pending = promise; } });
    await pending;
    expect(showNotification.mock.calls[0][1]).toMatchObject({ data: { url: '/bildirimler' }, tag: `acb-${'a'.repeat(24)}` });
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ sound: true }));
    expect(background).toHaveBeenCalledWith(expect.objectContaining({ sound: false }));
    self.clients.matchAll.mockResolvedValue([]);
    handlers.notificationclick({ notification: { close: vi.fn() }, waitUntil: promise => { pending = promise; } });
    await pending; expect(openWindow).toHaveBeenCalledWith('https://atelier.test/bildirimler');
  });
});
