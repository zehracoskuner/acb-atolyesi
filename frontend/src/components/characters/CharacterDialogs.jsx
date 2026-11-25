import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Camera, Check, ImagePlus, Link2, Pencil, Sparkles, Trash2, X } from "lucide-react";
import Portrait from "./Portrait";
import RelationshipWorkspace from "./RelationshipWorkspace";
import { relationName, relationshipTypeIdentity } from "./graph";
import { PORTRAIT_MAX_EDGE, PORTRAIT_MAX_INPUT_BYTES } from "../../../../shared/characterPortrait.js";

export function UniverseDialog({ label, className = "", onClose, onOpen, busy, children }) {
  const dialog = useRef(null);
  const openEffect = useRef(onOpen);
  useLayoutEffect(() => {
    const element = dialog.current;
    element.showModal();
    openEffect.current?.();
    return () => element.close();
  }, []);
  return (
    <dialog ref={dialog} aria-label={label} className={`cu-dialog ${className}`}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll("button, input, textarea, select, a[href], [tabindex='0']")]
          .filter(element => !element.matches(":disabled") && element.getClientRects().length);
        const first = controls.at(0), last = controls.at(-1);
        if (!first || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
      onCancel={event => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={event => {
        if (busy || event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      {children}
    </dialog>
  );
}

function CloseButton({ onClick, disabled }) {
  return <button className="cu-icon cu-close" type="button" aria-label="Kapat" onClick={onClick} disabled={disabled}><X size={20} /></button>;
}

function CharacterDeleteDialog({ name, onClose, onDelete }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  async function confirm() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try { await onDelete(); }
    catch (err) { setError(err.message || "Karakter silinemedi."); }
    finally { lock.current = false; setBusy(false); }
  }

  return (
    <UniverseDialog label="Karakteri sil" className="cu-dialog--small" onClose={onClose} busy={busy}>
      <div className="cu-dialog-shell cu-form-shell">
        <h2>{name} silinsin mi?</h2>
        <p className="cu-muted">Karakter ve ona bağlı çizgiler haritadan kalkacak. Karakter silme işlemi geri alınamaz.</p>
        {error && <p className="cu-form-error" role="alert">{error}</p>}
        <div className="cu-dialog-actions">
          <button className="cu-button cu-action-spacer" type="button" onClick={onClose} disabled={busy} autoFocus>Vazgeç</button>
          <button className="cu-button cu-danger-solid" type="button" onClick={confirm} disabled={busy}>{busy ? "Siliniyor…" : "Sil"}</button>
        </div>
      </div>
    </UniverseDialog>
  );
}

function ProfilePortrait({ character, portraitRef, initialRatio }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [ratio, setRatio] = useState(initialRatio);
  return (
    <div className="cu-profile-visual">
      <div className="cu-profile-image" ref={portraitRef} style={{ "--cu-image-ratio": ratio }}>
        <Portrait key={attempt} character={character} onUnavailable={setFailedUrl} onRatio={setRatio} />
      </div>
      {failedUrl && failedUrl === character.imageUrl && (
        <div className="cu-portrait-recovery">
          <p role="status">Fotoğraf yüklenemedi.</p>
          <button className="cu-button" type="button" onClick={() => {
            setFailedUrl(null);
            setAttempt(value => value + 1);
          }}>Yeniden dene</button>
        </div>
      )}
    </div>
  );
}

function CharacterDescription({ notes, onSave }) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const editButton = useRef(null);
  const editor = useRef(null);
  const restoreFocus = useRef(false);
  const headingId = useId();
  const hasNotes = Boolean(notes?.trim());

  useLayoutEffect(() => {
    if (editing) editor.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      editButton.current?.focus();
    }
  }, [editing]);

  function finish() {
    restoreFocus.current = true;
    setEditing(false);
    setError("");
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(draft.trim() ? draft : "");
      finish();
    } catch (err) {
      setError(err.message || "Açıklama kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="cu-profile-description" aria-labelledby={headingId}>
      <div className="cu-description-heading">
        <h3 id={headingId}>Açıklama</h3>
        {!editing && <button ref={editButton} className="cu-text-button" type="button" onClick={() => {
          setDraft(notes || "");
          setEditing(true);
        }}><Pencil size={14} /> {hasNotes ? "Açıklamayı düzenle" : "Açıklama ekle"}</button>}
      </div>
      {editing ? <form className="cu-description-form" onSubmit={save} onKeyDown={event => {
        if (event.key !== "Escape" || saving) return;
        event.preventDefault();
        event.stopPropagation();
        finish();
      }}>
        <textarea ref={editor} aria-label="Karakter açıklaması" rows={5} value={draft} disabled={saving}
          placeholder="Karakterin geçmişi, motivasyonu ve hikâyedeki yeri…" onChange={event => setDraft(event.target.value)} />
        {error && <p className="cu-form-error" role="alert">{error}</p>}
        <div>
          <button className="cu-button" type="button" onClick={finish} disabled={saving}>Vazgeç</button>
          <button className="cu-button cu-primary" disabled={saving}>{saving ? "Kaydediliyor…" : "Açıklamayı kaydet"}</button>
        </div>
      </form> : hasNotes ? <p className="cu-notes">{notes}</p> : <p className="cu-muted">Bu karakterin açıklaması henüz yazılmadı.</p>}
    </section>
  );
}

export function CharacterDetails({ workId, character, origin, portraitRatio, relationships, nodesById, types, onNavigate, onClose, onEdit, onPhoto, onDelete, onSaveDescription }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bondId, setBondId] = useState(null);
  const bondTrigger = useRef(null);
  const workspace = useRef(null);
  const bond = relationships.find(edge => edge.id === bondId);
  const incoming = bond?.directed && bond.to === character.id;
  const related = bond && nodesById.get(bond.from === character.id ? bond.to : bond.from);
  const original = useRef(character);
  const portrait = useRef(null);
  const shared = useRef(null);
  const heading = useRef(null);
  const displayedId = useRef(character.id);
  const animations = useRef([]);
  const imageLabel = character.imageUrl ? "Fotoğraf değiştir" : "Fotoğraf ekle";
  const facts = [["Grup", character.faction], ["Konum", character.location], ["Özellikler", character.traits?.join(", ")]].filter(([, value]) => value);
  useEffect(() => () => animations.current.forEach(animation => animation.cancel()), []);
  useLayoutEffect(() => {
    if (character.id !== displayedId.current) {
      heading.current?.focus();
      displayedId.current = character.id;
    }
  }, [character.id]);

  function animatePortrait() {
    const ghost = shared.current;
    const target = portrait.current;
    if (!origin || !ghost?.animate || !target || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const end = target.getBoundingClientRect();
    if (!end.width || !end.height) return;
    const frame = (progress, offset) => ({
      left: `${origin.left + (end.left - origin.left) * progress}px`,
      top: `${origin.top + (end.top - origin.top) * progress}px`,
      width: `${origin.width + (end.width - origin.width) * progress}px`,
      height: `${origin.height + (end.height - origin.height) * progress}px`,
      borderRadius: progress < 0.72 ? `${50 * (1 - progress)}%` : "12px",
      opacity: 1,
      offset,
    });
    animations.current = [
      ghost.animate([frame(0, 0), frame(0.72, 0.32), frame(1.012, 0.68), frame(1, 1)], { duration: 310, easing: "ease-out" }),
      target.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: 0.87 }, { opacity: 1, offset: 1 }], { duration: 310 }),
    ];
  }

  const canLeaveBond = () => workspace.current?.canLeave() ?? true;
  const closeDetails = () => { if (canLeaveBond()) onClose(); };
  function backToProfile() {
    if (!canLeaveBond()) return;
    setBondId(null);
    requestAnimationFrame(() => bondTrigger.current?.focus({ preventScroll: true }));
  }
  function openProfile(id) {
    if (!canLeaveBond()) return;
    setBondId(null);
    if (id === character.id) requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
    else onNavigate(id);
  }

  return (<>
    <UniverseDialog label={bond ? `${character.name} ${bond.directed ? incoming ? "←" : "→" : "↔"} ${related.name}` : character.name}
      className={`cu-dialog--profile${bond ? " cu-dialog--bond" : ""}`} onClose={closeDetails} onOpen={animatePortrait}>
      <div className="cu-profile cu-dialog-shell" hidden={Boolean(bond)}>
        <CloseButton onClick={onClose} />
        <ProfilePortrait key={character.id} character={character} portraitRef={portrait} initialRatio={portraitRatio} />
        <div className="cu-profile-copy" key={character.id}>
          <header>
            <h2 ref={heading} tabIndex={-1}>{character.name}</h2>
            {character.role && <p className="cu-profile-role">{character.role}</p>}
            {character.tagline && <p className="cu-tagline">{character.tagline}</p>}
          </header>
          <div className="cu-profile-actions">
            <button className="cu-button" type="button" onClick={onEdit}><Pencil size={15} /> Düzenle</button>
            <button className="cu-button" type="button" onClick={onPhoto}><Camera size={16} /> {imageLabel}</button>
            <button className="cu-button cu-danger" type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Karakteri sil</button>
          </div>
          <div className="cu-profile-body">
            <CharacterDescription notes={character.notes} onSave={onSaveDescription} />
            {facts.length > 0 && <dl className="cu-facts">{facts.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}</dl>}
            <section className="cu-profile-section">
              <h3>İlişkiler <span>{relationships.length}</span></h3>
              {relationships.length ? <ul className="cu-relations">{relationships.map(edge => {
                const outgoing = edge.from === character.id;
                const other = nodesById.get(outgoing ? edge.to : edge.from);
                const Direction = !edge.directed ? Link2 : outgoing ? ArrowUpRight : ArrowDownLeft;
                return (
                  <li key={edge.id}>
                    <button className="cu-relation-portrait" type="button" aria-label={`${other.name} karakter kartını aç`}
                      onClick={() => openProfile(other.id)}>
                      <Portrait character={other} />
                    </button>
                    <button className="cu-relation-open" type="button" onClick={event => {
                      bondTrigger.current = event.currentTarget;
                      setBondId(edge.id);
                    }}>
                      <span><strong>{other.name}</strong><small>{relationName(edge.type, types)}{edge.label ? ` · ${edge.label}` : ""}</small></span>
                      <Direction size={16} aria-label={edge.directed ? outgoing ? "Giden bağ" : "Gelen bağ" : "Yönsüz bağ"} />
                    </button>
                  </li>
                );
              })}</ul> : <p className="cu-muted">Bu karakterin henüz bir bağı yok.</p>}
            </section>
          </div>
        </div>
      </div>
      {bond && <RelationshipWorkspace key={bond.id} ref={workspace} workId={workId} relationship={bond} character={character} related={related} incoming={incoming}
        type={relationName(bond.type, types)} backLabel={`${character.name} kartına dön`} onBack={backToProfile}
        onClose={closeDetails} onNavigate={openProfile} />}
      {origin && <div className="cu-shared-portrait" ref={shared}><Portrait character={original.current} /></div>}
    </UniverseDialog>
    {confirmDelete && <CharacterDeleteDialog name={character.name} onClose={() => setConfirmDelete(false)} onDelete={onDelete} />}
  </>);
}

