// src/pages/ChaptersPage.jsx
import {
  useEffect, useState, useCallback, useMemo,
  useRef, useReducer,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, isChapterSaveReceipt } from "../lib/api";
import DevelopmentCoachDialog from "../components/DevelopmentCoachDialog";
import DevelopmentCoachPreference from "../components/DevelopmentCoachPreference";
import DevelopmentCoachArchive from "../components/DevelopmentCoachArchive";
import { DEVELOPMENT_COACH_LAUNCH_ENABLED } from "../../../shared/features.js";
import { CHAPTER_HISTORY_ENABLED } from "../../../shared/features.js";
import BookDownload from "../components/BookDownload";
import { saveBeforeBookDownload } from "../lib/bookDownload";
import "../styles/ChaptersPage.css";
import EtikHatirlatma from "../components/EtikHatirlatma";
import AtelierTab from "../components/AtelierTab";
import ChapterHistory, { ChapterPreview } from "../components/ChapterHistory";
import { draftKey, readDrafts, persistDraft } from "../lib/chapterDrafts";
import DOMPurify from "dompurify";
import { setWritingFocus } from "../lib/writingFocus";

const AUTOSAVE_DELAY   = 2000;
const WORDS_PER_MINUTE = 200;
const MAX_UNDO         = 50;

/* ── Theme ── */
function getInitialTheme() {
  try {
    const s = localStorage.getItem("acb_theme");
    if (s === "dark" || s === "light") return s;
  } catch { /**/ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("acb_theme", t); } catch { /**/ }
}

/* ── Helpers ── */
function wcFromHtml(html) {
  if (!html) return 0;
  const d = document.createElement("div");
  d.innerHTML = html;
  d.querySelectorAll("br").forEach(node => node.replaceWith(document.createTextNode(" ")));
  d.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, blockquote, pre, tr").forEach(node => node.append(" "));
  const t = (d.textContent || "").trim();
  return t ? t.split(/\s+/).filter(Boolean).length : 0;
}
function readTime(w) {
  const m = Math.ceil(w / WORDS_PER_MINUTE);
  return m < 1 ? "<1 dk" : `${m} dk`;
}

function htmlify(raw) {
  if (!raw) return "";
  // Zaten HTML tag varsa dokunma
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  // Düz metin → paragraf bloklarına çevir
  return raw
    .split(/\n\n+/)
    .map((p) => `<div>${p.replace(/\n/g, "<br>") || "<br>"}</div>`)
    .join("");
}

function normalizeChapter(ch) {
  const raw = ch.content ?? ch.icerik ?? "";
  const fullContent = htmlify(raw);
  return {
    ...ch,
    content:    fullContent,
    title:      ch.title       || "",
    status:     ch.status      || "draft",
    reviewNote: ch.reviewNote  || "",
    order:      ch.order       ?? 0,
    _dirty:     false,
    revision: ch.revision ?? 0,
    savedAt: ch.savedAt || ch.updatedAt || null,
    _edit:      0,
    _eligibleWords: 0, _savedEligibleWords: 0,
  };
}

/* ── Undo ── */
function pushUndoSnapshot(id, content, stacksRef) {
  const stacks = stacksRef.current;
  if (!stacks[id]) stacks[id] = [];
  const s = stacks[id];
  if (s.length && s[s.length - 1] === content) return;
  s.push(content);
  if (s.length > MAX_UNDO) s.shift();
}
function popUndoSnapshot(id, stacksRef) {
  const stacks = stacksRef.current;
  if (!stacks[id] || stacks[id].length < 2) return null;
  stacks[id].pop();
  return stacks[id][stacks[id].length - 1];
}

/* ── Reducer ── */
function chaptersReducer(state, action) {
  switch (action.type) {
    case "SET":    return action.chapters;
    case "ADD":    return [...state, action.chapter];
    case "DELETE": return state.filter((c) => c._id !== action.id);
    case "UPDATE_TITLE":
      return state.map((c) => c._id === action.id && !c._deleting ? { ...c, title: action.title, _dirty: true, _edit: c._edit + 1, _saveError: false } : c);
    case "UPDATE_CHAPTER_CONTENT":
    case "UNDO_CONTENT":
      return state.map((ch) => {
        if (ch._id !== action.chapterId || ch._deleting) return ch;
        return { ...ch, content: action.content, _eligibleWords: (ch._eligibleWords || 0) + (action.eligibleWords || 0), _dirty: true, _edit: ch._edit + 1, _saveError: false };
      });
    case "UPDATE_STATUS":
      return state.map((c) => c._id !== action.id ? c : { ...c, status: action.status, reviewNote: action.reviewNote ?? c.reviewNote });
    case "DEVELOPMENT_STATUS":
      return state.map(c => (c._developmentSequence || 0) > (action.development.analysisCount || 0) ? c : {
        ...c, _developmentSequence: action.development.analysisCount || 0,
        _developmentEligible: !!action.development.eligibleForDevelopmentReview,
      });
    case "SAVE_START":
      return state.map(c => c._id === action.id ? { ...c, _request: action.request, _saving: true, _saveError: false } : c);
    case "SAVE_SUCCESS":
      return state.map(c => c._id !== action.id || c._request !== action.request ? c : {
        ...c, revision: action.item.revision, savedAt: action.item.savedAt,
        _savedEligibleWords: action.eligibleWords ?? c._savedEligibleWords,
        _developmentSequence: Math.max(c._developmentSequence || 0, action.development?.analysisCount || 0),
        _developmentEligible: (action.development?.analysisCount || 0) < (c._developmentSequence || 0)
          ? c._developmentEligible : action.development?.eligibleForDevelopmentReview ?? c._developmentEligible,
        status: action.item.status, reviewNote: action.item.reviewNote ?? "",
        // A receipt acknowledges a snapshot; it must not rewrite the live DOM
        // (even harmless sanitizer serialization like <br /> moves the caret).
        _saving: false, _saveError: false, _dirty: c._edit !== action.edit,
      });
    case "SAVE_ERROR":
      return state.map(c => c._id === action.id && c._request === action.request ? { ...c, _saving: false, _saveError: true, _conflict: action.current || c._conflict } : c);
    case "RESOLVE":
      return state.map(c => c._id !== action.id ? c : { ...c,
        title: action.title, content: action.content, revision: action.revision,
        _savedEligibleWords: c._eligibleWords || 0,
        _resolvedDraftKeys: [...(c._resolvedDraftKeys || []), ...(action.draftKey ? [action.draftKey] : [])],
        _dirty: true, _edit: c._edit + 1, _saveError: false, _conflict: null, _recovery: null });
    case "RESTORED":
      return state.map(c => c._id !== action.id ? c : c._edit === action.edit ? action.chapter : {
        ...c, revision: action.chapter.revision, savedAt: action.chapter.savedAt, status: "draft", _dirty: true });
    case "CONFLICT_REFRESH":
      return state.map(c => c._id !== action.id ? c : { ...c, _conflict: action.current });
    case "DISMISS_DRAFT":
      return state.map(c => {
        if (c._id !== action.id) return c;
        const remaining = c._recovery?.filter(d => d.key !== action.key);
        return { ...c, _recovery: remaining?.length ? remaining : null };
      });
    case "DELETING":
      return state.map(c => c._id === action.id ? { ...c, _deleting: action.value } : c);
    default: return state;
  }
}

/* ══════════════════════════════════════════════════════════
   BUBBLE TOOLBAR  — sadece seçim varken çıkar
══════════════════════════════════════════════════════════ */

// execCommand("justify*") bazı tarayıcılarda <center> veya align="" üretir;
// her iki sanitizer da bunları sildiği için hizalama kaybolur.
// Bunun yerine doğrudan style.textAlign ataması yapılır.
const ALIGN_VALS = { justifyLeft: "left", justifyCenter: "center", justifyRight: "right" };

