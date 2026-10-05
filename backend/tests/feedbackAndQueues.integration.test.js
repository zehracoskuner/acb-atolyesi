import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import { resolve } from 'node:path';
vi.mock('../services/emailService.js', () => ({ sendStaffMail: vi.fn(), sendAdminMail: vi.fn(), sendMail: vi.fn(), SITE_URL: 'http://localhost' }));
import feedbackRoutes from '../routes/feedback.js';
import reportRoutes from '../routes/reports.js';
import adminReports from '../routes/adminReports.js';
import Feedback from '../models/Feedback.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import Work from '../models/Work.js';
import Chapter from '../models/Chapter.js';

let mongo, server, base, author;
const adminId = new mongoose.Types.ObjectId();
async function request(path, { role = 'user', user = author?._id, method = 'GET', body } = {}) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { 'x-user': String(user), 'x-role': role } : {}) }, body: body && JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
describe('Feedback delivery and administration queues', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ binary: { systemBinary: resolve('node_modules/.cache/mongodb-binaries/mongod-x64-win32-7.0.14.exe'), version: '7.0.14' }, instance: { ip: '127.0.0.1' } });
    await mongoose.connect(mongo.getUri(), { dbName: 'feedback_queues_test' });
    const app = express(); app.use(express.json());
    app.use((req, res, next) => { if (req.headers['x-user']) req.user = { id: req.headers['x-user'], role: req.headers['x-role'] }; next(); });
    app.use('/feedback', feedbackRoutes); app.use('/reports', reportRoutes); app.use('/admin/reports', adminReports);
    server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`;
  }, 60000);
  afterAll(async () => { if (server) await new Promise(r => server.close(r)); await mongoose.disconnect(); await mongo?.stop(); });
  beforeEach(async () => {
    await Promise.all([Feedback.deleteMany({}), Report.deleteMany({}), User.deleteMany({}), Work.deleteMany({}), Chapter.deleteMany({})]);
    author = await User.create({ email: 'writer@example.test', kullaniciAdi: 'Writer' });
  });
  it('delivers an authenticated suggestion to the admin inbox and allows triage', async () => {
    const created = await request('/feedback', { method: 'POST', body: { kind: 'suggestion', subject: '  Bir öneri  ', message: 'Daha kolay bir arama.', status: 'closed', author: adminId } });
    expect(created.status).toBe(201);
    const stored = await Feedback.findById(created.data.id);
    expect(String(stored.author)).toBe(String(author._id)); expect(stored.status).toBe('new'); expect(stored.subject).toBe('Bir öneri');
    const inbox = await request('/feedback?status=new&kind=suggestion', { role: 'admin', user: adminId });
    expect(inbox.data.total).toBe(1); expect(inbox.data.items[0].author.email).toBe(author.email);
    expect((await request(`/feedback/${stored._id}`, { method: 'PATCH', role: 'admin', user: adminId, body: { status: 'reviewing' } })).status).toBe(200);
    expect((await request('/feedback?status=new', { role: 'admin', user: adminId })).data.total).toBe(0);
    expect((await request('/feedback?status=reviewing', { role: 'admin', user: adminId })).data.total).toBe(1);
  });
  it('keeps the inbox private and validates incoming messages', async () => {
    expect((await request('/feedback', { user: null, method: 'POST', body: {} })).status).toBe(401);
    expect((await request('/feedback')).status).toBe(403);
    expect((await request('/feedback', { role: 'moderator' })).status).toBe(403);
    for (const body of [{ kind: 'other', subject: 'Test', message: 'Text' }, { kind: 'complaint', subject: ' ', message: 'Text' }, { kind: 'complaint', subject: 'Test', message: 'x'.repeat(4001) }]) {
      expect((await request('/feedback', { method: 'POST', body })).status).toBe(400);
    }
    const created = await request('/feedback', { method: 'POST', body: { kind: 'complaint', subject: 'Sorun', message: 'Bir sorunla karşılaştım.' } });
    expect(created.status).toBe(201);
    expect((await request(`/feedback/${created.data.id}`, { method: 'PATCH', body: { status: 'closed' } })).status).toBe(403);
    expect((await request('/feedback/not-an-id', { method: 'PATCH', role: 'admin', body: { status: 'closed' } })).status).toBe(400);
    expect((await request('/feedback?kind=invalid', { role: 'admin' })).status).toBe(400);
  });
  it('partitions copyright, inappropriate works/chapters and other reports without losing cases', async () => {
    const records = await Report.create([
      { reason: 'telif_ihlali', targetType: 'work' },
      { reason: 'telif_ihlali', targetType: 'cover', contentCase: new mongoose.Types.ObjectId() },
      { reason: 'uygunsuz_icerik', targetType: 'work' },
      { reason: 'uygunsuz_icerik', targetType: 'chapter', contentCase: new mongoose.Types.ObjectId() },
      { reason: 'uygunsuz_icerik', targetType: 'user' },
      { reason: 'spam', targetType: 'comment' },
    ].map(r => ({ ...r, reporter: author._id, targetId: new mongoose.Types.ObjectId() })));
    const ids = [];
    for (const category of ['copyright', 'inappropriate', 'other']) {
      const result = await request(`/admin/reports?category=${category}`, { role: 'admin' });
      expect(result.status).toBe(200); expect(result.data.meta.toplam).toBe(2);
      ids.push(...result.data.sikayetler.map(r => r._id));
    }
    expect(new Set(ids).size).toBe(records.length);
    const moderator = await request('/admin/reports?category=copyright', { role: 'moderator' });
    // Product policy confirmed 2026-10-05: moderators inspect copyright; only
    // admins decide. Assert identities and denied writes, not just a new count.
    expect(moderator.data.meta.toplam).toBe(2);
    expect(new Set(moderator.data.sikayetler.map(r => r._id))).toEqual(new Set(records.slice(0, 2).map(r => String(r._id))));
    const detail = await request(`/admin/reports/${records[0]._id}`, { role: 'moderator' });
    expect(detail.status).toBe(200);
    expect(detail.data.report.canManage).toBe(false);
    for (const [method, operation] of [['POST', 'workflow'], ['PUT', 'resolve'], ['PUT', 'dismiss'], ['POST', 'warn'], ['DELETE', 'comment']]) {
      expect((await request(`/admin/reports/${records[0]._id}/${operation}`, {
        role: 'moderator', method, body: { operation: 'decision', revision: 0, outcome: 'dismissed', rationale: 'Not permitted' },
      })).status).toBe(403);
    }
    expect((await Report.findById(records[0]._id)).status).toBe('pending');
  });
  it('keeps chapter copyright in the reasoned copyright workflow even when an older client sends contentReview', async () => {
    const work = await Work.create({ user: adminId, title: 'Eser', status: 'published' });
    const chapter = await Chapter.create({ work: work._id, title: 'Bölüm', content: 'Metin', status: 'published' });
    await Work.updateOne({ _id: work._id }, { $set: { publishedChapterIds: [chapter._id] } });
    const result = await request('/reports', { method: 'POST', body: { targetType: 'chapter', targetId: chapter._id, reason: 'telif_ihlali', contentReview: true, originalWork: 'Özgün eserim', description: 'Başvuru gerekçesi' } });
    expect(result.status).toBe(201);
    const stored = await Report.findById(result.data.sikayet.id).select('+evidenceSnapshot');
    expect(stored.contentCase).toBeUndefined(); expect(stored.stage).toBe('received'); expect(stored.evidenceSnapshot.target.content).toBe('Metin');
  });
});