function drawPortrait(canvas, photo, maxEdge) {
  const { bitmap, crop, zoom, x, y } = photo;
  const cropWidth = crop ? Math.min(bitmap.width, bitmap.height * 3 / 4) / zoom : bitmap.width;
  const cropHeight = crop ? cropWidth * 4 / 3 : bitmap.height;
  const scale = Math.min(1, maxEdge / Math.max(cropWidth, cropHeight));
  canvas.width = Math.max(1, Math.round(cropWidth * scale));
  canvas.height = Math.max(1, Math.round(cropHeight * scale));
  const left = (bitmap.width - cropWidth) * (x + 100) / 200;
  const top = (bitmap.height - cropHeight) * (y + 100) / 200;
  canvas.getContext("2d").drawImage(bitmap, left, top, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
}

async function encodePortrait(photo) {
  if (!photo.crop) return photo.file;
  const canvas = document.createElement("canvas");
  drawPortrait(canvas, photo, PORTRAIT_MAX_EDGE);
  for (const quality of [0.95, 0.88, 0.76]) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
    if (blob?.type === "image/webp" && blob.size <= PORTRAIT_MAX_INPUT_BYTES) return blob;
  }
  throw new Error("Kırpılan fotoğraf 3 MB sınırına uygun olarak hazırlanamadı.");
}

