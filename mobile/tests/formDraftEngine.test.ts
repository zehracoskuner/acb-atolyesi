import { describe, expect, it } from 'vitest';
import { FormDraftEngine, formKey, normalizeForm, type FormDraft, type RemoteForm } from '../src/formDraftEngine';
const initial = (localId = 'one'): FormDraft => ({ userId: 'author', localId, kind: 'personal', version: null, dirty: true, editedAt: 1, data: normalizeForm({ title: 'Çağrı', content: '<p>İlk <strong>cümle</strong>.</p>' }) });
const remote = (draft: FormDraft): RemoteForm => ({ recordId: 'server-id', version: 'version-2', data: structuredClone(draft.data) });
const store = () => {
  const disk = new Map<string, FormDraft>();
  return { disk, write: async (key: string, draft: FormDraft) => { disk.set(key, structuredClone(draft)); } };
};
describe('durable individual form drafts', () => {
  it('restores unsent Turkish rich text after restart and preserves other drafts of the same kind', async () => {
    const { disk, write } = store();
    const one = new FormDraftEngine(initial('one'), write, async () => { throw new Error('offline'); });
    const two = new FormDraftEngine(initial('two'), write, async () => { throw new Error('offline'); });
    const html = '<h2>Öykü</h2><p>İzmir <em>ışıkları</em>.</p><ul><li>Yağmur</li></ul>';
    await one.edit({ content: html }); await two.edit({ title: 'Diğer kayıt', content: '<p>Başka metin.</p>' });
    const restarted = new FormDraftEngine(disk.get(formKey(one.draft))!, write, async draft => remote(draft));
    expect(restarted.draft.data.content).toBe(html); expect(restarted.draft.dirty).toBe(true);
    expect(disk.get(formKey(two.draft))?.data.content).toBe('<p>Başka metin.</p>');
    await restarted.sync(); expect(restarted.draft.dirty).toBe(false); expect(restarted.draft.data.content).toBe(html);
  });
  it('does not erase typing made while a network save is pending', async () => {
    const { write, disk } = store(); let finish!: (value: RemoteForm) => void;
    const engine = new FormDraftEngine(initial(), write, () => new Promise(resolve => { finish = resolve; }));
    await engine.keep(); const sent = structuredClone(engine.draft); const saving = engine.sync();
    await Promise.resolve(); await Promise.resolve();
    await engine.edit({ content: '<p>Ağ isteği sırasında yeni cümle.</p>' }); finish(remote(sent)); await saving;
    expect(engine.draft.data.content).toContain('yeni cümle'); expect(engine.draft.dirty).toBe(true);
    expect(engine.draft.recordId).toBe('server-id'); expect(disk.get(formKey(engine.draft))?.data).toEqual(engine.draft.data);
  });
  it('never reports a successful device save when storage fails and can retry without losing the text', async () => {
    const { write } = store(); let full = true; let calls = 0;
    const engine = new FormDraftEngine(initial(), async (key, draft) => { if (full) throw new Error('disk full'); await write(key, draft); }, async draft => { calls++; return remote(draft); });
    await expect(engine.edit({ content: '<p>Kaybolmaması gereken yazı.</p>' })).rejects.toThrow('disk full');
    expect(engine.status).toContain('Cihaz kaydı başarısız'); await expect(engine.sync()).rejects.toThrow('disk full'); expect(calls).toBe(0);
    full = false; await engine.keep(); await engine.sync(); expect(engine.diskError).toBeNull(); expect(engine.draft.data.content).toContain('Kaybolmaması');
  });
  it.each(['local', 'remote'] as const)('backs up both conflicting versions before an explicit %s choice', async choice => {
    const { write, disk } = store(); const other = { recordId: 'server-id', version: 'remote-version', data: normalizeForm({ title: 'Diğer cihaz', content: '<p>Uzak metin.</p>' }) };
    let calls = 0;
    const engine = new FormDraftEngine({ ...initial(), recordId: 'server-id', version: 'old-version' }, write, async draft => { if (!calls++) throw { status: 409, body: { current: other } }; return remote(draft); });
    await engine.keep(); await engine.sync(); expect(engine.draft.conflict).toEqual(other); expect(engine.draft.data.content).toContain('İlk');
    await engine.sync(); expect(calls).toBe(1);
    await engine.resolve(choice);
    const backup = [...disk.entries()].find(([key]) => key.includes(':backup:'))?.[1];
    expect(backup?.data.content).toContain('İlk'); expect(backup?.conflict?.data.content).toBe('<p>Uzak metin.</p>');
    expect(engine.draft.data.content).toBe(choice === 'local' ? initial().data.content : other.data.content);
    expect(engine.draft.version).toBe('remote-version'); expect(engine.draft.dirty).toBe(choice === 'local');
  });
  it('recognizes a committed creation whose response was lost', async () => {
    const { write } = store(); const saved = remote(initial()); let calls = 0;
    const engine = new FormDraftEngine(initial(), write, async () => { calls++; throw { status: 409, body: { current: saved } }; });
    await engine.keep(); await engine.sync(); await engine.sync();
    expect(calls).toBe(1); expect(engine.draft.dirty).toBe(false); expect(engine.draft.recordId).toBe('server-id'); expect(engine.draft.conflict).toBeUndefined();
  });
  it('keeps a failed network save on disk for later recovery', async () => {
    const { write, disk } = store(); const engine = new FormDraftEngine(initial(), write, async () => { throw new Error('offline'); });
    await engine.keep(); await expect(engine.sync()).rejects.toThrow('offline');
    expect(disk.get(formKey(engine.draft))?.data).toEqual(initial().data); expect(engine.status).toContain('Cihazda kayıtlı'); expect(engine.draft.dirty).toBe(true);
  });
  it('does not restore a device draft deleted while a request is pending', async () => {
    const { write, disk } = store(); let finish!: (value: RemoteForm) => void;
    const engine = new FormDraftEngine(initial(), write, () => new Promise(resolve => { finish = resolve; }));
    await engine.keep(); const saving = engine.sync(); await Promise.resolve(); await Promise.resolve();
    const disposing = engine.dispose(); finish(remote(engine.draft)); await Promise.all([saving, disposing]); disk.clear();
    await expect(engine.edit({ title: 'Yeniden yazma' })).rejects.toThrow('silindi'); expect(disk.size).toBe(0);
  });
  it('does not replace either text when conflict backup fails', async () => {
    const { write } = store(); const other = { recordId: 'server-id', version: 'remote-version', data: normalizeForm({ title: 'Uzak metin' }) };
    const engine = new FormDraftEngine({ ...initial(), conflict: other }, async (key, draft) => { if (key.includes(':backup:')) throw new Error('backup failed'); await write(key, draft); }, async draft => remote(draft));
    await expect(engine.resolve('remote')).rejects.toThrow('backup failed'); expect(engine.draft.conflict).toEqual(other); expect(engine.draft.data).toEqual(initial().data);
  });
});
