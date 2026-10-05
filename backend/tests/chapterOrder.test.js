import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import Chapter from '../models/Chapter.js';
import Work from '../models/Work.js';
import ChapterVersion from '../models/ChapterVersion.js';
import { updateChapterOrder } from '../services/chapterHistory.js';

afterEach(() => vi.restoreAllMocks());
function fixture({ owned = true, found = true } = {}) {
  const session = {};
  const chapter = { _id: 'c', work: 'w', order: 3, title: 'Başlık', content: 'Metin',
    status: 'published', reviewNote: 'Not', revision: 5, savedAt: new Date(0),
    save: vi.fn().mockResolvedValue(undefined) };
  vi.spyOn(mongoose.connection, 'transaction').mockImplementation(fn => fn(session));
  vi.spyOn(Chapter, 'findById').mockReturnValue({ session: async () => found ? chapter : null });
  vi.spyOn(Work, 'findOne').mockReturnValue({ session: async () => owned ? { _id: 'w' } : null });
  const lock = vi.spyOn(Work, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
  const versions = vi.spyOn(ChapterVersion, 'create');
  return { chapter, session, lock, versions };
}

describe('chapter order metadata', () => {
  it('persists order without changing text, revision, publication or history', async () => {
    const f = fixture();
    const before = { ...f.chapter };
    const result = await updateChapterOrder({ id: 'c', userId: 'owner', order: 0 });
    expect(f.chapter).toEqual({ ...before, order: 0 });
    expect(result.revision).toBe(5);
    expect(result.draftedFromPublished).toBe(false);
    expect(f.chapter.save).toHaveBeenCalledWith({ session: f.session });
    expect(f.lock).toHaveBeenCalledWith({ _id: 'w' }, { $inc: { __v: 1 } }, { session: f.session });
    expect(f.versions).not.toHaveBeenCalled();
  });
  it.each([-1, 0.5, '2', null, Number.MAX_SAFE_INTEGER + 1])('rejects invalid order %s', async order => {
    const f = fixture();
    await expect(updateChapterOrder({ id: 'c', userId: 'owner', order })).rejects.toMatchObject({ status: 400 });
    expect(f.chapter.save).not.toHaveBeenCalled();
  });
  it('requires work ownership', async () => {
    const f = fixture({ owned: false });
    await expect(updateChapterOrder({ id: 'c', userId: 'other', order: 1 })).rejects.toMatchObject({ status: 403 });
    expect(f.chapter.save).not.toHaveBeenCalled();
  });
  it('rejects missing chapters', async () => {
    fixture({ found: false });
    await expect(updateChapterOrder({ id: 'missing', userId: 'owner', order: 1 })).rejects.toMatchObject({ status: 404 });
  });
});

describe('PUT routing preserves versioned text saves', () => {
  const source = fs.readFileSync(new URL('../routes/chapter.js', import.meta.url), 'utf8');
  const start = source.indexOf('router.put("/:id", ensureAuth');
  const handlerSource = source.slice(start, source.indexOf('\n});', start) + 4);
  function route() {
    let handler;
    const order = vi.fn().mockResolvedValue({ item: { order: 0 } });
    const save = vi.fn().mockResolvedValue({ revision: 6 });
    new Function('router', 'ensureAuth', 'updateChapterOrder', 'saveChapterVersion', 'historyError', handlerSource)(
      { put: (_, auth, fn) => { expect(auth).toBe('auth'); handler = fn; } },
      'auth', order, save, (_, error) => { throw error; });
    const res = { code: 200, status(code) { this.code = code; return this; }, json: vi.fn() };
    return { handler, order, save, res };
  }
  it('order-only requests use the metadata operation', async () => {
    const f = route();
    await f.handler({ params: { id: 'c' }, user: { id: 'owner' }, body: { order: 0 } }, f.res);
    expect(f.order).toHaveBeenCalledWith({ id: 'c', userId: 'owner', order: 0 });
    expect(f.save).not.toHaveBeenCalled();
  });
  it('cannot bypass revision validation by adding order to a text request', async () => {
    const f = route();
    await f.handler({ params: { id: 'c' }, user: { id: 'owner' }, body: { order: 0, content: 'new' } }, f.res);
    expect(f.res.code).toBe(400);
    expect(f.order).not.toHaveBeenCalled();
    expect(f.save).not.toHaveBeenCalled();
  });
  it('text saves keep expectedRevision and the existing history service', async () => {
    const f = route();
    await f.handler({ params: { id: 'c' }, user: { id: 'owner' }, body: { title: 'New', expectedRevision: 5 } }, f.res);
    expect(f.save).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 5, title: 'New' }));
    expect(f.order).not.toHaveBeenCalled();
  });
});
