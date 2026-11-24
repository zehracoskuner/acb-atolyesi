import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Bold, Check, CloudOff, CloudUpload, FileText, Heading2, Italic,
  List, ListOrdered, NotebookPen, Plus, Search, Trash2,
} from "lucide-react";
import { chapterClipboardHtml, insertChapterHtml, plainTextHtml } from "../lib/chapterClipboard";
import VoiceInputButton from "./VoiceInputButton";
import "../styles/WorkNotes.css";

const commands = [
  { name: "Ara başlık", command: "formatBlock", value: "h2", Icon: Heading2 },
  { name: "Kalın", command: "bold", Icon: Bold },
  { name: "İtalik", command: "italic", Icon: Italic },
  { name: "Madde işaretli liste", command: "insertUnorderedList", Icon: List },
  { name: "Numaralı liste", command: "insertOrderedList", Icon: ListOrdered },
];

const saveLabels = {
  idle: "Otomatik kayıt açık",
  dirty: "Kaydedilmeyi bekliyor",
  saving: "Kaydediliyor…",
  saved: "Kaydedildi",
  error: "Kaydedilemedi",
};
const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" });

function notePreview(note) {
  const [firstLine, ...rest] = note.content.trim().split(/\r?\n/);
  const title = note.title?.trim();
  return {
    title: title || firstLine || "Başlıksız not",
    excerpt: title ? note.content.trim() : rest.join("\n").trim(),
  };
}

function WorkNoteEditor({ draft, status, busy, titleRef, onChange, onClose, onSave, onRemove }) {
  const editor = useRef(null);
  const dialog = useRef(null);
  const range = useRef(null);
  const [activeCommands, setActiveCommands] = useState({});
  const [initialHtml] = useState(() => {
    const rich = draft.mobileRichBody;
    return rich?.plain === draft.content && typeof rich.html === "string"
      ? chapterClipboardHtml({ getData: type => type === "text/html" ? rich.html : "" })
      : plainTextHtml(draft.content);
  });
  const currentHtml = useRef(initialHtml);
  const rememberSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editor.current?.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
    range.current = selection.getRangeAt(0).cloneRange();
    setActiveCommands(Object.fromEntries(commands.map(({ command, value }) => [command, value
      ? document.queryCommandValue(command).toLowerCase() === value
      : document.queryCommandState(command)])));
  }, []);

  useEffect(() => {
    editor.current.innerHTML = initialHtml;
    document.addEventListener("selectionchange", rememberSelection);
    return () => document.removeEventListener("selectionchange", rememberSelection);
  }, [initialHtml, rememberSelection]);

  function updateBody() {
    const element = editor.current;
    // Deleting formatted text can leave an empty block with a caret placeholder.
    const empty = !element.textContent && element.children.length <= 1 && element.querySelectorAll("br").length <= 1;
    const richBody = empty ? "" : element.innerHTML;
    if (richBody === currentHtml.current) return;
    currentHtml.current = richBody;
    onChange({ richBody, content: empty ? "" : element.innerText });
  }

  function focusBody(selectionRange) {
    const element = editor.current;
    const selection = window.getSelection();
    element.focus();
    if (!selectionRange || !element.contains(selectionRange.commonAncestorContainer)) {
      selectionRange = document.createRange();
      selectionRange.selectNodeContents(element);
      selectionRange.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(selectionRange);
  }

  function format({ command, value }) {
    focusBody(range.current);
    const nextValue = value && document.queryCommandValue(command).toLowerCase() === value ? "div" : value;
    document.execCommand(command, false, nextValue);
    rememberSelection();
    updateBody();
  }

  function paste(event) {
    event.preventDefault();
    insertChapterHtml(editor.current, chapterClipboardHtml(event.clipboardData));
    updateBody();
  }

  function appendVoice(text) {
    if (busy) return;
    focusBody();
    insertChapterHtml(editor.current, plainTextHtml(`${editor.current.textContent ? " " : ""}${text}`));
    updateBody();
  }

  const SaveIcon = status === "error" ? CloudOff : status === "saved" ? Check : CloudUpload;
  const words = draft.content.trim().split(/\s+/u).filter(Boolean).length;
  return <div className="wn-editor-inner" onKeyDown={event => {
    if (dialog.current?.open) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      if (!busy) void onSave();
    }
    if (event.key === "Escape" && !event.nativeEvent.isComposing) onClose();
  }}>
    <div className="wn-editor-bar">
      <button className="wn-button wn-list-back" onClick={onClose} disabled={busy}><ArrowLeft size={17} /> Notlar</button>
      <span className="wn-save-state" role="status" data-status={status}><SaveIcon size={17} />{saveLabels[status]}</span>
      <div className="wn-editor-actions">
        <button className="wn-button wn-save-button" onClick={onSave} disabled={busy || status === "saving"} title="Ctrl veya ⌘ + S">
          {status === "error" ? "Yeniden kaydet" : "Kaydet"}
        </button>
        <button className="wn-button wn-icon wn-delete" aria-label="Notu sil" title="Notu sil" disabled={busy}
          onClick={() => dialog.current.showModal()}><Trash2 size={17} /></button>
      </div>
    </div>
    {status === "error" && <p className="wn-save-error">Değişikliklerin editörde duruyor. Devam etmek için yeniden kaydet.</p>}

    <div className="wn-document">
      <input className="wn-title" ref={titleRef} aria-label="Not başlığı" placeholder="Başlıksız not" value={draft.title || ""}
        readOnly={busy} onChange={event => onChange({ title: event.target.value })} />
      <div className="wn-format-bar" role="group" aria-label="Metin biçimlendirme">
        {commands.map(option => <button key={option.command} className="wn-button wn-icon" type="button"
          aria-label={option.name} title={option.name} aria-pressed={Boolean(activeCommands[option.command])} disabled={busy}
          onMouseDown={event => event.preventDefault()} onClick={() => format(option)}><option.Icon size={18} /></button>)}
        <VoiceInputButton onResult={appendVoice} disabled={busy} />
      </div>
      <div className="wn-body" ref={editor} contentEditable={!busy} role="textbox" aria-label="Not içeriği" aria-multiline="true"
        aria-readonly={busy} data-empty={(draft.richBody ?? initialHtml) === ""} data-placeholder="Notunu yaz…"
        spellCheck lang="tr" onInput={updateBody} onPaste={paste}
        onDragOver={event => event.preventDefault()} onDrop={event => event.preventDefault()} />
    </div>

    <footer className="wn-editor-footer">{words.toLocaleString("tr-TR")} kelime</footer>

    <dialog ref={dialog} className="wn-dialog" aria-labelledby="wn-delete-title">
      <h2 id="wn-delete-title">Not silinsin mi?</h2>
      <p>Bu not kalıcı olarak silinecek.</p>
      <form method="dialog">
        <button className="wn-button" autoFocus>Vazgeç</button>
        <button className="wn-button wn-danger" type="button" onClick={() => { dialog.current.close(); onRemove(); }}>Notu sil</button>
      </form>
    </dialog>
  </div>;
}

