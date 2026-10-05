import { useEffect, useRef, useState } from "react";
import "./WorldEntryModal.css";

export default function WorldEntryModal({ category, initial, onClose, onSave, saving, onFilter, onManage }) {
  const character = category === "characters";
  const [form, setForm] = useState(() => character
    ? { name: initial?.name || "", role: initial?.role || "", tagline: initial?.tagline || "", notes: initial?.notes || "", faction: initial?.faction || "", location: initial?.location || "" }
    : { name: initial?.name || "", description: initial?.description || "", notes: initial?.notes || "" });
  const [dirty, setDirty] = useState(false), [status, setStatus] = useState("");
  const dialog = useRef(null), lock = useRef(false);
  useEffect(() => {
    const trigger = document.activeElement;
    dialog.current.showModal();
    return () => { if (trigger?.isConnected) trigger.focus(); };
  }, []);
  useEffect(() => {
    const warn = e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(close = false) {
    if (saving || lock.current) return;
    if (!dirty && initial) { if (close) onClose(); return true; }
    if (!dirty && close) { onClose(); return true; }
    if (!form.name.trim()) { setStatus("Başlık gerekli. Yazdıkların bu panelde korunuyor."); return false; }
    lock.current = true; setStatus("Kaydediliyor…");
    try {
      const ok = await onSave({ ...form, category });
      if (!ok) throw new Error("save");
      setDirty(false); setStatus("Kaydedildi");
      if (close) onClose();
      return true;
    } catch { setStatus("Kaydedilemedi. Yazdıkların burada; yeniden kaydetmeyi dene."); return false; }
    finally { lock.current = false; }
  }
  const field = (key, label, multiline = false) => <label className="pww-form-group" key={key}>{label}
    {multiline ? <textarea value={form[key]} disabled={saving} onChange={e => change(key, e.target.value)} rows={key === "notes" && character ? 10 : 7} />
      : <input autoFocus={key === "name"} value={form[key]} disabled={saving} onChange={e => change(key, e.target.value)} />}
  </label>;
  function change(key, value) { setForm(prev => ({ ...prev, [key]: value })); setDirty(true); setStatus("Değişiklik var"); }
  return <dialog ref={dialog} className="pww-modal-content" aria-labelledby="pww-title" onCancel={e => { e.preventDefault(); void save(true); }}
    onKeyDown={e => { e.stopPropagation(); if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); void save(); } }}>
    <header className="pww-modal-header"><h2 id="pww-title">{character ? "Karakter" : category === "rules" ? "Evren bilgisi" : "Olay örgüsü notu"}{initial ? " · Düzenle" : " ekle"}</h2>
      <button className="pww-btn-ghost" disabled={saving} onClick={() => save(true)}>← Listeye dön</button></header>
    <div className="pww-modal-body">
      {field("name", character ? "Ad" : "Başlık")}
      {character ? <>{field("role", "Rol (isteğe bağlı)")}{field("tagline", "Kısa tanım (isteğe bağlı)")}{field("notes", "Karakter notları", true)}
        <details><summary>Diğer karakter bilgileri</summary>{field("faction", "Topluluk")}{field("location", "Konum")}</details></>
        : <>{field("description", "Açıklama (isteğe bağlı)", true)}{initial?.notes && field("notes", "Ek notlar", true)}
          {!!initial?.scenes?.length && <p>{initial.scenes.length} sahne bağlantısı korunuyor.</p>}</>}
    </div>
    <footer className="pww-modal-actions"><span role="status">{status}</span>
      {onFilter && <button disabled={saving} onClick={async () => { if (await save()) { onFilter(); onClose(); } }}>Sahnelerini filtrele</button>}
      {onManage && <button disabled={saving} onClick={async () => { if (await save()) onManage(); }}>Karakter yönetimi</button>}
      <button className="pww-btn-primary" disabled={saving || (!dirty && !!initial)} onClick={() => save()}>{saving ? "Kaydediliyor…" : "Kaydet"}</button></footer>
  </dialog>;
}
