import express from 'express';
import mongoose from 'mongoose';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DomUtils, parseDocument } from 'htmlparser2';
import User from '../models/User.js';
import Work from '../models/Work.js';
import Chapter from '../models/Chapter.js';
import InlineComment from '../models/InlineComment.js';
import Comment from '../models/Comment.js';
import Quote from '../models/Quote.js';
import ReadingProgress from '../models/ReadingProgress.js';
import AuthSession from '../models/AuthSession.js';
import { createNativeSession } from '../services/authSession.js';
import { newTermsAcceptance } from '../config/terms.js';
import publicRouter from '../routes/public.js';
import inlineRouter from '../routes/inlineComments.js';
import commentRouter from '../routes/comments.js';
import quoteRouter from '../routes/quotes.js';
import progressRouter from '../routes/readingProgress.js';
vi.mock('../services/emailService.js', () => ({ sendMail: vi.fn(), sendStaffMail: vi.fn(), SITE_URL: 'https://example.test' }));
const uri = process.env.CHAPTER_TEST_MONGO_URI;
describe.skipIf(!uri)('mobile reader HTTP contracts', () => {
  let server, base, owner, token, work, first, second;
  const database = `reader_${randomUUID().replaceAll('-', '')}`;
  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\/?(?:\?.*)?$/.test(uri)) throw new Error('Loopback test database only');
    vi.stubEnv('JWT_SECRET', randomBytes(48).toString('hex')); vi.stubEnv('READER_PREVIEW_CHARACTERS', '120');
    await mongoose.connect(uri, { dbName: database });
    await Promise.all([User, Work, Chapter, Comment, InlineComment, Quote, ReadingProgress, AuthSession].map(m => m.init()));
    const app = express(); app.use(express.json());
    app.use('/public', publicRouter); app.use('/inline-comments', inlineRouter); app.use('/comments', commentRouter); app.use('/quotes', quoteRouter); app.use('/reading-progress', progressRouter);
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
  });
  afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); if (mongoose.connection.name === database) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); vi.unstubAllEnvs(); });
  beforeEach(async () => {
    owner = await User.create({ email: `${randomUUID()}@reader.test`, kullaniciAdi: randomUUID(), birthYear: 1990, ...newTermsAcceptance() });
    token = await createNativeSession(owner);
    work = await Work.create({ user: owner._id, title: 'Eser adı', status: 'published' });
    first = await Chapter.create({ work: work._id, title: 'Yayındaki ilk başlık', content: `<p>${'İlk pasaj. '.repeat(30)}</p><p>PREVIEW_BOUNDARY_SECRET</p>`, order: 1, status: 'published', draftContent: { title: 'DRAFT_TITLE_SECRET', content: 'DRAFT_TEXT_SECRET' } });
    second = await Chapter.create({ work: work._id, title: 'İkinci bölüm', content: '<p>SECOND_CHAPTER_SECRET</p>', order: 2, status: 'published' });
    await Work.updateOne({ _id: work._id }, { publishedChapterIds: [second._id, first._id] });
  });
  async function request(path, { guest = false, method = 'GET', body } = {}) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(!guest ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  const read = () => request(`/public/works/${work._id}/chapters/${first._id}`);
  it('uses narrative order and sends only the configured first-chapter excerpt to guests', async () => {
    const result = await request(`/public/works/${work._id}/preview?chapterId=${second._id}`, { guest: true });
    expect(result.status).toBe(200); expect(result.body.item._id).toBe(String(first._id));
    expect(Array.from(DomUtils.textContent(parseDocument(result.body.item.content)))).toHaveLength(120);
    expect(JSON.stringify(result.body)).not.toMatch(/PREVIEW_BOUNDARY_SECRET|SECOND_CHAPTER_SECRET|DRAFT_/);
    const list = await request(`/public/works/${work._id}/chapters?reader=1`, { guest: true }); expect(list.body.items.map(c => c._id)).toEqual([String(first._id)]);
    const members = await request(`/public/works/${work._id}/chapters`); expect(members.body.items.map(c => c._id)).toEqual([String(first._id), String(second._id)]);
    expect((await request(`/public/works/${work._id}/chapters/${first._id}`, { guest: true })).status).toBe(401);
    await Comment.create({ author: owner._id, work: work._id, chapter: second._id, content: 'SECOND_CHAPTER_SECRET quoted by a reader', status: 'published' });
    await InlineComment.create({ author: owner._id, workId: work._id, chapterId: first._id, paragraphIndex: 1, paragraphText: 'PREVIEW_BOUNDARY_SECRET', content: 'PREVIEW_BOUNDARY_SECRET in comment', status: 'published' });
    for (const path of [`/comments/chapter/${second._id}`, `/inline-comments?chapterId=${first._id}`, `/inline-comments?chapterId=${second._id}`]) {
      const result = await request(path, { guest: true }); expect(result.status).toBe(401); expect(JSON.stringify(result.body)).not.toMatch(/PREVIEW_BOUNDARY_SECRET|SECOND_CHAPTER_SECRET/);
    }
    expect((await request(`/quotes/user/${owner._id}`, { guest: true })).status).toBe(401);
  });
  it('never returns draft title, body or removed chapters via reader APIs', async () => {
    const result = await read(); expect(result.status).toBe(200); expect(result.body.item.title).toBe(first.title); expect(JSON.stringify(result.body)).not.toMatch(/DRAFT_/);
    await Chapter.updateOne({ _id: first._id }, { status: 'draft' }); expect((await read()).status).toBe(404);
    expect((await request(`/public/works/${work._id}/preview`, { guest: true })).body.item._id).toBe(String(second._id));
    await Work.updateOne({ _id: work._id }, { status: 'draft' }); expect((await request(`/public/works/${work._id}/preview`, { guest: true })).status).toBe(404);
  });
  it('verifies the paragraph snapshot, paginates comments, and keeps changed and legacy comments detached', async () => {
    const { body: { item } } = await read();
    const payload = { workId: String(work._id), chapterId: String(first._id), paragraphIndex: 0, blockId: item.blocks[0].id, contentVersion: item.contentVersion, content: 'Bu pasaja yorum' };
    expect((await request('/inline-comments', { method: 'POST', body: payload })).status).toBe(201);
    const summary = await request(`/inline-comments?chapterId=${first._id}&summary=1`); expect(summary.body.counts[0]).toBe(1);
    await InlineComment.create({ author: owner._id, workId: work._id, chapterId: first._id, paragraphIndex: 0, content: 'Eski indeks yorumu' });
    let old = await request(`/inline-comments?chapterId=${first._id}&paragraphIndex=-1&page=1`); expect(old.body.items).toHaveLength(1);
    await Chapter.updateOne({ _id: first._id }, { content: '<p>Tamamen yeni metin.</p>' });
    expect((await request('/inline-comments', { method: 'POST', body: payload })).status).toBe(409);
    expect((await request(`/inline-comments?chapterId=${first._id}&summary=1&contentVersion=${item.contentVersion}`)).status).toBe(409);
    old = await request(`/inline-comments?chapterId=${first._id}&paragraphIndex=-1&page=1`); expect(old.body.items).toHaveLength(2); expect(old.body.items.every(c => c.paragraphIndex === -1)).toBe(true);
  });
  it('keeps newer progress, including backwards reading, scoped to user/work and rejects stale retries', async () => {
    const send = (chapter, position, savedAt) => request('/reading-progress', { method: 'POST', body: { storyId: String(work._id), chapterId: String(chapter._id), scrollPosition: position, savedAt } });
    const now = Date.now() - 1000;
    expect((await send(first, 90, now)).status).toBe(200);
    expect((await send(second, 0, now + 100)).status).toBe(200);
    expect((await send(first, 99, now)).body.stale).toBe(true);
    expect((await request(`/reading-progress/${work._id}`)).body).toMatchObject({ chapterId: String(second._id), scrollPosition: 0 });
    await send(first, 12, now + 200); expect((await request(`/reading-progress/${work._id}`)).body.scrollPosition).toBe(12);
    const other = await User.create({ email: `${randomUUID()}@reader.test`, kullaniciAdi: randomUUID(), birthYear: 1990, ...newTermsAcceptance() }); token = await createNativeSession(other);
    expect((await request(`/reading-progress/${work._id}`)).body.found).toBe(false);
  });
  it('uses server work/author metadata, enforces quote limits and duplicate visibility semantics', async () => {
    expect((await request('/quotes/policy', { guest: true })).body).toEqual({ min: 10, max: 500, visibility: 'public' });
    const body = { workId: String(work._id), text: 'Kaydedilecek gerçek bir alıntı.', workTitle: 'FORGED', authorName: 'FORGED' };
    const saved = await request('/quotes', { method: 'POST', body }); expect(saved.status).toBe(201); expect(saved.body.item).toMatchObject({ workTitle: work.title, authorName: owner.kullaniciAdi });
    expect((await request('/quotes', { method: 'POST', body })).status).toBe(409);
    expect((await request('/quotes', { method: 'POST', body: { ...body, text: 'x'.repeat(501) } })).status).toBe(400);
    expect((await request('/quotes/my')).body.items.map(q => q._id)).toContain(saved.body.item._id);
  });
});
