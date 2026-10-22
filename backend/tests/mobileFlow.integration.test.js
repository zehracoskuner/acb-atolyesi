import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
vi.mock('dotenv/config', () => ({}));
vi.mock('../services/emailService.js', () => ({ sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendEmailVerifyOtp: vi.fn(), sendStaffMail: vi.fn() }));
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import auth from '../routes/auth.js';
import works from '../routes/works.js';
import chapters from '../routes/chapter.js';
import publicRoutes from '../routes/public.js';
import feed from '../routes/feed.js';
import logs from '../routes/log.js';
import progress from '../routes/readingProgress.js';
import mobile from '../routes/mobile.js';
import plots from '../routes/plots.js';
import userRoutes from '../routes/user.js';
import readingLists from '../routes/readingLists.js';
import quotes from '../routes/quotes.js';
import library from '../routes/library.js';
import readerAccess from '../middlewares/readerAccess.js';
import User from '../models/User.js';
import ChapterVersion from '../models/ChapterVersion.js';
import PushDevice from '../models/PushDevice.js';
import PushDelivery from '../models/PushDelivery.js';
import Notification from '../models/Notification.js';
import '../models/Character.js';
import { drainPush } from '../services/pushDelivery.js';
import { newTermsAcceptance } from '../config/terms.js';
// Dedicated, ephemeral loopback replica set; never reads the app's MONGO_URI or touches user data.
describe('native login → feed → writing → reopen → publication → reading', () => {
  let repl, server, base, token;
  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', randomUUID() + randomUUID());
    repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(repl.getUri(), { dbName: `acb_mobile_test_${randomUUID().replaceAll('-', '')}` });
    await Promise.all([User.init(), ChapterVersion.init(), PushDevice.init(), PushDelivery.init()]);
    await User.create({ email: 'mobile@example.test', kullaniciAdi: 'gezgin_yazar', sifreHash: await bcrypt.hash('a-real-test-password', 4), emailVerified: true, profileComplete: true, birthYear: 1990, ...newTermsAcceptance() });
    const app = express(); app.use(express.json()); app.use(cookieParser()); app.use('/api', (req, res, next) => req.path.startsWith('/auth/') ? next() : readerAccess(req, res, next));
    for (const [path, router] of Object.entries({ auth, works, chapters, public: publicRoutes, feed, logs, 'reading-progress': progress, mobile, plots, user: userRoutes, 'reading-lists': readingLists, quotes, library })) app.use(`/api/${path}`, router);
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${server.address().port}/api`;
  }, 600000);
  afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (repl) await repl.stop(); vi.unstubAllEnvs(); }, 30000);
  async function request(path, method = 'GET', body) {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json(), cookie: r.headers.get('set-cookie') };
  }
  it('uses real native sessions and preserves rich text through versioned saves and reopen', async () => {
    const login = await request('/auth/login', 'POST', { email: 'mobile@example.test', sifre: 'a-real-test-password', client: 'native' });
    expect(login.status).toBe(200); expect(login.cookie).toBeNull(); token = login.data.token; expect(token).toBeTruthy();
    expect((await request('/auth/me')).data.user.kullaniciAdi).toBe('gezgin_yazar');
    await request('/logs', 'POST', { content: 'Bugün İstanbul üzerine yazıyorum.', visibility: 'public' });
    expect((await request('/feed')).data.items[0].content).toContain('İstanbul');
    const work = await request('/works', 'POST', { title: 'Yağmurun Öyküsü', genres: ['Dram'] }); expect(work.status).toBe(201);
    const created = await request('/chapters', 'POST', { workId: work.data.item._id, title: 'Üç sabah' }); expect(created.status).toBe(201);
    const id = created.data.item._id; const content = '<h2>İstanbul</h2><p style="text-align:justify">Çığlık değil, <strong>sessizlik</strong>.</p><ul><li>Öykü</li></ul>';
    const saved = await request(`/chapters/${id}`, 'PUT', { title: 'Üç sabah', content, expectedRevision: 0, eligibleWordDelta: 6 }); expect(saved.status).toBe(200); expect(saved.data.item.content).toBe(content);
    const reopened = await request(`/chapters/${id}`); expect(reopened.data.item.content).toBe(content); expect(reopened.data.item.revision).toBe(1);
    const conflict = await request(`/chapters/${id}`, 'PUT', { content: '<p>Old client</p>', expectedRevision: 0 }); expect(conflict.status).toBe(409); expect(conflict.data.current.content).toBe(content);
    const pub = await request(`/chapters/${id}/status`, 'PATCH', { status: 'published', expectedRevision: 1, workId: work.data.item._id }); expect(pub.status).toBe(200);
    expect((await request(`/public/works/${work.data.item._id}/chapters`)).data.items[0]._id).toBe(id);
    expect((await request(`/public/works/${work.data.item._id}/chapters/${id}`)).data.item.content).toBe(content);
    expect((await request('/reading-progress', 'POST', { storyId: work.data.item._id, chapterId: id, scrollPosition: 63 })).status).toBe(200);
    expect((await request(`/reading-progress/${work.data.item._id}`)).data.scrollPosition).toBe(63);
    await request('/auth/logout', 'POST', {}); expect((await request('/auth/me')).status).toBe(401);
  }, 60000);
  it('reorders scenes with an optimistic timestamp and rejects a stale touchscreen action', async () => {
    token = (await request('/auth/login', 'POST', { email: 'mobile@example.test', sifre: 'a-real-test-password', client: 'native' })).data.token;
    const { data: { item: work } } = await request('/works', 'POST', { title: 'Sahne sırası' });
    const a = (await request(`/plots/${work._id}/scenes`, 'POST', { title: 'Sabah', act: 'giris' })).data.scene;
    const b = (await request(`/plots/${work._id}/scenes`, 'POST', { title: 'Akşam', act: 'giris' })).data.scene;
    const expectedUpdatedAt = (await request(`/plots/${work._id}`)).data.plot.updatedAt;
    const ordered = await request(`/mobile/plots/${work._id}/order`, 'POST', { sceneIds: [b._id, a._id], act: 'giris', expectedUpdatedAt }); expect(ordered.status).toBe(200);
    const next = (await request(`/plots/${work._id}`)).data.plot.scenes.sort((a, b) => a.order - b.order); expect(next.map(s => s.title)).toEqual(['Akşam', 'Sabah']);
    expect((await request(`/mobile/plots/${work._id}/order`, 'POST', { sceneIds: [a._id, b._id], act: 'giris', expectedUpdatedAt })).status).toBe(409);
  });
  it('keeps profile drafts, private journals and lists private while persisting reader collections', async () => {
    const ownerToken = token;
    const owner = (await request('/user/profile')).data.user;
    const ownWorks = (await request('/user/works')).data.items;
    const published = ownWorks.find(w => w.status === 'published');
    expect(published).toBeTruthy();
    const draft = (await request('/works', 'POST', { title: 'Özel taslak' })).data.item;
    await request('/logs', 'POST', { content: 'Özel günlük içeriğim', visibility: 'private' });
    const privateList = (await request('/reading-lists', 'POST', { name: 'Özel listem', isPrivate: true })).data.list;
    await User.create({ email: 'reader@example.test', kullaniciAdi: 'okur_test', sifreHash: await bcrypt.hash('reader-password', 4), emailVerified: true, profileComplete: true, birthYear: 1990, ...newTermsAcceptance() });
    token = (await request('/auth/login', 'POST', { email: 'reader@example.test', sifre: 'reader-password', client: 'native' })).data.token;
    try {
      expect((await request(`/public/profile/${owner._id}/works`)).data.items.some(w => w._id === draft._id)).toBe(false);
      expect((await request(`/works/${draft._id}`)).status).not.toBe(200);
      expect((await request(`/logs/${owner._id}`)).data.items.some(l => l.content === 'Özel günlük içeriğim')).toBe(false);
      expect((await request(`/reading-lists/user/${owner._id}`)).data.items.some(l => l._id === privateList._id)).toBe(false);
      expect((await request(`/reading-lists/${privateList._id}`, 'PATCH', { isPrivate: false })).status).not.toBe(200);
      expect((await request(`/public/profile/${owner._id}/follow`, 'POST', {})).status).toBe(200);
      expect((await request(`/public/profile/${owner._id}`)).data.user.followerCount).toBe(1);
      expect((await request('/library', 'POST', { workId: published._id })).status).toBe(201);
      expect((await request('/library')).data.items.some(w => w._id === published._id)).toBe(true);
      const list = (await request('/reading-lists', 'POST', { name: 'Okuduklarım', isPrivate: false })).data.list;
      expect((await request(`/reading-lists/${list._id}/works`, 'POST', { workId: published._id })).status).toBe(200);
      expect((await request('/reading-lists')).data.items[0].works[0].work._id).toBe(published._id);
      expect((await request('/quotes', 'POST', { workId: published._id, text: 'Çığlık değil, sessizlik.', workTitle: published.title })).status).toBe(201);
      expect((await request('/quotes/my')).data.items[0].text).toBe('Çığlık değil, sessizlik.');
    } finally { token = ownerToken; }
  });
  it('registers push for a revocable session, spools notifications, checks receipts and removes expired devices', async () => {
    const registered = await request('/mobile/push-device', 'POST', { token: 'ExpoPushToken[mobile_test_12345]', platform: 'android' }); expect(registered.status).toBe(200);
    const device = await PushDevice.findOne(); expect(device.sessionHash).toMatch(/^[a-f\d]{64}$/); expect(device.sessionHash).not.toBe(token);
    await Notification.create({ recipient: device.user, type: 'warning', text: 'Private moderation text never leaves the inbox.' });
    const originalFetch = globalThis.fetch; const calls = [];
    const mock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (!String(url).startsWith('https://exp.host/')) return originalFetch(url, options);
      calls.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ data: String(url).endsWith('getReceipts') ? { 'ticket-1': { status: 'ok' } } : [{ status: 'ok', id: 'ticket-1' }] }) };
    });
    try {
      await drainPush(); expect(calls[0][0].body).not.toContain('Private'); expect((await PushDelivery.findOne()).state).toBe('ticket');
      await PushDelivery.updateOne({}, { $set: { attemptedAt: new Date(Date.now() - 1000000) } }); await drainPush(); expect((await PushDelivery.findOne()).state).toBe('sent');
      await request('/auth/logout', 'POST', {}); await drainPush(); expect(await PushDevice.countDocuments()).toBe(0);
    } finally { mock.mockRestore(); }
  });
});
