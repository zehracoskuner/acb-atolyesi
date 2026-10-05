import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "../lib/api";
import { createNoteSaveQueue } from "../lib/noteSaveQueue";
import VoiceInputButton from "./VoiceInputButton";
import "../styles/NotesPad.css";

const idOf = n => n?._id || n?.id;
const workOf = n => idOf(n?.workId) || idOf(n?.work) || n?.workId || n?.work || "";
const normalize = n => ({ ...n, _id: idOf(n), content: n.content ?? n.body ?? "" });
const dateLabel = n => n.updatedAt || n.createdAt
  ? new Date(n.updatedAt || n.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "";
const labels = { idle: "", dirty: "Değişiklik var", saving: "Kaydediliyor…", saved: "Kaydedildi", error: "Kaydedilemedi. Notun açık tutuluyor." };

export default function NotesWorkspace({ workId }) {
  const navigate = useNavigate();
  const endpoint = workId ? `/works/${workId}/notes` : "/notes";
  const [notes, setNotes] = useState([]), [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [worksError, setWorksError] = useState(false);
  const [draft, setDraft] = useState(null), [status, setStatus] = useState("idle");
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const editorRef = useRef(null), timer = useRef(null), lastTrigger = useRef(null), actionLock = useRef(false);
  const queue = useMemo(() => createNoteSaveQueue(async value => {
    const payload = workId ? { title: value.title || "", content: value.content, body: value.content }
      : { title: value.title, content: value.content, workId: value.workId || null };
    const res = await (workId ? apiPut : apiPatch)(`${endpoint}/${value._id}`, payload);
    if (!res.item) throw new Error("Eksik kayıt yanıtı");
    return normalize(res.item);
  }, setStatus, item => setNotes(prev => prev.map(n => n._id === item._id ? item : n))), [endpoint, workId]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const res = await apiGet(endpoint); setNotes((res.items || []).map(normalize)); }
    catch { setError("Notlar yüklenemedi."); }
    finally { setLoading(false); }
  }, [endpoint]);
  const loadWorks = useCallback(async () => {
    try { const res = await apiGet("/works"); setWorks(res.items || []); setWorksError(false); }
    catch { setWorksError(true); }
  }, []);
  useEffect(() => { load(); loadWorks(); }, [load, loadWorks]);
  useEffect(() => {
    const warn = e => { if (queue.isDirty()) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); clearTimeout(timer.current); void queue.flush(); };
  }, [queue]);
  useEffect(() => { if (draft?._id && !busy) editorRef.current?.focus(); }, [draft?._id, busy]);
  async function flush() { clearTimeout(timer.current); return queue.flush(); }
  async function transition(action) {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setActionError("");
    try { if (await flush()) await action(); }
    finally { actionLock.current = false; setBusy(false); }
  }
  function select(note) {
    const value = { ...normalize(note), workId: workOf(note) };
    queue.reset(value); setDraft(value);
  }
  function open(note, trigger) {
    if (note._id === draft?._id) return;
    transition(() => { lastTrigger.current = trigger; select(note); });
  }
  function change(patch) {
    const value = { ...draft, ...patch };
    setDraft(value); queue.change(value); clearTimeout(timer.current);
    timer.current = setTimeout(() => queue.flush(), workId ? 800 : 1400);
  }
  function close() { transition(() => { queue.reset(null); setDraft(null); requestAnimationFrame(() => lastTrigger.current?.focus()); }); }
  function create(event) {
    lastTrigger.current = event.currentTarget;
    transition(async () => {
      try {
        const res = await apiPost(endpoint, workId ? { content: "Yeni not", body: "Yeni not" } : { title: "Yeni Not", content: "" });
        const note = normalize(res.item);
        setNotes(prev => [note, ...prev]); setQuery(""); setFilter("all"); select(note);
      } catch { setActionError("Not oluşturulamadı. Yeni not düğmesiyle yeniden deneyebilirsin."); }
    });
  }
  function remove() {
    if (!window.confirm("Bu notu kalıcı olarak silmek istiyor musun?")) return;
    transition(async () => {
      try {
        await apiDelete(`${endpoint}/${draft._id}`);
        setNotes(prev => prev.filter(n => n._id !== draft._id)); queue.reset(null); setDraft(null);
      } catch { setActionError("Not silinemedi. Yeniden deneyebilirsin."); }
    });
  }
  const filtered = notes.filter(n => (filter !== "free" || !workOf(n)) && (filter !== "linked" || workOf(n))
    && `${n.title || ""} ${n.content}`.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")));
  const workName = id => works.find(w => String(idOf(w)) === String(id))?.title;
  return <section className={`np-layout ${workId ? "np-work" : ""} ${draft ? "np-has-selection" : ""}`}>
    <header className="np-heading">
      <div>{workId && <Link to={`/work/${workId}`} onClick={e => { e.preventDefault(); transition(() => navigate(`/work/${workId}`)); }}>← Esere dön</Link>}
        <h1>{workId ? workName(workId) || "Eser notları" : "Notlarım"}</h1>
        <p>{workId ? "Bu eserin notları ve fikirleri. Genel defter ve olay örgüsü notları ayrı tutulur." : "Serbest ve esere bağlı notların. Eser içindeki ve olay örgüsündeki notlar ayrı tutulur."}</p>
        {actionError && <p className="np-error" role="alert">{actionError}</p>}
      </div>
      <button className="np-primary" onClick={create} disabled={busy || loading}>+ Yeni not</button>
    </header>
    <aside className="np-sidebar" aria-label="Not listesi">
      <input type="search" aria-label="Notlarda ara" placeholder="Notlarda ara…" value={query} onChange={e => setQuery(e.target.value)} />
      {!workId && <div className="np-filters" aria-label="Not kapsamı">{[["all", "Tümü"], ["free", "Serbest"], ["linked", "Esere bağlı"]].map(([key, label]) =>
        <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>}
      {error && <div className="np-error" role="alert">{error} <button onClick={load}>Yeniden dene</button></div>}
      <div className="np-list">
        {loading ? <p role="status">Notlar yükleniyor…</p> : !error && !filtered.length ? <p>{notes.length ? "Bu arama veya filtreyle eşleşen not yok." : "Henüz not yok. Yeni not ile başlayabilirsin."}</p> : null}
        {filtered.map(n => <button key={n._id} className="np-item" aria-current={draft?._id === n._id ? "true" : undefined} disabled={busy}
          onClick={e => open(n, e.currentTarget)}>
          <strong>{n.title || n.content.split("\n")[0] || "Başlıksız not"}</strong>
          <span className="np-excerpt">{n.content || "İçerik eklenmemiş"}</span>
          {(workId || workOf(n)) && <span className="np-work-tag">{workName(workId || workOf(n)) || "Esere bağlı"}</span>}
          {n.source && <span className="np-work-tag">{n.source === "sceneSpark" ? "Kıvılcım" : n.source === "ai-coach" ? "AI Notu" : n.source}</span>}
          {dateLabel(n) && <span className="np-work-tag">{dateLabel(n)}</span>}
        </button>)}
      </div>
    </aside>
    <main className="np-editor">
      {draft ? <div className="np-editor-inner" onKeyDown={e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void flush(); }
        if (e.key === "Escape") close();
      }}>
        <div className="np-toolbar">
          <button onClick={close} disabled={busy}>← Not listesi</button>
          <span role="status" className={status === "error" ? "np-error" : "np-save-status"}>{labels[status]}</span>
          <button onClick={flush} disabled={busy || status === "saving"}>{status === "error" ? "Yeniden kaydet" : "Kaydet"}</button>
          <VoiceInputButton onResult={text => change({ content: draft.content ? `${draft.content} ${text}` : text })} />
        </div>
        <label className="np-field">Not başlığı{workId ? " (isteğe bağlı)" : ""}<input ref={editorRef} value={draft.title || ""} disabled={busy} onChange={e => change({ title: e.target.value })} /></label>
        {!workId && <>
          <div className="np-link-wrap"><label>Bağlı eser<select value={draft.workId} disabled={busy || worksError} onChange={e => change({ workId: e.target.value })}>
            <option value="">Serbest not (bağlantı yok)</option>
            {draft.workId && !workName(draft.workId) && <option value={draft.workId}>Bağlı eser</option>}
            {works.map(w => <option key={idOf(w)} value={idOf(w)}>{w.title}</option>)}
          </select></label>{draft.workId && <button disabled={busy} onClick={() => change({ workId: "" })}>Eser bağlantısını kaldır</button>}
          {worksError && <button onClick={loadWorks}>Eserler yüklenemedi · Yeniden dene</button>}</div></>}
        <label className="np-field np-body-field">Not içeriği<textarea value={draft.content} disabled={busy} onChange={e => change({ content: e.target.value })} placeholder="Fikrini buraya bırak…" /></label>
        <footer className="np-footer"><span>Değişiklikler otomatik kaydedilir.</span><button disabled={busy} onClick={remove}>Notu sil</button></footer>
      </div> : <div className="np-empty-state"><h2>Fikirlerine yer aç</h2><p>Okumak veya düzenlemek için listeden bir not seç.</p></div>}
    </main>
  </section>;
}
