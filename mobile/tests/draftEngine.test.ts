import { describe, expect, it } from 'vitest';
import { DraftEngine, draftKey, fromChapter, reconcile, saveFields, type Draft, type DraftStorage } from '../src/draftEngine';
import type { Chapter } from '../src/types';
const chapter: Chapter = { _id: 'chapter', title: 'İlk bölüm', content: '<p>İstanbul’da <strong>bir</strong> sabah.</p>', revision: 4 };
function storage() {
  const data = new Map<string, Draft>();
  return { data, read: async (k: string) => data.get(k) || null, write: async (k: string, d: Draft) => { data.set(k, structuredClone(d)); } } satisfies DraftStorage & { data: Map<string, Draft> };
}
describe('durable writing and revision synchronization', () => {
  it('does not resend content for a title edit after server HTML normalization', async () => {
    const e = new DraftEngine(fromChapter(chapter, 'user', 'work'), storage(), async d => ({ ...chapter, content: '<p>A<br /></p>', title: d.title, revision: 5 }));
    await e.edit(chapter.title, '<p>A<br></p>'); await e.sync(); await e.edit('Only title', e.draft.content);
    expect(saveFields(e.draft)).toEqual({ expectedRevision: 5, title: 'Only title' });
  });
  it('opens recovery when another device saves before publication', async () => {
    const e = new DraftEngine(fromChapter(chapter, 'user', 'work'), storage(), async () => chapter);
    const remote = { ...chapter, title: 'Other device', content: '<p>Remote</p>', revision: 5 };
    await expect(e.publish(chapter, async () => { throw { status: 409, body: { current: remote } }; })).rejects.toMatchObject({ status: 409 });
    expect(e.draft.content).toBe(chapter.content); expect(e.draft.conflict).toEqual(remote);
  });
  it('sends only changed fields and scopes disk keys by account, work and chapter', async () => {
    const e = new DraftEngine(fromChapter(chapter, 'user', 'work'), storage(), async () => chapter);
    await e.edit('Yeni başlık', chapter.content);
    expect(saveFields(e.draft)).toEqual({ title: 'Yeni başlık', expectedRevision: 4 });
    expect(draftKey('user', 'chapter', 'work')).not.toBe(draftKey('user', 'chapter', 'other'));
    expect(reconcile(e.draft, chapter, true).conflict).toEqual(chapter);
  });
  it('queues a second save requested while the first one is in flight', async () => {
    let release!: (c: Chapter) => void; const sent: Draft[] = [];
    const e = new DraftEngine(fromChapter(chapter, 'user', 'work'), storage(), d => {
      sent.push(d); return sent.length === 1 ? new Promise(r => { release = r; }) : Promise.resolve({ ...chapter, title: d.title, content: d.content, revision: 6 });
    });
    await e.edit('A', '<p>A</p>'); const first = e.sync(); await Promise.resolve(); await Promise.resolve();
    await e.edit('B', '<p>B</p>'); const next = e.sync();
    release({ ...chapter, title: 'A', content: '<p>A</p>', revision: 5 });
    await Promise.all([first, next]); expect(sent.map(d => [d.baseRevision, d.title])).toEqual([[4, 'A'], [5, 'B']]); expect(e.draft.dirty).toBe(false);
  });
  it('does not publish after a failed save or after typing changes the confirmed snapshot', async () => {
    let published = false; const e = new DraftEngine(fromChapter(chapter, 'user', 'work'), storage(), async () => { throw new Error('offline'); });
    await e.edit('A', 'A');
    await expect(e.publish({ title: 'A', content: 'A' }, async () => { published = true; return chapter; })).rejects.toThrow('offline');
    expect(published).toBe(false); expect(e.draft.content).toBe('A');
    await e.edit('B', 'B');
    await expect(e.publish({ title: 'A', content: 'A' }, async () => chapter)).rejects.toThrow('metin değişti');
  });
  it('coordinates autosave with publication and preserves typing during publication', async () => {
    let release!: (c: Chapter) => void; let sends = 0; let publishes = 0;
    const live = { ...chapter, status: 'published' };
    const e = new DraftEngine(fromChapter(live, 'user', 'work'), storage(), async d => { sends++; return { ...live, title: d.title, content: d.content, revision: 4 + sends, hasUnpublishedChanges: true }; });
    await e.edit('Approved', '<p>Approved</p>');
    const publishing = e.publish({ title: e.draft.title, content: e.draft.content }, () => { publishes++; return new Promise(r => { release = r; }); });
    while (!release) await new Promise(r => setTimeout(r, 0));
    await e.edit('Private', '<p>Private</p>'); const auto = e.sync();
    expect(sends).toBe(1); expect(e.publish({ title: 'Other', content: '' }, async () => chapter)).toBe(publishing);
    release({ ...live, title: 'Approved', content: '<p>Approved</p>', revision: 5, hasUnpublishedChanges: false });
    await publishing; expect(e.draft.content).toBe('<p>Private</p>'); expect(e.draft.dirty).toBe(true);
    await auto; expect(sends).toBe(2); expect(publishes).toBe(1); expect(e.draft.hasUnpublishedChanges).toBe(true);
  });
  it('preserves formatted Turkish content across closing and reopening offline', async () => {
    const disk = storage(); const engine = new DraftEngine(fromChapter(chapter, 'user', 'work'), disk, async () => { throw new Error('offline'); });
    const html = '<h2>Üç şehir</h2><p style="text-align:justify">İzmir <em>ışıkları</em> ve <u>yağmur</u>.</p><ul><li>Öykü</li></ul>';
    await engine.edit('Çağrı', html); await expect(engine.sync()).rejects.toThrow('offline');
    const saved = await disk.read(draftKey('user', 'chapter', 'work')); expect(saved?.content).toBe(html); expect(saved?.dirty).toBe(true);
    const reopened = new DraftEngine(saved!, disk, async d => ({ ...chapter, title: d.title, content: d.content, revision: 5 }));
    await reopened.sync(); expect(reopened.draft.content).toBe(html); expect(reopened.draft.dirty).toBe(false);
  });
  it('does not lose typing that happens while a network save is pending', async () => {
    const disk = storage(); let resolve!: (c: Chapter) => void; const response = new Promise<Chapter>(r => { resolve = r; });
    const engine = new DraftEngine(fromChapter(chapter, 'user', 'work'), disk, () => response);
    await engine.edit('Başlık', '<p>bir</p>'); const saving = engine.sync(); await Promise.resolve(); await Promise.resolve();
    await engine.edit('Başlık', '<p>bir iki üç</p>'); resolve({ ...chapter, title: 'Başlık', content: '<p>bir</p>', revision: 5 }); await saving;
    expect(engine.draft.content).toBe('<p>bir iki üç</p>'); expect(engine.draft.baseRevision).toBe(5); expect(engine.draft.dirty).toBe(true);
    expect((await disk.read(draftKey('user', 'chapter', 'work')))?.content).toBe('<p>bir iki üç</p>');
  });
  it('blocks conflicting saves, keeps both versions, and archives before explicit resolution', async () => {
    const disk = storage(); let calls = 0; const remote = { ...chapter, content: '<p>Başka cihaz</p>', revision: 5 };
    const engine = new DraftEngine(fromChapter(chapter, 'user', 'work'), disk, async () => { calls++; throw { status: 409, body: { current: remote } }; });
    await engine.edit('Yerel', '<p>Benim metnim</p>'); await engine.sync(); await engine.sync(); expect(calls).toBe(1);
    expect(engine.draft.conflict?.content).toBe(remote.content); expect(engine.draft.content).toBe('<p>Benim metnim</p>');
    await engine.resolve('merge', '<p>Başka cihaz ve benim metnim</p>'); expect(engine.draft.baseRevision).toBe(5); expect(engine.draft.dirty).toBe(true);
    const backup = [...disk.data.entries()].find(([key]) => key.includes(':backup:'))?.[1]; expect(backup?.content).toBe('<p>Benim metnim</p>'); expect(backup?.conflict?.content).toBe(remote.content);
  });
  it('recognizes a committed save whose network response was lost', () => {
    const d = { ...fromChapter(chapter, 'user', 'work'), dirty: true, content: '<p>Yeni</p>' };
    expect(reconcile(d, { ...chapter, content: d.content, revision: 5 }).dirty).toBe(false);
  });
  it('separates accounts and excludes pasted/imported text from organic writing progress', async () => {
    const disk = storage(); const e = new DraftEngine(fromChapter(chapter, 'a', 'work'), disk, async () => chapter);
    await e.edit(chapter.title, '<p>ithal </p>'.repeat(100), false); expect(e.draft.eligibleWordDelta).toBe(0);
    expect(await disk.read(draftKey('b', 'chapter'))).toBeNull();
  });
  it('never reports a network save if the local disk write fails', async () => {
    let sent = false; const disk = { read: async () => null, write: async () => { throw new Error('disk full'); } };
    const e = new DraftEngine(fromChapter(chapter, 'user', 'work'), disk, async () => { sent = true; return chapter; });
    await expect(e.edit('x', 'y')).rejects.toThrow('disk full'); await expect(e.sync()).rejects.toThrow('disk full'); expect(sent).toBe(false);
  });
  it('refreshes clean reopened chapters but never regresses a newer acknowledged revision', async () => {
    const e = new DraftEngine(fromChapter(chapter, 'user', 'work'), storage(), async () => chapter);
    await e.refreshRemote({ ...chapter, revision: 5, content: '<p>Uzak metin</p>' }); expect(e.draft.content).toBe('<p>Uzak metin</p>');
    await e.refreshRemote(chapter); expect(e.draft.baseRevision).toBe(5); expect(e.draft.content).toBe('<p>Uzak metin</p>');
  });
  it('does not resurrect a deleted device draft when a pending save finishes', async () => {
    const disk = storage(); let resolve!: (c: Chapter) => void; const e = new DraftEngine(fromChapter(chapter, 'user', 'work'), disk, () => new Promise(r => { resolve = r; }));
    await e.edit('Başlık', 'Yeni'); const saving = e.sync(); await Promise.resolve(); await Promise.resolve(); const disposed = e.dispose();
    resolve({ ...chapter, content: 'Yeni', revision: 5 }); await Promise.all([saving, disposed]); disk.data.clear();
    await expect(e.edit('x', 'y')).rejects.toThrow('silindi'); await e.sync(); expect(disk.data.size).toBe(0);
  });
});
