import { createNativeSession } from "../services/authSession.js";
import { beforeAll, afterAll, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'node:crypto';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import User from '../models/User.js';
import Work from '../models/Work.js';
import Chapter from '../models/Chapter.js';
import ChapterVersion from '../models/ChapterVersion.js';
import Report from '../models/Report.js';
import ImageAsset from '../models/ImageAsset.js';
import ContentCase from '../models/ContentCase.js';
import VisualAccount from '../models/VisualAccount.js';
import Notification from '../models/Notification.js';
import ensureAuth from '../middlewares/ensureAuth.js';
import moderationRoutes from '../routes/contentModeration.js';
import reportRoutes from '../routes/reports.js';
import uploadRoutes from '../routes/upload.js';
import userRoutes from '../routes/user.js';
import worksRoutes from '../routes/works.js';
import chapterRoutes from '../routes/chapter.js';
import aiRoutes from '../routes/ai.js';
import { prepareContentModeration } from '../services/prepareContentModeration.js';
import { fileContentReport, decideContent, manualVisualBlock } from '../services/contentModeration.js';
import { blockedUntil, assertImageAllowed } from '../services/imageAssets.js';
import { saveChapterVersion } from '../services/chapterHistory.js';
import { newTermsAcceptance } from '../config/terms.js';
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(), sendStaffMail: vi.fn(), sendAdminMail: vi.fn(), SITE_URL: 'https://example.test' }));
vi.mock('../utils/aiModerator.js', () => ({ moderateCover: vi.fn(() => { throw Error('AI must not run'); }), moderateChapter: vi.fn(() => { throw Error('AI must not run'); }) }));
vi.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: class {
  getGenerativeModel() { return { generateContent: vi.fn(async () => ({ response: { text: () => JSON.stringify({ analysis: 'Coach analysis', closingNote: 'Keep writing', weakness: { skill: 'ritim', severity: 'low' } }) } })) }; }
} }));
let replica, server, base, owner, admin, moderator, reporters, png, serial = 0;
const actor = user => ({ id: String(user._id), role: user.role });
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', randomBytes(32).toString('hex'));
  vi.stubEnv('GEMINI_API_KEY', 'test-only-key');
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.14', downloadDir: fileURLToPath(new URL('../node_modules/.cache/mongodb-binaries', import.meta.url)) } });
  await mongoose.connect(replica.getUri(), { dbName: 'content_moderation_test' });
  await prepareContentModeration();
  await Promise.all([User.init(), Work.init(), Chapter.init(), ChapterVersion.init(), Notification.init()]);
  png = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } }).png().toBuffer();
  const app = express(); app.use(cookieParser(), express.json());
  app.use('/api/moderation', ensureAuth, moderationRoutes);
  app.use('/api/reports', ensureAuth, reportRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/upload', uploadRoutes); app.use('/api/user', userRoutes); app.use('/api/works', worksRoutes); app.use('/api/chapters', chapterRoutes);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, 120000);
afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await replica?.stop(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  for (const model of [User, Work, Chapter, ChapterVersion, Report, ContentCase, ImageAsset, VisualAccount, Notification]) await model.deleteMany({});
  [owner, admin, moderator, ...reporters] = await User.create(['user', 'admin', 'moderator', ...Array(7).fill('user')].map((role, i) => ({ email: `u${i}@example.test`, kullaniciAdi: `member${i}`, role, profileComplete: true, birthYear: 1990, ...newTermsAcceptance() })));
  vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
  vi.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((options, callback) => new Writable({ write(chunk, encoding, done) { done(); }, final(done) {
    const key = `asset-${++serial}`; callback(null, { secure_url: `https://res.cloudinary.com/test/image/upload/v1/${key}.png`, public_id: key, version: 1 }); done();
  } }));
});
afterEach(() => vi.restoreAllMocks());
async function request(path, user = owner, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { ...(user ? { Authorization: `Bearer ${await createNativeSession(user)}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
}
async function image(kind = 'avatar') {
  const key = `fixture-${++serial}`;
  const asset = await ImageAsset.create({ owner: owner._id, url: `https://res.cloudinary.com/test/image/upload/v1/${key}.png`, publicId: key, bytes: png, mime: 'image/png' });
  let target = owner._id;
  if (kind === 'cover') target = (await Work.create({ user: owner._id, title: key, status: 'published', coverImage: asset.url }))._id;
  else await User.updateOne({ _id: owner._id }, { $set: { [kind === 'avatar' ? 'avatarUrl' : 'bannerImage']: asset.url } });
  return { asset, kind, target };
}
async function report(fixture, reporter = reporters[0]) {
  return fileContentReport(actor(reporter), { targetType: fixture.kind, targetId: String(fixture.target), reason: 'uygunsuz_icerik', expectedUrl: fixture.asset?.url });
}
async function decision(caseId, action = 'remove', by = admin) {
  const current = await ContentCase.findById(caseId);
  return decideContent(caseId, actor(by), { action, revision: current.revision, reason: 'Bağlam incelendi; gerekçeli karar.', message: 'Destek ekibine başvurabilirsiniz.' });
}
async function violation(kind = 'avatar') { const fixture = await image(kind); const r = await report(fixture); await decision(r.contentCase); return r.contentCase; }

it('requires membership to report and staff roles to view evidence or decide', async () => {
  const f = await image();
  expect((await request('/reports', null, 'POST', { targetType: 'avatar', targetId: owner._id, reason: 'spam' })).status).toBe(401);
  const r = await report(f);
  expect((await request(`/moderation/cases/${r.contentCase}`, owner)).status).toBe(403);
  expect((await request(`/moderation/cases/${r.contentCase}/evidence`, reporters[0])).status).toBe(403);
  expect((await request(`/moderation/cases/${r.contentCase}/decision`, owner, 'POST', { action: 'remove', reason: 'X', revision: 1 })).status).toBe(403);
  for (const by of [admin, moderator]) {
    const next = await report(await image('banner'), reporters[1]);
    expect((await request(`/moderation/cases/${next.contentCase}/decision`, by, 'POST', { action: 'remove', reason: 'Gerekçeli insan kararı', revision: 1 })).status).toBe(200);
  }
});
it('involved admins and moderators can inspect cases and evidence but cannot decide', async () => {
  for (const by of [admin, moderator]) {
    const f = await image('banner');
    const r = await report(f, by);
    const detail = await request(`/moderation/cases/${r.contentCase}`, by);
    expect(detail.status).toBe(200); expect(detail.data.canDecide).toBe(false);
    const evidence = await fetch(base + `/moderation/cases/${r.contentCase}/evidence`, { headers: { Authorization: `Bearer ${await createNativeSession(by)}` } });
    expect(evidence.status).toBe(200);
    expect((await request(`/moderation/cases/${r.contentCase}/decision`, by, 'POST', { action: 'dismiss', reason: 'Gerekçe', revision: 1 })).status).toBe(403);
    await User.updateOne({ _id: owner._id }, { $set: { role: by.role } });
    const ownerStaff = { ...owner.toObject(), role: by.role };
    expect((await request(`/moderation/cases/${r.contentCase}`, ownerStaff)).data.canDecide).toBe(false);
    expect((await request(`/moderation/cases/${r.contentCase}/decision`, ownerStaff, 'POST', { action: 'dismiss', reason: 'Gerekçe', revision: 1 })).status).toBe(403);
  }
});
it('groups many reporters, blocks open duplicates and notifies only at the fifth complaint without exposing identities', async () => {
  const f = await image();
  const first = await report(f);
  await expect(report(f)).rejects.toMatchObject({ code: 11000 });
  for (let i = 1; i < 4; i++) await report(f, reporters[i]);
  expect(await Notification.countDocuments({ recipient: owner._id })).toBe(0);
  await Promise.all(reporters.slice(4).map(user => report(f, user)));
  expect(await ContentCase.countDocuments()).toBe(1);
  expect(await Notification.countDocuments({ recipient: owner._id })).toBe(1);
  const notice = await Notification.findOne({ recipient: owner._id }).lean();
  expect(notice.sender).toBeNull(); expect(notice.text).not.toContain(reporters[0].kullaniciAdi);
  expect(await VisualAccount.findById(owner._id)).toBeNull();
  await decision(first.contentCase);
  expect((await VisualAccount.findById(owner._id)).violations).toHaveLength(1);
  expect(await Notification.countDocuments({ recipient: { $in: reporters.map(r => r._id) } })).toBe(7);
});
it('the fourth distinct visual violation allows uploads; fifth gives exactly 72 hours, shared across image kinds', async () => {
  for (const kind of ['cover', 'avatar', 'banner', 'cover']) await violation(kind);
  await expect(assertImageAllowed(owner._id)).resolves.toBeUndefined();
  await violation('banner');
  const a = await VisualAccount.findById(owner._id);
  expect(a.violations).toHaveLength(5); expect(a.penalties).toHaveLength(1);
  expect(+a.penalties[0].until - +a.penalties[0].at).toBe(72 * 3600000);
  await expect(assertImageAllowed(owner._id)).rejects.toMatchObject({ code: 'IMAGE_UPLOAD_BLOCKED' });
  const notices = await Notification.find({ recipient: owner._id }).lean();
  expect(notices.some(n => n.text.includes(a.penalties[0].until.toISOString()))).toBe(true);
});
it('concurrent/repeated decisions create one violation and one penalty; active automatic penalties are not extended', async () => {
  for (let i = 0; i < 4; i++) await violation();
  const r = await report(await image());
  const results = await Promise.allSettled([decision(r.contentCase), decision(r.contentCase, 'remove', moderator)]);
  expect(results.some(r => r.status === 'fulfilled')).toBe(true);
  await decision(r.contentCase);
  const before = await VisualAccount.findById(owner._id);
  expect(before.violations).toHaveLength(5); expect(before.penalties).toHaveLength(1);
  await violation('cover');
  const after = await VisualAccount.findById(owner._id);
  expect(after.penalties).toHaveLength(1); expect(+after.penalties[0].until).toBe(+before.penalties[0].until);
});
it('expired groups never restart; reversing a contributing violation revokes only its active automatic penalty', async () => {
  const cases = []; for (let i = 0; i < 5; i++) cases.push(await violation());
  const manualUntil = new Date(Date.now() + 86400000);
  await manualVisualBlock(actor(admin), owner._id, { reason: 'Bağımsız ağır ihlal', until: manualUntil });
  await decision(cases[0], 'reverse');
  const reversed = await VisualAccount.findById(owner._id);
  expect(reversed.violations.filter(v => v.active)).toHaveLength(4);
  expect(reversed.penalties[0].revokedAt).toBeTruthy();
  expect(+blockedUntil(reversed)).toBe(+manualUntil);
  await VisualAccount.updateOne({ _id: owner._id }, { $set: { 'manual.until': new Date(0), 'penalties.0.until': new Date(0) } });
  await expect(assertImageAllowed(owner._id)).resolves.toBeUndefined();
  await violation('cover');
  expect((await VisualAccount.findById(owner._id)).penalties).toHaveLength(1);
});
it('stale image reports/removals/reversals never replace the new avatar or cover; provider purge is retriable', async () => {
  for (const kind of ['avatar', 'cover']) {
    const f = await image(kind), r = await report(f), replacement = await image('banner');
    const model = kind === 'cover' ? Work : User, field = kind === 'cover' ? 'coverImage' : 'avatarUrl';
    await model.updateOne({ _id: f.target }, { $set: { [field]: replacement.asset.url } });
    cloudinary.uploader.destroy.mockRejectedValueOnce(Error('CDN offline'));
    const removed = await decision(r.contentCase);
    expect(removed.delivery).toBe('purge_pending');
    expect((await model.findById(f.target))[field]).toBe(replacement.asset.url);
    await decision(r.contentCase); // idempotent retry also retries CDN removal
    expect((await ImageAsset.findById(f.asset._id)).delivery).toBe('purged');
    await decision(r.contentCase, 'reverse');
    expect((await model.findById(f.target))[field]).toBe(replacement.asset.url);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(f.asset.publicId, { resource_type: 'image', invalidate: true });
  }
});
it('blocked accounts cannot upload or associate old URLs, but can delete pictures, edit text and save drafts', async () => {
  const f = await image('cover'), available = await image();
  await manualVisualBlock(actor(moderator), owner._id, { reason: 'Gerekçeli manuel engel', until: new Date(Date.now() + 86400000) });
  for (const path of ['/upload', '/user/avatar', '/user/banner']) {
    expect((await request(path, owner, 'POST')).status).toBe(403);
  }
  expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  expect((await request(`/works/${f.target}`, owner, 'PATCH', { coverImage: available.asset.url })).status).toBe(403);
  expect((await request('/works', owner, 'POST', { title: 'New', coverImage: available.asset.url })).status).toBe(403);
  expect((await request(`/works/${f.target}`, owner, 'PATCH', { title: 'New title' })).status).toBe(200);
  expect((await request(`/works/${f.target}`, owner, 'PATCH', { coverImage: '' })).status).toBe(200);
  expect((await request('/user/avatar', owner, 'DELETE')).status).toBe(200);
  expect((await request('/user/profile', owner, 'PATCH', { bio: 'Still writing' })).status).toBe(200);
  const ch = await Chapter.create({ work: f.target, title: 'Draft' });
  await expect(saveChapterVersion({ id: ch._id, userId: owner._id, expectedRevision: 0, content: '<p>Text</p>' })).resolves.toMatchObject({ revision: 1 });
});
it('chapter removal keeps text/history, survives draft saves, and requires revision-matched human approval', async () => {
  const work = await Work.create({ user: owner._id, title: 'Book', status: 'published' });
  const chapter = await Chapter.create({ work: work._id, title: 'Chapter', content: '<p>Original context</p>', status: 'published' });
  await Work.updateOne({ _id: work._id }, { $set: { publishedChapterIds: [chapter._id] } });
  const r = await report({ kind: 'chapter', target: chapter._id });
  await decision(r.contentCase, 'remove', moderator);
  expect((await Chapter.findById(chapter._id)).content).toBe('<p>Original context</p>');
  expect(await VisualAccount.countDocuments()).toBe(0);
  expect((await request(`/chapters/${chapter._id}/status`, owner, 'PATCH', { status: 'published' })).status).toBe(202);
  await saveChapterVersion({ id: chapter._id, userId: owner._id, expectedRevision: 0, content: '<p>Revised context</p>' });
  expect((await Chapter.findById(chapter._id)).moderationHold).toBe(true);
  expect(await ChapterVersion.countDocuments({ chapter: chapter._id })).toBe(2);
  expect((await request(`/chapters/${chapter._id}/status`, owner, 'PATCH', { status: 'published', expectedRevision: 1 })).status).toBe(202);
  expect((await request(`/chapters/${chapter._id}/approve`, moderator, 'PATCH', { expectedRevision: 0, reason: 'Stale' })).status).toBe(409);
  expect((await request(`/chapters/${chapter._id}/approve`, moderator, 'PATCH', { expectedRevision: 1, reason: 'Yeni sürüm bağlamıyla uygun' })).status).toBe(200);
  expect((await Chapter.findById(chapter._id)).moderationHold).toBe(false);
  expect((await Chapter.findById(chapter._id)).content).toBe('<p>Revised context</p>');
});
it('old chapter complaints cannot silently remove edited text and normal publication invokes no AI', async () => {
  const work = await Work.create({ user: owner._id, title: 'Book', status: 'published' });
  const chapter = await Chapter.create({ work: work._id, title: 'Chapter', content: '<p>Original</p>', status: 'published' });
  await Work.updateOne({ _id: work._id }, { $set: { publishedChapterIds: [chapter._id] } });
  const r = await report({ kind: 'chapter', target: chapter._id });
  await saveChapterVersion({ id: chapter._id, userId: owner._id, expectedRevision: 0, content: '<p>Edited</p>' });
  await expect(decision(r.contentCase)).rejects.toMatchObject({ status: 409 });
  expect((await request(`/chapters/${chapter._id}/status`, owner, 'PATCH', { status: 'published', expectedRevision: 1 })).status).toBe(200);
  for (const file of ['routes/upload.js', 'config/cloudinary.js', 'routes/chapter.js']) {
    expect(await readFile(new URL(`../${file}`, import.meta.url), 'utf8')).not.toMatch(/moderateCover|moderateChapter/);
  }
  expect(await readFile(new URL('../routes/ai.js', import.meta.url), 'utf8')).toContain('router.post');
});

it('keeps the authenticated writing coach operational independently of content moderation', async () => {
  expect((await request('/ai/review', null, 'POST', { text: 'A sufficiently long passage.' })).status).toBe(401);
  const result = await request('/ai/review', owner, 'POST', { text: 'A sufficiently long passage.', focus: 'genel' });
  expect(result.status).toBe(200);
  expect(result.data).toMatchObject({ analysis: 'Coach analysis', closingNote: 'Keep writing', signal: { skill: 'ritim', severity: 'low' } });
});

it('does not recycle expired penalty groups or count violations older than ninety days', async () => {
  for (let i = 0; i < 5; i++) await violation();
  await VisualAccount.updateOne({ _id: owner._id }, { $set: { 'penalties.0.until': new Date(0) } });
  await expect(assertImageAllowed(owner._id)).resolves.toBeUndefined();
  await violation();
  expect((await VisualAccount.findById(owner._id)).penalties).toHaveLength(1);
  await VisualAccount.updateOne({ _id: owner._id }, { $set: { 'violations.$[].at': new Date(Date.now() - 91 * 86400000) } });
  for (let i = 0; i < 4; i++) await violation();
  expect((await VisualAccount.findById(owner._id)).penalties).toHaveLength(1);
  await violation();
  expect((await VisualAccount.findById(owner._id)).penalties).toHaveLength(2);
});

it('restores untouched placeholders to a new provider asset and keeps repeated reversals idempotent', async () => {
  const f = await image('avatar'), r = await report(f);
  await decision(r.contentCase);
  expect((await User.findById(owner._id)).avatarUrl).toBe('');
  await decision(r.contentCase, 'reverse');
  const restored = (await User.findById(owner._id)).avatarUrl;
  expect(restored).not.toBe(f.asset.url);
  expect(restored).toMatch(/^https:\/\//);
  expect(await ImageAsset.exists({ owner: owner._id, url: restored, state: 'active' })).toBeTruthy();
  const uploads = cloudinary.uploader.upload_stream.mock.calls.length;
  await decision(r.contentCase, 'reverse');
  expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(uploads);
  expect((await User.findById(owner._id)).avatarUrl).toBe(restored);
});
