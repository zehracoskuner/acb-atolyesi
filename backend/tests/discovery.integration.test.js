import { beforeAll, afterAll, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Work from '../models/Work.js';
import Chapter from '../models/Chapter.js';
import Log from '../models/Log.js';
import Comment from '../models/Comment.js';
import Library from '../models/Library.js';
import LogComment from '../models/LogComment.js';
import feedRouter from '../routes/feed.js';
import worksRouter from '../routes/works.js';
import searchRouter from '../routes/search.js';
import publicRouter from '../routes/public.js';
import libraryRouter from '../routes/library.js';
import { createNativeSession } from '../services/authSession.js';
import { newTermsAcceptance } from '../config/terms.js';

vi.mock('../services/notificationService.js', () => ({ notifyFollow: vi.fn(async () => {}) }));
let mongo, server, base, author, reader;
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', 'discovery-isolated-local-test-secret-abcdefghijklmnopqrstuvwxyz');
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14', downloadDir: fileURLToPath(new URL('../node_modules/.cache/mongodb-binaries', import.meta.url)) } });
  await mongoose.connect(mongo.getUri(), { dbName: 'discovery_test' });
  const app = express(); app.use(express.json());
  for (const [path, route] of [['feed', feedRouter], ['works', worksRouter], ['search', searchRouter], ['public', publicRouter], ['library', libraryRouter]]) app.use(`/api/${path}`, route);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
}, 120000);
afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo?.stop(); vi.unstubAllEnvs(); });
afterEach(() => vi.restoreAllMocks());
beforeEach(async () => {
  await Promise.all([User, Work, Chapter, Log, Comment, Library, LogComment].map(m => m.deleteMany({})));
  [author, reader] = await User.create(['writer', 'reader'].map(name => ({ email: `${name}@discovery.test`, kullaniciAdi: name, birthYear: 1990, ...newTermsAcceptance() })));
});
async function request(path, user, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${await createNativeSession(user)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, body: await response.json() };
}
async function book(title, options = {}) {
  const work = await Work.create({ title, user: author._id, status: 'published', universe: { genres: ['Fantastik'] }, ...options });
  const chapter = await Chapter.create({ work: work._id, title: 'PUBLIC CHAPTER TITLE', content: 'FULL CHAPTER SECRET', status: 'published', draftContent: { title: 'UNRELEASED TITLE', content: 'UNRELEASED BODY' }, hasUnpublishedChanges: true });
  const draft = await Chapter.create({ work: work._id, title: 'DRAFT TITLE', content: 'DRAFT BODY', status: 'draft' });
  await Work.updateOne({ _id: work._id }, { publishedChapterIds: [chapter._id, draft._id], customChapterTitles: { [chapter._id]: 'UNRELEASED CUSTOM TITLE' } });
  return { work, chapter, draft };
}

it('paginates beyond the six-book shelf with accurate counts and stable ordering', async () => {
  for (let i = 0; i < 9; i++) await book(`Story ${i}`);
  const first = await request('/feed/discover');
  const next = await request('/feed/discover?page=2');
  expect(first.status).toBe(200); expect(first.body.works).toHaveLength(6); expect(next.body.works).toHaveLength(3);
  expect(first.body.pagination).toMatchObject({ total: 9, totalPages: 2 });
  expect(new Set([...first.body.works, ...next.body.works].map(w => w._id)).size).toBe(9);
  const full = await request('/works/discover?sort=updated');
  expect(full.body.items.map(w => w._id)).toEqual([...first.body.works, ...next.body.works].map(w => w._id));
});

it('cards never return chapter text, draft titles, custom titles or hidden author identity', async () => {
  const hidden = await book('Hidden story');
  // Legacy anonymous records remain private; creation of new ones is prohibited.
  await Work.collection.updateOne({ _id: hidden.work._id }, { $set: { isAnonymous: true } });
  await book('Ordinary story');
  for (const path of ['/works/discover', '/search/works?q=story', '/feed/discover', '/feed/needs-review']) {
    const result = await request(path); expect(result.status, path).toBe(200);
    const items = result.body.items || result.body.works;
    const item = items.find(w => w._id === String(hidden.work._id));
    expect(item, path).toBeTruthy(); expect(item.author).toBeNull(); expect(item.chapterCount).toBe(1);
    for (const secret of ['FULL CHAPTER SECRET', 'UNRELEASED', 'DRAFT BODY', 'DRAFT TITLE', 'customChapterTitles', 'publishedChapterIds', 'draftContent']) expect(JSON.stringify(result.body), path).not.toContain(secret);
    expect(JSON.stringify(item)).not.toContain(String(author._id));
  }
});

