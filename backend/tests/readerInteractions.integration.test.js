import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Work from '../models/Work.js';
import Chapter from '../models/Chapter.js';
import Comment from '../models/Comment.js';
import InlineComment from '../models/InlineComment.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';
import MentionCooldown from '../models/MentionCooldown.js';
import AuthSession from '../models/AuthSession.js';
import commentsRouter from '../routes/comments.js';
import inlineRouter from '../routes/inlineComments.js';
import reportsRouter from '../routes/reports.js';
import adminReportsRouter from '../routes/adminReports.js';
import readerAccess from '../middlewares/readerAccess.js';
import { readerPayload } from '../services/readerContent.js';
import { createNativeSession } from '../services/authSession.js';
import { newTermsAcceptance } from '../config/terms.js';
import { notifyComment, notifyReply } from '../services/notificationService.js';

vi.mock('../services/notificationService.js', () => ({ notifyComment: vi.fn(async () => {}), notifyReply: vi.fn(async () => {}), notifyCommentRemoved: vi.fn(async () => {}), notifyMention: vi.fn(async () => {}), notifyWarning: vi.fn(async () => {}), notifyReport: vi.fn(async () => {}) }));
vi.mock('../services/emailService.js', () => ({ sendStaffMail: vi.fn(async () => {}), sendAdminMail: vi.fn(async () => {}), SITE_URL: 'https://example.test' }));
let mongo, server, base, users, tokens, work, chapter, otherChapter;
const models = [User, Work, Chapter, Comment, InlineComment, Report, AuthSession, Notification, MentionCooldown];
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', randomBytes(48).toString('hex'));
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.14', downloadDir: fileURLToPath(new URL('../node_modules/.cache/mongodb-binaries', import.meta.url)) } });
  await mongoose.connect(mongo.getUri(), { dbName: 'reader_interactions_isolated' });
  await Promise.all(models.map(model => model.init()));
  const app = express(); app.use(express.json());
  app.use('/comments', commentsRouter); app.use('/inline-comments', inlineRouter); app.use('/reports', reportsRouter);
  app.use('/admin/reports', readerAccess, adminReportsRouter);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
}, 120000);
afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo?.stop(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  vi.clearAllMocks(); await Promise.all(models.map(model => model.deleteMany({})));
  users = await User.create([0, 1, 2, 3].map(i => ({ email: `reader${i}@test.local`, kullaniciAdi: `reader${i}`, birthYear: 1990, role: i === 3 ? 'moderator' : 'user', ...newTermsAcceptance() })));
  tokens = await Promise.all(users.map(createNativeSession));
  work = await Work.create({ user: users[0]._id, title: 'Published book', status: 'published' });
  chapter = await Chapter.create({ work: work._id, title: 'First', content: '<div><p><br></p><p>Bir</p><p>İki</p></div>', status: 'published' });
  otherChapter = await Chapter.create({ work: work._id, title: 'Other', content: '<p>Other prose</p>', status: 'published' });
  await Work.updateOne({ _id: work._id }, { publishedChapterIds: [chapter._id, otherChapter._id] });
});
async function request(path, { method = 'GET', user = 1, body } = {}) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user === null ? {} : { Authorization: `Bearer ${tokens[user]}` }) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
const create = (content = 'Yorum', parentId, user = 1, id = chapter._id) => request(`/comments/chapter/${id}`, { method: 'POST', user, body: { content, workId: String(work._id), ...(parentId ? { parentId } : {}) } });
const list = (suffix = '', user = 1) => request(`/comments/chapter/${chapter._id}${suffix}`, { user });