export default function WorkNotesView({ workPath, workTitle, onBack, notes, total, query, onSearch, loading, error, actionError,
  busy, onRetry, onCreate, onOpen, newNoteRef, draft, status, titleRef, onChange, onClose, onSave, onRemove }) {
  return <main className={`wn-page${draft ? " wn-has-note" : ""}`}>
    <header className="wn-header">
      <div className="wn-heading">
        <Link className="wn-back" to={workPath} onClick={onBack} title={workTitle || "Esere dön"}>
          <ArrowLeft size={16} /> <span>{workTitle || "Esere dön"}</span>
        </Link>
        <h1>Eser notları</h1>
      </div>
      <button className="wn-button wn-primary" onClick={onCreate} ref={newNoteRef} disabled={busy || loading || Boolean(error)}>
        <Plus size={19} /> Yeni not
      </button>
    </header>

    {actionError && <p className="wn-action-error" role="alert">{actionError}</p>}

    <div className="wn-workspace">
      <aside className="wn-sidebar" aria-label="Not listesi">
        <div className="wn-sidebar-top">
          <div className="wn-list-heading"><h2>Tüm notlar</h2>{!loading && !error && <span>{query.trim() ? `${notes.length} / ${total}` : total}</span>}</div>
          <label className="wn-search"><Search size={17} /><input type="search" aria-label="Notlarda ara" placeholder="Notlarda ara…"
            value={query} onChange={event => onSearch(event.target.value)} /></label>
        </div>
        <div className="wn-list">
          {loading && <p className="wn-list-message" role="status">Notlar yükleniyor…</p>}
          {error && <div className="wn-list-message" role="alert"><p>{error}</p><button className="wn-button" onClick={onRetry}>Yeniden dene</button></div>}
          {!loading && !error && !notes.length && <p className="wn-list-message">{total ? "Aramayla eşleşen not yok." : "Henüz not yok."}</p>}
          {notes.map(note => {
            const { title, excerpt } = notePreview(note);
            const timestamp = Date.parse(note.updatedAt || note.createdAt);
            const source = note.source === "sceneSpark" ? "Sahne Kıvılcımı" : note.source === "ai-coach" ? "AI notu" : null;
            return <button key={note._id} className="wn-note" aria-current={draft?._id === note._id ? "true" : undefined}
              disabled={busy} onClick={event => onOpen(note, event.currentTarget)}>
              <FileText className="wn-note-icon" size={17} />
              <span className="wn-note-copy">
                <strong>{title}</strong>
                {excerpt && <span className="wn-note-excerpt">{excerpt}</span>}
                {(!Number.isNaN(timestamp) || source) && <span className="wn-note-meta">
                  {!Number.isNaN(timestamp) && <time dateTime={new Date(timestamp).toISOString()}>{dateFormat.format(timestamp)}</time>}
                  {source && <span className="wn-note-source">{source}</span>}
                </span>}
              </span>
            </button>;
          })}
        </div>
      </aside>

      <section className="wn-editor" aria-label="Not editörü">
        {draft ? <WorkNoteEditor key={draft._id} {...{ draft, status, busy, titleRef, onChange, onClose, onSave, onRemove }} />
          : <div className="wn-empty">
            <span className="wn-empty-icon"><NotebookPen size={27} strokeWidth={1.6} /></span>
            <h2>{total ? "Bir not seç" : "İlk notunu yaz"}</h2>
          </div>}
      </section>
    </div>
  </main>;
}