it('excludes withdrawn, empty, stale and foreign chapter references before pagination and genre counts', async () => {
  const live = await book('Live story');
  const withdrawn = await book('Withdrawn story');
  await Work.updateOne({ _id: withdrawn.work._id }, { status: 'draft' });
  const stale = await book('Stale story');
  await Chapter.updateOne({ _id: stale.chapter._id }, { status: 'draft' });
  await Work.create({ user: author._id, title: 'Foreign story', status: 'published', universe: { genres: ['Gotik'] }, publishedChapterIds: [live.chapter._id] });
  await Work.create({ user: author._id, title: 'Empty story', status: 'published' });
  for (const path of ['/works/discover?limit=1', '/search/works?q=story&limit=1', '/feed/discover']) {
    const result = await request(path); expect(result.body.pagination.total, path).toBe(1);
    expect((result.body.items || result.body.works)[0]._id).toBe(String(live.work._id));
  }
  const genres = await request('/works/genres');
  expect(genres.body.genres.find(g => g.genre === 'Fantastik').count).toBe(1);
  expect(genres.body.genres.find(g => g.genre === 'Gotik').count).toBe(0);
  expect((await request('/feed/needs-review')).body.items.map(w => w._id)).toEqual([String(live.work._id)]);
});

it('uses literal searches, the real genres array and independent writer pagination', async () => {
  await book('Story [literal]'); await book('Story other', { universe: { genres: ['Gotik'] } });
  const filtered = await request('/search/works?q=Story&genre=Fantastik');
  expect(filtered.body.items.map(w => w.title)).toEqual(['Story [literal]']);
  const literal = await request('/search/works?q=%5Bliteral%5D'); expect(literal.body.items).toHaveLength(1);
  const metacharacters = await request('/search/works?q=.*'); expect(metacharacters.status).toBe(200); expect(metacharacters.body.items).toHaveLength(0);
  await User.updateOne({ _id: author._id }, { bio: 'Story [literal]' });
  const people = await request('/search/users?q=Story&genre=Gotik&limit=1');
  expect(people.body.items[0]._id).toBe(String(author._id));
  expect((await request('/search/users?q=.*')).body.items).toHaveLength(0);
  await User.create(Array.from({ length: 17 }, (_, i) => ({ email: `voice${i}@discovery.test`, kullaniciAdi: `voice_${i}`, bio: 'a new voice' })));
  const one = await request('/search/users?q=voice'); const two = await request('/search/users?q=voice&page=2');
  expect(one.body.items).toHaveLength(15); expect(two.body.items).toHaveLength(2); expect(one.body.pagination.total).toBe(17);
});

it('needs-review selects published low-feedback works, excluding moderation drafts', async () => {
  const low = await book('Low feedback'); const high = await book('High feedback');
  const pending = await book('Moderation draft', { status: 'draft' });
  await Chapter.updateOne({ _id: pending.chapter._id }, { status: 'pending_review' });
  await Comment.create(Array.from({ length: 3 }, () => ({ work: high.work._id, author: reader._id, content: 'Published feedback' })));
  await Comment.create([{ work: low.work._id, author: reader._id, content: 'Waiting', status: 'pending_review' }, { work: low.work._id, author: reader._id, content: 'Deleted', isDeleted: true }]);
  const result = await request('/feed/needs-review?genres=Gotik');
  expect(result.body.items.map(w => w._id)).toEqual([String(low.work._id)]);
  expect(result.body.items[0].commentCount).toBe(0);
});

it('writer and journal discovery includes only public logs and at most three journal entries', async () => {
  await Log.create({ author: reader._id, visibility: 'private', content: 'PRIVATE LOG SECRET' });
  await Log.create({ author: reader._id, visibility: 'followers', content: 'FOLLOWERS LOG SECRET' });
  await Log.create(Array.from({ length: 5 }, (_, i) => ({ author: author._id, visibility: 'public', content: `Public log ${i}` })));
  const writers = await request('/feed/writers'); expect(writers.body.items.map(w => w._id)).toEqual([String(author._id)]);
  const logs = await request('/feed/top-logs'); expect(logs.body.items.length).toBeLessThanOrEqual(3);
  expect(logs.body.items.every(l => l.visibility === 'public')).toBe(true);
  expect(JSON.stringify(logs.body)).not.toContain('SECRET');
});

it('follow state agrees across discovery, search and public profile; library menu uses persisted state', async () => {
  await Log.create({ author: author._id, visibility: 'public', content: 'Hello' });
  const { work } = await book('Library story');
  for (const desired of [true, false]) {
    expect((await request(`/public/profile/${author._id}/follow`, reader, 'POST', {})).body.following).toBe(desired);
    expect((await request('/feed/writers', reader)).body.items[0].isFollowedByMe).toBe(desired);
    expect((await request('/search/users?q=writer', reader)).body.items[0].isFollowedByMe).toBe(desired);
    expect((await request(`/public/profile/${author._id}`, reader)).body.user.isFollowedByMe).toBe(desired);
  }
  expect((await request('/library', reader, 'POST', { workId: work._id })).status).toBe(201);
  expect((await request(`/library/check/${work._id}`, reader)).body.inLibrary).toBe(true);
  expect((await request('/library', reader)).body.items[0]._id).toBe(String(work._id));
  await request(`/library/${work._id}`, reader, 'DELETE');
  expect((await request(`/library/check/${work._id}`, reader)).body.inLibrary).toBe(false);
});

it('a writer lookup failure does not break independent book discovery', async () => {
  await book('Available story');
  vi.spyOn(Log, 'find').mockImplementation(() => { throw new Error('isolated service failure'); });
  expect((await request('/feed/writers')).status).toBe(500);
  const works = await request('/works/discover?sort=updated'); expect(works.status).toBe(200); expect(works.body.items).toHaveLength(1);
});
