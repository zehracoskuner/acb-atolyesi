// Serialize writes and acknowledge only the revision actually saved by the server.
export function createNoteSaveQueue(write, onStatus = () => {}, onSaved = () => {}) {
  let draft = null, revision = 0, savedRevision = 0, pending = null;
  return {
    reset(value) { draft = value; revision = 0; savedRevision = 0; onStatus("idle"); },
    change(value) { draft = value; revision++; onStatus("dirty"); },
    isDirty() { return revision !== savedRevision; },
    flush() {
      if (pending) return pending;
      pending = (async () => {
        while (revision !== savedRevision) {
          const version = revision, snapshot = draft;
          onStatus("saving");
          try { const item = await write(snapshot); savedRevision = version; onSaved(item); }
          catch { onStatus("error"); return false; }
        }
        onStatus(savedRevision ? "saved" : "idle");
        return true;
      })().finally(() => { pending = null; });
      return pending;
    },
  };
}