function BubbleToolbar({ editorRef }) {
  const [pos,     setPos]     = useState(null); // { top, left }
  const [formats, setFormats] = useState({ bold:false, italic:false, underline:false, strike:false });
  const toolbarRef = useRef(null);

  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setPos(null); return; }

      // Seçim editorRef içinde mi?
      const range = sel.getRangeAt(0);
      const el    = editorRef.current;
      if (!el || !el.contains(range.commonAncestorContainer)) { setPos(null); return; }

      const rect    = range.getBoundingClientRect();
      const edRect  = el.getBoundingClientRect();
      const tbH     = 38; // toolbar yüksekliği tahmini

      setPos({
        top:  rect.top  - edRect.top  - tbH - 8,
        left: rect.left - edRect.left + rect.width / 2,
      });
      setFormats({
        bold:      document.queryCommandState("bold"),
        italic:    document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strike:    document.queryCommandState("strikeThrough"),
      });
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [editorRef]);

  function exec(cmd, val) {
    if (!editorRef.current) return;
    editorRef.current.focus();

    if (cmd in ALIGN_VALS) {
      // Hizalama komutlarını execCommand yerine doğrudan DOM'a yaz.
      // execCommand("justify*") bazı Chrome sürümlerinde <center> veya
      // align özelliği üretir; sanitize aşamasında her ikisi de silinir.
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        let node = sel.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
        while (node && node !== editorRef.current) {
          if (/^(P|DIV|H[1-6]|LI|BLOCKQUOTE)$/.test(node.tagName || "")) {
            node.style.textAlign = ALIGN_VALS[cmd];
            break;
          }
          node = node.parentNode;
        }
      }
      editorRef.current.dispatchEvent(new InputEvent("input", { bubbles: true }));
      return;
    }

    document.execCommand("styleWithCSS", false, true);
    document.execCommand(cmd, false, val ?? null);
    setFormats({
      bold:      document.queryCommandState("bold"),
      italic:    document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strike:    document.queryCommandState("strikeThrough"),
    });
  }

  if (!pos) return null;

  return (
    <div
      ref={toolbarRef}
      className="bubble-toolbar"
      style={{ top: pos.top, left: pos.left, transform: "translateX(-50%)" }}
      onMouseDown={(e) => e.preventDefault()} // seçimi bozmama
    >
      <button className={`bt-btn ${formats.bold      ? "active":""}`} onMouseDown={() => exec("bold")}          title="Kalın (Ctrl+B)"><strong>B</strong></button>
      <button className={`bt-btn ${formats.italic    ? "active":""}`} onMouseDown={() => exec("italic")}        title="İtalik (Ctrl+I)"><em>I</em></button>
      <button className={`bt-btn ${formats.underline ? "active":""}`} onMouseDown={() => exec("underline")}     title="Altı çizili"><span style={{textDecoration:"underline"}}>U</span></button>
      <button className={`bt-btn ${formats.strike    ? "active":""}`} onMouseDown={() => exec("strikeThrough")} title="Üstü çizili"><span style={{textDecoration:"line-through"}}>S</span></button>
      <div className="bt-sep"/>
      <button className="bt-btn" onMouseDown={() => exec("formatBlock","h1")} title="Başlık 1">H1</button>
      <button className="bt-btn" onMouseDown={() => exec("formatBlock","h2")} title="Başlık 2">H2</button>
      <button className="bt-btn" onMouseDown={() => exec("formatBlock","div")} title="Normal">¶</button>
      <div className="bt-sep"/>
      <button className="bt-btn" onMouseDown={() => exec("justifyLeft")}   title="Sola hizala">
        <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="1" width="14" height="2" rx="1"/><rect x="0" y="5" width="9" height="2" rx="1"/><rect x="0" y="9" width="14" height="2" rx="1"/></svg>
      </button>
      <button className="bt-btn" onMouseDown={() => exec("justifyCenter")} title="Ortala">
        <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="1" width="14" height="2" rx="1"/><rect x="2.5" y="5" width="9" height="2" rx="1"/><rect x="0" y="9" width="14" height="2" rx="1"/></svg>
      </button>
      <button className="bt-btn" onMouseDown={() => exec("justifyRight")}  title="Sağa hizala">
        <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="1" width="14" height="2" rx="1"/><rect x="5" y="5" width="9" height="2" rx="1"/><rect x="0" y="9" width="14" height="2" rx="1"/></svg>
      </button>
      <div className="bt-sep"/>
      <button className="bt-btn" onMouseDown={() => exec("insertUnorderedList")} title="Madde işaretli liste">
        <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor"><circle cx="1.5" cy="3" r="1.5"/><rect x="4" y="2" width="10" height="2" rx="1"/><circle cx="1.5" cy="8" r="1.5"/><rect x="4" y="7" width="10" height="2" rx="1"/></svg>
      </button>
      <button className="bt-btn" onMouseDown={() => exec("insertOrderedList")} title="Numaralı liste">
        <svg width="11" height="11" viewBox="0 0 14 14" fill="currentColor"><rect x="0" y="0" width="3" height="3" rx="0.5"/><rect x="5" y="1" width="9" height="2" rx="1"/><rect x="0" y="5" width="3" height="3" rx="0.5"/><rect x="5" y="6" width="9" height="2" rx="1"/><rect x="0" y="10" width="3" height="3" rx="0.5"/><rect x="5" y="11" width="9" height="2" rx="1"/></svg>
      </button>
      <button className="bt-btn" onMouseDown={() => exec("removeFormat")} title="Biçimi kaldır">
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2h8l-3 5H5L3 2z"/><line x1="1" y1="12" x2="8" y2="12"/><line x1="11" y1="2" x2="13" y2="12"/></svg>
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   RICH EDITOR  — bubble toolbar, static toolbar yok
══════════════════════════════════════════════════════════ */
function RichEditor({ value, onChange, placeholder, className, readOnly = false }) {
  const editorRef    = useRef(null);
  const isComposing  = useRef(false);

  // Dış değer değişirse (undo vs.) güncelle
  useEffect(() => {
    const el = editorRef.current;
    if (!el || el.innerHTML === (value || "")) return;
    const hadFocus = document.activeElement === el;
    el.innerHTML = value || "";
    if (hadFocus) {
      const sel = window.getSelection();
      const r   = document.createRange();
      r.selectNodeContents(el); r.collapse(false);
      sel.removeAllRanges(); sel.addRange(r);
    }
  }, [value]);

  function triggerChange(event, composition = false) {
    if (isComposing.current) return;
    const eligible = composition || ["insertText", "insertFromPaste", "insertFromDrop", "insertCompositionText", "insertParagraph", "insertLineBreak"].includes(event?.nativeEvent?.inputType);
    if (onChange && editorRef.current) onChange(editorRef.current.innerHTML, eligible);
  }

  return (
    <div className={`rich-editor-wrap ${className || ""}`} style={{ position:"relative" }}>
      <BubbleToolbar editorRef={editorRef} />
      <div
        ref={editorRef}
        className="rich-content"
        contentEditable={!readOnly}
        suppressContentEditableWarning
        data-placeholder={placeholder || "Yaz…"}
        onInput={triggerChange}
        onKeyUp={() => {}}
        onMouseUp={() => {}}
        onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); document.execCommand("insertText", false, "  "); } }}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => { isComposing.current = false; triggerChange(null, true); }}
        spellCheck
        lang="tr"
      />
    </div>
  );
}
/* ── ReviewPendingBanner ── */
function ReviewPendingBanner({ onClose }) {
  return (
    <div style={{ position:"fixed",bottom:"1.5rem",left:"50%",transform:"translateX(-50%)",zIndex:9999,background:"var(--cream-0)",border:"1px solid rgba(230,126,34,.4)",borderLeft:"3px solid #e67e22",borderRadius:"6px",padding:"1rem 1.4rem",maxWidth:"480px",width:"calc(100% - 2rem)",boxShadow:"0 8px 32px rgba(0,0,0,.4)",animation:"slideUp 0.3s cubic-bezier(0.22,1,0.36,1)",display:"flex",alignItems:"flex-start",gap:"0.75rem" }}>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
      <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(230,126,34,.15)",border:"1px solid rgba(230,126,34,.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"0.85rem"}}>◎</div>
      <div style={{flex:1}}>
        <p style={{fontFamily:"var(--ui-font)",fontSize:"0.82rem",fontWeight:500,color:"var(--ink-0)",margin:"0 0 0.25rem"}}>Bölüm incelemeye alındı</p>
        <p style={{fontFamily:"var(--ui-font)",fontSize:"0.72rem",fontWeight:300,color:"var(--ink-4)",margin:0,lineHeight:1.5}}>İçerik politikamız kapsamında inceleme gerekiyor. En geç 6 saat içinde size geri dönüş yapılacaktır.</p>
      </div>
      <button onClick={onClose} style={{background:"none",border:"none",color:"var(--ink-4)",cursor:"pointer",fontSize:"0.75rem",padding:2,flexShrink:0}}>✕</button>
    </div>
  );
}