describe('chapter comment contract shared by web and mobile', () => {
  it('requires membership for quoted discussion text, counts root threads, paginates and hides raw likes', async () => {
    const root = (await create('İlk')).body.item;
    await create('Yanıt', root._id, 2); await create('İkinci');
    const first = await list('?page=1&limit=1');
    expect(first.status).toBe(200); expect(first.body).toMatchObject({ total: 2, pages: 2, page: 1 });
    expect((await list('?page=2&limit=1')).body.items[0]).toMatchObject({ _id: root._id, replies: [{ content: 'Yanıt' }] });
    expect((await list('?summary=1')).body).toEqual({ total: 2 });
    expect(JSON.stringify(first.body)).not.toContain('"likes":');
    expect((await list('', null)).status).toBe(401);
    expect((await list('?summary=1', null)).status).toBe(401);
    expect((await create('Misafir', null, null)).status).toBe(401);
  });
  it('validates text, ownership, the work/chapter relation and single-level replies', async () => {
    expect((await create('  ')).status).toBe(400); expect((await create('a'.repeat(2001))).status).toBe(400);
    const root = (await create()).body.item, reply = (await create('Yanıt', root._id)).body.item;
    expect((await create('Nested', reply._id)).status).toBe(400);
    expect((await create('Cross-chapter', root._id, 1, otherChapter._id)).status).toBe(400);
    expect((await request(`/comments/chapter/${chapter._id}`, { method: 'POST', body: { content: 'Forged', workId: String(new mongoose.Types.ObjectId()) } })).status).toBe(400);
    expect((await request(`/comments/${root._id}`, { method: 'PATCH', user: 2, body: { content: 'Not mine' } })).status).toBe(403);
    expect((await request(`/comments/${root._id}`, { method: 'DELETE', user: 2 })).status).toBe(403);
    const edited = await request(`/comments/${root._id}`, { method: 'PATCH', body: { content: 'Düzenlendi' } });
    expect(edited.body.item).toMatchObject({ _id: root._id, content: 'Düzenlendi', isEdited: true });
    expect((await list()).body.items[0].replies).toHaveLength(1);
  });
  it('keeps likes independent, idempotent under parallel requests and excludes removed comments', async () => {
    const root = (await create()).body.item, reply = (await create('Reply', root._id, 2)).body.item;
    const like = (id, liked) => request(`/comments/${id}/like`, { method: 'POST', body: { liked } });
    const results = await Promise.all(Array.from({ length: 6 }, () => like(root._id, true)));
    expect(results.every(r => r.status === 200 && r.body.likeCount === 1)).toBe(true);
    expect((await like(reply._id, true)).body.likeCount).toBe(1);
    await like(root._id, false);
    let item = (await list()).body.items[0]; expect(item.likeCount).toBe(0); expect(item.replies[0].likeCount).toBe(1);
    expect((await request(`/comments/${root._id}`, { method: 'DELETE' })).body.tombstone).toBe(true);
    item = (await list()).body.items[0]; expect(item.content).toBeNull(); expect(item.replies).toHaveLength(1);
    expect(item).not.toHaveProperty('originalContent'); expect(item).not.toHaveProperty('deletedReason');
    expect((await like(root._id, true)).status).toBe(410);
    expect((await list('?summary=1')).body.total).toBe(1);
    expect((await request(`/comments/${reply._id}`, { method: 'DELETE', user: 2 })).body.tombstone).toBe(false);
    const lone = (await create('Lone')).body.item;
    expect((await request(`/comments/${lone._id}`, { method: 'DELETE' })).body.tombstone).toBe(false);
    expect((await list('?summary=1')).body.total).toBe(1);
  });
  it('does not leave an orphan reply or resurrect a deleted root during concurrent operations', async () => {
    const root = (await create()).body.item;
    const [reply, deletion] = await Promise.all([create('Racing reply', root._id, 2), request(`/comments/${root._id}`, { method: 'DELETE' })]);
    expect(deletion.status).toBe(200);
    if (reply.status === 201) { expect((await Comment.findById(root._id)).isDeleted).toBe(true); expect(await Comment.exists({ _id: reply.body.item._id })).toBeTruthy(); }
    else { expect([404, 410]).toContain(reply.status); expect(await Comment.exists({ parentId: root._id })).toBeNull(); }
  });
  it('enforces bans and publication on creation, replies and likes without emitting failed notifications', async () => {
    await User.updateOne({ _id: users[1]._id }, { commentBanned: true });
    const denied = await create(); expect(denied.status).toBe(403); expect(denied.body.message).toContain('kısıtlanmış');
    expect(notifyComment).not.toHaveBeenCalled();
    const root = (await create('Author', null, 0)).body.item;
    expect((await create('Reply', root._id)).status).toBe(403);
    expect((await list()).status).toBe(200);
    await Chapter.updateOne({ _id: chapter._id }, { status: 'draft' });
    expect((await create('Hidden', null, 2)).status).toBe(404);
    expect((await request(`/inline-comments?chapterId=${chapter._id}&summary=1`)).status).toBe(404);
    expect((await request(`/inline-comments?chapterId=${chapter._id}&page=1`)).status).toBe(404);
    expect((await request(`/comments/${root._id}/like`, { method: 'POST', user: 2, body: { liked: true } })).status).toBe(404);
    expect(notifyReply).not.toHaveBeenCalled();
  });
  it('avoids self and duplicate owner/reply notifications', async () => {
    const own = (await create('Owner root', null, 0)).body.item;
    expect(notifyComment).not.toHaveBeenCalled();
    await create('Owner replying to self', own._id, 0); expect(notifyReply).not.toHaveBeenCalled();
    await create('Reader reply', own._id, 1); expect(notifyReply).toHaveBeenCalledTimes(1); expect(notifyComment).not.toHaveBeenCalled();
    const root = (await create('Reader root', null, 1)).body.item;
    expect(notifyComment).toHaveBeenCalledTimes(1);
    await create('Another reader', root._id, 2); expect(notifyReply).toHaveBeenCalledTimes(2); expect(notifyComment).toHaveBeenCalledTimes(2);
  });
});

