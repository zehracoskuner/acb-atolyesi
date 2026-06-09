// src/pages/ChaptersPage.jsx
import {
  useEffect, useState, useCallback, useMemo,
  useRef, useReducer,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "../lib/api";
import "../styles/ChaptersPage.css";
import EtikHatirlatma from "../components/EtikHatirlatma";

const WORDS_PER_PAGE   = 400;
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
  const t = d.innerText.trim();
  return t ? t.split(/\s+/).filter(Boolean).length : 0;
}
function readTime(w) {
  const m = Math.ceil(w / WORDS_PER_MINUTE);
  return m < 1 ? "<1 dk" : `${m} dk`;
}

/*
  normalizeChapter: içerik ham HTML olabilir ya da düz metin.
  Eğer içerik HTML tag içermiyorsa satır sonlarını <br> çevir.
*/
/* ── HTML-aware pagination ──
   HTML içeriği <div>/<p> bloklarına göre böl, kelime limitine göre sayfalara ayır
*/
function paginateHtml(chapterId, html) {
  if (!html || !html.trim()) {
    return [{ id: `${chapterId}-p0`, content: "" }];
  }

  // Geçici div ile blokları parse et
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const blocks = Array.from(tmp.childNodes);

  const pages = [];
  let pageIdx = 0;
  let pageWordCount = 0;
  let pageContent = "";

  function blockText(node) {
    const d = document.createElement("div");
    d.appendChild(node.cloneNode(true));
    return d.innerText || "";
  }

  function blockHtml(node) {
    const d = document.createElement("div");
    d.appendChild(node.cloneNode(true));
    return d.innerHTML;
  }

  for (const block of blocks) {
    const bText = blockText(block);
    const bWc   = bText.trim() ? bText.trim().split(/\s+/).filter(Boolean).length : 0;
    const bHtml = blockHtml(block);

    if (pageWordCount + bWc > WORDS_PER_PAGE && pageContent) {
      pages.push({ id: `${chapterId}-p${pageIdx}`, content: pageContent });
      pageIdx++;
      pageContent  = bHtml;
      pageWordCount = bWc;
    } else {
      pageContent  += bHtml;
      pageWordCount += bWc;
    }
  }

  if (pageContent) {
    pages.push({ id: `${chapterId}-p${pageIdx}`, content: pageContent });
  }

  return pages.length > 0 ? pages : [{ id: `${chapterId}-p0`, content: "" }];
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
    pages:      paginateHtml(ch._id, fullContent),
    _dirty:     false,
  };
}

function mergePages(pages) {
  return pages.map((p) => p.content).join("").trim();
}

/* ── Undo ── */
const undoStacksRef_GLOBAL = { current: {} };
function pushUndoSnapshot(id, content) {
  const stacks = undoStacksRef_GLOBAL.current;
  if (!stacks[id]) stacks[id] = [];
  const s = stacks[id];
  if (s.length && s[s.length - 1] === content) return;
  s.push(content);
  if (s.length > MAX_UNDO) s.shift();
}
function popUndoSnapshot(id) {
  const stacks = undoStacksRef_GLOBAL.current;
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
      return state.map((c) => c._id === action.id ? { ...c, title: action.title, _dirty: true } : c);
    case "UPDATE_CONTENT":
      return state.map((ch) => {
        if (ch._id !== action.chapterId) return ch;
        // Sayfanın içeriğini güncelle, sonra tüm içeriği yeniden paginate et
        const updatedPages = ch.pages.map((p) => p.id === action.pageId ? { ...p, content: action.value } : p);
        const merged = updatedPages.map(p => p.content).join("");
        const repaginated = paginateHtml(ch._id, merged);
        return { ...ch, pages: repaginated, _dirty: true };
      });
    case "UNDO_CONTENT":
      return state.map((ch) => {
        if (ch._id !== action.chapterId) return ch;
        return { ...ch, pages: paginateHtml(ch._id, action.content), _dirty: true };
      });
    case "UPDATE_STATUS":
      return state.map((c) => c._id !== action.id ? c : { ...c, status: action.status, reviewNote: action.reviewNote ?? c.reviewNote });
    case "MARK_CLEAN":
      return state.map((c) => c._id === action.id ? { ...c, _dirty: false } : c);
    case "REORDER":
      return [...action.chapters].map((c, i) => ({ ...c, order: i }));
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
function RichEditor({ value, onChange, placeholder, className }) {
  const editorRef    = useRef(null);
  const isComposing  = useRef(false);

  // İlk mount: içeriği set et
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== (value || "")) el.innerHTML = value || "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function triggerChange() {
    if (onChange && editorRef.current) onChange(editorRef.current.innerHTML);
  }

  return (
    <div className={`rich-editor-wrap ${className || ""}`} style={{ position:"relative" }}>
      <BubbleToolbar editorRef={editorRef} />
      <div
        ref={editorRef}
        className="rich-content"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || "Yaz…"}
        onInput={() => { if (!isComposing.current) triggerChange(); }}
        onKeyUp={() => {}}
        onMouseUp={() => {}}
        onKeyDown={(e) => { if (e.key === "Tab") { e.preventDefault(); document.execCommand("insertText", false, "  "); } }}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => { isComposing.current = false; triggerChange(); }}
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