/* ── AnnounceModal ── */
function AnnounceModal({ chapterTitle, workId, onClose }) {
  const [text, setText]       = useState("");
  const [posting, setPosting] = useState(false);
  const [done, setDone]       = useState(false);
  const MAX = 280;
  async function handleAnnounce() {
    if (!text.trim() || posting) return;
    setPosting(true);
    try { await apiPost("/logs", { content:text.trim(), visibility:"public", relatedWork:workId }); setDone(true); setTimeout(onClose,1400); }
    catch { setPosting(false); }
  }
  return (
    <div className="ann-veil" onClick={onClose}>
      <div className="ann-box" onClick={(e)=>e.stopPropagation()}>
        {done ? (
          <div className="ann-done"><div className="ann-done-icon">✓</div><p className="ann-done-text">Duyuru paylaşıldı!</p></div>
        ) : (
          <>
            <div className="ann-head">
              <div><h3 className="ann-title">🎉 Bölüm yayınlandı!</h3><p className="ann-sub">Okuyucularına kısa bir not bırakmak ister misin?</p></div>
              <button className="ann-x" onClick={onClose}>✕</button>
            </div>
            <div className="ann-tag">📖 {chapterTitle}</div>
            <EtikHatirlatma variant="paylasim" />
            <textarea className="ann-textarea" placeholder={`"Bu bölümü yazarken en çok…" gibi bir şey paylaşabilirsin.`} value={text} onChange={(e)=>setText(e.target.value)} maxLength={MAX+10} autoFocus rows={4}/>
            <div className="ann-foot">
              <span className="ann-chr" style={{color:MAX-text.length<30?"#c8832a":undefined}}>{MAX-text.length}</span>
              <div style={{display:"flex",gap:8}}>
                <button className="ann-skip" onClick={onClose}>Atla</button>
                <button className="ann-post" onClick={handleAnnounce} disabled={!text.trim()||posting}>{posting?"Paylaşılıyor…":"Paylaş"}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ChapterDocument({ chapter, chapterIndex, onContentChange, onTitleChange }) {
  const count = useMemo(() => wcFromHtml(chapter.content), [chapter.content]);
  return <article className="chapter-document" data-chapter-id={chapter._id}>
    <header className="chapter-document-head">
      <span className="ch-order-label">Bölüm {chapterIndex + 1}</span>
      <span className={`status-badge status-badge--${chapter.status}`}>
        {({ draft: "taslak", published: "yayında", pending_review: "inceleniyor", rejected: "reddedildi" })[chapter.status]}
      </span>
      <input className="title-input" aria-label="Bölüm başlığı" value={chapter.title}
        disabled={chapter._deleting} onChange={e => onTitleChange(chapter._id, e.target.value)} placeholder="Bölüm başlığı…" spellCheck lang="tr" />
      {chapter.status === "published" && <p className="chapter-document-note">Yayında · okurlar görebiliyor</p>}
      {chapter.status === "pending_review" && <p className="chapter-document-note">İnceleniyor · moderatör onayı bekleniyor</p>}
      {chapter.reviewNote && <p className="chapter-document-note">{chapter.reviewNote}</p>}
    </header>
    <RichEditor readOnly={chapter._deleting} value={chapter.content}
      onChange={(html, eligible) => onContentChange(chapter._id, html, eligible)} placeholder="Yazmaya başla…" />
    <footer className="chapter-document-note">{count.toLocaleString("tr-TR")} kelime · {readTime(count)}</footer>
  </article>;
}

/* ── FocusOverlay ── */
function FocusOverlay({ chapter, onClose, onContentChange, onTitleChange, saveStatus, onSave }) {
  const overlayRef = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    overlayRef.current?.querySelector('[contenteditable="true"]')?.focus();
    return () => previous?.isConnected && previous.focus();
  }, []);
  const localTitle = chapter.title;
  const localHtml = chapter.content;
  const count = useMemo(()=>wcFromHtml(localHtml),[localHtml]);
  function handleChange(html, eligible) {
    onContentChange(chapter._id, html, eligible);
  }
  return (
    <div className="focus-veil" ref={overlayRef} role="dialog" aria-modal="true" aria-label="Odak modu">
      <button className="focus-esc" onClick={onClose}>esc — çık</button>
      <div className="focus-paper">
        <input disabled={chapter._deleting} className="focus-title" value={localTitle} onChange={(e)=>{if(chapter)onTitleChange(chapter._id,e.target.value);}} placeholder="Bölüm başlığı…"/>
        <div className="focus-rule"/>
        <RichEditor readOnly={chapter._deleting} value={localHtml} onChange={handleChange} placeholder="Yaz…" className="focus-rich"/>
      </div>
      <div className="focus-save" role="status">{saveLabel(saveStatus)}{saveStatus === "error" && <button onClick={onSave}>Tekrar dene</button>}</div>
      <div className="focus-wc">{count.toLocaleString("tr-TR")} kelime</div>
    </div>
  );
}

function ChapterItem({ chapter, index, isActive, onJump, onDelete }) {
  const chWc = wcFromHtml(chapter.content);
  const dotClass = chapter.status === "published" ? "pub" : chapter.status === "pending_review" ? "pending" : chapter.status === "rejected" ? "rejected" : "";
  return <div className={"cp-ch-item" + (isActive ? " cp-ch-item--active" : "")}>
    <button className="cp-ch-btn" onClick={() => onJump(chapter._id)} disabled={chapter._deleting}>
      <div className="cp-ch-eyebrow">bölüm {index + 1}</div>
      <div className="cp-ch-name">{chapter.title || "Başlıksız"}</div>
      <div className="cp-ch-meta">{chWc.toLocaleString("tr-TR")} kelime · {readTime(chWc)}</div>
    </button>
    <div className="cp-ch-right"><span className={"cp-ch-dot " + dotClass} />
      <button className="cp-ch-del" aria-label={(chapter.title || "Bölüm") + " sil"} disabled={chapter._deleting} onClick={() => onDelete(chapter._id, chapter.title)}>✕</button>
    </div>
  </div>;
}

const ILHAM_NOTES = [
  "Sadece Başla: 300 kelime kötü yazmak, hiç yazmamaktan iyidir.",
  "Göster, Anlatma: 'Mutlu' deme — mutluluğun nasıl göründüğünü betimle.",
  "Başlık En Sona Kalır. Şimdilik yaz.",
  "Karakterinin elini tut, nereye gittiğini sen de merak et.",
];
const CONSTRAINTS = [
  "Sadece diyalog yazarak aynı sahneyi anlat.",
  "Her cümle tam 7 kelime olsun.",
  "Bir koku metaforunu mutlaka kullan.",
  "Zaman kipini geçmişten şimdiye çevir.",
  "Bir nesneyi karakter gibi konuştur.",
  "Renk adı kullanmadan rengi anlat.",
  "Sessizliği aktif bir karakter gibi yaz.",
];
/* ── Ana Sayfa ── */
const saveLabel = status => ({ saved: "Kaydedildi", saving: "Kaydediliyor…", error: "Kaydedilemedi", conflict: "Kayıt çakışması", recovery: "Yerel taslak bulundu", unsaved: "Kaydedilmedi" })[status];
const PAGE_TABS = { BOLUMLER:"bolumler", ATOLYE:"atolye" };

export default function ChaptersPage() {
  const { workId } = useParams();
  const [identity, setIdentity] = useState(null);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    let active = true, generation = 0;
    const check = async () => {
      const request = ++generation;
      try {
        const { user } = await apiGet("/auth/me");
        if (active && request === generation) { setIdentity(user._id); setAuthError(""); }
      } catch { if (active && request === generation) setAuthError("Oturum doğrulanamadı. Bağlantıyı kontrol edin."); }
    };
    const changed = e => { if (!e.key || e.key === "token" || e.key === "user") { setIdentity(null); check(); } };
    check(); window.addEventListener("storage", changed); window.addEventListener("focus", check);
    return () => { active = false; window.removeEventListener("storage", changed); window.removeEventListener("focus", check); };
  }, []);
  if (!identity) return <p role="status">{authError || "Oturum doğrulanıyor…"}</p>;
  return <ChapterEditor key={identity + ":" + workId} userId={identity} />;
}

