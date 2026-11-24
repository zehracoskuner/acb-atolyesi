import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowRightLeft, Lock, X } from "lucide-react";
import { apiGet, apiPut } from "../../lib/api";
import Portrait from "./Portrait";
import { RelationshipMilestones } from "./RelationshipMilestones";

function RelationshipPortrait({ character, side, onClick }) {
  return <button className={`cu-bond-person cu-bond-person--${side}`} type="button"
    aria-label={`${character.name} karakter kartını aç`} onClick={onClick}>
    <Portrait className="cu-bond-portrait" character={character} />
    <strong>{character.name}</strong>
    {character.role && <span>{character.role}</span>}
  </button>;
}

export default function RelationshipWorkspace({ ref, workId, relationship, character, related, incoming, type, backLabel, onBack, onClose, onNavigate }) {
  const path = `/works/${workId}/character-guide/relationships/${relationship.id}`;
  const formId = useId();
  const heading = useRef(null);
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const dirty = !!draft && (draft.writerNote !== saved.writerNote || draft.milestones !== saved.milestones);
  useImperativeHandle(ref, () => ({
    canLeave: () => !busy && (!dirty || window.confirm("Kaydedilmemiş ilişki notları silinsin mi?")),
  }), [busy, dirty]);
  useLayoutEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    let active = true;
    apiGet(path).then(data => {
      if (!active) return;
      setSaved(data.draft);
      setDraft(data.draft);
      setChapters(data.chapters);
    }).catch(err => { if (active) setError(err); });
    return () => { active = false; };
  }, [path, reload]);

  function update(field, value) {
    setDraft(current => ({ ...current, [field]: value }));
    setNotice("");
  }

  function loadLatest() {
    if (dirty && !window.confirm("Kaydedilmemiş ilişki notları silinsin mi?")) return;
    setDraft(null);
    setError(null);
    setReload(value => value + 1);
  }

  async function save(event) {
    event.preventDefault();
    if (busy || !dirty) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiPut(path, draft);
      setSaved(result.draft);
      setDraft(result.draft);
      setNotice("İlişki kaydedildi.");
    } catch (err) { setError(err); }
    finally { setBusy(false); }
  }

  const Direction = !relationship.directed ? ArrowRightLeft : incoming ? ArrowLeft : ArrowRight;
  return <div className="cu-dialog-shell cu-bond">
    <header className="cu-bond-top">
      <button className="cu-text-button" type="button" disabled={busy} onClick={onBack}><ArrowLeft size={16} /> <span>{backLabel}</span></button>
      <div className="cu-bond-top-actions">
        {draft && <button className="cu-button cu-primary" form={formId} type="submit" disabled={busy || !dirty}>
          {busy ? "Kaydediliyor…" : notice ? "Kaydedildi" : "Kaydet"}
        </button>}
        <button className="cu-icon" type="button" disabled={busy} onClick={onClose} aria-label="Kapat"><X size={19} /></button>
      </div>
    </header>
    <div className="cu-bond-layout">
      <RelationshipPortrait character={character} side="selected" onClick={() => onNavigate(character.id)} />
      <RelationshipPortrait character={related} side="related" onClick={() => onNavigate(related.id)} />
      <div className="cu-bond-content">
        <header className="cu-bond-heading">
          <h2 ref={heading} tabIndex={-1}>{character.name} <Direction size={21}
            aria-label={!relationship.directed ? "ile" : incoming ? "gelen bağ" : "giden bağ"} /> {related.name}</h2>
          <p><strong>{type}</strong>{relationship.label && <> · {relationship.label}</>}</p>
        </header>
        {error && <div className="cu-bond-error" role="alert">
          <p>{error.message}</p>
          {error.status === 409 && <button type="button" className="cu-button" onClick={loadLatest}>Son sürümü aç</button>}
        </div>}
        {!draft ? <>
          {!error && <p role="status" className="cu-muted">İlişki notları yükleniyor…</p>}
          {error && <button type="button" className="cu-button" onClick={loadLatest}>Tekrar dene</button>}
        </> : <form className="cg-form cu-bond-form" id={formId} onSubmit={save}>
          <fieldset disabled={busy}>
            <label className="cu-bond-note">
              <span><strong>İlişki Notu</strong><small><Lock size={13} /> Yalnızca sana görünür</small></span>
              <textarea rows={7} maxLength={8000} value={draft.writerNote} onChange={event => update("writerNote", event.target.value)}
                placeholder="Bir sonraki sahnede aralarında ne değişsin?" />
            </label>
            <section className="cu-bond-milestones" aria-label="Dönüm noktaları">
              <RelationshipMilestones notes={draft.milestones} chapters={chapters} workId={workId}
                onChange={value => update("milestones", value)} />
            </section>
          </fieldset>
        </form>}
        <span className="cu-bond-feedback" role="status">{notice}</span>
      </div>
    </div>
  </div>;
}
