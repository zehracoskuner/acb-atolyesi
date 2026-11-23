import type { Chapter } from './types';
const copyDraft = (draft: Draft): Draft => JSON.parse(JSON.stringify(draft));
export interface Draft {
  chapterId: string; workId: string; userId: string; title: string; content: string;
  baseRevision: number; baseContent: string; baseTitle: string; dirty: boolean; editedAt: number;
  eligibleWordDelta: number; conflict?: Chapter;
  status?: string; reviewStatus?: string; hasUnpublishedChanges?: boolean; reviewNote?: string; order?: number;
  position?: { scroll: number; start?: number; end?: number };
}
export interface DraftStorage { read(key: string): Promise<Draft | null>; write(key: string, draft: Draft): Promise<void> }
export const draftKey = (userId: string, chapterId: string, workId?: string) => `draft:${userId}:${workId ? `${workId}:` : ''}${chapterId}`;
const metadata = (c: Chapter) => ({ status: c.status, reviewStatus: c.reviewStatus, hasUnpublishedChanges: c.hasUnpublishedChanges, reviewNote: c.reviewNote, order: c.order });
export const saveFields = (d: Draft) => ({ expectedRevision: d.baseRevision,
  ...(d.title !== d.baseTitle ? { title: d.title } : {}),
  ...(d.content !== d.baseContent ? { content: d.content, eligibleWordDelta: d.eligibleWordDelta } : {}) });