function PhotoEditor({ character, photo, setPhoto, remove, setRemove, setError, onDecoding, disabled, inputRef }) {
  const preview = useRef(null);
  const decodeRequest = useRef(0);
  const { bitmap, crop, x, y, zoom } = photo || {};
  useLayoutEffect(() => {
    if (bitmap && preview.current) drawPortrait(preview.current, { bitmap, crop, x, y, zoom }, 192);
  }, [bitmap, crop, x, y, zoom]);
  useEffect(() => () => bitmap?.close(), [bitmap]);
  useEffect(() => () => { decodeRequest.current += 1; }, []);

  async function selectPhoto(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const request = ++decodeRequest.current;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      onDecoding(false);
      setError("JPEG, PNG veya WebP biçiminde bir fotoğraf seçin.");
      return;
    }
    if (file.size > PORTRAIT_MAX_INPUT_BYTES) {
      onDecoding(false);
      setError("Fotoğraf en fazla 3 MB olabilir.");
      return;
    }
    onDecoding(true);
    try {
      const image = await createImageBitmap(file, { imageOrientation: "from-image" });
      if (request !== decodeRequest.current) {
        image.close();
        return;
      }
      setPhoto({ file, bitmap: image, crop: false, x: 0, y: 0, zoom: 1 });
      setRemove(false);
    } catch {
      if (request === decodeRequest.current) setError("Fotoğraf açılamadı. Başka bir dosya seçin.");
    } finally {
      if (request === decodeRequest.current) onDecoding(false);
    }
  }

  return (
    <fieldset className="cu-photo-edit" disabled={disabled}>
      <legend>Fotoğraf</legend>
      <div className="cu-photo-preview" style={bitmap && !crop ? { aspectRatio: bitmap.width / bitmap.height } : undefined}>
        {photo ? <canvas ref={preview} role="img" aria-label="Fotoğraf önizlemesi" />
          : <Portrait character={remove ? { ...character, imageUrl: undefined } : character} />}
      </div>
      <div className="cu-photo-actions">
        <label className="cu-file cu-button"><ImagePlus size={17} /> Fotoğraf seç
          <input ref={inputRef} type="file" aria-label="Fotoğraf seç" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} />
        </label>
        {photo && <label className="cu-crop-choice">
          <input type="checkbox" checked={crop} onChange={event => setPhoto({ ...photo, crop: event.target.checked })} /> 3:4 kırp
        </label>}
        {crop && [
          ["zoom", "Yakınlık", 1, 3, 0.05],
          ["x", "Yatay konum", -100, 100, 1],
          ["y", "Dikey konum", -100, 100, 1],
        ].map(([key, label, min, max, step]) => (
          <label key={key} className="cu-range">{label}<input type="range" min={min} max={max} step={step}
            value={photo[key]} onChange={event => setPhoto(current => ({ ...current, [key]: Number(event.target.value) }))} /></label>
        ))}
        {(photo || (character.imageUrl && !remove)) && <button className="cu-text-button" type="button" onClick={() => {
          decodeRequest.current += 1;
          onDecoding(false);
          if (photo) setPhoto(null);
          else setRemove(true);
        }}>{photo ? "Seçimi geri al" : "Fotoğrafı kaldır"}</button>}
        {remove && <button className="cu-text-button" type="button" onClick={() => setRemove(false)}>Kaldırmayı geri al</button>}
      </div>
    </fieldset>
  );
}

