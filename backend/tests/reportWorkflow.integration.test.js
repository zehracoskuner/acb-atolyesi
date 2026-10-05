// Explicit entry avoids the installed Vitest Windows bare-import resolver issue.
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import { resolve } from 'node:path';
vi.doMock('../services/emailService.js', () => ({ sendStaffMail: vi.fn().mockResolvedValue(), sendAdminMail: vi.fn().mockResolvedValue(), sendMail: vi.fn().mockResolvedValue(), SITE_URL: 'http://localhost' }));
const { default: reports } = await import('../routes/reports.js');
const { default: adminReports } = await import('../routes/adminReports.js');
const { default: adminRouter } = await import('../routes/admin.js');
import requireRole from '../middlewares/requireRole.js';
import Comment from '../models/Comment.js';
import Report from '../models/Report.js';
import Work from '../models/Work.js';
import Chapter from '../models/Chapter.js';
import Notification from '../models/Notification.js';
import { publicReport } from '../services/reportWorkflow.js';

let mongo, server, base, work, chapter;
const claimant = new mongoose.Types.ObjectId(), owner = new mongoose.Types.ObjectId(), admin = new mongoose.Types.ObjectId(), stranger = new mongoose.Types.ObjectId();
async function request(path, { user = claimant, role = 'user', method = 'GET', body } = {}) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'x-user': String(user), 'x-role': role }, body: body && JSON.stringify(body) });
  return { status: res.status, data: await res.json() };
}
async function create(reason = 'telif_ihlali') {
  return request('/reports', { method: 'POST', body: { targetType: 'chapter', targetId: chapter._id, reason, originalWork: 'https://example.com/original (özel kanıt)', description: 'İzinsiz kopya' } });
}
async function staff(id, revision, operation, extra = {}) {
  return request(`/admin/reports/${id}/workflow`, { user: admin, role: 'admin', method: 'POST', body: { revision, operation, ...extra } });
}
describe('Report HTTP workflow with isolated MongoDB', () => {
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ binary: { systemBinary: resolve('node_modules/.cache/mongodb-binaries/mongod-x64-win32-7.0.14.exe'), version: '7.0.14' }, instance: { ip: '127.0.0.1' } });
    await mongoose.connect(mongo.getUri(), { dbName: 'report_workflow_test' });
    await Report.init();
    const app = express(); app.use(express.json());
    app.use((req, res, next) => { if (req.headers['x-user']) req.user = { id: req.headers['x-user'], role: req.headers['x-role'] }; next(); });
    app.use('/reports', reports); app.use('/admin/reports', adminReports); app.use('/secret-admin', requireRole('admin'), adminRouter);
    server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}`;
  }, 60000);
  afterAll(async () => { if (server) await new Promise(r => server.close(r)); await mongoose.disconnect(); await mongo?.stop(); });
  beforeEach(async () => {
    vi.restoreAllMocks(); await Promise.all([Report.deleteMany({}), Work.deleteMany({}), Chapter.deleteMany({}), Notification.deleteMany({}), Comment.deleteMany({})]);
    work = await Work.create({ user: owner, title: 'Eser', status: 'published' });
    chapter = await Chapter.create({ work: work._id, title: 'Bölüm', content: 'Başvuru anındaki metin', status: 'published' });
    await Work.updateOne({ _id: work._id }, { $set: { publishedChapterIds: [chapter._id] } });
  });
  it('submission, tracking, information, reasoned decision and both parties appeal on the same report', async () => {
    const made = await create(); expect(made.status).toBe(201); const id = made.data.sikayet.id;
    expect((await create()).status).toBe(409);
    expect((await request('/reports/mine')).data.sikayetler[0].stage).toBe('received');
    expect((await staff(id, 0, 'decision', { outcome: 'upheld', action: 'none', rationale: 'reason' })).status).toBe(409);
    expect((await staff(id, 0, 'review')).status).toBe(200);
    expect((await staff(id, 1, 'request_information', { text: 'Tarihli özgün kaydı gönderin.' })).status).toBe(200);
    expect((await request(`/reports/${id}/information`, { method: 'POST', body: { revision: 2, text: 'Özel kanıt cevabı' } })).status).toBe(200);
    expect((await staff(id, 3, 'decision', { outcome: 'upheld', action: 'notice', rationale: ' ' })).status).toBe(400);
    expect((await staff(id, 3, 'decision', { outcome: 'upheld', action: 'notice', rationale: 'Metin karşılaştırması ve tarihler incelendi.', privateNote: 'Gizli personel notu' })).status).toBe(200);
    const theirs = await request(`/reports/${id}`, { user: owner }); expect(theirs.status).toBe(200);
    expect(JSON.stringify(theirs.data)).not.toMatch(/Gizli|Özel kanıt|example.com|originalWork|reporter|evidenceSnapshot/);
    expect(theirs.data.report.canAppeal).toBe(true);
    expect((await request(`/reports/${id}/appeal`, { user: owner, method: 'POST', body: { revision: 4, text: 'İzin belgem var.' } })).status).toBe(200);
    expect((await request(`/reports/${id}/appeal`, { method: 'POST', body: { revision: 5, text: 'Karara ilişkin gerekçeli itirazım.' } })).status).toBe(200);
    expect((await request(`/reports/${id}/appeal`, { user: owner, method: 'POST', body: { revision: 6, text: 'Yine' } })).status).toBe(409);
    expect((await staff(id, 6, 'decision', { outcome: 'dismissed', action: 'none', rationale: 'İzin belgesi doğrulandı.' })).status).toBe(200);
    expect(await Report.countDocuments()).toBe(1);
    expect((await Chapter.findById(chapter._id)).status).toBe('published');
  });
  it('privacy and role checks cover detail, list, legacy shortcuts and forged operations', async () => {
    const id = (await create()).data.sikayet.id;
    for (const user of [owner, stranger]) expect((await request(`/reports/${id}`, { user })).status).toBe(404);
    expect((await request('/reports/mine', { user: owner })).data.sikayetler).toHaveLength(0);
    for (const role of ['user', 'moderator']) {
      expect((await request(`/admin/reports/${id}`, { user: stranger, role })).status).toBe(role === 'moderator' ? 200 : 403);
      expect((await request(`/admin/reports/${id}/resolve`, { user: stranger, role, method: 'PUT' })).status).toBe(403);
    }
    for (const [method, op] of [['PUT', 'resolve'], ['PUT', 'dismiss'], ['POST', 'warn'], ['DELETE', 'comment']]) {
      expect((await request(`/admin/reports/${id}/${op}`, { user: admin, role: 'admin', method })).status).toBe(409);
    }
    expect((await request(`/reports/${id}/decision`, { method: 'POST', body: {} })).status).toBe(400);
    expect((await request(`/admin/reports/${id}/workflow`, { user: claimant, role: 'admin', method: 'POST', body: { revision: 0, operation: 'review' } })).status).toBe(403);
  });
  it('snapshot survives edits, conflicting decisions cannot both commit, notification failure does not roll back', async () => {
    const id = (await create()).data.sikayet.id;
    await Chapter.updateOne({ _id: chapter._id }, { $set: { content: 'Değişti' } });
    expect((await Report.findById(id).select('+evidenceSnapshot')).evidenceSnapshot.target.content).toBe('Başvuru anındaki metin');
    expect(JSON.stringify((await request(`/reports/${id}`)).data)).not.toContain('evidenceSnapshot');
    await staff(id, 0, 'review');
    vi.spyOn(Notification, 'create').mockRejectedValue(new Error('delivery offline'));
    const results = await Promise.all(['upheld', 'dismissed'].map(outcome => staff(id, 1, 'decision', { outcome, action: 'none', rationale: 'İnsan incelemesi sonucu.' })));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect((await Report.findById(id)).decisions).toHaveLength(1);
  });
  it('legacy statuses and non-copyright reports retain existing behavior', async () => {
    // General work reports retain the legacy workflow; chapter content reports
    // now use the versioned human-review cases tested in contentModeration.
    const id = (await request('/reports', { method: 'POST', body: { targetType: 'work', targetId: work._id, reason: 'spam' } })).data.sikayet.id;
    expect((await request(`/admin/reports/${id}/resolve`, { user: admin, role: 'admin', method: 'PUT' })).status).toBe(200);
    expect((await request(`/reports/${id}`)).data.report.stage).toBe('decided');
    for (const status of ['pending', 'resolved', 'dismissed']) {
      expect(publicReport({ _id: id, reporter: claimant, status, adminNote: 'secret' }, claimant).stage).toBe(status === 'pending' ? 'received' : 'decided');
    }
  });
  it('secret admin alias cannot bypass workflow and moderators can inspect copyright evidence', async () => {
    const id = (await create()).data.sikayet.id;
    expect((await request('/admin/reports?status=all', { user: stranger, role: 'moderator' })).data.sikayetler).toHaveLength(1);
    expect((await request('/secret-admin/reports/' + id + '/resolve', { user: admin, role: 'admin', method: 'PUT' })).status).toBe(409);
    expect((await request('/secret-admin/reports/' + id + '/workflow', { user: admin, role: 'admin', method: 'POST', body: { revision: 0, operation: 'review' } })).status).toBe(200);
  });
  it('unauthenticated requests fail and malformed or missing evidence is rejected without creation', async () => {
    const res = await fetch(base + '/reports/mine'); expect(res.status).toBe(401);
    expect((await request('/admin/reports', { user: stranger })).status).toBe(403);
    expect((await request('/reports', { method: 'POST', body: { targetType: 'chapter', targetId: chapter._id, reason: 'telif_ihlali', description: 'Gerekçe' } })).status).toBe(400);
    await Chapter.updateOne({ _id: chapter._id }, { $set: { status: 'draft' } });
    expect((await create()).status).toBe(404);
    expect(await Report.countDocuments()).toBe(0);
  });
  it('moderator comment removal still works but never closes a separate copyright file', async () => {
    const comment = await Comment.create({ author: owner, work: work._id, content: 'Yorum', status: 'published' });
    const copyright = await Report.create({ reporter: claimant, targetType: 'comment', targetId: comment._id, reason: 'telif_ihlali', stage: 'received' });
    const spam = await Report.create({ reporter: stranger, targetType: 'comment', targetId: comment._id, reason: 'spam' });
    expect((await request('/admin/reports/' + spam._id + '/comment', { user: admin, role: 'moderator', method: 'DELETE' })).status).toBe(200);
    expect((await Report.findById(copyright._id)).status).toBe('pending');
    expect((await Report.findById(spam._id)).status).toBe('resolved');
    expect((await Comment.findById(comment._id)).isDeleted).toBe(true);
  });
  it('rejects every reason on an owned work or chapter without creating a report', async () => {
    for (const targetType of ['work', 'chapter', 'cover']) {
      for (const reason of ['spam', 'uygunsuz_icerik', 'telif_ihlali', 'taciz', 'nefret_soylemi', 'diger']) {
        const result = await request('/reports', { user: owner, method: 'POST', body: {
          targetType, targetId: targetType === 'chapter' ? chapter._id : work._id, reason,
          description: 'Gerekçe', originalWork: 'Özgün eser', targetOwner: stranger,
        } });
        expect(result.status).toBe(400);
      }
    }
    expect(await Report.countDocuments()).toBe(0);
  });
  it('allows involved staff to inspect while preserving decision restrictions', async () => {
    const id = (await create()).data.sikayet.id;
    for (const user of [owner, claimant]) for (const role of ['admin', 'moderator']) {
      const detail = await request(`/admin/reports/${id}`, { user, role });
      expect(detail.status).toBe(200);
      expect(detail.data.report.evidenceSnapshot.target.content).toBe('Başvuru anındaki metin');
      expect(detail.data.report.canManage).toBe(false);
      expect((await request(`/admin/reports/${id}/workflow`, { user, role, method: 'POST', body: {
        operation: 'decision', revision: 0, outcome: 'dismissed', action: 'none', rationale: 'İncelendi',
      } })).status).toBe(403);
    }
    expect((await request(`/admin/reports/${id}`, { user: admin, role: 'admin' })).data.report.canManage).toBe(true);
  });

});
