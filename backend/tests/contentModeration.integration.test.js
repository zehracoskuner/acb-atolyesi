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
import Character from '../models/Character.js';
import Chapter from '../models/Chapter.js';
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
import characterRoutes from '../routes/characters.js';
import aiRoutes from '../routes/ai.js';
import { prepareContentModeration } from '../services/prepareContentModeration.js';
import { fileContentReport, decideContent, manualVisualBlock } from '../services/contentModeration.js';
import { blockedUntil, assertImageAllowed } from '../services/imageAssets.js';
import { migrateCharacterPortraits } from '../services/portraitMigration.js';
import { saveChapter } from '../services/chapterEditing.js';
import { newTermsAcceptance } from '../config/terms.js';
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(), sendStaffMail: vi.fn(), sendAdminMail: vi.fn(), SITE_URL: 'https://example.test' }));
vi.mock('../utils/aiModerator.js', () => ({ moderateCover: vi.fn(() => { throw Error('AI must not run'); }), moderateChapter: vi.fn(() => { throw Error('AI must not run'); }) }));
vi.mock('@google/generative-ai', () => ({ GoogleGenerativeAI: class {
  getGenerativeModel() { return { generateContent: vi.fn(async () => ({ response: { text: () => JSON.stringify({ analysis: 'Coach analysis', closingNote: 'Keep writing', weakness: { skill: 'ritim', severity: 'low' } }) } })) }; }
} }));
let replica, server, base, owner, admin, moderator, reporters, png, serial = 0;
const portraitObjects = new Map();
const actor = user => ({ id: String(user._id), role: user.role });
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', randomBytes(32).toString('hex'));
  vi.stubEnv('GEMINI_API_KEY', 'test-only-key');
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.14', downloadDir: fileURLToPath(new URL('../node_modules/.cache/mongodb-binaries', import.meta.url)) } });
  await mongoose.connect(replica.getUri(), { dbName: 'content_moderation_test' });
  await prepareContentModeration();
  await Promise.all([User.init(), Work.init(), Chapter.init(), Notification.init()]);
  png = await sharp({ create: { width: 8, height: 8, channels: 3, background: 'red' } }).png().toBuffer();
  const app = express(); app.use(cookieParser(), express.json());
  app.use('/api/moderation', ensureAuth, moderationRoutes);
  app.use('/api/reports', ensureAuth, reportRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/upload', uploadRoutes); app.use('/api/user', userRoutes); app.use('/api/works', worksRoutes); app.use('/api/chapters', chapterRoutes);
  app.use('/api/characters', characterRoutes);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, 120000);
afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await replica?.stop(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  for (const model of [User, Work, Character, Chapter, Report, ContentCase, ImageAsset, VisualAccount, Notification]) await model.deleteMany({});
  [owner, admin, moderator, ...reporters] = await User.create(['user', 'admin', 'moderator', ...Array(7).fill('user')].map((role, i) => ({ email: `u${i}@example.test`, kullaniciAdi: `member${i}`, role, profileComplete: true, birthYear: 1990, ...newTermsAcceptance() })));
  portraitObjects.clear();
  cloudinary.config({ cloud_name: 'test', api_key: 'test', api_secret: 'test-only-secret' });
  vi.spyOn(cloudinary.uploader, 'destroy').mockResolvedValue({ result: 'ok' });
  vi.spyOn(cloudinary.uploader, 'upload_stream').mockImplementation((options, callback) => {
    const chunks = [];
    return new Writable({ write(chunk, encoding, done) { chunks.push(chunk); done(); }, final(done) {
      if (options.public_id?.startsWith('acb-moderation-evidence/')) {
        portraitObjects.set(options.public_id, Buffer.concat(chunks));
        callback(null, { public_id: options.public_id, resource_type: 'image', type: 'authenticated', format: 'png', version: 1 });
        return done();
      }
      const isPortrait = options.type === 'authenticated';
      const key = isPortrait ? options.public_id : `asset-${++serial}`;
      if (isPortrait) portraitObjects.set(key, Buffer.concat(chunks));
      const suffix = isPortrait ? `authenticated/s--signed--/v1/${key}.webp` : `upload/v1/${key}.png`;
      callback(null, { secure_url: `https://res.cloudinary.com/test/image/${suffix}`, public_id: key, version: 1 });
      done();
    } });
  });
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

function mockPortraitDelivery() {
  const fetchLocal = globalThis.fetch;
  const delivered = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) => {
    const url = new URL(input);
    if (url.hostname !== 'res.cloudinary.com') return fetchLocal(input, options);
    const match = /^\/test\/image\/authenticated\/s--[\w-]+--\/v1\/(acb-character-portraits\/[a-f\d]{24})\.webp$/.exec(url.pathname) ||
      /^\/test\/image\/authenticated\/s--[\w-]+--\/v1\/(acb-moderation-evidence\/.+)\.png$/.exec(url.pathname);
    delivered.push(url.pathname);
    const bytes = match && portraitObjects.get(match[1]);
    return Promise.resolve(bytes ? new Response(bytes, { headers: { 'Content-Type': 'image/webp' } }) : new Response(null, { status: 404 }));
  });
  return delivered;
}