export function fromChapter(chapter: Chapter, userId: string, workId: string): Draft {
  return { chapterId: chapter._id, workId, userId, title: chapter.title, content: chapter.content,
    baseRevision: chapter.revision, baseContent: chapter.content, baseTitle: chapter.title,
    dirty: false, editedAt: Date.now(), eligibleWordDelta: 0, ...metadata(chapter) };
}
export function words(html: string) { return html.replace(/<[^>]+>/g, ' ').replace(/&[^;]+;/g, ' ').trim().split(/\s+/u).filter(Boolean).length; }
export function reconcile(local: Draft, remote: Chapter, recovery = false): Draft {
  if (!local.dirty) return { ...fromChapter(remote, local.userId, local.workId), position: local.position };
  // A response can be lost after the server committed a save. Identical content is safe to acknowledge.
  if (local.content === remote.content && local.title === remote.title)
    return { ...fromChapter(remote, local.userId, local.workId), position: local.position };
  if (recovery || local.conflict || local.baseRevision !== remote.revision) return { ...local, ...metadata(remote), conflict: remote };
  return { ...local, ...metadata(remote), conflict: undefined };
}
// One serial disk/network queue per chapter; an acknowledgement never replaces edits made during a request.
export class DraftEngine {
  draft: Draft;
  recoveryPending = false;
  localState: 'saved' | 'pending' | 'failed' = 'saved';
  private diskSequence = 0;
  private editSequence = 0;
  private disk: Promise<void> = Promise.resolve();
  private inFlight: Promise<void> | null = null;
  private disposed = false;
  private publication: Promise<void> | null = null;
  constructor(initial: Draft, private storage: DraftStorage, private send: (d: Draft) => Promise<Chapter>, private change: (d: Draft) => void = () => {}) { this.draft = initial; }
  private commit(draft: Draft) {
    if (this.disposed) return Promise.resolve();
    this.draft = draft; this.localState = 'pending'; const sequence = ++this.diskSequence; this.change(draft);
    const snapshot = copyDraft(draft);
    this.disk = this.disk.catch(() => {}).then(() => this.storage.write(draftKey(draft.userId, draft.chapterId, draft.workId), snapshot)).then(() => {
      if (sequence === this.diskSequence) { this.localState = 'saved'; this.change(this.draft); }
    }, error => { if (sequence === this.diskSequence) { this.localState = 'failed'; this.change(this.draft); } throw error; });
    return this.disk;
  }
  edit(title: string, content: string, organic = true) {
    if (this.disposed) return Promise.reject(new Error('Bu cihaz taslağı silindi. Bölümü yeniden aç.'));
    const delta = organic ? Math.max(0, words(content) - words(this.draft.content)) : 0;
    if (title === this.draft.title && content === this.draft.content) return this.disk;
    this.editSequence++;
    return this.commit({ ...this.draft, title, content, dirty: title !== this.draft.baseTitle || content !== this.draft.baseContent, editedAt: Date.now(), eligibleWordDelta: this.draft.eligibleWordDelta + delta });
  }
  async persist() { let pending: Promise<void>; do { pending = this.disk; await pending; } while (pending !== this.disk); }
  retryPersist() { return this.commit(this.draft); }
  rememberPosition(position: Draft['position']) { return this.commit({ ...this.draft, position }); }
  async refreshRemote(remote: Chapter) {
    if (this.inFlight) await this.inFlight.catch(() => {});
    if (remote.revision < this.draft.baseRevision) return;
    await this.commit({ ...reconcile(this.draft, remote, this.recoveryPending), position: this.draft.position });
    this.recoveryPending = false;
  }
  async dispose() {
    this.disposed = true;
    if (this.publication) await this.publication.catch(() => {});
    if (this.inFlight) await this.inFlight.catch(() => {});
    await this.disk.catch(() => {});
  }
  sync(): Promise<void> {
    if (this.publication) return this.publication.then(() => this.sync());
    if (this.inFlight) return this.inFlight.then(() => this.sync());
    return this.syncOnce();
  }
  private syncOnce(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const task = async () => {
      // Capture the payload before waiting: a later edit may have another disk write pending.
      const sent = copyDraft(this.draft);
      await this.disk;
      if (this.disposed || this.recoveryPending || !sent.dirty || this.draft.conflict) return;
      try {
        const saved = await this.send(sent);
        const current = this.draft;
        const unchanged = current.title === sent.title && current.content === sent.content;
        // Track the submitted DOM as the comparison baseline. Harmless server HTML
        // serialization must not turn a later title-only edit into a content update.
        await this.commit({ ...current, ...metadata(saved), baseRevision: saved.revision, baseContent: sent.content, baseTitle: sent.title,
          dirty: !unchanged,
          eligibleWordDelta: Math.max(0, current.eligibleWordDelta - sent.eligibleWordDelta), conflict: undefined });
      } catch (error) {
        const e = error as { status?: number; body?: { current?: Chapter } };
        if (e.status === 409 && e.body?.current) await this.commit(reconcile(this.draft, e.body.current));
        else throw error;
      }
    };
    this.inFlight = task().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
  publish(confirmed: { title: string; content: string }, send: (d: Draft) => Promise<Chapter>): Promise<void> {
    if (this.publication) return this.publication;
    const task = async () => {
      const editSequence = this.editSequence;
      if (this.draft.title !== confirmed.title || this.draft.content !== confirmed.content) throw new Error('Onaydan sonra metin değişti. Güncel bölümü kontrol edip tekrar yayınla.');
      if (this.inFlight) await this.inFlight;
      await this.syncOnce();
      if (this.disposed || this.recoveryPending || this.draft.conflict || this.draft.dirty || this.editSequence !== editSequence)
        throw new Error('Metin değişti veya kayıt tamamlanamadı. Güncel bölümü kontrol edip tekrar yayınla.');
      let result: Chapter;
      try { result = await send(copyDraft(this.draft)); }
      catch (error) {
        const e = error as { status?: number; body?: { current?: Chapter } };
        if (e.status === 409 && e.body?.current) await this.commit({ ...this.draft, conflict: e.body.current });
        throw error;
      }
      // Publication changes metadata only. Typing during the request remains private and dirty.
      await this.commit({ ...this.draft, ...metadata(result) });
    };
    this.publication = task().finally(() => { this.publication = null; });
    return this.publication;
  }
  async resolve(choice: 'remote' | 'local' | 'merge', merged?: string) {
    const remote = this.draft.conflict;
    if (!remote) return;
    // Archive both versions before explicit replacement; do not silently drop either text.
    await this.storage.write(`${draftKey(this.draft.userId, this.draft.chapterId, this.draft.workId)}:backup:${Date.now()}`, copyDraft(this.draft));
    const fresh = fromChapter(remote, this.draft.userId, this.draft.workId);
    await this.commit(choice === 'remote' ? fresh : { ...fresh, title: this.draft.title,
      content: choice === 'merge' ? merged ?? this.draft.content : this.draft.content, dirty: true });
  }
}
