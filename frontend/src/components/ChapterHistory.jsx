import { useEffect, useState, useRef } from "react";
import DOMPurify from "dompurify";
import { apiGet } from "../lib/api";

export function ChapterPreview({ title, content }) {
  return <section className="chapter-preview"><h3>{title}</h3><div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content || "") }} /></section>;
}

export default function ChapterHistory({ chapter, onClose, onRestore, onCheckpoint, renderCurrent }) {
  const [items, setItems] = useState([]), [next, setNext] = useState(null);
  const [selected, setSelected] = useState(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [naming, setNaming] = useState(false), [comparing, setComparing] = useState(false);
  const [message, setMessage] = useState("");
  const panelRef = useRef(null);
  const busyRef = useRef(false);
  useEffect(() => {
    const previous = document.activeElement;
    panelRef.current?.querySelector("button")?.focus();
    return () => previous?.isConnected && previous.focus();
  }, []);
  useEffect(() => {
    let active = true;
    apiGet(`/chapters/${chapter._id}/versions`).then(data => {
      if (active) { setItems(data.items); setNext(data.nextBefore); }
    }).catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [chapter._id]);
  async function preview(revision) {
    setBusy(true); setError("");
    try { setSelected((await apiGet(`/chapters/${chapter._id}/versions/${revision}`)).item); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function more() {
    setBusy(true);
    try {
      const data = await apiGet(`/chapters/${chapter._id}/versions?before=${next}`);
      setItems(old => [...old, ...data.items]); setNext(data.nextBefore);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function restore() {
    setBusy(true); setError("");
    try { if (await onRestore(selected)) onClose(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  async function checkpoint(name) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const item = await onCheckpoint(name);
      setItems(old => [item, ...old.filter(version => version.revision !== item.revision)].sort((a, b) => b.revision - a.revision));
      setLabel(""); setNaming(false); setMessage("Bu an Geçmiş'te saklandı.");
    } catch (err) { setError(err.message); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const blocked = busy || loading || chapter._deleting || chapter._saving || !!chapter._conflict || !!chapter._recovery;
  return <div className="chapter-history-veil" role="dialog" aria-modal="true" aria-label="Geçmiş"
    onKeyDown={event => {
      if (event.key === "Escape") { event.stopPropagation(); if (!busy) { if (comparing) setComparing(false); else onClose(); } }
      if (event.key === "Tab") {
        const nodes = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"], [contenteditable="true"]')];
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
    <div className={"chapter-history-box" + (comparing ? " is-comparing" : "")} ref={panelRef}>
      <div className="chapter-history-header"><h2>Geçmiş</h2><button onClick={onClose} disabled={busy}>Kapat</button></div>
      <p className="chapter-history-subtitle">ACB, bölümünün önceki hâllerini senin için saklar.</p>
      {!selected && <div className="chapter-checkpoint">
        <button aria-expanded={naming} onClick={() => setNaming(v => !v)} disabled={blocked}>☆ Bu anı sakla</button>
        {naming && <div className="chapter-name-popover">
          <label htmlFor="checkpoint-label">Bu ana bir isim vermek ister misin?</label>
          <input id="checkpoint-label" value={label} maxLength={80} disabled={busy} onChange={e => setLabel(e.target.value)} placeholder="Edit öncesi" autoFocus />
          <div className="chapter-history-actions"><button onClick={() => checkpoint("")} disabled={blocked}>İsimsiz sakla</button><button onClick={() => checkpoint(label)} disabled={blocked || !label.trim()}>Sakla</button></div>
        </div>}
      </div>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Geçmiş yükleniyor…</p>}
      {!loading && !items.length && <p>Henüz eski bir kayıt yok. Yazdıkça önceki metinlerin burada korunacak.</p>}
      {!selected && <div className="chapter-history-list">{items.map(item => <button aria-pressed={selected?.revision === item.revision} key={item.revision} disabled={busy} onClick={() => preview(item.revision)}>
        <strong>{item.isCheckpoint ? "⭐ " + (item.label || "Sakladığın an") : historyDate(item.savedAt)}</strong>
        {item.isCheckpoint && <span>{historyDate(item.savedAt)}</span>}
      </button>)}</div>}
      {!selected && next !== null && <button disabled={busy} onClick={more}>Daha eski kayıtlar</button>}
      {selected && <>
        <button disabled={busy} onClick={() => { setSelected(null); setComparing(false); }}>← Kayıtlara dön</button>
        <p className="chapter-history-subtitle">{historyDate(selected.savedAt)}{selected.label ? " · ⭐ " + selected.label : ""}</p>
        {comparing ? <><button onClick={() => setComparing(false)}>Karşılaştırmayı kapat</button>
          <div className="chapter-comparison">{renderCurrent({ readOnly: busy || chapter._deleting })}<ChapterPreview title="Geçmişteki metin" content={selected.content} /></div>
        </> : <ChapterPreview title={selected.title} content={selected.content} />}
        <div className="chapter-history-actions">
          {!comparing && <button disabled={busy} onClick={() => setComparing(true)}>Karşılaştır</button>}
          <button className="acb-action--primary" disabled={blocked} onClick={restore}>{busy ? "İşleniyor…" : "Bu metinden devam et"}</button>
        </div>
        <p className="chapter-history-note">Mevcut taslağın güvende kalacak.</p>
      </>}
    </div>
  </div>;
}

function historyDate(value) {
  const date = new Date(value), today = new Date(), yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const day = date.toDateString() === today.toDateString() ? "Bugün" : date.toDateString() === yesterday.toDateString() ? "Dün" : date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }) });
  return day + " " + date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}