it('stores optimized private portraits in Cloudinary, preserves the previous image on failure and supports moderation reversal', async () => {
  const delivered = mockPortraitDelivery();
  const work = await Work.create({ user: owner._id, title: 'Özel karakterler' });
  const character = await Character.create({ user: owner._id, work: work._id, name: 'Lavinia' });
  const path = `/characters/${character._id}/portrait?workId=${work._id}`;
  const ownerToken = await createNativeSession(owner);
  const otherToken = await createNativeSession(reporters[0]);
  const fetchAs = (url, token, options = {}) => fetch(base.replace(/\/api$/, '') + url, {
    ...options, headers: { Authorization: `Bearer ${token}` },
  });
  const upload = (bytes, token = ownerToken, mime = 'image/png') => {
    const body = new FormData();
    body.append('file', new Blob([bytes], { type: mime }), 'portrait.png');
    return fetchAs('/api' + path, token, { method: 'POST', body });
  };
  const largePhoto = await sharp({ create: { width: 1500, height: 2000, channels: 3, background: 'purple' } })
    .withMetadata().png().toBuffer();
  expect((await upload(png, otherToken)).status).toBe(404);
  const stored = await upload(largePhoto);
  expect(stored.status).toBe(201);
  const { item } = await stored.json();
  const asset = await ImageAsset.findOne({ url: item.imageUrl }).select('+bytes');
  expect(asset.providerUrl).toMatch(/^https:\/\/res\.cloudinary\.com\/test\/image\/authenticated\/v1\/.+\.webp$/);
  expect(asset.bytes).toBeUndefined();
  expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(expect.objectContaining({
    type: 'authenticated', overwrite: false,
  }), expect.any(Function));
  expect(portraitObjects.get(asset.publicId).length).toBeLessThan(750 * 1024);
  expect((await upload(png, ownerToken, 'image/jpeg')).status).toBe(400);
  const oversized = await upload(Buffer.alloc(3 * 1024 * 1024 + 1));
  expect(oversized.status).toBe(400);
  expect((await oversized.json()).message).toMatch(/3 MB/);
  cloudinary.uploader.upload_stream.mockImplementationOnce((_options, callback) => new Writable({
    write(chunk, encoding, done) { done(); },
    final(done) { callback(new Error('Provider offline')); done(); },
  }));
  expect((await upload(png)).status).toBe(502);
  expect((await request(`/characters?workId=${work._id}`)).data.items[0].imageUrl).toBe(item.imageUrl);
  expect((await fetchAs(item.imageUrl, otherToken)).status).toBe(404);
  expect(delivered).toHaveLength(0);
  const picture = await fetchAs(item.imageUrl, ownerToken);
  expect(picture.headers.get('content-type')).toBe('image/webp');
  expect(picture.headers.get('cache-control')).toBe('private, no-store');
  const metadata = await sharp(Buffer.from(await picture.arrayBuffer())).metadata();
  expect(metadata).toMatchObject({ format: 'webp', width: 1200, height: 1600 });
  expect(metadata.exif).toBeUndefined();
  const complaint = { targetType: 'characterImage', targetId: item._id, expectedUrl: item.imageUrl, reason: 'uygunsuz_icerik' };
  expect((await request('/reports', reporters[0], 'POST', complaint)).status).toBe(403);
  const result = await request('/reports', moderator, 'POST', complaint);
  expect(result.status).toBe(201);
  const caseId = result.data.sikayet.contentCase;
  const removed = await decision(caseId);
  expect(removed.entry.status).toBe('removed');
  expect(removed.delivery).toBe('restricted');
  expect((await fetchAs(item.imageUrl, ownerToken)).status).toBe(404);
  expect((await fetchAs(`/api/moderation/cases/${caseId}/evidence`, await createNativeSession(admin))).headers.get('content-type')).toBe('image/webp');
  expect((await decision(caseId, 'reverse')).entry.status).toBe('reversed');
  expect((await fetchAs(item.imageUrl, ownerToken)).status).toBe(200);
  expect((await request(path, owner, 'DELETE')).data.item.imageUrl).toBeUndefined();
  expect((await fetchAs(item.imageUrl, ownerToken)).status).toBe(404);
  expect(cloudinary.uploader.upload_stream).toHaveBeenCalledTimes(2);
  expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
});

