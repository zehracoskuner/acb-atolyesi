export type FormKind = 'personal' | 'notes' | 'characters' | 'scenes' | 'world';
export interface FormValues {
  title: string; content: string; body: string; name: string; description: string; notes: string;
  role: string; tagline: string; goal: string; act: string; status: string; draftText: string; characters: string[]; volume: string;
}
export const emptyForm: FormValues = { title: '', content: '', body: '', name: '', description: '', notes: '', role: '', tagline: '', goal: '', act: 'giris', status: 'idea', draftText: '', characters: [], volume: '' };
export type FormScope = { kind: FormKind; workId?: string; category?: string };
export type RemoteForm = { recordId: string; version: string; data: FormValues };
export interface FormDraft extends FormScope {
  localId: string; userId: string; recordId?: string; version: string | null; data: FormValues;
  dirty: boolean; editedAt: number; conflict?: RemoteForm; baseData?: FormValues;
}
export const formKey = (d: Pick<FormDraft, 'userId' | 'localId'>) => `form-draft:${d.userId}:${d.localId}`;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const same = (a: FormValues, b: FormValues) => JSON.stringify(a) === JSON.stringify(b);
export const normalizeForm = (data: Partial<FormValues>): FormValues => Object.fromEntries(
  Object.entries(emptyForm).map(([key, fallback]) => [key, data[key as keyof FormValues] ?? fallback]),
) as unknown as FormValues;
export const formComplete = (d: FormDraft) => !!(['characters', 'world'].includes(d.kind) ? d.data.name : d.data.title).trim();

export class FormDraftEngine {
  diskError: unknown = null;
  error: unknown = null;
  pendingWrites = 0;
  private disk: Promise<void> = Promise.resolve();
  private flight: Promise<void> | null = null;
  private disposed = false;
  private sequence = 0;
  constructor(public draft: FormDraft, private write: (key: string, value: FormDraft) => Promise<void>,
    private send: (draft: FormDraft) => Promise<RemoteForm>, private changed: () => void = () => {}) {}
  get busy() { return !!this.flight; }
  get status() {
    return this.diskError ? 'Cihaz kaydı başarısız · ekranı kapatma' : this.pendingWrites ? 'Cihaza kaydediliyor…'
      : this.draft.conflict ? 'Sürüm çakışması · iki metin de korunuyor' : this.busy ? 'Sunucuya kaydediliyor…'
      : this.draft.dirty ? 'Cihazda kayıtlı · sunucu kaydı bekliyor' : 'Sunucuya kaydedildi · cihaz kopyası hazır';
  }
  private commit(draft: FormDraft) {
    if (this.disposed) return Promise.reject(new Error('Bu cihaz taslağı silindi. Kaydı yeniden aç.'));
    this.draft = clone(draft); const snapshot = clone(draft); const sequence = ++this.sequence;
    this.pendingWrites++; this.changed();
    const task = this.disk.catch(() => {}).then(() => this.write(formKey(draft), snapshot));
    this.disk = task.then(() => { if (sequence === this.sequence) this.diskError = null; }, error => { this.diskError = error; throw error; })
      .finally(() => { this.pendingWrites--; this.changed(); });
    return this.disk;
  }
  edit(patch: Partial<FormValues>) { return this.commit({ ...this.draft, data: normalizeForm({ ...this.draft.data, ...patch }), dirty: true, editedAt: Date.now() }); }
  persist() { return this.disk; }
  keep() { return this.commit(this.draft); }
  async settle() { if (this.flight) await this.flight.catch(() => {}); }
  async refresh(remote: RemoteForm) {
    if (this.draft.dirty && !same(this.draft.data, remote.data)) {
      if (this.draft.version !== remote.version) await this.commit({ ...this.draft, conflict: remote });
      return;
    }
    await this.commit({ ...this.draft, ...remote, baseData: remote.data, dirty: false, conflict: undefined });
  }
  sync(): Promise<void> {
    if (this.flight) return this.flight;
    const task = async () => {
      await this.disk;
      if (this.disposed || !this.draft.dirty || this.draft.conflict || !formComplete(this.draft)) return;
      const sent = clone(this.draft); this.error = null;
      try {
        const saved = await this.send(sent); const current = this.draft;
        const unchanged = same(current.data, sent.data);
        if (!this.disposed) await this.commit({ ...current, recordId: saved.recordId, version: saved.version,
          data: unchanged ? saved.data : current.data, baseData: saved.data, dirty: !unchanged, conflict: undefined });
      } catch (error) {
        const failure = error as { status?: number; body?: { current?: RemoteForm } };
        if (failure.status === 409 && failure.body?.current) await this.refresh(failure.body.current);
        else { this.error = error; throw error; }
      }
    };
    this.flight = task().finally(() => { this.flight = null; this.changed(); }); this.changed();
    return this.flight;
  }
  async resolve(choice: 'local' | 'remote') {
    const remote = this.draft.conflict;
    if (!remote) return;
    await this.write(`${formKey(this.draft)}:backup:${Date.now()}`, clone(this.draft));
    await this.commit({ ...this.draft, recordId: remote.recordId, version: remote.version,
      data: choice === 'remote' ? remote.data : this.draft.data, baseData: remote.data, dirty: choice !== 'remote', conflict: undefined });
    this.error = null;
  }
  async dispose() { this.disposed = true; await this.settle(); await this.disk.catch(() => {}); }
}