describe('paragraph anchors and general report targets', () => {
  const inline = async (content = 'Pasaj yorumu', user = 1) => {
    const payload = readerPayload(chapter), block = payload.blocks.find(b => b.text);
    return request('/inline-comments', { method: 'POST', user, body: { workId: String(work._id), chapterId: String(chapter._id), paragraphIndex: block.index, blockId: block.id, contentVersion: payload.contentVersion, content } });
  };
  it('notifies the work owner about paragraph comments with chapter context', async () => {
    expect((await inline()).status).toBe(201);
    expect(notifyComment).toHaveBeenCalledExactlyOnceWith({ senderId: String(users[1]._id), workId: String(work._id), chapterId: String(chapter._id), commentPreview: 'Pasaj yorumu' });
  });
  it('avoids self notifications and duplicate notifications for a mentioned owner', async () => {
    expect((await inline('Kendi yorumum', 0)).status).toBe(201);
    expect(notifyComment).not.toHaveBeenCalled();
    expect((await inline('@reader0 Pasaj yorumu')).status).toBe(201);
    expect(notifyComment).not.toHaveBeenCalled();
    const notifications = await Notification.find({ recipient: users[0]._id }).lean();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('mention');
    expect(String(notifications[0].chapter)).toBe(String(chapter._id));
  });
  it('does not notify for rejected paragraph comments', async () => {
    await User.updateOne({ _id: users[1]._id }, { commentBanned: true });
    expect((await inline()).status).toBe(403);
    expect(notifyComment).not.toHaveBeenCalled();
    expect(await InlineComment.countDocuments()).toBe(0);
  });
  it('keeps paragraph comments separate, hides moderation fields and detaches changed/legacy text', async () => {
    const created = await inline(); expect(created.status).toBe(201);
    await InlineComment.create({ workId: work._id, chapterId: chapter._id, author: users[1]._id, paragraphIndex: 0, content: 'LEGACY' });
    await InlineComment.create({ workId: work._id, chapterId: chapter._id, author: users[1]._id, paragraphIndex: 0, content: 'HIDDEN', reviewNote: 'PRIVATE', status: 'pending_review' });
    const path = `/inline-comments?chapterId=${chapter._id}`;
    expect((await request(path, { user: null })).status).toBe(401);
    const summary = await request(path + '&summary=1'); expect(summary.body.counts).toEqual({ 0: 1 }); expect(summary.body.detachedCount).toBe(1);
    const comments = await request(path + '&page=1'); expect(comments.body.total).toBe(2); expect(JSON.stringify(comments.body)).not.toMatch(/HIDDEN|PRIVATE|reviewNote/);
    expect((await list('?summary=1')).body.total).toBe(0);
    await Chapter.updateOne({ _id: chapter._id }, { content: '<p>Yeni metin</p>' });
    expect((await request(path + '&paragraphIndex=-1&page=1')).body.items).toHaveLength(2);
    expect((await request(path + '&contentVersion=' + readerPayload(chapter).contentVersion)).status).toBe(409);
  });
  it('uses server reasons, validates comment targets and delivers chapter and paragraph reports to moderators', async () => {
    const root = (await create()).body.item, paragraph = (await inline()).body.item;
    const reasons = await request('/reports/reasons'); expect(reasons.body.reasons).toHaveProperty('spam');
    expect(reasons.body.reasons).not.toHaveProperty('telif_ihlali');
    for (const targetId of [root._id, paragraph._id]) {
      const response = await request('/reports', { method: 'POST', user: 2, body: {
        targetType: 'comment', targetId, reason: 'telif_ihlali', description: 'Gerekçe', originalWork: 'Özgün eser',
      } });
      expect(response.status).toBe(400);
    }
    const report = (targetId, user = 2) => request('/reports', { method: 'POST', user, body: { targetType: 'comment', targetId, reason: 'spam' } });
    expect((await report(root._id, null)).status).toBe(401); expect((await report(root._id, 1)).status).toBe(400);
    expect((await report(String(new mongoose.Types.ObjectId()))).status).toBe(404);
    expect((await report(root._id)).status).toBe(201); expect((await report(root._id)).status).toBe(409);
    const inlineReport = await report(paragraph._id); expect(inlineReport.status).toBe(201);
    const listing = await request('/admin/reports?targetType=comment', { user: 3 });
    expect(listing.status).toBe(200); expect(listing.body.sikayetler).toHaveLength(2);
    expect(listing.body.sikayetler.find(r => r.targetId === paragraph._id).targetObj).toMatchObject({ content: 'Pasaj yorumu', work: { title: work.title }, chapter: { title: chapter.title } });
    expect((await request(`/admin/reports/${inlineReport.body.sikayet.id}/comment`, { method: 'DELETE', user: 3 })).status).toBe(200);
    expect((await InlineComment.findById(paragraph._id)).status).toBe('rejected');
    expect((await request(`/inline-comments?chapterId=${chapter._id}`)).body.items).toHaveLength(0);
  });
});