it('reads and restores a public image from private Cloudinary evidence without MongoDB bytes', async () => {
  mockPortraitDelivery();
  const body = new FormData();
  body.append('file', new Blob([png], { type: 'image/png' }), 'cover.png');
  const response = await fetch(`${base}/upload`, { method: 'POST', body, headers: { Authorization: `Bearer ${await createNativeSession(owner)}` } });
  expect(response.status).toBe(200);
  const upload = await response.json();
  const asset = await ImageAsset.findById(upload.assetId).select('+bytes');
  expect(asset.bytes).toBeUndefined();
  expect(asset.evidence.publicId).toMatch(/^acb-moderation-evidence\//);
  await User.updateOne({ _id: owner._id }, { $set: { avatarUrl: asset.url } });
  const { contentCase } = await report({ asset, kind: 'avatar', target: owner._id });
  const expected = portraitObjects.get(asset.evidence.publicId);
  portraitObjects.delete(asset.evidence.publicId);
  expect((await decision(contentCase)).delivery).toBe('purge_pending');
  expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
  portraitObjects.set(asset.evidence.publicId, expected);
  expect((await decision(contentCase)).delivery).toBe('purged');
  const evidence = await fetch(`${base}/moderation/cases/${contentCase}/evidence`, { headers: { Authorization: `Bearer ${await createNativeSession(admin)}` } });
  expect(evidence.status).toBe(200);
  expect(Buffer.from(await evidence.arrayBuffer()).equals(expected)).toBe(true);
  expect((await decision(contentCase, 'reverse')).entry.status).toBe('reversed');
  const restored = await ImageAsset.findOne({ url: (await User.findById(owner._id)).avatarUrl }).select('+bytes');
  expect(restored.url).not.toBe(asset.url);
  expect(restored.bytes).toBeUndefined();
  expect(restored.evidence.publicId).toBe(asset.evidence.publicId);
});

it('copies legacy attached portraits without removing data, then releases Mongo storage only after verifying the provider copy', async () => {
  mockPortraitDelivery();
  const work = await Work.create({ user: owner._id, title: 'Eski portreler' });
  const character = await Character.create({ user: owner._id, work: work._id, name: 'Lavinia' });
  const _id = new mongoose.Types.ObjectId();
  const url = `/api/characters/${character._id}/portrait/${_id}`;
  const bytes = await sharp(png).webp().toBuffer();
  await ImageAsset.create({ _id, owner: owner._id, url, privatePortrait: true, bytes, mime: 'image/webp' });
  await Character.updateOne({ _id: character._id }, { $set: { imageUrl: url } });
  const unlinked = await ImageAsset.create({ owner: owner._id, url: '/api/characters/unused/portrait/unused', privatePortrait: true, bytes, mime: 'image/webp' });
  const load = id => ImageAsset.findById(id).select('+bytes');
  const headers = { Authorization: `Bearer ${await createNativeSession(owner)}` };
  expect(await migrateCharacterPortraits('--dry-run')).toMatchObject({ inspected: 2, eligible: 1, pending: 1, detachedWithoutCase: 1 });
  expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  expect(await migrateCharacterPortraits('--copy')).toMatchObject({ copied: 1, failed: 0 });
  const copied = await load(_id);
  expect(copied.bytes.equals(bytes)).toBe(true);
  expect(copied.providerUrl).toContain('/image/authenticated/');
  expect(await migrateCharacterPortraits('--copy')).toMatchObject({ alreadyCopied: 1, copied: 0 });
  portraitObjects.delete(copied.publicId);
  const fallback = await fetch(base + url.slice(4), { headers });
  expect(fallback.status).toBe(200);
  expect(Buffer.from(await fallback.arrayBuffer()).equals(bytes)).toBe(true);
  portraitObjects.set(copied.publicId, Buffer.from('different'));
  expect(await migrateCharacterPortraits('--release-mongo')).toMatchObject({ released: 0, failed: 1 });
  expect((await load(_id)).bytes.equals(bytes)).toBe(true);
  portraitObjects.set(copied.publicId, bytes);
  expect(await migrateCharacterPortraits('--release-mongo')).toMatchObject({ released: 1, failed: 0 });
  expect((await load(_id)).bytes).toBeUndefined();
  expect((await load(unlinked._id)).bytes.equals(bytes)).toBe(true);
  const picture = await fetch(base + url.slice(4), { headers });
  expect(picture.status).toBe(200);
  expect(Buffer.from(await picture.arrayBuffer()).equals(bytes)).toBe(true);
});

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
  await expect(saveChapter({ id: ch._id, userId: owner._id, expectedRevision: 0, content: '<p>Text</p>' })).resolves.toMatchObject({ revision: 1 });
});
it('chapter removal keeps text, survives draft saves, and requires revision-matched human approval', async () => {
  const work = await Work.create({ user: owner._id, title: 'Book', status: 'published' });
  const chapter = await Chapter.create({ work: work._id, title: 'Chapter', content: '<p>Original context</p>', status: 'published' });
  await Work.updateOne({ _id: work._id }, { $set: { publishedChapterIds: [chapter._id] } });
  const r = await report({ kind: 'chapter', target: chapter._id });
  await decision(r.contentCase, 'remove', moderator);
  expect((await Chapter.findById(chapter._id)).content).toBe('<p>Original context</p>');
  expect(await VisualAccount.countDocuments()).toBe(0);
  expect((await request(`/chapters/${chapter._id}/status`, owner, 'PATCH', { status: 'published', expectedRevision: 0 })).status).toBe(202);
  await saveChapter({ id: chapter._id, userId: owner._id, expectedRevision: 0, content: '<p>Revised context</p>' });
  expect((await Chapter.findById(chapter._id)).moderationHold).toBe(true);
  expect((await request(`/chapters/${chapter._id}/status`, owner, 'PATCH', { status: 'published', expectedRevision: 1 })).status).toBe(202);
  expect((await request(`/chapters/${chapter._id}/approve`, moderator, 'PATCH', { expectedRevision: 0, reason: 'Stale' })).status).toBe(409);
  expect((await request(`/chapters/${chapter._id}/approve`, moderator, 'PATCH', { expectedRevision: 1, reason: 'Yeni sürüm bağlamıyla uygun' })).status).toBe(200);
  expect((await Chapter.findById(chapter._id)).moderationHold).toBe(false);
  expect((await Chapter.findById(chapter._id)).content).toBe('<p>Revised context</p>');
});
it('old chapter complaints cannot silently remove a newly published version and normal publication invokes no AI', async () => {
  const work = await Work.create({ user: owner._id, title: 'Book', status: 'published' });
  const chapter = await Chapter.create({ work: work._id, title: 'Chapter', content: '<p>Original</p>', status: 'published' });
  await Work.updateOne({ _id: work._id }, { $set: { publishedChapterIds: [chapter._id] } });
  const r = await report({ kind: 'chapter', target: chapter._id });
  await saveChapter({ id: chapter._id, userId: owner._id, expectedRevision: 0, content: '<p>Edited</p>' });
  expect((await request(`/chapters/${chapter._id}/status`, owner, 'PATCH', { status: 'published', expectedRevision: 1 })).status).toBe(200);
  await expect(decision(r.contentCase)).rejects.toMatchObject({ status: 409 });
  for (const file of ['routes/upload.js', 'config/cloudinary.js', 'routes/chapter.js']) {
    expect(await readFile(new URL(`../${file}`, import.meta.url), 'utf8')).not.toMatch(/moderateCover|moderateChapter/);
  }
  expect(await readFile(new URL('../routes/ai.js', import.meta.url), 'utf8')).toContain('router.post');
});
it('private drafting does not invalidate complaints against the text still live', async () => {
  const work = await Work.create({ user: owner._id, title: 'Book', status: 'published' });
  const chapter = await Chapter.create({ work: work._id, title: 'Chapter', content: '<p>Live version</p>', status: 'published' });
  await Work.updateOne({ _id: work._id }, { $set: { publishedChapterIds: [chapter._id] } });
  const r = await report({ kind: 'chapter', target: chapter._id });
  await saveChapter({ id: chapter._id, userId: owner._id, expectedRevision: 0, content: '<p>Private draft</p>' });
  await decision(r.contentCase, 'remove', moderator);
  const stored = await Chapter.findById(chapter._id).select('+draftContent');
  expect(stored.content).toBe('<p>Live version</p>');
  expect(stored.draftContent.content).toBe('<p>Private draft</p>');
  expect(stored.moderationHold).toBe(true);
  expect((await request(`/chapters/${chapter._id}/status`, owner, 'PATCH', { status: 'published', expectedRevision: 1 })).status).toBe(202);
  const submitted = await Chapter.findById(chapter._id).select('+reviewSubmission +draftContent');
  expect(submitted.content).toBe('<p>Live version</p>');
  expect(submitted.reviewSubmission.content).toBe('<p>Private draft</p>');
  expect(submitted.draftContent.content).toBe('<p>Private draft</p>');
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