export function CharacterEditor({ character, creating, photoFirst, onClose, onSave, onDelete, onQuestion }) {
  const [fields, setFields] = useState(() => Object.fromEntries(["name", "role", "tagline", "faction", "location", "notes"]
    .map(key => [key, character[key] || ""])));
  const [photo, setPhoto] = useState(null);
  const [decoding, setDecoding] = useState(false);
  const [remove, setRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [questionBusy, setQuestionBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const lock = useRef(false);
  const title = creating ? "Yeni karakter" : "Karakteri düzenle";

  async function submit(event) {
    event.preventDefault();
    if (lock.current || decoding) return;
    const name = fields.name.trim();
    if (!name) { setError("Karakter adını yazın."); return; }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const blob = photo ? await encodePortrait(photo) : null;
      await onSave({ ...fields, name }, { blob, remove });
    } catch (err) { setError(err.message || "Karakter kaydedilemedi."); }
    finally { lock.current = false; setBusy(false); }
  }

  async function question() {
    setQuestionBusy(true);
    setError("");
    try {
      const line = await onQuestion(fields);
      setFields(current => ({ ...current, notes: [current.notes, line].filter(Boolean).join("\n\n") }));
    } catch (err) { setError(err.message || "Karakter sorusu hazırlanamadı."); }
    finally { setQuestionBusy(false); }
  }

  const setField = event => setFields(current => ({ ...current, [event.target.name]: event.target.value }));
  return (<>
    <UniverseDialog label={title} className="cu-dialog--edit" onClose={onClose} busy={busy}
      onOpen={() => { if (photoFirst) inputRef.current?.focus(); }}>
      <div className="cu-dialog-shell cu-form-shell">
        <CloseButton onClick={onClose} disabled={busy} />
        <h2>{title}</h2>
        <form onSubmit={submit}>
          <PhotoEditor character={character} photo={photo} setPhoto={setPhoto} remove={remove} setRemove={setRemove}
            setError={setError} onDecoding={setDecoding} disabled={busy} inputRef={inputRef} />
          <fieldset className="cu-fields" disabled={busy}>
            <label>İsim<input name="name" value={fields.name} onChange={setField} required maxLength={140} autoFocus={!photoFirst} /></label>
            <label>Rol<input name="role" value={fields.role} onChange={setField} /></label>
            <label className="cu-field-wide">Kısa tanım<input name="tagline" value={fields.tagline} onChange={setField} /></label>
            <label>Grup<input name="faction" value={fields.faction} onChange={setField} /></label>
            <label>Konum<input name="location" value={fields.location} onChange={setField} /></label>
            <label className="cu-field-wide">Açıklama<textarea name="notes" value={fields.notes} rows={4} onChange={setField} /></label>
          </fieldset>
          {error && <p className="cu-form-error" role="alert">{error}</p>}
          <div className="cu-dialog-actions">
            {!creating && <button type="button" className="cu-button cu-danger" onClick={() => setConfirmDelete(true)} disabled={busy}><Trash2 size={15} /> Karakteri sil</button>}
            <button type="button" className="cu-button" data-tour="karakter-detay-btn" onClick={question} disabled={questionBusy || busy || !fields.name.trim()}>
              <Sparkles size={15} /> {questionBusy ? "Hazırlanıyor…" : "Derinleştir"}
            </button>
            <button type="button" className="cu-button cu-action-spacer" onClick={onClose} disabled={busy}>İptal</button>
            <button className="cu-button cu-primary" disabled={busy || questionBusy || decoding}><Check size={17} /> {busy ? "Kaydediliyor…" : decoding ? "Fotoğraf hazırlanıyor…" : "Kaydet"}</button>
          </div>
        </form>
      </div>
    </UniverseDialog>
    {confirmDelete && <CharacterDeleteDialog name={character.name} onClose={() => setConfirmDelete(false)} onDelete={onDelete} />}
  </>);
}

export function RelationshipEditor({ relationship, relationships, names, types, onClose, onSave }) {
  const [type, setType] = useState(relationship.type || "");
  const [newType, setNewType] = useState("");
  const [label, setLabel] = useState(relationship.label);
  const [strength, setStrength] = useState(relationship.strength);
  const [directed, setDirected] = useState(relationship.directed ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const customOption = useId();
  const typeOptions = new Map();
  for (const option of types) {
    const key = relationshipTypeIdentity(option.label);
    if (!typeOptions.has(key) || option.key === relationship.type) typeOptions.set(key, option);
  }
  const requestedType = type === customOption ? newType.trim() : type;
  const name = requestedType && relationshipTypeIdentity(relationName(requestedType, types));
  const matches = relationship.id || !name ? [] : relationships.filter(edge =>
    edge.directed === directed &&
    ((edge.from === relationship.from && edge.to === relationship.to) ||
      (!directed && edge.from === relationship.to && edge.to === relationship.from)) &&
    (relationshipTypeIdentity(relationName(edge.type, types)) === name ||
      relationshipTypeIdentity(edge.type) === relationshipTypeIdentity(requestedType))
  );
  const existing = matches.find(edge => edge.type === requestedType) || matches[0];
  const displayedLabel = label ?? existing?.label ?? "";
  const displayedStrength = strength ?? existing?.strength ?? 3;

  async function submit(event) {
    event.preventDefault();
    if (busy || !requestedType) return;
    setBusy(true);
    setError("");
    try {
      await onSave({ ...relationship, type: existing?.type ?? requestedType, label: label?.trim(), strength, directed },
        type === customOption && !existing ? requestedType : "");
    } catch (err) { setError(err.message || "Bağ kaydedilemedi."); }
    finally { setBusy(false); }
  }

  return (
    <UniverseDialog label={relationship.id ? "Bağı düzenle" : "Bağ kur"} className="cu-dialog--small" onClose={onClose} busy={busy}>
      <div className="cu-dialog-shell cu-form-shell" data-tour="karakter-bag-btn">
        <CloseButton onClick={onClose} disabled={busy} />
        <h2>{relationship.id ? "Bağı düzenle" : "Bağ kur"}</h2>
        <p className="cu-pair">{names.get(relationship.from)} {directed ? "→" : "↔"} {names.get(relationship.to)}</p>
        <form onSubmit={submit}>
          <fieldset className="cu-fields cu-fields--single" disabled={busy}>
            <label>İlişki türü<select value={type} onChange={event => setType(event.target.value)} required autoFocus>
              <option value="">Tür seçin</option>
              {[...typeOptions.values()].map(({ key, label: name }) => <option value={key} key={key}>{name}</option>)}
              <option value={customOption}>Özel tür ekle</option>
            </select></label>
            {type === customOption && <label>Özel tür<input value={newType} maxLength={80} onChange={event => setNewType(event.target.value)} required /></label>}
            <label>Bağ notu<input value={displayedLabel} maxLength={200} onChange={event => setLabel(event.target.value)} /></label>
            <label className="cu-range">Güç <output>{displayedStrength}/5</output>
              <input type="range" min="1" max="5" value={displayedStrength} onChange={event => setStrength(Number(event.target.value))} />
            </label>
            <label className="cu-checkbox"><input type="checkbox" checked={directed} onChange={event => setDirected(event.target.checked)} /> Yönlü bağ</label>
          </fieldset>
          {existing && <p className="cu-muted" role="status">Bu bağ zaten var. Değişiklikler mevcut bağa kaydedilecek.</p>}
          {error && <p role="alert" className="cu-form-error">{error}</p>}
          <div className="cu-dialog-actions">
            <button className="cu-button cu-action-spacer" type="button" onClick={onClose} disabled={busy}>Vazgeç</button>
            <button className="cu-button cu-primary" disabled={busy}>{busy ? "Kaydediliyor…" : "Kaydet"}</button>
          </div>
        </form>
      </div>
    </UniverseDialog>
  );
}
