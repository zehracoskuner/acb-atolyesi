import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import webpush from 'web-push';
import User from '../models/User.js';
import AuthSession from '../models/AuthSession.js';
import Notification from '../models/Notification.js';
import Subscription from '../models/WebPushSubscription.js';
import Delivery from '../models/WebPushDelivery.js';
import { passwordFingerprint } from '../services/authSession.js';
import { drainWebPush } from '../services/webPush.js';
import express from 'express';
import { once } from 'node:events';
import { createNativeSession } from '../services/authSession.js';
import { newTermsAcceptance } from '../config/terms.js';
import router from '../routes/webPush.js';
import Work from '../models/Work.js';
import Chapter from '../models/Chapter.js';

const uri = process.env.CHAPTER_TEST_MONGO_URI;
describe.skipIf(!uri)('durable browser push', () => {
  let user, sub, send, server, base;
  const database = `acb_web_push_${randomUUID().replaceAll('-', '')}`;
  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\/?(?:\?.*)?$/.test(uri)) throw new Error('Loopback only');
    await mongoose.connect(uri, { dbName: database });
    await Promise.all([User, AuthSession, Notification, Subscription, Delivery].map(model => model.init()));
    const keys = webpush.generateVAPIDKeys();
    vi.stubEnv('WEB_PUSH_PUBLIC_KEY', keys.publicKey); vi.stubEnv('WEB_PUSH_PRIVATE_KEY', keys.privateKey); vi.stubEnv('WEB_PUSH_SUBJECT', 'mailto:admin@example.com');
    send = vi.spyOn(webpush, 'sendNotification');
    vi.stubEnv('JWT_SECRET', 'web-push-integration-secret-only-for-tests-123456789');
    const app = express(); app.use(express.json()); app.use(router);
    app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }));
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
    await mongoose.disconnect(); vi.restoreAllMocks(); vi.unstubAllEnvs();
  });
  beforeEach(async () => {
    await Promise.all([User, AuthSession, Notification, Subscription, Delivery].map(model => model.deleteMany({})));
    send.mockReset().mockResolvedValue({ statusCode: 201 });
    user = await User.create({ email: 'push@example.test', kullaniciAdi: 'push_member', birthYear: 1990, profileComplete: true, ...newTermsAcceptance() });
    await AuthSession.create({ user: user._id, tokenHash: 'session', passwordFingerprint: passwordFingerprint(user), expiresAt: new Date(Date.now() + 3600000) });
    sub = await Subscription.create({ user: user._id, sessionHash: 'session', endpoint: 'https://fcm.googleapis.com/push/test',
      keys: { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64)]).toString('base64url'), auth: Buffer.alloc(16).toString('base64url') }, registeredAt: new Date(Date.now() - 1000) });
  });
  const notify = () => Notification.create({ recipient: user._id, type: 'new_log', text: 'private text' });
  it('announces only the first saved publication across draft and review flows', async () => {
    const author = await User.create({ email: 'author@push.test' });
    await User.updateOne({ _id: user._id }, { following: [author._id] });
    const work = await Work.create({ user: author._id, title: 'Book' });
    const chapter = await Chapter.create({ work: work._id, title: 'Chapter', content: '<p>Text</p>', status: 'pending_review' });
    expect(await Notification.countDocuments({ type: 'new_chapter' })).toBe(0);
    chapter.status = 'published'; await chapter.save();
    chapter.title = 'Updated'; await chapter.save();
    chapter.status = 'draft'; await chapter.save();
    chapter.status = 'published'; await chapter.save();
    expect(await Notification.countDocuments({ type: 'new_chapter', recipient: user._id, chapter: chapter._id })).toBe(1);
  });
  it('authenticates API requests, publishes only the public key and binds subscription to the authenticated account', async () => {
    expect((await fetch(base + '/config')).status).toBe(401);
    const token = await createNativeSession(user);
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const config = await (await fetch(base + '/config', { headers })).json();
    expect(config).toEqual({ enabled: true, publicKey: process.env.WEB_PUSH_PUBLIC_KEY });
    const payload = { endpoint: sub.endpoint, keys: sub.keys.toObject(), user: new mongoose.Types.ObjectId().toString(), sessionHash: 'attacker' };
    expect((await fetch(base + '/subscribe', { method: 'POST', headers, body: JSON.stringify(payload) })).status).toBe(200);
    const stored = await Subscription.findById(sub._id);
    expect(String(stored.user)).toBe(String(user._id)); expect(stored.sessionHash).not.toBe('attacker');
    const registeredAt = +stored.registeredAt;
    await fetch(base + '/subscribe', { method: 'POST', headers, body: JSON.stringify(payload) });
    expect(+(await Subscription.findById(sub._id)).registeredAt).toBe(registeredAt);
    expect((await fetch(base + '/subscribe', { method: 'POST', headers, body: JSON.stringify({ ...payload, endpoint: 'https://127.0.0.1/private' }) })).status).toBe(400);
    expect((await fetch(base + '/unsubscribe', { method: 'POST', headers, body: JSON.stringify({ endpoint: sub.endpoint }) })).status).toBe(200);
    expect(await Subscription.countDocuments()).toBe(0);
  });
  it('sends once across scans and does not send old or read notifications', async () => {
    await notify(); await Notification.create({ recipient: user._id, type: 'follow', text: 'read', read: true });
    await Notification.create({ recipient: user._id, type: 'follow', text: 'old', createdAt: new Date(Date.now() - 60000) });
    await drainWebPush(); await drainWebPush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(await Delivery.countDocuments({ state: 'sent' })).toBe(1);
  });
  it('revokes on logout before delivering queued notifications', async () => {
    const notification = await notify(); await Delivery.create({ subscription: sub._id, notification: notification._id });
    await AuthSession.deleteMany({}); await drainWebPush();
    expect(send).not.toHaveBeenCalled(); expect(await Subscription.countDocuments()).toBe(0); expect(await Delivery.countDocuments()).toBe(0);
  });
  it('removes expired endpoints and retries transient failures', async () => {
    await notify(); send.mockRejectedValueOnce(new Error('network'));
    await drainWebPush();
    expect(await Delivery.countDocuments({ state: 'queued', attempts: 1 })).toBe(1);
    await Delivery.updateMany({}, { attemptedAt: new Date(Date.now() - 61000) });
    send.mockRejectedValueOnce({ statusCode: 410 }); await drainWebPush();
    expect(await Subscription.countDocuments()).toBe(0); expect(await Delivery.countDocuments()).toBe(0);
  });
  it('does not deliver a previous account queue after a browser changes accounts', async () => {
    const notification = await notify(); await Delivery.create({ subscription: sub._id, notification: notification._id });
    const other = await User.create({ email: 'other@push.test' });
    await AuthSession.create({ user: other._id, tokenHash: 'other', passwordFingerprint: passwordFingerprint(other), expiresAt: new Date(Date.now() + 3600000) });
    await Subscription.updateOne({ _id: sub._id }, { user: other._id, sessionHash: 'other', registeredAt: new Date() });
    await drainWebPush(); expect(send).not.toHaveBeenCalled();
  });
});
