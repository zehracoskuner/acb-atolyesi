import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawingSaver, draftKey, readDrawingDraft, waitForDrawing } from "../../frontend/src/lib/drawingPersistence.js";
import { MAX_DRAWING_BYTES, validateDrawing } from "../../shared/drawingProtocol.js";
const snapshot = name => ({ document: { schema: {}, store: { name } } });
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
function fixture(workId = 'work', storage = new Map()) {
  const disk = { get length() { return storage.size; }, key: i => [...storage.keys()][i], setItem: (k,v) => storage.set(k,v), getItem: k => storage.get(k), removeItem: k => storage.delete(k) };
  const request = vi.fn(async (path,b) => ({ ok:true, workId, mutationId:b.mutationId, revision:b.expectedRevision+1 }));
  const notify = vi.fn();
  const saver = new DrawingSaver({ userId:'user', workId, revision:0, storage:disk, request, notify });
  return { saver, request, storage, disk, notify };
}
afterEach(() => vi.restoreAllMocks());
describe('drawing recovery and save queue', () => {
  it('persists immediately, before debounce or navigation, isolated by user and work', async () => {
    const h=fixture(); h.saver.edit(snapshot('çizim'));
    expect(readDrawingDraft(h.disk,'user','work',{revision:0}).snapshot).toEqual(snapshot('çizim'));
    expect(readDrawingDraft(h.disk,'another','work',{})).toBeNull();
    expect(draftKey('user','a')).not.toBe(draftKey('user','b'));
    await h.saver.save(); expect(h.storage.size).toBe(0); expect(h.saver.status).toBe('Kaydedildi');
  });
  it('serializes edits during a save and only acknowledges the submitted version', async () => {
    const h=fixture(), first=deferred(); h.request.mockImplementationOnce(() => first.promise);
    h.saver.edit(snapshot('first')); const saving=h.saver.save(); await Promise.resolve();
    const body=h.request.mock.calls[0][1]; h.saver.edit(snapshot('latest'));
    expect(h.saver.status).toBe('Kaydediliyor'); expect(h.request).toHaveBeenCalledTimes(1);
    first.resolve({ok:true,workId:'work',mutationId:body.mutationId,revision:1}); await saving;
    expect(h.request.mock.calls[1][1]).toMatchObject({snapshot:snapshot('latest'),expectedRevision:1});
    expect(h.saver.status).toBe('Kaydedildi');
  });
  it('keeps local data on failure and retries the same id after a lost acknowledgement', async () => {
    const h=fixture(); h.request.mockRejectedValueOnce(new Error('offline')); h.saver.edit(snapshot('safe')); await h.saver.save();
    expect(h.saver.status).toBe('Kaydedilemedi'); expect(h.storage.size).toBe(1);
    await h.saver.save(); expect(h.request.mock.calls[0][1].mutationId).toBe(h.request.mock.calls[1][1].mutationId);
  });
  it('does not accept a malformed receipt or auto-overwrite conflicts', async () => {
    const h=fixture(); h.request.mockResolvedValueOnce({ok:true}); h.saver.edit(snapshot('safe')); await h.saver.save();
    expect(h.saver.status).toBe('Kaydedilemedi'); expect(h.saver.revision).toBe(0);
    h.request.mockRejectedValueOnce(Object.assign(new Error(),{status:409})); await h.saver.save(); expect(h.storage.size).toBe(1);
  });
  it('waits for outgoing work before reloading while another work saves independently', async () => {
    const a=fixture('a'), b=fixture('b'), gate=deferred(); a.request.mockImplementationOnce(() => gate.promise);
    a.saver.edit(snapshot('a')); const saving=a.saver.save(); await Promise.resolve();
    b.saver.edit(snapshot('b')); await b.saver.save(); expect(b.saver.status).toBe('Kaydedildi');
    let done=false; const waiting=waitForDrawing('a').then(() => done=true); await Promise.resolve(); expect(done).toBe(false);
    gate.resolve({ok:true,workId:'a',revision:1,mutationId:a.request.mock.calls[0][1].mutationId}); await saving; await waiting; expect(done).toBe(true);
  });
  it('recovers newer edits after a committed request whose acknowledgement was lost on reload', async () => {
    const h=fixture('recovery'); h.disk.setItem(draftKey('user','recovery'),JSON.stringify({snapshot:snapshot('newer'),revision:0,pendingId:'id',version:2,sentVersion:1}));
    expect(readDrawingDraft(h.disk,'user','recovery',{revision:1,mutationId:'id'})).toMatchObject({revision:1,snapshot:snapshot('newer')});
  });
  it('checks UTF-8 bytes and reports local quota failure', async () => {
    expect(() => validateDrawing(snapshot('ş'.repeat(MAX_DRAWING_BYTES/2)))).toThrow();
    const h=fixture(); h.disk.setItem=()=>{throw new Error('quota');}; h.saver.edit(snapshot('safe')); expect(h.saver.localError).toContain('saklanamadı'); await h.saver.save();
  });
  it('keeps drafts from separate editing sessions when one session saves', async () => {
    const storage = new Map(), a = fixture('tabs', storage), b = fixture('tabs', storage);
    a.saver.edit(snapshot('tab a')); b.saver.edit(snapshot('tab b'));
    expect(a.saver.key).not.toBe(b.saver.key); expect(storage.size).toBe(2);
    await a.saver.save(); expect(storage.size).toBe(1);
    expect(readDrawingDraft(b.disk, 'user', 'tabs', {}).snapshot).toEqual(snapshot('tab b'));
    await b.saver.save();
  });
  it('retains a memory recovery draft during SPA navigation when disk quota is exhausted', async () => {
    const h=fixture('quota-navigation'); h.disk.setItem=()=>{throw new Error('quota');};
    h.request.mockRejectedValueOnce(new Error('offline'));
    h.saver.edit(snapshot('recover me')); await h.saver.save();
    expect(readDrawingDraft(h.disk,'user','quota-navigation',{}).snapshot).toEqual(snapshot('recover me'));
    await h.saver.save();
  });
});
