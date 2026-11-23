import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Work from '../models/Work.js';
import Chapter from '../models/Chapter.js';
import ReadingList from '../models/ReadingList.js';
import Library from '../models/Library.js';
import Log from '../models/Log.js';
import AuthSession from '../models/AuthSession.js';
import userRouter from '../routes/user.js';
import publicRouter from '../routes/public.js';
import listRouter from '../routes/readingLists.js';
import libraryRouter from '../routes/library.js';
import logRouter from '../routes/log.js';
import { createNativeSession } from '../services/authSession.js';
import { newTermsAcceptance } from '../config/terms.js';
const uri = process.env.CHAPTER_TEST_MONGO_URI;
let server, base, owner, visitor, published, draft, privateList, publicList, ownerToken, visitorToken;
describe.skipIf(!uri)('mobile profile HTTP contracts and privacy', () => {
  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\/?(?:\?.*)?$/.test(uri || '')) throw Error('Use the isolated local test runner');
    vi.stubEnv('JWT_SECRET', randomBytes(32).toString('hex'));
    await mongoose.connect(uri, { dbName: `profile_${randomUUID().replaceAll('-', '')}` });
    const app = express(); app.use(express.json());
    app.use('/user', userRouter); app.use('/public', publicRouter); app.use('/reading-lists', listRouter); app.use('/library', libraryRouter); app.use('/logs', logRouter);
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(async () => { if (server) await new Promise(r => server.close(r)); await mongoose.disconnect(); vi.unstubAllEnvs(); });
  beforeEach(async () => {
    await Promise.all([User, Work, Chapter, ReadingList, Library, Log, AuthSession].map(m => m.deleteMany({})));
    const common = { birthYear: 1990, emailVerified: true, ...newTermsAcceptance() };
    owner = await User.create({ ...common, email: 'owner@example.test', kullaniciAdi: 'owner', bio: 'Uzun biyografi. '.repeat(30) });
    visitor = await User.create({ ...common, email: 'visitor@example.test', kullaniciAdi: 'visitor' });
    ownerToken = await createNativeSession(owner); visitorToken = await createNativeSession(visitor);
    published = await Work.create({ user: owner._id, title: 'Public work', status: 'published', universe: { genres: ['Roman'] } });
    draft = await Work.create({ user: owner._id, title: 'PRIVATE DRAFT', status: 'draft' });
    const chapter = await Chapter.create({ work: published._id, title: 'Public chapter', status: 'published', content: 'Published text', draftContent: { content: 'PRIVATE WORKING TEXT' }, hasUnpublishedChanges: true, reviewStatus: 'pending_review' });
    await Work.updateOne({ _id: published._id }, { publishedChapterIds: [chapter._id] });
    // Legacy anonymous works remain private; current creation correctly disallows new ones.
    await Work.collection.insertOne({ user: owner._id, title: 'ANONYMOUS WORK', status: 'published', isAnonymous: true });
    privateList = await ReadingList.create({ owner: owner._id, name: 'PRIVATE LIST', isPrivate: true, works: [{ work: published._id }] });
    publicList = await ReadingList.create({ owner: owner._id, name: 'Public list', works: [{ work: published._id }, { work: draft._id }, { work: new mongoose.Types.ObjectId() }] });
    await Library.create({ user: owner._id, work: published._id });
    await Log.create({ author: owner._id, content: 'PUBLIC LOG', visibility: 'public' });
    await Log.create({ author: owner._id, content: 'FOLLOWERS LOG', visibility: 'followers' });
    await Log.create({ author: owner._id, content: 'PRIVATE LOG', visibility: 'private' });
  });
  async function request(path, token = visitorToken, method = 'GET', body) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  it('returns only public identity and published nonanonymous works to a visitor', async () => {
    const profile = await request(`/public/profile/${owner._id}`); expect(profile.status).toBe(200); expect(profile.data.user.workCount).toBe(1);
    for (const field of ['email', 'library', 'drafts', 'readingLists', 'password']) expect(profile.data.user).not.toHaveProperty(field);
    const works = await request(`/public/profile/${owner._id}/works`); expect(works.data.items).toHaveLength(1); expect(works.data.items[0].title).toBe('Public work');
    expect(JSON.stringify(works.data)).not.toMatch(/PRIVATE|ANONYMOUS|pendingReviewCount|unpublishedChangesCount/);
  });
  it('keeps publication, review and working changes separate in the owner response', async () => {
    const own = await request('/user/works', ownerToken); expect(own.status).toBe(200);
    expect(own.data.items.find(w => w._id === String(published._id))).toMatchObject({ status: 'published', chapterCount: 1, pendingReviewCount: 1, unpublishedChangesCount: 1, genres: ['Roman'] });
    expect(own.data.items.find(w => w._id === String(draft._id)).status).toBe('draft');
    expect((await request('/user/works')).data.items).toEqual([]); expect((await request('/user/works', null)).status).toBe(401);
  });
  it('excludes private lists, draft entries and removed works on visitor endpoints', async () => {
    const lists = await request(`/reading-lists/user/${owner._id}`); expect(lists.data.items).toHaveLength(1); expect(lists.data.items[0].works).toHaveLength(1);
    expect(JSON.stringify(lists.data)).not.toContain('PRIVATE'); expect((await request(`/reading-lists/${privateList._id}`)).status).toBe(403);
    expect((await request('/reading-lists', ownerToken)).data.items).toHaveLength(2);
    expect((await request('/library')).data.items).toEqual([]); expect((await request('/library', null)).status).toBe(401);
  });
  it('enforces ownership for list editing and distinguishes removing an entry from deleting a work', async () => {
    expect((await request(`/reading-lists/${publicList._id}`, visitorToken, 'PATCH', { name: 'Hijack' })).status).toBe(404);
    expect((await request(`/reading-lists/${publicList._id}`, ownerToken, 'PATCH', { name: 'Renamed', description: 'Description', isPrivate: true })).status).toBe(200);
    expect((await request(`/reading-lists/user/${owner._id}`)).data.items).toHaveLength(0);
    expect((await request(`/reading-lists/${publicList._id}/works/${published._id}`, ownerToken, 'DELETE')).status).toBe(200);
    expect(await Work.exists({ _id: published._id })).toBeTruthy();
    expect((await request(`/reading-lists/${publicList._id}`, ownerToken, 'DELETE')).status).toBe(200); expect(await Work.exists({ _id: published._id })).toBeTruthy();
  });
  it('returns server follow counts and respects all journal visibility boundaries', async () => {
    const logs = () => request(`/logs/${owner._id}`);
    expect((await logs()).data.items.map(l => l.content)).toEqual(['PUBLIC LOG']);
    const follow = await request(`/public/profile/${owner._id}/follow`, visitorToken, 'POST', {}); expect(follow.data).toMatchObject({ following: true, followerCount: 1 });
    expect((await logs()).data.items.map(l => l.content).sort()).toEqual(['FOLLOWERS LOG', 'PUBLIC LOG']);
    expect((await request(`/logs/${owner._id}`, ownerToken)).data.items).toHaveLength(3);
    expect((await request(`/public/profile/${owner._id}/follow`, visitorToken, 'POST', {})).data).toMatchObject({ following: false, followerCount: 0 });
    expect((await logs()).data.items.map(l => l.content)).toEqual(['PUBLIC LOG']);
  });
});
