import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from "../lib/api";
import { createNoteSaveQueue } from "../lib/noteSaveQueue";
import VoiceInputButton from "./VoiceInputButton";

const idOf = n => n?._id || n?.id;
const workOf = n => idOf(n?.workId) || idOf(n?.work) || n?.workId || n?.work || "";
const normalize = n => ({ ...n, _id: idOf(n), content: n.content ?? n.body ?? "" });
const dateLabel = n => n.updatedAt || n.createdAt
  ? new Date(n.updatedAt || n.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "";
const labels = { idle: "", dirty: "Değişiklik var", saving: "Kaydediliyor…", saved: "Kaydedildi", error: "Kaydedilemedi. Notun açık tutuluyor." };

export default function NotesWorkspace({ workId, WorkView }) {
  const navigate = useNavigate();
  const endpoint = workId ? `/works/${workId}/notes` : "/notes";
  const [notes, setNotes] = useState([]), [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [worksError, setWorksError] = useState(false);
  const [draft, setDraft] = useState(null), [status, setStatus] = useState("idle");
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const editorRef = useRef(null), newNoteRef = useRef(null), draftRef = useRef(null);
  const timer = useRef(null), lastTrigger = useRef(null), actionLock = useRef(false);
  const queue = useMemo(() => createNoteSaveQueue(async (value, previous) => {
    const payload = workId ? {
      ...(value.title !== previous.title && { title: value.title }),
      ...(value.richBody !== previous.richBody && { richBody: value.richBody }),
    }
      : { title: value.title, content: value.content, workId: value.workId || null };
    const res = await (workId ? apiPut : apiPatch)(`${endpoint}/${value._id}`, payload);
    if (!res.item) throw new Error("Eksik kayıt yanıtı");
    return normalize(res.item);
  }, setStatus, item => setNotes(prev => workId
    ? [item, ...prev.filter(n => n._id !== item._id)]
    : prev.map(n => n._id === item._id ? item : n))), [endpoint, workId]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const res = await apiGet(endpoint); setNotes((res.items || []).map(normalize)); }
    catch { setError("Notlar yüklenemedi."); }
    finally { setLoading(false); }
  }, [endpoint]);
  const loadWorks = useCallback(async () => {
    try {
      const res = await apiGet(workId ? `/works/${workId}` : "/works");
      setWorks(workId ? [res.item].filter(Boolean) : res.items || []);
      setWorksError(false);
    }
    catch { setWorksError(true); }
  }, [workId]);
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
    draftRef.current = value;
    queue.reset(value); setDraft(value);
  }
  function open(note, trigger) {
    if (note._id === draft?._id) return;
    transition(() => { lastTrigger.current = trigger; select(note); });
  }
  function change(patch) {
    if (actionLock.current || !draftRef.current) return;
    const value = { ...draftRef.current, ...patch };
    draftRef.current = value;
    setDraft(value); queue.change(value); clearTimeout(timer.current);
    timer.current = setTimeout(() => queue.flush(), workId ? 800 : 1400);
  }
  function clearSelection() {
    draftRef.current = null;
    queue.reset(null);
    setDraft(null);
    requestAnimationFrame(() => {
      lastTrigger.current?.focus();
      if (workId && document.activeElement !== lastTrigger.current) newNoteRef.current?.focus();
    });
  }
  function close() { transition(clearSelection); }
  function create(event) {
    const trigger = event.currentTarget;
    transition(async () => {
      try {
        const res = await apiPost(endpoint, workId ? {} : { title: "Yeni Not", content: "" });
        const note = normalize(res.item);
        lastTrigger.current = trigger;
        setNotes(prev => [note, ...prev]); setQuery(""); setFilter("all"); select(note);
      } catch { setActionError("Not oluşturulamadı. Yeni not düğmesiyle yeniden deneyebilirsin."); }
    });
  }
  function remove() {
    if (!workId && !window.confirm("Bu notu kalıcı olarak silmek istiyor musun?")) return;
    transition(async () => {
      try {
        await apiDelete(`${endpoint}/${draft._id}`);
        setNotes(prev => prev.filter(n => n._id !== draft._id));
        clearSelection();
      } catch { setActionError("Not silinemedi. Yeniden deneyebilirsin."); }
    });
  }
  const filtered = notes.filter(n => (filter !== "free" || !workOf(n)) && (filter !== "linked" || workOf(n))
    && `${n.title || ""} ${n.content}`.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")));
  const workName = id => works.find(w => String(idOf(w)) === String(id))?.title;
  if (WorkView) {
    const workPath = `/work/${workId}`;
    return <WorkView workPath={workPath} workTitle={workName(workId)}
      onBack={event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        transition(() => navigate(workPath));
      }}
      notes={filtered} total={notes.length} query={query} onSearch={setQuery} loading={loading} error={error}
      actionError={actionError} busy={busy} onRetry={load} onCreate={create} onOpen={open} newNoteRef={newNoteRef}
      draft={draft} status={status} titleRef={editorRef} onChange={change} onClose={close} onSave={flush} onRemove={remove} />;
  }
  return <section className={`np-layout ${draft ? "np-has-selection" : ""}`}>
    <header className="np-heading">
      <div><h1>Notlarım</h1>
        <p>Serbest ve esere bağlı notların. Eser içindeki ve olay örgüsündeki notlar ayrı tutulur.</p>
        {actionError && <p className="np-error" role="alert">{actionError}</p>}
      </div>
      <button className="np-primary" onClick={create} disabled={busy || loading}>+ Yeni not</button>
    </header>
    <aside className="np-sidebar" aria-label="Not listesi">
      <input type="search" aria-label="Notlarda ara" placeholder="Notlarda ara…" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="np-filters" aria-label="Not kapsamı">{[["all", "Tümü"], ["free", "Serbest"], ["linked", "Esere bağlı"]].map(([key, label]) =>
        <button key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
      {error && <div className="np-error" role="alert">{error} <button onClick={load}>Yeniden dene</button></div>}
      <div className="np-list">
        {loading ? <p role="status">Notlar yükleniyor…</p> : !error && !filtered.length ? <p>{notes.length ? "Bu arama veya filtreyle eşleşen not yok." : "Henüz not yok. Yeni not ile başlayabilirsin."}</p> : null}
        {filtered.map(n => <button key={n._id} className="np-item" aria-current={draft?._id === n._id ? "true" : undefined} disabled={busy}
          onClick={e => open(n, e.currentTarget)}>
          <strong>{n.title || n.content.split("\n")[0] || "Başlıksız not"}</strong>
          <span className="np-excerpt">{n.content || "İçerik eklenmemiş"}</span>
          {workOf(n) && <span className="np-work-tag">{workName(workOf(n)) || "Esere bağlı"}</span>}
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
        <label className="np-field">Not başlığı<input ref={editorRef} value={draft.title || ""} disabled={busy} onChange={e => change({ title: e.target.value })} /></label>
        <div className="np-link-wrap"><label>Bağlı eser<select value={draft.workId} disabled={busy || worksError} onChange={e => change({ workId: e.target.value })}>
            <option value="">Serbest not (bağlantı yok)</option>
            {draft.workId && !workName(draft.workId) && <option value={draft.workId}>Bağlı eser</option>}
            {works.map(w => <option key={idOf(w)} value={idOf(w)}>{w.title}</option>)}
          </select></label>{draft.workId && <button disabled={busy} onClick={() => change({ workId: "" })}>Eser bağlantısını kaldır</button>}
          {worksError && <button onClick={loadWorks}>Eserler yüklenemedi · Yeniden dene</button>}</div>
        <label className="np-field np-body-field">Not içeriği<textarea value={draft.content} disabled={busy} onChange={e => change({ content: e.target.value })} placeholder="Fikrini buraya bırak…" /></label>
        <footer className="np-footer"><span>Değişiklikler otomatik kaydedilir.</span><button disabled={busy} onClick={remove}>Notu sil</button></footer>
      </div> : <div className="np-empty-state"><h2>Fikirlerine yer aç</h2><p>Okumak veya düzenlemek için listeden bir not seç.</p></div>}
    </main>
  </section>;
}