function ChapterEditor({ userId }) {
  const { workId } = useParams();
  const navigate   = useNavigate();

  const [chapters, rawDispatch] = useReducer(chaptersReducer, []);
  const creatingRef = useRef(false);
  const chaptersRef = useRef([]);
  const editorId = useRef(crypto.randomUUID());
  const mounted = useRef(true);
  const fetchGeneration = useRef(0);
  const undoStacksRef = useRef({});
  const [localError, setLocalError] = useState("");
  const [historyId, setHistoryId] = useState(null);
  const [development, setDevelopment] = useState(false);
  const [developmentQuota, setDevelopmentQuota] = useState(null);
  const developmentStatusGeneration = useRef(0);
  const [coachPreference, setCoachPreference] = useState(null);
  const [archiveRefresh, setArchiveRefresh] = useState(0);
  const [hasDevelopmentAnalysis, setHasDevelopmentAnalysis] = useState(false);
  useEffect(() => { if (chapters.some(ch => ch._developmentEligible)) setDevelopment(true); }, [chapters]);
  const [developmentOpen, setDevelopmentOpen] = useState(false);
  const developmentRequest = useRef(false);
  const [developmentState, setDevelopmentState] = useState({ kind: "baseline", message: "Yazı örneklerin hazırlanıyor…" });
  const openDevelopment = async () => {
    if (!DEVELOPMENT_COACH_LAUNCH_ENABLED || coachPreference !== "enabled") return;
    if (developmentRequest.current) { setDevelopmentOpen(true); return; }
    if (developmentQuota?.remaining === 0) return;
    developmentStatusGeneration.current++;
    developmentRequest.current = true;
    setDevelopmentOpen(true);
    setDevelopmentState(previous => ({ kind: previous.kind, status: "loading", message: "Yazıların değerlendiriliyor…" }));
    try {
      const result = await apiPost("/chapters/development/" + workId, {});
      if (mounted.current) {
        setDevelopmentState(result);
        if (result.status === "complete") {
          setArchiveRefresh(value => value + 1);
          setHasDevelopmentAnalysis(true);
          setDevelopment(!!result.development.eligibleForDevelopmentReview);
          setDevelopmentQuota(result.development.quota ?? null);
          dispatch({ type: "DEVELOPMENT_STATUS", development: result.development });
        }
      }
    } catch (error) {
      if (mounted.current) {
        if (error.data?.quota) setDevelopmentQuota(error.data.quota);
        setDevelopmentState(previous => ({ ...previous, status: "error", message: error.message || "Değerlendirme tamamlanamadı. Yeni yazıların korunuyor." }));
      }
    } finally { developmentRequest.current = false; developmentStatusGeneration.current++; }
  };
  const openLatestDevelopment = async () => {
    if (!DEVELOPMENT_COACH_LAUNCH_ENABLED) return;
    if (developmentRequest.current) { setDevelopmentOpen(true); return; }
    setDevelopmentOpen(true);
    setDevelopmentState({ status: "loading", message: "Son değerlendirmen yükleniyor…" });
    developmentRequest.current = true;
    try {
      const result = await apiGet("/chapters/development/" + workId + "/latest");
      if (mounted.current) setDevelopmentState(result);
    } catch (error) {
      if (mounted.current) setDevelopmentState({ status: "error", message: error.message });
    } finally { developmentRequest.current = false; }
  };
  const [restoreMessage, setRestoreMessage] = useState("");
  useEffect(() => {
    let active = true;
    if (!DEVELOPMENT_COACH_LAUNCH_ENABLED) return;
    const refresh = () => {
      if (developmentRequest.current) return;
      const generation = ++developmentStatusGeneration.current;
      apiGet("/chapters/development/" + workId).then(data => {
        if (active && generation === developmentStatusGeneration.current) {
          setDevelopment(!!data.eligibleForDevelopmentReview); setHasDevelopmentAnalysis(data.analysisCount > 0);
          setDevelopmentQuota(data.quota ?? null);
        }
      }).catch(() => {});
    };
    refresh();
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 60000);
    const resetTimer = developmentQuota?.retryAfter ? setTimeout(refresh, Math.min(developmentQuota.retryAfter * 1000 + 100, 2147483647)) : null;
    return () => { active = false; clearInterval(timer); clearTimeout(resetTimer); window.removeEventListener("focus", refresh); };
  }, [workId, developmentQuota?.retryAfter, coachPreference]);
  useEffect(() => {
    if (!restoreMessage) return;
    const timer = setTimeout(() => setRestoreMessage(""), 7000);
    return () => clearTimeout(timer);
  }, [restoreMessage]);
  const dispatch = useCallback(action => {
    if (!mounted.current) return;
    const next = chaptersReducer(chaptersRef.current, action);
    chaptersRef.current = next;
    rawDispatch(action);
    try {
      next.forEach(ch => {
        persistDraft(localStorage, draftKey(userId, workId, ch._id, editorId.current), ch);
        if (!ch._dirty && !ch._saving) ch._resolvedDraftKeys?.forEach(key => localStorage.removeItem(key));
      });
      setLocalError("");
    } catch { setLocalError("Yerel taslak saklanamadı (depolama dolu veya kapalı). Metninizi kopyalayın; sunucu kaydı ayrı olarak gösterilir."); }
  }, [userId, workId]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [pageTab,  setPageTab]  = useState(PAGE_TABS.BOLUMLER);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [activeChapterId, setActiveChapterId] = useState(null);
  const saveStatus = chapters.some(c => c._conflict) ? "conflict"
    : chapters.some(c => c._recovery) ? "recovery"
    : chapters.some(c => c._saveError) ? "error"
    : chapters.some(c => c._saving) ? "saving"
    : chapters.some(c => c._dirty) ? "unsaved" : "saved";
  const savesInFlight = useRef(new Map());
  const publishingIds = useRef(new Set());
  const autoSaveTimers = useRef({});

  const [focusMode,     setFocusMode]     = useState(false);
  useEffect(() => {
    setWritingFocus(focusMode);
    return () => setWritingFocus(false);
  }, [focusMode]);
  const [announceModal, setAnnounceModal] = useState(null);
  const [reviewPending, setReviewPending] = useState(false);
  const [publishing,    setPublishing]    = useState(false);


  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => { applyTheme(theme); }, [theme]);

  const deskRef     = useRef(null);

  useEffect(() => {
    const h = (e) => { if (chaptersRef.current.some(c=>c._dirty)) { e.preventDefault(); e.returnValue=""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const fetchChapters = useCallback(async () => {
    const generation = ++fetchGeneration.current;
    setLoading(true); setError("");
    try {
      const res = await apiGet(`/chapters?workId=${workId}`);
      const metadata = res.items || res || [];
      const raw = await Promise.all(metadata.map(async ch => (await apiGet(`/chapters/${ch._id}`)).item));
      const sorted = [...raw].sort((a,b) => {
        const ao=a.order??9999, bo=b.order??9999;
        return ao!==bo ? ao-bo : new Date(a.createdAt||0)-new Date(b.createdAt||0);
      });
      if (!mounted.current || generation !== fetchGeneration.current) return;
      const items = sorted.map((ch) => {
        const item = normalizeChapter(ch);
        try { item._recovery = readDrafts(localStorage, userId, workId, ch._id).filter(d => d.title !== item.title || d.content !== item.content); }
        catch { setLocalError("Yerel taslaklar okunamadı."); }
        if (!item._recovery?.length) item._recovery = null;
        return item;
      });
      dispatch({ type:"SET", chapters:items });
      items.forEach(ch => pushUndoSnapshot(ch._id, ch.content, undoStacksRef));
      if (items.length > 0) { setActiveChapterId(items[0]._id); }
    } catch(err) { if (mounted.current && generation === fetchGeneration.current) setError(err.message||"Bölümler yüklenemedi."); }
    finally { if (mounted.current && generation === fetchGeneration.current) setLoading(false); }
  }, [workId, userId, dispatch]);

  useEffect(() => { fetchChapters(); }, [fetchChapters]);


useEffect(() => {
  window.__acbTourTrigger = window.__acbTourTrigger || {};
  const prepare = () => {
    setSidebarOpen(true);
    return () => setSidebarOpen(sidebarOpen);
  };
  window.__acbTourTrigger.openChapterSidebar = prepare;
  const prepareAtelier = () => { setPageTab(PAGE_TABS.ATOLYE); setSidebarOpen(false); };
  const prepareChapters = () => { setPageTab(PAGE_TABS.BOLUMLER); };
  window.__acbTourTrigger.openAtelier = prepareAtelier;
  window.__acbTourTrigger.openChapters = prepareChapters;
  return () => {
    if (window.__acbTourTrigger.openAtelier === prepareAtelier) delete window.__acbTourTrigger.openAtelier;
    if (window.__acbTourTrigger.openChapters === prepareChapters) delete window.__acbTourTrigger.openChapters;
    if (window.__acbTourTrigger.openChapterSidebar === prepare) delete window.__acbTourTrigger.openChapterSidebar;
  };
}, [sidebarOpen]);

  const saveChapter = useCallback((chapterId) => {
    if (savesInFlight.current.has(chapterId)) return savesInFlight.current.get(chapterId);
    const ch = chaptersRef.current.find(c => c._id === chapterId);
    if (!ch || ch._deleting || ch._conflict || ch._recovery || publishingIds.current.has(chapterId)) return Promise.resolve(false);
    if (!ch._dirty) return Promise.resolve(true);
    clearTimeout(autoSaveTimers.current[chapterId]);
    const requestId = `${ch.revision ?? 0}:${ch._edit}`;
    dispatch({ type: "SAVE_START", id: chapterId, request: requestId });
    const request = (async () => {
      try {
        const result = await apiPut(`/chapters/${chapterId}`, {
          title: ch.title, content: ch.content, expectedRevision: ch.revision ?? 0,
          eligibleWordDelta: Math.max(0, (ch._eligibleWords || 0) - (ch._savedEligibleWords || 0)),
        });
        if (!isChapterSaveReceipt(result, chapterId, ch.revision ?? 0)) throw new Error("Geçersiz kayıt yanıtı.");
        dispatch({ type: "SAVE_SUCCESS", id: chapterId, request: requestId, edit: ch._edit, eligibleWords: ch._eligibleWords || 0, development: result.development, item: { ...result.item, revision: result.revision, savedAt: result.savedAt } });
        return true;
      } catch (err) {
        dispatch({ type: "SAVE_ERROR", id: chapterId, request: requestId, current: err.status === 409 ? err.data?.current : null });
        return false;
      } finally {
        savesInFlight.current.delete(chapterId);
      }
    })();
    savesInFlight.current.set(chapterId, request);
    return request;
  }, [dispatch]);

  useEffect(() => {
    const timers = autoSaveTimers.current;
    chapters.forEach(ch => {
      if (!ch._dirty || ch._deleting || ch._saving || ch._saveError || ch._conflict || ch._recovery || publishingIds.current.has(ch._id)) return;
      timers[ch._id] = setTimeout(() => saveChapter(ch._id), AUTOSAVE_DELAY);
    });
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, [chapters, saveChapter, publishing]);

  const handleContentChange = useCallback((chapterId, value, eligible = false) => {
    const ch = chaptersRef.current.find(c => c._id === chapterId);
    if (!ch || ch._deleting) return;
    const before = ch.content;
    if (before === value) return;
    pushUndoSnapshot(chapterId, before, undoStacksRef);
    dispatch({ type: "UPDATE_CHAPTER_CONTENT", chapterId, content: value,
      eligibleWords: eligible ? Math.max(0, wcFromHtml(value) - wcFromHtml(before)) : 0 });
    pushUndoSnapshot(chapterId, chaptersRef.current.find(c => c._id === chapterId).content, undoStacksRef);
  }, [dispatch]);
  const handleTitleChange = useCallback((chapterId, title) => dispatch({ type:"UPDATE_TITLE", id:chapterId, title }), [dispatch]);

  const handleCreateChapter = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    const cur = chaptersRef.current;
    try {
      const res = await apiPost("/chapters", { workId, title:`Bölüm ${cur.length+1}`, status:"draft" });
      const newCh = normalizeChapter({...res.item, content:res.item?.content||""});
      dispatch({ type:"ADD", chapter:newCh });
      pushUndoSnapshot(newCh._id, "", undoStacksRef);
      setActiveChapterId(newCh._id);
    } catch(err) { setError(err.message||"Bölüm oluşturulamadı."); }
    finally { creatingRef.current = false; }
  };

  const handleDeleteChapter = async (chapterId, title) => {
    const ch = chaptersRef.current.find(c => c._id === chapterId);
    if (!ch || ch._deleting || publishingIds.current.has(chapterId)) return;
    if (!window.confirm(`"${title||"Bu bölüm"}" kalıcı olarak silinecek. Emin misin?`)) return;
    dispatch({ type: "DELETING", id: chapterId, value: true });
    clearTimeout(autoSaveTimers.current[chapterId]);
    try {
      await savesInFlight.current.get(chapterId);
      await apiDelete(`/chapters/${chapterId}`);
      dispatch({ type:"DELETE", id:chapterId });
      if (activeChapterId===chapterId) {
        const rem = chaptersRef.current.filter(c=>c._id!==chapterId);
        if (rem.length>0) { setActiveChapterId(rem[0]._id); }
        else { setActiveChapterId(null); }
      }
    } catch(err) { alert("Silinemedi: "+(err.message||"")); }
    finally { dispatch({ type: "DELETING", id: chapterId, value: false }); }
  };

  const handlePublish = async () => {
    const ch = chaptersRef.current.find(c => c._id === activeChapterId);
    if (!ch || ch._deleting || publishingIds.current.has(ch._id)) return;
    const toDraft = ch.status === "published" || ch.status === "pending_review";
    if (!toDraft && !ch.content) { alert("Bölüm içeriği boş."); return; }
    if (!window.confirm(toDraft ? "Bölümü taslağa almak istediğinden emin misin?"
      : ch.status === "rejected" ? "Yeniden incelemeye göndermek istiyor musun?"
      : "Bu bölümü yayınlamak istediğinden emin misin?")) return;
    setPublishing(true);
    let acquired = false;
    try {
      if (!await saveChapter(ch._id)) return;
      // Do not publish an older snapshot when typing continued during its save.
      const current = chaptersRef.current.find(c => c._id === ch._id);
      if (!current || current._deleting || current._dirty || current._edit !== ch._edit || publishingIds.current.has(ch._id)) return;
      publishingIds.current.add(ch._id);
      acquired = true;
      clearTimeout(autoSaveTimers.current[ch._id]);
      let result;
      try {
        result = await apiPatch(`/chapters/${ch._id}/status`, { workId, expectedRevision: chaptersRef.current.find(c => c._id === ch._id)?.revision ?? 0, status: toDraft ? "draft" : "published" });
      } catch (err) {
        if (err.status !== 422 || err.data?.item?._id !== ch._id || err.data.item.status !== "rejected") throw err;
        result = err.data;
      }
      if (result.item?._id !== ch._id || !result.item.status) throw new Error("Geçersiz durum yanıtı.");
      dispatch({ type: "UPDATE_STATUS", id: ch._id, status: result.item.status, reviewNote: result.item.reviewNote ?? "" });
      if (result.item.status === "pending_review") {
        setReviewPending(true); setTimeout(() => setReviewPending(false), 8000);
      } else if (result.item.status === "rejected") {
        alert(result.message || "İçerik politikasına aykırı.");
      } else if (result.item.status === "published") {
        setAnnounceModal({ title: ch.title });
      }
    } catch (err) {
      if (err.status === 409 && err.data?.current) dispatch({ type: "CONFLICT_REFRESH", id: ch._id, current: err.data.current });
      alert(err.message || "Yayınlama başarısız oldu.");
    }
    finally { if (acquired) publishingIds.current.delete(ch._id); setPublishing(false); }
  };

  const restoreVersion = async (selected) => {
    const ch = chaptersRef.current.find(c => c._id === historyId);
    if (!ch || ch._deleting || publishingIds.current.has(ch._id) || ch._conflict || ch._recovery) return false;
    if (!await saveChapter(ch._id)) throw new Error("Önce mevcut metnin sunucuya kaydedilmesi gerekiyor.");
    const current = chaptersRef.current.find(c => c._id === ch._id);
    if (!current || current._deleting || publishingIds.current.has(ch._id) || current._edit !== ch._edit || current._dirty) throw new Error("Kayıt sırasında metin değişti. Önizlemeyi kontrol edip tekrar deneyin.");
    publishingIds.current.add(ch._id);
    clearTimeout(autoSaveTimers.current[ch._id]);
    try {
      const result = await apiPost(`/chapters/${ch._id}/versions/${selected.revision}/restore`, { expectedRevision: current.revision });
      if (!isChapterSaveReceipt(result, ch._id, current.revision)) throw new Error("Geri yükleme yanıtı doğrulanamadı.");
      dispatch({ type: "RESTORED", id: ch._id, edit: current._edit, chapter: normalizeChapter(result.item) });
      setRestoreMessage("Seçtiğin metinden devam ediyorsun. Önceki taslağın Geçmiş'te saklandı.");
      return true;
    } catch (err) {
      dispatch({ type: "SAVE_ERROR", id: ch._id, request: current._request, current: err.status === 409 ? err.data?.current : null });
      throw err;
    } finally { publishingIds.current.delete(ch._id); }
  };

  const saveCheckpoint = async (label) => {
    const ch = chaptersRef.current.find(c => c._id === historyId);
    if (!ch || ch._deleting || ch._conflict || ch._recovery || publishingIds.current.has(ch._id)) throw new Error("Önce bölümün kayıt durumunu çözün.");
    if (!await saveChapter(ch._id)) throw new Error("Metin sunucuya kaydedilemedi. Yerel taslağınız korunuyor.");
    const current = chaptersRef.current.find(c => c._id === ch._id);
    if (!current || current._dirty || current._edit !== ch._edit) throw new Error("Kayıt sırasında metin değişti. Tekrar deneyin.");
    try {
      const result = await apiPost(`/chapters/${ch._id}/checkpoint`, { expectedRevision: current.revision, label });
      if (!result.item || result.item.revision !== current.revision || !result.item.isCheckpoint) throw new Error("Kaydın saklandığı doğrulanamadı.");
      return result.item;
    } catch (err) {
      if (err.status === 409 && err.data?.current) dispatch({ type: "CONFLICT_REFRESH", id: ch._id, current: err.data.current });
      throw err;
    }
  };

  const resolveLocal = async (chapter, draft) => {
    try {
      const { item } = await apiGet(`/chapters/${chapter._id}`);
      if (!mounted.current) return;
      if ((item.revision ?? 0) !== (chapter._conflict?.revision ?? chapter.revision)) {
        dispatch({ type: "CONFLICT_REFRESH", id: chapter._id, current: item });
        return;
      }
      const current = chaptersRef.current.find(c => c._id === chapter._id);
      if (current._edit !== chapter._edit) { setError("Karşılaştırma sırasında metin değişti. Tekrar kontrol edin."); return; }
      dispatch({ type: "RESOLVE", id: chapter._id, revision: item.revision ?? 0,
        draftKey: draft?.key,
        title: draft?.title ?? current.title, content: DOMPurify.sanitize(draft?.content ?? current.content) });
    } catch (err) { setError(err.message); }
  };

  const jumpToChapter = useCallback((chapterId) => {
    setActiveChapterId(chapterId); setSidebarOpen(false);
  }, []);
  useEffect(() => { deskRef.current?.scrollTo({ top: 0 }); }, [activeChapterId]);

  useEffect(() => {
    const down=(e)=>{
      if (pageTab !== PAGE_TABS.BOLUMLER && !focusMode) return;
      const mod=e.ctrlKey||e.metaKey;
      if (developmentOpen) return;
      if (historyId && (e.key === "F11" || (mod && ["ArrowDown", "ArrowUp"].includes(e.key)))) { e.preventDefault(); return; }
      if(mod&&e.key==="s"){e.preventDefault();if(activeChapterId)saveChapter(activeChapterId);}
      if(e.key==="F11"){e.preventDefault();setFocusMode(v=>!v);}
      if(e.key==="Escape"){setFocusMode(false);}
      if(mod&&e.key==="ArrowDown"){e.preventDefault();const cur=chaptersRef.current,idx=cur.findIndex(c=>c._id===activeChapterId);if(idx<cur.length-1)jumpToChapter(cur[idx+1]._id);}
      if(mod&&e.key==="ArrowUp"){e.preventDefault();const cur=chaptersRef.current,idx=cur.findIndex(c=>c._id===activeChapterId);if(idx>0)jumpToChapter(cur[idx-1]._id);}
      if(mod&&!e.shiftKey&&e.key==="z"){
        const a=document.activeElement;
        if(a?.tagName!=="TEXTAREA"&&a?.tagName!=="INPUT"&&activeChapterId){
          const chapterId = a?.closest("[data-chapter-id]")?.dataset.chapterId || activeChapterId;
          if (e.isComposing || chaptersRef.current.find(c => c._id === chapterId)?._deleting) return;
          e.preventDefault();const prev=popUndoSnapshot(chapterId, undoStacksRef);
          if(prev!==null)dispatch({type:"UNDO_CONTENT",chapterId,content:prev});
        }
      }
    };
    window.addEventListener("keydown",down);
    return()=>window.removeEventListener("keydown",down);
  },[activeChapterId,saveChapter,jumpToChapter,dispatch,pageTab,focusMode,historyId,developmentOpen]);

  const activeChapter=chapters.find(c=>c._id===activeChapterId);
  const totalWc = useMemo(() => chapters.reduce((sum, ch) => sum + wcFromHtml(ch.content), 0), [chapters]);

  const publishBtnLabel=()=>{
    if(publishing)return"inceleniyor…";
    if(!activeChapter)return"yayınla";
    if(activeChapter.status==="published"||activeChapter.status==="pending_review")return"taslağa al";
    if(activeChapter.status==="rejected")return"yeniden gönder";
    return"yayınla";
  };
  const publishBtnClass=()=>{
    if(!activeChapter)return"cp-publish-btn";
    if(activeChapter.status==="published")     return"cp-publish-btn cp-publish-btn--live";
    if(activeChapter.status==="pending_review")return"cp-publish-btn cp-publish-btn--pending";
    if(activeChapter.status==="rejected")      return"cp-publish-btn cp-publish-btn--rejected";
    return"cp-publish-btn";
  };

  if (loading) return <div className="cp-loading"><div className="cp-loading-dots"><span/><span/><span/></div><p>Bölümler yükleniyor…</p></div>;
  if (error&&chapters.length===0) return (
    <div className="cp-loading">
      <p style={{color:"var(--red)",marginBottom:"1rem"}}>{error}</p>
      <button onClick={fetchChapters} style={{padding:"0.5rem 1.2rem",background:"transparent",border:"1px solid var(--cream-4)",borderRadius:"4px",cursor:"pointer",fontFamily:"var(--ui-font)",fontSize:"0.82rem",color:"var(--ink-2)"}}>Yeniden Dene</button>
    </div>
  );

  return (
    <>
    <DevelopmentCoachPreference initialOnly onChange={setCoachPreference} />
    <div className="cp-root" inert={focusMode && !!activeChapter || !!historyId || developmentOpen || coachPreference === "undecided"}>
      {sidebarOpen && <button className="cp-sidebar-backdrop" aria-label="Bölüm menüsünü kapat" onClick={() => setSidebarOpen(false)} />}
      {/* ── SIDEBAR ── */}
      <aside className={`cp-sidebar ${sidebarOpen ? "cp-sidebar--open" : ""}`}>
        <div className="cp-sidebar-top">
          <button className="cp-back-btn" onClick={()=>{ if (!chaptersRef.current.some(c=>c._dirty) || window.confirm("Kaydedilmemiş değişiklikler var. Ayrılmak istiyor musun?")) navigate(`/work/${workId}`); }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            stüdyo
          </button>
          <div className="cp-side-tabs">
            <button data-tour="write-chapters" className={`cp-side-tab ${pageTab===PAGE_TABS.BOLUMLER?"active":""}`} onClick={()=>setPageTab(PAGE_TABS.BOLUMLER)}>📖 Bölümler</button>
            <button className={`cp-side-tab ${pageTab===PAGE_TABS.ATOLYE?"active":""}`}   onClick={()=>{setPageTab(PAGE_TABS.ATOLYE);setSidebarOpen(false);}}
            data-tour = "write-atolye-tab"  >✍️ Atölye</button>
          </div>
        </div>

        <div className="cp-sidebar-body">
          {pageTab===PAGE_TABS.BOLUMLER&&(
            <>
              {error&&<div className="cp-err-box">{error}</div>}
              <div className="cp-sec-label">bölümler</div>
              <div className="cp-chapter-nav">
                {chapters.length===0&&<p className="cp-empty-hint">Henüz bölüm yok.</p>}
                {chapters.map((ch,idx)=>(
                  <ChapterItem key={ch._id} chapter={ch} index={idx} isActive={ch._id===activeChapterId}
                    onJump={jumpToChapter} onDelete={handleDeleteChapter}/>
                ))}
              </div>
              <button className="cp-new-ch-btn" onClick={handleCreateChapter}
               data-tour="write-yeni-bolum">+ yeni bölüm</button>


            </>
          )}
          {pageTab===PAGE_TABS.ATOLYE&&(
            <div className="cp-atelier-hint"><p>Egzersizlerin notlara kaydedilir ve esere bağlanır.</p><p>Yazma rutinini sağ panelden başlat.</p></div>
          )}
        </div>
        {DEVELOPMENT_COACH_LAUNCH_ENABLED && coachPreference === "enabled" && <DevelopmentCoachArchive key={workId} workId={workId} refresh={archiveRefresh} onOpen={item => { setDevelopmentState(item); setDevelopmentOpen(true); }} />}
      </aside>

      {/* ── MAIN ── */}
      <div className="cp-main">
        <header className="cp-topbar">
          <div className="cp-tb-left">
            <button className="cp-mobile-menu-btn" aria-label="Bölüm menüsü" aria-expanded={sidebarOpen} onClick={()=>setSidebarOpen(v=>!v)}>☰</button>
            {pageTab === PAGE_TABS.BOLUMLER && <details className="cp-save-details" data-tour="write-save-status">
              <summary>{saveLabel(saveStatus)}</summary>
              <div className="cp-save-popover">
                <strong>{activeChapter?.title || "Bölüm kaydı"}</strong>
                <p>Son sunucu kaydı: {activeChapter?.savedAt ? new Date(activeChapter.savedAt).toLocaleString("tr-TR") : "Henüz yok"}</p>
                <p>{activeChapter?._dirty ? "Yerel değişiklik var" : "Yerel değişiklik yok"}</p>
                <p>{activeChapter?._saving ? "Kayıt sunucuya gönderiliyor." : activeChapter?._dirty ? "Kayıt bekliyor." : "Bekleyen kayıt yok."}</p>
                {activeChapter?._saveError && <p role="alert">Son kayıt tamamlanamadı. Metnin korunuyor; tekrar deneyebilirsin.</p>}
                <button className="cp-tb-btn" onClick={() => activeChapterId && saveChapter(activeChapterId)} disabled={!activeChapterId || saveStatus === "saving"}>Şimdi kaydet</button>
                <p>{localError || (activeChapter?._dirty || activeChapter?._recovery ? "Yerel taslak bu tarayıcıda saklanıyor; sunucu kaydı değildir." : "Bu durum sunucunun kayıt yanıtına dayanır.")}</p>
              </div>
            </details>}
            {pageTab === PAGE_TABS.ATOLYE && <span className="cp-tb-chapname">Atölye · Egzersiz alanı</span>}
            {pageTab === PAGE_TABS.BOLUMLER && activeChapter&&<span className="cp-tb-chapname">{activeChapter.title||"Başlıksız"}</span>}
          </div>

          <div className="cp-tb-right">
            {pageTab === PAGE_TABS.BOLUMLER && <>
              {DEVELOPMENT_COACH_LAUNCH_ENABLED && coachPreference === "enabled" && (development || chapters.some(ch => ch._developmentEligible)) && <>
                <button className="cp-tb-btn cp-development-btn" disabled={developmentQuota?.remaining === 0} onClick={openDevelopment}>✦ Gelişimimi takip et</button>
                {developmentQuota && <span className="cp-development-quota" role="status">Kalan analiz: {developmentQuota.remaining}/{developmentQuota.dailyLimit} (24 saat)</span>}
              </>}
              {CHAPTER_HISTORY_ENABLED && <button className="cp-tb-btn cp-compact-tool" aria-label="Geçmiş" title="Geçmiş" disabled={!activeChapterId} onClick={() => setHistoryId(activeChapterId)}><span className="cp-tb-btn-icon" aria-hidden="true">◷</span><span className="cp-tool-label">Geçmiş</span></button>}
              <button className="cp-tb-btn cp-compact-tool" aria-label="Odak" title="Odak (F11)" disabled={!activeChapterId} onClick={() => setFocusMode(true)} data-tour="write-odak-btn"><span className="cp-tb-btn-icon" aria-hidden="true">⛶</span><span className="cp-tool-label">Odak</span></button>
            </>}
            <button className="cp-tb-btn cp-theme-btn" onClick={() => setTheme(t => t === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Karanlık moda geç" : "Aydınlık moda geç"} title={theme === "light" ? "Karanlık moda geç" : "Aydınlık moda geç"}>{theme === "light" ? "☾" : "☀"}</button>
            <details className="cp-tools-menu"><summary>Araçlar</summary><div className="cp-tools-popover">
              {!DEVELOPMENT_COACH_LAUNCH_ENABLED && <button className="cp-tb-btn" disabled>Gelişim Koçu · Beta · Çok yakında</button>}
              {DEVELOPMENT_COACH_LAUNCH_ENABLED && coachPreference === "enabled" && hasDevelopmentAnalysis && <button className="cp-tb-btn" onClick={openLatestDevelopment}>Son gelişim değerlendirmesi</button>}
              <BookDownload workId={workId} buttonClass="cp-tb-btn" dirty={chapters.some(ch => ch._dirty || ch._saving || ch._saveError || ch._conflict || ch._recovery)} disabled={loading || !!error || publishing} beforeSave={() => saveBeforeBookDownload(() => chaptersRef.current, saveChapter)} />
            </div></details>
            {pageTab===PAGE_TABS.BOLUMLER&&(
              <>
                {activeChapter&&(
                  <button className={publishBtnClass()} onClick={handlePublish}
                  data-tour="write-yayinla-btn"
                   disabled={saveStatus==="saving"||publishing}>
                    {publishing&&<span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",border:"1.5px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",animation:"spin 0.6s linear infinite",marginRight:5,verticalAlign:"middle"}}/>}
                    {publishBtnLabel()}
                  </button>
                )}
              </>
            )}
          </div>
        </header>

        {localError && <p role="alert">{localError}</p>}
        {error && <p role="alert">{error}</p>}
        {chapters.filter(c => c._conflict || c._recovery).map(ch => <section className="chapter-conflict" key={ch._id}>
          <h2>{ch.title}: {ch._conflict ? "Başka bir cihazda değişiklik var" : "Kurtarılabilir yerel taslak var"}</h2>
          <p>Otomatik kayıt durduruldu. Metinleri karşılaştırın; düzenleyicideki metni değiştirebilir, gerekli parçaları kopyalayabilirsiniz.</p>
          <div className="chapter-comparison">
            <ChapterPreview title="Düzenleyicideki metin" content={ch.content} />
            {ch._conflict && <ChapterPreview title={"Sunucudaki metin: " + ch._conflict.title} content={ch._conflict.content} />}
            {ch._recovery?.map(draft => <section key={draft.key}>
              <p>Yerel: {new Date(draft.localAt).toLocaleString("tr-TR")}</p>
              <ChapterPreview title={draft.title} content={draft.content} />
              <button onClick={() => resolveLocal(ch, draft)}>Bu yerel metinle devam et</button>
              <button onClick={() => {
                if (!window.confirm("Bu yerel kopya silinecek. Sunucu metni ve diğer taslaklar korunur. Devam edilsin mi?")) return;
                try { localStorage.removeItem(draft.key); dispatch({ type: "DISMISS_DRAFT", id: ch._id, key: draft.key }); }
                catch { setLocalError("Yerel kopya silinemedi."); }
              }}>Bu yerel kopyayı sil</button>
            </section>)}
          </div>
          <button onClick={() => resolveLocal(ch)}>Karşılaştırdım; düzenleyicideki metni kaydet</button>
        </section>)}
        <div className="cp-content-area">
          {pageTab===PAGE_TABS.BOLUMLER&&(
            <div className="cp-desk" ref={deskRef}
            data-tour="write-editor">
              {chapters.length===0?(
                <div className="cp-desk-empty">
                  <div className="cp-desk-empty-glyph">✦</div>
                  <p>Henüz bölüm yok.</p>
                  <button onClick={handleCreateChapter}>İlk bölümü oluştur</button>
                </div>
              ):activeChapter ? (
                <ChapterDocument key={activeChapter._id} chapter={activeChapter}
                  chapterIndex={chapters.findIndex(ch => ch._id === activeChapterId)}
                  onContentChange={handleContentChange} onTitleChange={handleTitleChange} />
              ):null}

            </div>
          )}
          <div className="cp-atelier-container" hidden={pageTab!==PAGE_TABS.ATOLYE}><AtelierTab key={userId + ":" + workId} userId={userId} workId={workId}/></div>
        </div>

        <div className="cp-statusbar">
          <span className="cp-sb-item"><strong>{totalWc.toLocaleString("tr-TR")}</strong> kelime</span>
          <span className="cp-sb-sep"/><span className="cp-sb-item">⏱ {readTime(totalWc)}</span>
          <span className="cp-sb-sep"/><span className="cp-sb-item">bölüm <strong>{chapters.findIndex(c=>c._id===activeChapterId)+1}</strong> / <strong>{chapters.length}</strong></span>
          <span className="cp-sb-spacer"/>
          <span className="cp-sb-hint">ctrl+s · ctrl+z · F11 odak · ctrl+↑↓ bölüm</span>
        </div>
      </div>

    </div>
    {/* Portals — cp-root dışında, viewport'a göre fixed */}
    {focusMode&&activeChapter&&<FocusOverlay key={activeChapter._id} chapter={activeChapter} onClose={()=>setFocusMode(false)} onContentChange={handleContentChange} onTitleChange={handleTitleChange} saveStatus={saveStatus} onSave={()=>saveChapter(activeChapterId)}/>}
    {CHAPTER_HISTORY_ENABLED && historyId && chapters.find(c => c._id === historyId) && <ChapterHistory key={historyId} chapter={chapters.find(c => c._id === historyId)} onClose={() => setHistoryId(null)} onRestore={restoreVersion} onCheckpoint={saveCheckpoint} renderCurrent={({ readOnly }) => <section data-chapter-id={historyId}><h3>Şu anki metin</h3><RichEditor readOnly={readOnly} value={chapters.find(c => c._id === historyId)?.content} onChange={(html, eligible) => handleContentChange(historyId, html, eligible)} /></section>} />}
    {restoreMessage && <div className="cp-restore-toast" role="status">{restoreMessage}</div>}
    {developmentOpen && <DevelopmentCoachDialog state={developmentState} onClose={() => setDevelopmentOpen(false)} />}
    {announceModal&&<AnnounceModal chapterTitle={announceModal.title} workId={workId} onClose={()=>setAnnounceModal(null)}/>}
    {reviewPending&&<ReviewPendingBanner onClose={()=>setReviewPending(false)}/>}
    </>
  );
}