/* ── PageLeaf ── */
function PageLeaf({ page, chapter, chapterIndex, isFirstPage, globalNum, onContentChange, onTitleChange, onFocus, leafRef, isFocused }) {
  const chWc = chapter.pages.reduce((s,p) => s + wcFromHtml(p.content), 0);
  const pct  = Math.min(100, Math.round((wcFromHtml(page.content) / WORDS_PER_PAGE) * 100));
  return (
    <article
      ref={leafRef}
      className={["leaf", isFirstPage?"leaf--open":"leaf--cont", isFocused===false?"leaf--dimmed":""].join(" ").trim()}
      data-page-id={page.id} data-chapter-id={chapter._id}
    >
      {isFirstPage && chapter.status === "published"      && <div className="leaf-pub-banner"><span className="pub-dot"/>yayında · okurlar görebiliyor</div>}
      {isFirstPage && chapter.status === "pending_review" && <div className="leaf-review-banner"><span className="review-dot"/>inceleniyor · en geç 6 saat içinde geri dönüş yapılacak</div>}
      {isFirstPage && chapter.status === "rejected"       && <div className="leaf-rejected-banner"><span className="rejected-dot"/>yayınlanamıyor{chapter.reviewNote&&<span className="rejected-note"> · {chapter.reviewNote}</span>}</div>}

      {isFirstPage && (
        <div className="leaf-head">
          <div className="leaf-eyebrow">
            <span className="ch-order-label">bölüm {chapterIndex+1}</span>
            <span className={`status-badge status-badge--${chapter.status}`}>
              {chapter.status==="published"&&"yayında"}{chapter.status==="draft"&&"taslak"}
              {chapter.status==="pending_review"&&"inceleniyor"}{chapter.status==="rejected"&&"reddedildi"}
            </span>
          </div>
          <input className="title-input" value={chapter.title} onChange={(e)=>onTitleChange(chapter._id,e.target.value)} onFocus={()=>onFocus(page.id,chapter._id)} placeholder="Bölüm başlığı…" spellCheck lang="tr"/>
        </div>
      )}
      {!isFirstPage && (
        <div className="leaf-cont-head">
          <span className="leaf-cont-title">{chapter.title||"—"}</span>
          <span className="leaf-cont-sep">·</span>
          <span className="leaf-cont-label">devam</span>
        </div>
      )}

      <div onFocus={()=>onFocus(page.id,chapter._id)}>
        <RichEditor value={page.content} onChange={(html)=>onContentChange(chapter._id,page.id,html)} placeholder={isFirstPage?"Yazmaya başla… her şey mümkün.":""}/>
      </div>

      <div className="leaf-fill-track"><div className="leaf-fill-bar" style={{width:`${pct}%`}}/></div>
      <footer className="leaf-foot">
        <span className="leaf-wc">{wcFromHtml(page.content).toLocaleString("tr-TR")} kelime</span>
        {isFirstPage && <><span className="leaf-ch-wc">{chWc.toLocaleString("tr-TR")} toplam</span><span className="leaf-read-time">⏱ {readTime(chWc)}</span></>}
        <span className="leaf-fill-pct">{pct}%</span>
        <span className="leaf-page-num">{globalNum}</span>
      </footer>
    </article>
  );
}

/* ── FocusOverlay ── */
function FocusOverlay({ chapter, onClose, onContentChange, onTitleChange }) {
  const [localTitle, setLocalTitle] = useState(chapter?.title||"");
  const [localHtml,  setLocalHtml]  = useState((chapter?.pages||[]).map(p=>p.content).join(""));
  const count = useMemo(()=>wcFromHtml(localHtml),[localHtml]);
  function handleChange(html) {
    setLocalHtml(html);
    const fp = chapter?.pages?.[0];
    if (fp) onContentChange(chapter._id, fp.id, html);
  }
  return (
    <div className="focus-veil">
      <button className="focus-esc" onClick={onClose}>esc — çık</button>
      <div className="focus-paper">
        <input className="focus-title" value={localTitle} onChange={(e)=>{setLocalTitle(e.target.value);if(chapter)onTitleChange(chapter._id,e.target.value);}} placeholder="Bölüm başlığı…"/>
        <div className="focus-rule"/>
        <RichEditor value={localHtml} onChange={handleChange} placeholder="Yaz…" className="focus-rich"/>
      </div>
      <div className="focus-wc">{count.toLocaleString("tr-TR")} kelime</div>
    </div>
  );
}

/* ── AIDrawer ── */
function AIDrawer({ open, onClose, chapterId, chapter, onReview, loading, review, onClear }) {
  const hasContent = chapter?.pages?.some((p)=>p.content.trim());
  return (
    <>
      {open && <div className="ai-veil" onClick={onClose}/>}
      <aside className={`ai-drawer ${open?"ai-drawer--open":""}`}>
        <div className="ai-drawer-head"><span className="ai-drawer-title">AI Yorum</span><button className="ai-close" onClick={onClose}>✕</button></div>
        <div className="ai-body">
          {!chapterId&&<p className="ai-muted">Önce bir bölüm seç.</p>}
          {chapterId&&!hasContent&&<p className="ai-muted">Yorum için önce bir şeyler yaz.</p>}
          {loading&&<div className="ai-thinking"><span/><span/><span/></div>}
          {!loading&&review&&<p className="ai-review">{review}</p>}
          {!loading&&!review&&chapterId&&hasContent&&<p className="ai-muted" style={{fontStyle:"normal"}}>Hazır. Analiz Et butonuna bas.</p>}
        </div>
        <div className="ai-foot">
          <button className="ai-btn" onClick={onClear} disabled={loading||!review} style={{flex:".4"}}>Temizle</button>
          <button className="ai-btn ai-btn--primary" onClick={onReview} disabled={!chapterId||!hasContent||loading}>{loading?"Analiz ediliyor…":"Analiz Et"}</button>
        </div>
      </aside>
    </>
  );
}

