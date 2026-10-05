import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiDownloadBook } from "../lib/api";
import "../styles/BookDownload.css";

export default function BookDownload({ workId, dirty = false, beforeSave, disabled = false, buttonClass = "ws-btn-ghost" }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState("docx");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const running = useRef(false);
  const dialog = useRef(null);
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  async function download(save) {
    if (running.current) return;
    running.current = true; setBusy(true); setMessage("");
    try {
      if (save) await beforeSave();
      await apiDownloadBook(workId, format);
      setMessage("Dosya hazırlandı ve tarayıcıya iletildi.");
    } catch (err) { setMessage(err.message || "Kitap indirilemedi."); }
    finally { running.current = false; setBusy(false); }
  }
  return <div className="book-download">
    <button className={buttonClass} disabled={disabled || busy} onClick={() => { setOpen(!open); setMessage(""); }} aria-expanded={open}>Kitabımı indir</button>
    {open && createPortal(<dialog ref={dialog} className="book-download-panel" aria-label="Kitabımı indir"
      onCancel={event => { if (busy) event.preventDefault(); else setOpen(false); }}>
      <p>Yayımlanmamış bölümler dâhil sunucuda kayıtlı kitabınız indirilir. Özel notlar ve AI değerlendirmeleri eklenmez.</p>
      <p>Başka bir sekmede açık düzenlemeleriniz varsa önce o sekmede kaydedin.</p>
      <label>Dosya biçimi <select value={format} disabled={busy} onChange={e => setFormat(e.target.value)}>
        <option value="docx">DOCX — düzenlenebilir</option><option value="txt">TXT — UTF-8 düz metin</option>
      </select></label>
      {dirty && <p role="alert">Kaydedilmemiş değişiklikler var. Kayıtlı sürümü indirirseniz bu değişiklikler dosyada yer almaz.</p>}
      <div className="book-download-actions">
        {beforeSave && <button className="acb-action--primary" disabled={busy || disabled} onClick={() => download(true)}>Önce kaydet ve indir</button>}
        <button className={beforeSave ? undefined : "acb-action--primary"} disabled={busy || disabled} onClick={() => download(false)}>Kayıtlı sürümü indir</button>
        <button disabled={busy} onClick={() => setOpen(false)}>Kapat</button>
      </div>
      <p role="status" aria-live="polite">{busy ? "Kitap hazırlanıyor…" : message}</p>
    </dialog>, document.body)}
  </div>;
}
