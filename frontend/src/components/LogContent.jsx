import MentionInput from "./MentionInput";
import MentionText from "./MentionText";
import { useRef, useState } from "react";
import { apiPatch, apiDelete } from "../lib/api";
import "../styles/LogContent.css";

export default function LogContent({ content, mentions = [], endpoint, maxLength = 500, canEdit, canDelete, onUpdated, onDeleted, className, children }) {
  const [saved, setSaved] = useState(null);
  const [savedMentions, setSavedMentions] = useState(null);
  const Editor = MentionInput;
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const label = maxLength === 800 ? "Günlük girdisi" : "Yorum";

  async function save(event) {
    event.preventDefault();
    if (!canEdit || pending.current || !draft.trim() || draft.trim().length > maxLength) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const res = await apiPatch(endpoint, { content: draft.trim() });
      setSaved(res.item.content); setSavedMentions(res.item.mentions || []); onUpdated?.(res.item); setEditing(false);
    } catch (err) { setError(err.message || "Kaydedilemedi. Yeniden deneyebilirsin."); }
    finally { pending.current = false; setBusy(false); }
  }
  async function remove() {
    if (!canDelete || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await apiDelete(endpoint); onDeleted?.(); }
    catch (err) { setError(err.message || "Silinemedi. Yeniden deneyebilirsin."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="log-content-manager">
    {editing ? <form className="log-content-editor" onSubmit={save}>
      <Editor autoFocus aria-label={`${label} düzenle`} value={draft} onChange={event => setDraft(event.target.value)} maxLength={maxLength} disabled={busy} rows={3} />
      <div className="log-content-actions">
        <button type="submit" disabled={busy || !draft.trim() || draft.trim().length > maxLength}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
        <button type="button" disabled={busy} onClick={() => { setEditing(false); setError(""); }}>Vazgeç</button>
      </div>
    </form> : <>
      <p className={className}>{children}<MentionText content={saved ?? content} mentions={savedMentions ?? mentions} /></p>
      <div className="log-content-actions">
        {canEdit && <button type="button" disabled={busy} onClick={() => { setDraft(saved ?? content); setEditing(true); setConfirmDelete(false); setError(""); }}>Düzenle</button>}
        {canDelete && !confirmDelete && <button type="button" disabled={busy} onClick={() => { setConfirmDelete(true); setError(""); }}>Sil</button>}
      </div>
    </>}
    {confirmDelete && <div className="log-content-confirm" role="group" aria-label={`${label} silme onayı`}>
      <span>{label} silinsin mi? Bu işlem geri alınamaz.</span>
      <div className="log-content-actions">
        <button type="button" disabled={busy} onClick={remove}>{busy ? "Siliniyor…" : "Evet, sil"}</button>
        <button type="button" disabled={busy} onClick={() => { setConfirmDelete(false); setError(""); }}>Vazgeç</button>
      </div>
    </div>}
    {error && <p className="log-content-error" role="alert">{error}</p>}
  </div>;
}