/* ── ChapterItem ── */
function ChapterItem({ chapter, index, isActive, onJump, onDelete, onDragStart, onDragOver, onDrop, isDragging, isDragOver }) {
  const chWc = chapter.pages.reduce((s,p)=>s+wcFromHtml(p.content),0);
  const dotClass = chapter.status==="published"?"pub":chapter.status==="pending_review"?"pending":chapter.status==="rejected"?"rejected":"";
  return (
    <div
      className={["cp-ch-item",isActive?"cp-ch-item--active":"",isDragging?"cp-ch-item--dragging":"",isDragOver?"cp-ch-item--drag-over":""].join(" ").trim()}
      draggable onDragStart={(e)=>onDragStart(e,index)} onDragOver={(e)=>{e.preventDefault();onDragOver(index);}} onDrop={(e)=>{e.preventDefault();onDrop(index);}}
    >
      <button className="cp-ch-drag" onMouseDown={(e)=>e.stopPropagation()}>⠿</button>
      <button className="cp-ch-btn" onClick={()=>onJump(chapter._id)}>
        <div className="cp-ch-eyebrow">bölüm {index+1}</div>
        <div className="cp-ch-name">{chapter.title||"Başlıksız"}</div>
        <div className="cp-ch-meta">{chWc.toLocaleString("tr-TR")} kelime · {chapter.pages.length} sayfa · {readTime(chWc)}</div>
      </button>
      <div className="cp-ch-right">
        <span className={`cp-ch-dot ${dotClass}`}/>
        <button className="cp-ch-del" onClick={(e)=>{e.stopPropagation();onDelete(chapter._id,chapter.title);}}>✕</button>
      </div>
    </div>
  );
}
/* ── AtelierTab ── */
const ILHAM_NOTES = [
  "Sadece Başla: 300 kelime kötü yazmak, hiç yazmamaktan iyidir.",
  "Göster, Anlatma: 'Mutlu' deme — mutluluğun nasıl göründüğünü betimle.",
  "Başlık En Sona Kalır: Baskısını at, şimdilik [Taslak] yaz ve devam et.",
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

function AtelierTab({ workId }) {
  const [html,setHtml]                 = useState("");
  const [title,setTitle]               = useState("");
  const [toolTab,setToolTab]           = useState("ilham");
  const [coachEnabled,setCoachEnabled] = useState(false);
  const [aiLoading,setAiLoading]       = useState(false);
  const [review,setReview]             = useState(null);
  const [chat,setChat]                 = useState([]);
  const [chatInput,setChatInput]       = useState("");
  const [coachNotes,setCoachNotes]     = useState([]);
  const [constraint,setConstraint]     = useState("");
  const [saveMsg,setSaveMsg]           = useState("");
  const [routine,setRoutine]           = useState({mode:"sprint",durationMin:10,goalWords:150,running:false,secondsLeft:600,startWc:0});
  const chatBoxRef  = useRef(null);
  const coachTimer  = useRef(null);
  const routineTimer= useRef(null);
  const wordCount   = useMemo(()=>wcFromHtml(html),[html]);

  useEffect(()=>{
    if(!routine.running)return;
    routineTimer.current=setInterval(()=>{
      setRoutine((p)=>{
        const n=Math.max(0,p.secondsLeft-1);
        if(n===0){clearInterval(routineTimer.current);return{...p,secondsLeft:0,running:false};}
        return{...p,secondsLeft:n};
      });
    },1000);
    return()=>clearInterval(routineTimer.current);
  },[routine.running]);

  useEffect(()=>{ if(chatBoxRef.current)chatBoxRef.current.scrollTop=chatBoxRef.current.scrollHeight; },[chat]);

  useEffect(()=>{
    if(!coachEnabled||wordCount<50)return;
    if(coachTimer.current)clearTimeout(coachTimer.current);
    coachTimer.current=setTimeout(()=>{
      const tmp=document.createElement("div");tmp.innerHTML=html;
      const text=tmp.innerText;
      const notes=[];
      if((text.match(/çok/g)||[]).length>3) notes.push({key:"cok",icon:"✏️",title:"Sık tekrar",message:'"çok" kelimesi 3+ kez.',severity:"medium"});
      if(text.split(".").some((s)=>s.trim().split(/\s+/).length>35)) notes.push({key:"uzun",icon:"📏",title:"Uzun cümle",message:"35+ kelimeli cümle var.",severity:"low"});
      if(!text.includes(",")&&wordCount>80) notes.push({key:"virgul",icon:"⏸️",title:"Virgül yok",message:"80+ kelimede virgül yok.",severity:"low"});
      if(notes.length) setCoachNotes((prev)=>{
        const u=[...prev];
        notes.forEach((n)=>{const i=u.findIndex((x)=>x.key===n.key);if(i===-1)u.push({...n,count:1});else u[i]={...u[i],count:u[i].count+1};});
        return u;
      });
    },2000);
  },[html,coachEnabled,wordCount]);

  const fmt=(s)=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  function startRoutine(mode){clearInterval(routineTimer.current);const c={sprint:[10,150],warmup:[2,60],edit:[5,0]}[mode];setRoutine({mode,durationMin:c[0],goalWords:c[1],running:true,secondsLeft:c[0]*60,startWc:wordCount});}

  async function handleReview(){
    if(wordCount<30)return;
    setAiLoading(true);setReview(null);setToolTab("yorum");
    const tmp=document.createElement("div");tmp.innerHTML=html;
    try{const r=await apiPost("/ai/review",{title,text:tmp.innerText,context:"atelier",workId});setReview(r);}
    catch{setReview({analysis:"AI yorum alınamadı."});}
    finally{setAiLoading(false);}
  }
  async function saveNote(){
    if(!title.trim()&&!html.trim())return;
    try{await apiPost("/notes",{title:title||"Egzersiz notu",content:html,workId});setSaveMsg("✓ Kaydedildi");setTimeout(()=>setSaveMsg(""),2000);}
    catch{setSaveMsg("Kaydedilemedi.");setTimeout(()=>setSaveMsg(""),2000);}
  }
  async function sendChat(){
    if(!chatInput.trim())return;
    const msg=chatInput.trim();setChatInput("");
    setChat((p)=>[...p,{role:"user",content:msg}]);setAiLoading(true);
    const tmp=document.createElement("div");tmp.innerHTML=html;
    try{const r=await apiPost("/ai/chat",{message:msg,context:tmp.innerText,workId});setChat((p)=>[...p,{role:"assistant",content:r.reply||r.text||"…"}]);}
    catch{setChat((p)=>[...p,{role:"assistant",content:"Yanıt alınamadı."}]);}
    finally{setAiLoading(false);}
  }

  const routineWc=Math.max(0,wordCount-routine.startWc);
  const routinePct=routine.goalWords>0?Math.min(1,routineWc/routine.goalWords):0;
  const C=2*Math.PI*20;

  return (
    <div className="atelier-layout">
      <div className="atelier-editor">
        <div className="atelier-editor-top">
          <input className="atelier-title" placeholder="Egzersiz başlığı (isteğe bağlı)" value={title} onChange={(e)=>setTitle(e.target.value)}/>
          <button className={`coach-toggle ${coachEnabled?"coach-toggle--active":""}`} onClick={()=>setCoachEnabled(v=>!v)}>🧠 Koç: {coachEnabled?"Açık":"Kapalı"}</button>
        </div>
        <div className="atelier-editor-body">
          <RichEditor value={html} onChange={setHtml} placeholder="Bir beyaz kağıda her şey yazılabilir…" className="atelier-rich"/>
        </div>
        <div className="atelier-foot">
          <span className="atelier-wc">{wordCount.toLocaleString("tr-TR")} kelime · {readTime(wordCount)}</span>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {saveMsg&&<span className="save-msg">{saveMsg}</span>}
            <button className="btn-sm" onClick={saveNote}>💾 Nota Kaydet</button>
            <button className="btn-sm btn-sm--primary" onClick={handleReview} disabled={aiLoading||wordCount<30}>{aiLoading?"…":"AI Yorumla"}</button>
          </div>
        </div>
      </div>

      <div className="atelier-tools">
        <div className="routine-card">
          <div className="routine-top">
            <div>
              <div className="routine-label">🔥 Bugünün Rutini</div>
              <div className="routine-name">{{sprint:"Sprint",warmup:"Isınma",edit:"Düzenleme"}[routine.mode]} · {routine.durationMin} dk</div>
            </div>
            <div className="ring-wrap">
              <svg className="ring-svg" viewBox="0 0 44 44">
                <circle className="ring-bg" cx="22" cy="22" r="20"/>
                <circle className="ring-fg" cx="22" cy="22" r="20" strokeDasharray={C} strokeDashoffset={C-routinePct*C}/>
              </svg>
              <div className="ring-inner">
                <span className="ring-time">{fmt(routine.secondsLeft)}</span>
                {routine.goalWords>0&&<span className="ring-sub">{routineWc}/{routine.goalWords}</span>}
              </div>
            </div>
          </div>
          <div className="routine-btns">
            {!routine.running?(
              <><button className="rb rb--primary" onClick={()=>startRoutine("sprint")}>▶ Sprint</button><button className="rb" onClick={()=>startRoutine("warmup")}>Isınma</button><button className="rb" onClick={()=>startRoutine("edit")}>Düzenle</button></>
            ):(
              <><button className="rb" onClick={()=>{clearInterval(routineTimer.current);setRoutine(p=>({...p,running:false}));}}>❚❚ Duraklat</button><button className="rb" onClick={()=>{clearInterval(routineTimer.current);setRoutine(p=>({...p,running:false,secondsLeft:p.durationMin*60,startWc:wordCount}));}}>↺ Sıfırla</button></>
            )}
          </div>
          <div className="routine-hint">{{sprint:"İç eleştirmeni sustur. Durma, düzeltme yok.",warmup:"Akışı aç. Sadece yaz.",edit:"1 paragrafı sadeleştir."}[routine.mode]}</div>
        </div>

        <div className="tool-tabs">
          {[["ilham","✨ İlham"],["yorum","📋 Yorum"],["sohbet","💬 Sohbet"],["koc","🗒️ Koç"]].map(([id,label])=>(
            <button key={id} className={`tool-tab ${toolTab===id?"tool-tab--active":""}`} onClick={()=>setToolTab(id)}>{label}</button>
          ))}
        </div>

        <div className="tool-panel">
          {toolTab==="ilham"&&(
            <><ul className="ilham-list">{ILHAM_NOTES.map((n,i)=><li key={i}>{n}</li>)}</ul>
            <button className="constraint-btn" onClick={()=>setConstraint(CONSTRAINTS[Math.floor(Math.random()*CONSTRAINTS.length)])}>📝 Rastgele Kısıtlama</button>
            {constraint&&<div className="constraint-pill">{constraint}</div>}</>
          )}
          {toolTab==="yorum"&&(
            <>{aiLoading&&<div className="ai-thinking"><span/><span/><span/></div>}
            {!aiLoading&&!review&&<p className="tool-muted">Editör altındaki <strong>AI Yorumla</strong> butonuna bas.</p>}
            {!aiLoading&&review&&<><p className="ai-review">{review.analysis}</p>{review.closingNote&&<p className="tool-muted" style={{marginTop:10}}>— {review.closingNote}</p>}</>}</>
          )}
          {toolTab==="sohbet"&&(
            <><div className="chat-box" ref={chatBoxRef}>
              {chat.length===0&&<p className="tool-muted">AI ile metni hakkında sohbet edebilirsin.</p>}
              {chat.map((m,i)=><div key={i} className={`chat-msg chat-msg--${m.role}`}><strong>{m.role==="user"?"Sen":"AI"}</strong>{": "}{m.content}</div>)}
            </div>
            <div className="chat-input-row">
              <input className="chat-input" value={chatInput} onChange={(e)=>setChatInput(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"&&chatInput.trim()){e.preventDefault();sendChat();}}} placeholder="AI'ye sor…"/>
              <button className="chat-send" onClick={sendChat} disabled={aiLoading||!chatInput.trim()}>{aiLoading?"…":"↑"}</button>
            </div></>
          )}
          {toolTab==="koc"&&(
            <><div className="koc-header"><span className="tool-muted">Koçun not defteri</span><button className="koc-clear" onClick={()=>setCoachNotes([])}>Temizle</button></div>
            {!coachEnabled&&<p className="tool-muted" style={{marginBottom:10}}>Koç modu kapalı.</p>}
            {coachNotes.length===0?<p className="tool-muted">Yazdıkça koç buraya sessizce not düşecek.</p>:coachNotes.map((n)=>(
              <div key={n.key} className={`koc-note koc-note--${n.severity}`}>
                <div className="koc-note-head"><span>{n.icon}</span><span className="koc-note-title">{n.title}</span>{n.count>1&&<span className="koc-count">{n.count}×</span>}<span className="koc-badge">{n.severity==="medium"?"Orta":"Hafif"}</span></div>
                <p className="koc-note-msg">{n.message}</p>
              </div>
            ))}</>
          )}
        </div>
      </div>
    </div>
  );
}
/* ── Ana Sayfa ── */
const PAGE_TABS = { BOLUMLER:"bolumler", ATOLYE:"atolye" };

export default function ChaptersPage() {
  const { workId } = useParams();
  const navigate   = useNavigate();

  const [chapters, dispatch]    = useReducer(chaptersReducer, []);
  const [pageTab,  setPageTab]  = useState(PAGE_TABS.BOLUMLER);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [activeChapterId, setActiveChapterId] = useState(null);
  const [activePageId,    setActivePageId]    = useState(null);
  const [saveStatus,      setSaveStatus]      = useState("saved");
  const autoSaveTimers = useRef({});

  const [viewMode,      setViewMode]      = useState("single");
  const [focusMode,     setFocusMode]     = useState(false);
  const [aiOpen,        setAiOpen]        = useState(false);
  const [aiLoading,     setAiLoading]     = useState(false);
  const [aiReview,      setAiReview]      = useState("");
  const [announceModal, setAnnounceModal] = useState(null);
  const [reviewPending, setReviewPending] = useState(false);
  const [publishing,    setPublishing]    = useState(false);
  const [softFocus,     setSoftFocus]     = useState(false);

  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => { applyTheme(theme); }, [theme]);

  const [wordGoal,    setWordGoal]    = useState(() => Number(localStorage.getItem("acb_word_goal")) || 0);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput,   setGoalInput]   = useState("");
  const [dragFromIdx, setDragFromIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const leafRefsMap = useRef({});
  const deskRef     = useRef(null);
  const observerRef = useRef(null);
  const chaptersRef = useRef(chapters);
  useEffect(() => { chaptersRef.current = chapters; }, [chapters]);

  useEffect(() => {
    const h = (e) => { if (chaptersRef.current.some(c=>c._dirty)) { e.preventDefault(); e.returnValue=""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const fetchChapters = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await apiGet(`/chapters?workId=${workId}`);
      const raw = res.items || res || [];
      const sorted = [...raw].sort((a,b) => {
        const ao=a.order??9999, bo=b.order??9999;
        return ao!==bo ? ao-bo : new Date(a.createdAt||0)-new Date(b.createdAt||0);
      });
      const items = sorted.map((ch,i) => normalizeChapter({...ch, order:i}));
      dispatch({ type:"SET", chapters:items });
      items.forEach(ch => pushUndoSnapshot(ch._id, ch.pages[0]?.content??""));
      if (items.length > 0) { setActiveChapterId(items[0]._id); setActivePageId(items[0].pages[0].id); }
    } catch(err) { setError(err.message||"Bölümler yüklenemedi."); }
    finally { setLoading(false); }
  }, [workId]);

  useEffect(() => { fetchChapters(); }, [fetchChapters]);

useEffect(() => {
  window.__acbTourTrigger = window.__acbTourTrigger || {};
  window.__acbTourTrigger.openAtelierTab = () => setPageTab(PAGE_TABS.ATOLYE);
    window.__acbTourTrigger.openBolumlerTab = () => setPageTab(PAGE_TABS.BOLUMLER);
  return () => {
    delete window.__acbTourTrigger.openAtelierTab;
    delete window.__acbTourTrigger.openBolumlerTab;
  };
}); // dependency array YOK

  useEffect(() => {
    if (!deskRef.current) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      let best=null, bestR=0;
      entries.forEach(e => { if(e.intersectionRatio>bestR){bestR=e.intersectionRatio;best=e.target;} });
      if (best&&bestR>0.12) { const pgId=best.dataset.pageId, chId=best.dataset.chapterId; if(pgId&&chId){setActivePageId(pgId);setActiveChapterId(chId);} }
    }, { root:deskRef.current, threshold:[0.12,0.4,0.7] });
    Object.values(leafRefsMap.current).forEach(el => { if(el) observerRef.current.observe(el); });
    return () => observerRef.current?.disconnect();
  }, [chapters, viewMode]);

  const saveChapter = useCallback(async (chapterId) => {
    const ch = chaptersRef.current.find(c=>c._id===chapterId);
    if (!ch) return;
    try {
      setSaveStatus("saving");
      await apiPut(`/chapters/${chapterId}`, { title:ch.title, content:mergePages(ch.pages), status:ch.status, order:ch.order });
      dispatch({ type:"MARK_CLEAN", id:chapterId });
      setSaveStatus("saved");
    } catch { setSaveStatus("error"); }
  }, []);

  useEffect(() => {
    chapters.forEach(ch => {
      if (!ch._dirty) return;
      if (autoSaveTimers.current[ch._id]) clearTimeout(autoSaveTimers.current[ch._id]);
      setSaveStatus("unsaved");
      autoSaveTimers.current[ch._id] = setTimeout(() => saveChapter(ch._id), AUTOSAVE_DELAY);
    });
  }, [chapters, saveChapter]);

  const undoDebounceRef = useRef({});
  const handleContentChange = useCallback((chapterId, pageId, value) => {
    dispatch({ type:"UPDATE_CONTENT", chapterId, pageId, value });
    if (undoDebounceRef.current[chapterId]) clearTimeout(undoDebounceRef.current[chapterId]);
    undoDebounceRef.current[chapterId] = setTimeout(() => pushUndoSnapshot(chapterId, value), 1500);
  }, []);
  const handleTitleChange = useCallback((chapterId, title) => dispatch({ type:"UPDATE_TITLE", id:chapterId, title }), []);
  const handlePageFocus   = useCallback((pageId, chapterId) => { setActivePageId(pageId); setActiveChapterId(chapterId); }, []);

  const handleCreateChapter = async () => {
    const cur = chaptersRef.current;
    try {
      const res = await apiPost("/chapters", { workId, title:`Bölüm ${cur.length+1}`, status:"draft", order:cur.length });
      const newCh = normalizeChapter({...res.item, content:res.item?.content||""});
      dispatch({ type:"ADD", chapter:newCh });
      pushUndoSnapshot(newCh._id, "");
      setActiveChapterId(newCh._id); setActivePageId(newCh.pages[0].id);
      setTimeout(() => leafRefsMap.current[newCh.pages[0].id]?.scrollIntoView({behavior:"smooth",block:"start"}), 100);
    } catch(err) { setError(err.message||"Bölüm oluşturulamadı."); }
  };

  const handleDeleteChapter = async (chapterId, title) => {
    if (!window.confirm(`"${title||"Bu bölüm"}" kalıcı olarak silinecek. Emin misin?`)) return;
    try {
      await apiDelete(`/chapters/${chapterId}`);
      dispatch({ type:"DELETE", id:chapterId });
      if (activeChapterId===chapterId) {
        const rem = chaptersRef.current.filter(c=>c._id!==chapterId);
        if (rem.length>0) { setActiveChapterId(rem[0]._id); setActivePageId(rem[0].pages[0].id); }
        else { setActiveChapterId(null); setActivePageId(null); }
      }
    } catch(err) { alert("Silinemedi: "+(err.message||"")); }
  };

  function handleDragStart(e,idx){ setDragFromIdx(idx); e.dataTransfer.effectAllowed="move"; }
  function handleDragOver(idx){ if(idx!==dragOverIdx)setDragOverIdx(idx); }
  async function handleDrop(toIdx){
    if(dragFromIdx===null||dragFromIdx===toIdx){setDragFromIdx(null);setDragOverIdx(null);return;}
    const r=[...chaptersRef.current];const[m]=r.splice(dragFromIdx,1);r.splice(toIdx,0,m);
    dispatch({type:"REORDER",chapters:r});setDragFromIdx(null);setDragOverIdx(null);
  }

  const handlePublish = async () => {
    const ch = chaptersRef.current.find(c=>c._id===activeChapterId);
    if (!ch) return;
    if (ch.status==="published"||ch.status==="pending_review") {
      if (!window.confirm("Bölümü taslağa almak istediğinden emin misin?")) return;
      try { setSaveStatus("saving"); await apiPatch(`/chapters/${activeChapterId}/status`,{workId,status:"draft"}); dispatch({type:"UPDATE_STATUS",id:activeChapterId,status:"draft"}); setSaveStatus("saved"); }
      catch(err) { setSaveStatus("error"); alert("İşlem başarısız: "+(err.message||"")); }
      return;
    }
    const merged = mergePages(ch.pages);
    if (!merged.trim()) { alert("Bölüm içeriği boş."); return; }
    if (!window.confirm(ch.status==="rejected"?"Yeniden incelemeye göndermek istiyor musun?":"Bu bölümü yayınlamak istediğinden emin misin?")) return;
    setPublishing(true); setSaveStatus("saving");
    try {
      await apiPut(`/chapters/${activeChapterId}`,{title:ch.title,content:merged,order:ch.order});
      const result = await apiPatch(`/chapters/${activeChapterId}/status`,{workId,status:"published"});
      if (result.pending) { dispatch({type:"UPDATE_STATUS",id:activeChapterId,status:"pending_review",reviewNote:""}); setReviewPending(true); setTimeout(()=>setReviewPending(false),8000); }
      else if (result.rejected) { dispatch({type:"UPDATE_STATUS",id:activeChapterId,status:"rejected",reviewNote:ch.reviewNote||""}); alert(result.message||"İçerik politikasına aykırı."); }
      else { dispatch({type:"UPDATE_STATUS",id:activeChapterId,status:"published"}); setAnnounceModal({title:ch.title}); }
      setSaveStatus("saved");
    } catch(err) { setSaveStatus("error"); alert(err.message||"Yayınlama başarısız oldu."); }
    finally { setPublishing(false); }
  };

  const handleAIReview = async () => {
    const ch = chaptersRef.current.find(c=>c._id===activeChapterId);
    if (!ch) return;
    setAiOpen(true); setAiLoading(true); setAiReview("");
    try {
      const tmp=document.createElement("div"); tmp.innerHTML=mergePages(ch.pages);
      const res=await apiPost("/ai/review",{workId,chapterId:activeChapterId,title:ch.title,text:tmp.innerText,context:"chapter"});
      setAiReview(res.analysis||res.item?.analysis||res.text||"Yorum alındı.");
    } catch { setAiReview("AI yorum alınamadı."); }
    finally { setAiLoading(false); }
  };

  const jumpToChapter = useCallback((chapterId) => {
    setActiveChapterId(chapterId);
    const ch=chaptersRef.current.find(c=>c._id===chapterId);
    if (ch?.pages?.[0]) { setActivePageId(ch.pages[0].id); setTimeout(()=>leafRefsMap.current[ch.pages[0].id]?.scrollIntoView({behavior:"smooth",block:"start"}),30); }
  }, []);
  const jumpToPage = useCallback((pageId) => {
    setActivePageId(pageId);
    setTimeout(()=>leafRefsMap.current[pageId]?.scrollIntoView({behavior:"smooth",block:"start"}),30);
  }, []);

  useEffect(() => {
    const down=(e)=>{
      const mod=e.ctrlKey||e.metaKey;
      if(mod&&e.key==="s"){e.preventDefault();if(activeChapterId)saveChapter(activeChapterId);}
      if(e.key==="F11"){e.preventDefault();setFocusMode(v=>!v);}
      if(e.key==="Escape"){setFocusMode(false);setEditingGoal(false);}
      if(mod&&e.key==="ArrowDown"){e.preventDefault();const cur=chaptersRef.current,idx=cur.findIndex(c=>c._id===activeChapterId);if(idx<cur.length-1)jumpToChapter(cur[idx+1]._id);}
      if(mod&&e.key==="ArrowUp"){e.preventDefault();const cur=chaptersRef.current,idx=cur.findIndex(c=>c._id===activeChapterId);if(idx>0)jumpToChapter(cur[idx-1]._id);}
      if(mod&&!e.shiftKey&&e.key==="z"){
        const a=document.activeElement;
        if(a?.contentEditable!=="true"&&a?.tagName!=="TEXTAREA"&&a?.tagName!=="INPUT"&&activeChapterId){
          e.preventDefault();const prev=popUndoSnapshot(activeChapterId);
          if(prev!==null)dispatch({type:"UNDO_CONTENT",chapterId:activeChapterId,content:prev});
        }
      }
    };
    window.addEventListener("keydown",down);
    return()=>window.removeEventListener("keydown",down);
  },[activeChapterId,saveChapter,jumpToChapter]);

  const activeChapter=chapters.find(c=>c._id===activeChapterId);
  let gCounter=0; const gMap={};
  chapters.forEach(ch=>ch.pages.forEach(pg=>{gCounter++;gMap[pg.id]=gCounter;}));
  const totalPages=gCounter, currentPage=gMap[activePageId]||1;
  const totalWc=useMemo(()=>chapters.reduce((s,ch)=>s+ch.pages.reduce((ss,p)=>ss+wcFromHtml(p.content),0),0),[chapters]);
  const goalPct=wordGoal>0?Math.min(100,Math.round((totalWc/wordGoal)*100)):0;
  const goalDone=wordGoal>0&&totalWc>=wordGoal;
  function saveGoal(){const v=parseInt(goalInput)||0;setWordGoal(v);localStorage.setItem("acb_word_goal",String(v));setEditingGoal(false);}

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
    <div className="cp-root">
      {/* ── SIDEBAR ── */}
      <aside className="cp-sidebar">
        <div className="cp-sidebar-top">
          <button className="cp-back-btn" onClick={()=>navigate(`/work/${workId}`)}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            stüdyo
          </button>
          <div className="cp-side-tabs">
            <button className={`cp-side-tab ${pageTab===PAGE_TABS.BOLUMLER?"active":""}`} onClick={()=>setPageTab(PAGE_TABS.BOLUMLER)}>📖 Bölümler</button>
            <button className={`cp-side-tab ${pageTab===PAGE_TABS.ATOLYE?"active":""}`}   onClick={()=>setPageTab(PAGE_TABS.ATOLYE)}
            data-tour = "write-atolye-tab"  >✍️ Atölye</button>
          </div>
        </div>

        <div className="cp-sidebar-body">
          {pageTab===PAGE_TABS.BOLUMLER&&(
            <>
              {error&&<div className="cp-err-box">{error}</div>}
              <div className="cp-sec-label">bölümler</div>
              <div className="cp-chapter-nav" onDragLeave={()=>setDragOverIdx(null)}>
                {chapters.length===0&&<p className="cp-empty-hint">Henüz bölüm yok.</p>}
                {chapters.map((ch,idx)=>(
                  <ChapterItem key={ch._id} chapter={ch} index={idx} isActive={ch._id===activeChapterId}
                    onJump={jumpToChapter} onDelete={handleDeleteChapter}
                    onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop}
                    isDragging={dragFromIdx===idx} isDragOver={dragOverIdx===idx}/>
                ))}
              </div>
              <button className="cp-new-ch-btn" onClick={handleCreateChapter}
               data-tour="write-yeni-bolum">+ yeni bölüm</button>

              {activeChapter&&(
                <><div className="cp-sec-label" style={{marginTop:14}}>sayfalar</div>
                <div className="cp-thumbs">
                  {activeChapter.pages.map((pg,pi)=>{
                    const pgWc=wcFromHtml(pg.content);
                    const pct=Math.min(100,Math.round((pgWc/WORDS_PER_PAGE)*100));
                    return (
                      <button key={pg.id} className={`cp-thumb-btn ${pg.id===activePageId?"active":""}`} onClick={()=>jumpToPage(pg.id)}>
                        <span className="cp-thumb-num">{pi+1}</span>
                        <div className="cp-thumb-track"><div className="cp-thumb-fill" style={{width:`${pct}%`}}/></div>
                        <span className="cp-thumb-wc">{pgWc}</span>
                      </button>
                    );
                  })}
                </div></>
              )}

              <div className="cp-goal">
                {editingGoal?(
                  <div className="cp-goal-edit">
                    <input className="cp-goal-input" type="number" value={goalInput} onChange={e=>setGoalInput(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")saveGoal();if(e.key==="Escape")setEditingGoal(false);}} onBlur={saveGoal} autoFocus placeholder="500"/>
                    <span className="cp-goal-unit">kelime</span>
                  </div>
                ):wordGoal>0?(
                  <div className="cp-goal-display" onClick={()=>{setEditingGoal(true);setGoalInput(String(wordGoal));}} title="Hedefi düzenle">
                    <div className="cp-goal-track"><div className={`cp-goal-fill ${goalDone?"done":""}`} style={{width:`${goalPct}%`}}/></div>
                    <span className="cp-goal-text">{goalDone?"🎉 hedef tamam":`%${goalPct} · ${wordGoal.toLocaleString("tr-TR")} hedef`}</span>
                  </div>
                ):(
                  <button className="cp-goal-set-btn" onClick={()=>{setEditingGoal(true);setGoalInput("");}}>+ günlük kelime hedefi</button>
                )}
              </div>
            </>
          )}
          {pageTab===PAGE_TABS.ATOLYE&&(
            <div className="cp-atelier-hint"><p>Egzersizlerin notlara kaydedilir ve esere bağlanır.</p><p>Yazma rutinini sağ panelden başlat.</p></div>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="cp-main">
        <header className="cp-topbar">
          <div className="cp-tb-left">
            <span className={`cp-save-dot cp-save-dot--${saveStatus}`}/>
            <span className="cp-save-text">
              {saveStatus==="saved"&&"kaydedildi"}{saveStatus==="unsaved"&&"kaydedilmemiş"}
              {saveStatus==="saving"&&"kaydediliyor…"}{saveStatus==="error"&&"kaydedilemedi!"}
            </span>
            {activeChapter&&<span className="cp-tb-chapname">{activeChapter.title||"Başlıksız"}</span>}
          </div>

          <div className="cp-tb-center">
            {pageTab===PAGE_TABS.BOLUMLER&&(
              <div className="cp-view-toggle">
                <button className={`cp-view-btn ${viewMode==="single"?"active":""}`} onClick={()=>setViewMode("single")} title="Tek sayfa">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="1" width="10" height="14" rx="1"/></svg>
                </button>
                <button className={`cp-view-btn ${viewMode==="double"?"active":""}`} onClick={()=>setViewMode("double")} title="Yan yana">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><rect x="0" y="1" width="7" height="14" rx="1"/><rect x="9" y="1" width="7" height="14" rx="1"/></svg>
                </button>
                {viewMode==="single"&&(
                  <button className={`cp-view-btn ${softFocus?"active":""}`} onClick={()=>setSoftFocus(v=>!v)} title="Odak görünümü" style={{marginLeft:4}}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1"/></svg>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="cp-tb-right">
            <button className="cp-theme-btn" onClick={()=>setTheme(t=>t==="light"?"dark":"light")} title="Tema değiştir">
              {theme==="light"?"🌙":"☀️"}
            </button>
            {pageTab===PAGE_TABS.BOLUMLER&&(
              <>
                <button className="cp-tb-btn" onClick={()=>setFocusMode(true)} 
                data-tour="write-odak-btn"
                title="F11">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                  odak
                </button>
                <button className="cp-tb-btn" onClick={()=>setAiOpen(v=>!v)} disabled={!activeChapterId}
                data-tour="write-ai-btn"
                >AI yorumla</button>
                <button className="cp-tb-btn" onClick={()=>activeChapterId&&saveChapter(activeChapterId)} disabled={saveStatus==="saving"}>kaydet</button>
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

        <div className="cp-content-area">
          {pageTab===PAGE_TABS.BOLUMLER&&(
            <div className={`cp-desk cp-desk--${viewMode}`} ref={deskRef}
            data-tour="write-editor">
              {chapters.length===0?(
                <div className="cp-desk-empty">
                  <div className="cp-desk-empty-glyph">✦</div>
                  <p>Henüz bölüm yok.</p>
                  <button onClick={handleCreateChapter}>İlk bölümü oluştur</button>
                </div>
              ):(
                <div className={`cp-leaves ${viewMode==="double"?"cp-leaves--double":""}`}>
                  {chapters.map((ch,chIdx)=>ch.pages.map((pg,pi)=>(
                    <PageLeaf key={pg.id} page={pg} chapter={ch} chapterIndex={chIdx} isFirstPage={pi===0}
                      globalNum={gMap[pg.id]||0} onContentChange={handleContentChange}
                      onTitleChange={handleTitleChange} onFocus={handlePageFocus}
                      leafRef={el=>{leafRefsMap.current[pg.id]=el;}}
                      isFocused={!softFocus||ch._id===activeChapterId?undefined:false}/>
                  )))}
                </div>
              )}
            </div>
          )}
          {pageTab===PAGE_TABS.ATOLYE&&<AtelierTab workId={workId}/>}
        </div>

        <div className="cp-statusbar">
          <span className="cp-sb-item"><strong>{totalWc.toLocaleString("tr-TR")}</strong> kelime</span>
          <span className="cp-sb-sep"/><span className="cp-sb-item">⏱ {readTime(totalWc)}</span>
          <span className="cp-sb-sep"/><span className="cp-sb-item">sayfa <strong>{currentPage}</strong> / <strong>{totalPages}</strong></span>
          <span className="cp-sb-sep"/><span className="cp-sb-item">bölüm <strong>{chapters.findIndex(c=>c._id===activeChapterId)+1}</strong> / <strong>{chapters.length}</strong></span>
          <span className="cp-sb-spacer"/>
          <span className="cp-sb-hint">ctrl+s · ctrl+z · F11 odak · ctrl+↑↓ bölüm</span>
        </div>
      </div>

      <AIDrawer open={aiOpen} onClose={()=>setAiOpen(false)} chapterId={activeChapterId} chapter={activeChapter} onReview={handleAIReview} loading={aiLoading} review={aiReview} onClear={()=>setAiReview("")}/>
    </div>
    {/* Portals — cp-root dışında, viewport'a göre fixed */}
    {focusMode&&activeChapter&&<FocusOverlay chapter={activeChapter} onClose={()=>setFocusMode(false)} onContentChange={handleContentChange} onTitleChange={handleTitleChange}/>}
    {announceModal&&<AnnounceModal chapterTitle={announceModal.title} workId={workId} onClose={()=>setAnnounceModal(null)}/>}
    {reviewPending&&<ReviewPendingBanner onClose={()=>setReviewPending(false)}/>}
    </>
  );
}