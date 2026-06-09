import {
  useEffect, useState, useRef, useCallback, useMemo,
} from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import TopBar from "../components/TopBar";
import Footer from "../components/Footer";
import "../styles/Read.css";
import ReportModal from "../components/ReportModal";
import { useReadingProgress } from "../hooks/useReadingProgress";
import { getProgressForStory } from "../services/readingProgressService";
import { cleanHtml } from "../lib/sanitize";

const API_BASE = import.meta.env?.VITE_API_URL ?? "/api";

/* ════════════════════════════
   HELPERS
════════════════════════════ */
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
}

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const err = new Error(`Hata ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
const apiGet  = (path)       => apiFetch(path);
const apiPost = (path, body) => apiFetch(path, { method: "POST", body: JSON.stringify(body) });

function readingTime(text = "") {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const mins  = Math.ceil(words / 200);
  return mins < 1 ? "< 1 dk" : `${mins} dk`;
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)     return "az önce";
  if (diff < 3600)   return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)} sa önce`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR");
}

function getInitials(user) {
  const name = user?.kullaniciAdi || user?.username || "?";
  return name.slice(0, 2).toUpperCase();
}

/* ════════════════════════════
   AVATAR  (DRY — tek tanım)
════════════════════════════ */
const AVATAR_PALETTES = [
  { bg: "#F0E9FF", fg: "#5B21B6" },
  { bg: "#FEF3C7", fg: "#92400E" },
  { bg: "#ECFDF5", fg: "#065F46" },
  { bg: "#FFF1F2", fg: "#9F1239" },
  { bg: "#EFF6FF", fg: "#1E40AF" },
  { bg: "#FDF2F8", fg: "#86198F" },
];

function Avatar({ user, size = 34 }) {
  const init       = getInitials(user);
  const idx        = (init.charCodeAt(0) || 0) % AVATAR_PALETTES.length;
  const { bg, fg } = AVATAR_PALETTES[idx];

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={init}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0, display: "block",
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: Math.max(10, size * 0.34), fontWeight: 700,
      fontFamily: "'Cormorant Garamond', serif",
      userSelect: "none", letterSpacing: ".02em",
    }}>
      {init}
    </div>
  );
}

/* ════════════════════════════
   KOPYA KORUMA
════════════════════════════ */
function useCopyProtection(workTitle, authorName, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onContextMenu = (e) => {
      if (e.target.closest(".rd-body")) e.preventDefault();
    };

    const onCopy = (e) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      if (!selection.anchorNode?.parentElement?.closest(".rd-body")) return;
      e.preventDefault();
      const selectedText = selection.toString();
      if (!selectedText.trim()) return;
      const attribution = `\n\n— "${workTitle}", ${authorName}\n(ACB Atölyesi · acbatolyesi.com)`;
      e.clipboardData.setData("text/plain", selectedText + attribution);
      e.clipboardData.setData(
        "text/html",
        `<p>${selectedText}</p><p><em>— "${workTitle}", ${authorName} · ACB Atölyesi</em></p>`
      );
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
    };
  }, [workTitle, authorName, enabled]);
}

/* ════════════════════════════
   TOAST
════════════════════════════ */
function Toast({ visible, children }) {
  return (
    <div className={`rd-toast ${visible ? "rd-toast--visible" : ""}`} aria-live="polite">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      {children}
    </div>
  );
}

/* ════════════════════════════
   ALINTI BALONU
════════════════════════════ */
function QuoteBubble({ workId, workTitle, authorName, genre, currentUser }) {
  const [bubble,    setBubble]    = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState(false);
  const [loginHint, setLoginHint] = useState(false);
  const bubbleRef = useRef(null);

  useEffect(() => {
    const onMouseUp = (e) => {
      if (bubbleRef.current?.contains(e.target)) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) { setBubble(null); return; }
      const text = selection.toString().trim();
      if (!text || text.length < 10 || text.length > 500) { setBubble(null); return; }
      if (!selection.anchorNode?.parentElement?.closest(".rd-body")) { setBubble(null); return; }
      const range = selection.getRangeAt(0);
      const rect  = range.getBoundingClientRect();
      setBubble({ x: rect.left + rect.width / 2 + window.scrollX, y: rect.top + window.scrollY - 52, text });
    };
    const onSelectionChange = () => {
      if (!window.getSelection()?.toString()) setBubble(null);
    };
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, []);

  async function saveQuote() {
    if (!bubble || saving) return;
    if (!currentUser) {
      setLoginHint(true);
      setTimeout(() => setLoginHint(false), 2500);
      return;
    }
    setSaving(true);
    try {
      await apiPost("/quotes", { workId, text: bubble.text, workTitle, authorName, genre: genre || "belirtilmemiş" });
      setBubble(null);
      window.getSelection()?.removeAllRanges();
      setToast(true);
      setTimeout(() => setToast(false), 2500);
    } catch {
      // sessiz
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {bubble && (
        <div
          ref={bubbleRef}
          className="rd-quote-bubble"
          style={{ left: bubble.x, top: bubble.y }}
          onMouseDown={e => e.preventDefault()}
        >
          <button className="rd-quote-bubble-btn" onClick={saveQuote} disabled={saving}>
            {saving ? (
              <span className="rd-spinner rd-spinner--sm" aria-hidden="true" />
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
                </svg>
                Alıntıla
              </>
            )}
          </button>
        </div>
      )}
      <Toast visible={toast}>Alıntı kaydedildi ✦</Toast>
      <Toast visible={loginHint}>Alıntılamak için giriş yapmalısın</Toast>
    </>
  );
}

/* ════════════════════════════
   INLINE PARAGRAPH
════════════════════════════ */
/* ════════════════════════════
   INLINE PARAGRAPH
════════════════════════════ */
function InlineParagraph({ html, index, comments, onOpenDrawer }) {
  const count = comments.length;
  // Drawer önizlemesi için düz metin (etiketsiz)
  const plain = useMemo(() => {
    const d = document.createElement("div");
    d.innerHTML = html;
    return d.textContent || "";
  }, [html]);

  // İç blok elemanının text-align inline stilini dış sarmalayıcıya taşı;
  // böylece .rd-paragraph { text-align: justify } CSS kuralını geçersiz kılar.
  const alignStyle = useMemo(() => {
    const d = document.createElement("div");
    d.innerHTML = html;
    const ta = d.firstElementChild?.style?.textAlign;
    return ta ? { textAlign: ta } : undefined;
  }, [html]);

  return (
    <div className={`rdic-para-wrap ${count > 0 ? "rdic-para-wrap--has-comments" : ""}`}>
      {/* html zaten cleanHtml'den geçti → güvenli */}
      <div className="rd-paragraph" style={alignStyle} dangerouslySetInnerHTML={{ __html: html }} />
      <div className="rdic-gutter">
        {count > 0 && (
          <button className="rdic-bubble" onClick={() => onOpenDrawer(index, plain)} title={`${count} yorum`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {count}
          </button>
        )}
        <button className="rdic-add" onClick={() => onOpenDrawer(index, plain)} title="Yorum ekle">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// Bunlar gerçek paragraf/blok sınırı sayılır; geri kalan her şey (text node,
// <b>/<i>/<span>/<a>/<br> vb. satır-içi öğeler) aynı paragraf tamponunda birikir.
const RDIC_BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "UL", "OL", "BLOCKQUOTE", "HR", "IMG"]);

function InlineParagraphs({ text, chapterId, workId, commentMap, onOpenDrawer }) {
  const blocks = useMemo(() => {
    const clean = cleanHtml(text || "");      // ← tek kapı: önce temizle
    if (!clean.trim()) return [];
    const tmp = document.createElement("div");
    tmp.innerHTML = clean;

    const result = [];
    let buffer = "";

    const flush = () => {
      const trimmed = buffer.trim();
      if (trimmed) result.push(`<p>${trimmed}</p>`);
      buffer = "";
    };

    for (const node of Array.from(tmp.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        buffer += node.textContent;
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      if (RDIC_BLOCK_TAGS.has(node.tagName)) {
        flush();
        // boş blokları (örn. <div><br></div>) at, ama gerçek <br>/<hr>/<img> kalsın
        const hasText = node.textContent.trim();
        const hasVoid = /<(br|hr|img)\b/i.test(node.outerHTML);
        if (hasText || hasVoid) result.push(node.outerHTML);
      } else {
        // satır-içi öğe (b, i, span, a, code, ...) → tampona ekle, ayrı blok açma
        buffer += node.outerHTML;
      }
    }
    flush();

    return result;
  }, [text]);

  if (!blocks.length)
    return <p className="rd-empty-para">Bu bölümde henüz içerik yok.</p>;

  return (
    <>
      {blocks.map((html, i) => (
        <InlineParagraph
          key={i}
          html={html}
          index={i}
          comments={commentMap[i] || []}
          onOpenDrawer={onOpenDrawer}
        />
      ))}
    </>
  );
}

/* ════════════════════════════
   INLINE COMMENT DRAWER
════════════════════════════ */
function InlineCommentDrawer({ open, onClose, paragraph, chapterId, workId, currentUser, comments, onCommentAdded, onCommentUpdated, onCommentDeleted }) {
  const [text,       setText]   = useState("");
  const [submitting, setSubmit] = useState(false);
  const [error,      setError]  = useState("");
  const drawerRef   = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!open) { setText(""); setError(""); return; }
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) onClose();
    };
    const id = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => { clearTimeout(id); document.removeEventListener("mousedown", onDown); };
  }, [open, onClose]);

  async function submit() {
    if (!text.trim() || submitting) return;
    setError("");
    setSubmit(true);
    try {
      const data = await apiPost("/inline-comments", {
        workId, chapterId, paragraphIndex: paragraph.index, content: text.trim(),
      });
      onCommentAdded(data.item);
      setText("");
    } catch (err) {
      setError(err.status === 403 ? "Yorum yapma yetkiniz kısıtlanmış." : "Gönderilemedi, tekrar dene.");
    } finally {
      setSubmit(false);
    }
  }

  return (
    <>
      <div className={`rdic-backdrop ${open ? "rdic-backdrop--open" : ""}`} aria-hidden="true" onClick={onClose} />
      <aside ref={drawerRef} className={`rdic-drawer ${open ? "rdic-drawer--open" : ""}`} aria-label="Paragraf yorumları">
        <div className="rdic-drawer-header">
          <span className="rdic-drawer-title">Paragraf Yorumu</span>
          <button className="rdic-drawer-close" onClick={onClose} aria-label="Kapat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {paragraph && (
          <blockquote className="rdic-quote">
            {paragraph.text.length > 200 ? paragraph.text.slice(0, 200) + "…" : paragraph.text}
          </blockquote>
        )}

        <div className="rdic-drawer-comments">
          {comments.length === 0 ? (
            <p className="rdic-empty">Bu paragraf için henüz yorum yok.</p>
          ) : (
            comments.map(c => (
              <InlineCommentItem
                key={c._id}
                comment={c}
                currentUser={currentUser}
                onUpdated={onCommentUpdated}
                onDeleted={onCommentDeleted}
              />
            ))
          )}
        </div>

        {currentUser ? (
          <div className="rdic-drawer-compose">
            <Avatar user={currentUser} size={28} />
            <div className="rdic-drawer-compose-inner">
              <textarea
                ref={textareaRef}
                className="rdic-drawer-textarea"
                placeholder="Bu paragraf hakkında düşünceni yaz…"
                value={text}
                onChange={e => setText(e.target.value.slice(0, 1000))}
                rows={3}
                onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) submit(); }}
              />
              {error && <p className="rdic-error">{error}</p>}
              <div className="rdic-drawer-footer">
                <span className="rdic-char">{text.length}/1000</span>
                <button className="rdic-submit-btn" onClick={submit} disabled={submitting || !text.trim()}>
                  {submitting ? <span className="rd-spinner rd-spinner--sm" aria-hidden="true" /> : "Gönder"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="rdic-empty" style={{ marginTop: 12 }}>Yorum yapmak için giriş yapmalısın.</p>
        )}
      </aside>
    </>
  );
}

/* ════════════════════════════
   INLINE COMMENT ITEM
   Drawer içindeki tekil yorum — düzenle/sil/şikayet
════════════════════════════ */
function InlineCommentItem({ comment, currentUser, onUpdated, onDeleted }) {
  const [editOpen,   setEditOpen]   = useState(false);
  const [editText,   setEditText]   = useState(comment.content ?? "");
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  const [reportOpen,   setReportOpen]   = useState(false);

  const [displayContent, setDisplayContent] = useState(comment.content ?? "");
  const [deleted,        setDeleted]        = useState(false);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const menuRef = useRef(null);
  const editRef = useRef(null);

  const isOwner = !!(currentUser && (
    currentUser?.id  === comment.author?._id?.toString() ||
    currentUser?._id === comment.author?._id?.toString()
  ));

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const id = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => { clearTimeout(id); document.removeEventListener("mousedown", onDown); };
  }, [menuOpen]);

  useEffect(() => {
    if (editOpen) setTimeout(() => editRef.current?.focus(), 60);
  }, [editOpen]);

  async function saveEdit() {
    if (!editText.trim() || editSaving) return;
    if (editText.trim() === displayContent) { setEditOpen(false); return; }
    setEditError(""); setEditSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/inline-comments/${comment._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: editText.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const updated = data.item?.content ?? editText.trim();
      setDisplayContent(updated);
      setEditOpen(false);
      onUpdated?.(comment._id, updated);
    } catch {
      setEditError("Kaydedilemedi, tekrar dene.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/inline-comments/${comment._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setDeleted(true);
      onDeleted?.(comment._id);
    } catch {
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }


  if (deleted) return null;

  const authorName = comment.author?.kullaniciAdi || comment.author?.username || "Okuyucu";

  return (
    <div className="rdic-comment-item">
      <div className="rdic-comment-top">
        <Avatar user={comment.author} size={26} />
        <div className="rdic-comment-meta">
          <span className="rdic-comment-author">{authorName}</span>
          <time className="rdic-comment-time">{timeAgo(comment.createdAt)}</time>
          {comment.updatedAt !== comment.createdAt && (
            <span className="rd-comment-edited">(düzenlendi)</span>
          )}
        </div>

        {currentUser && (
          <div ref={menuRef} className="rdic-menu-wrap">
            <button
              className="rdic-menu-trigger"
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Seçenekler"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
              </svg>
            </button>
            {menuOpen && (
              <div className="rdic-menu-dropdown">
                {isOwner && (
                  <>
                    <button className="rdic-menu-item" onClick={() => { setEditText(displayContent); setEditOpen(true); setMenuOpen(false); }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Düzenle
                    </button>
                    <button className="rdic-menu-item rdic-menu-item--danger" onClick={() => { setDeleteConfirm(true); setMenuOpen(false); }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      </svg>
                      Sil
                    </button>
                  </>
                )}
                {!isOwner && (
                  <button className="rdic-menu-item rdic-menu-item--warn" onClick={() => { setReportOpen(true); setMenuOpen(false); }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                      <line x1="4" y1="22" x2="4" y2="15"/>
                    </svg>
                    Şikayet Et
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {editOpen ? (
        <div className="rdic-edit-form">
          <textarea
            ref={editRef}
            className="rdic-drawer-textarea"
            value={editText}
            onChange={e => setEditText(e.target.value.slice(0, 1000))}
            rows={3}
            onKeyDown={e => {
              if (e.key === "Enter" && e.ctrlKey) saveEdit();
              if (e.key === "Escape") { setEditOpen(false); setEditError(""); }
            }}
          />
          {editError && <p className="rdic-error">{editError}</p>}
          <div className="rdic-edit-actions">
            <span className="rdic-char">{editText.length}/1000</span>
            <button className="rdic-cancel-btn" onClick={() => { setEditOpen(false); setEditError(""); }}>İptal</button>
            <button className="rdic-submit-btn" onClick={saveEdit} disabled={editSaving || !editText.trim()}>
              {editSaving ? <span className="rd-spinner rd-spinner--sm" /> : "Kaydet"}
            </button>
          </div>
        </div>
      ) : (
        <p className="rdic-comment-text">{displayContent}</p>
      )}

      {deleteConfirm && (
        <div className="rdic-confirm-bar">
          <span>Bu yorumu silmek istediğine emin misin?</span>
          <button className="rdic-cancel-btn" onClick={() => setDeleteConfirm(false)}>Vazgeç</button>
          <button className="rdic-danger-btn" onClick={handleDelete} disabled={deleting}>
            {deleting ? <span className="rd-spinner rd-spinner--sm" /> : "Evet, Sil"}
          </button>
        </div>
      )}

      {reportOpen && (
        <ReportModal
          isOpen={reportOpen}
          targetType="comment"
          targetId={comment._id}
          targetLabel={displayContent.slice(0, 60)}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}

/* ════════════════════════════
   YORUM SATIRI
════════════════════════════ */
function CommentItem({ comment, workId, chapterId, currentUser, isReply = false, onDeleted }) {
  const [liked, setLiked] = useState(comment.isLiked ?? false);
  const [likeCount,  setLikeCount] = useState(comment.likeCount ?? 0);
  const [replyOpen,  setReplyOpen] = useState(false);
  const [collapsed,  setCollapsed] = useState(true);
  const [replyText,  setReplyText] = useState("");
  const [submitting, setSubmit]    = useState(false);
  const [replyError, setReplyError] = useState("");
  const [replies,    setReplies]   = useState(comment.replies ?? []);

  // Düzenle
  const [editOpen,   setEditOpen]  = useState(false);
  const [editText,   setEditText]  = useState(comment.content ?? "");
  const [editSaving, setEditSaving]= useState(false);
  const [editError,  setEditError] = useState("");
  const editRef = useRef(null);

  // Sil
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting,      setDeleting]      = useState(false);

  // Şikayet
  const [reportOpen, setReportOpen] = useState(false);

  // Görünür içerik (düzenleme sonrası güncellenir)
  const [displayContent, setDisplayContent] = useState(comment.content ?? "");
  const [deleted,        setDeleted]        = useState(false);

  const isLoggedIn = !!currentUser;
  const isOwner    = isLoggedIn && (
    currentUser?.id === comment.author?._id?.toString() ||
    currentUser?._id === comment.author?._id?.toString()
  );

  useEffect(() => {
    if (editOpen) setTimeout(() => editRef.current?.focus(), 60);
  }, [editOpen]);

  /* ── Beğeni ── */
  async function handleLike() {
    if (!isLoggedIn) return;
    const next = !liked;
    setLiked(next); setLikeCount(c => c + (next ? 1 : -1));
    try {
      const res = await apiPost(`/comments/${comment._id}/like`);
      if (typeof res.likeCount === "number") setLikeCount(res.likeCount);
      if (typeof res.liked    === "boolean") setLiked(res.liked);
    } catch {
      setLiked(!next); setLikeCount(c => c + (next ? -1 : 1));
    }
  }

  /* ── Yanıt gönder ── */
  async function submitReply() {
    if (!replyText.trim() || submitting) return;
    setReplyError("");
    setSubmit(true);
    try {
      const res = await apiPost(`/comments/${chapterId || workId}`, {
        content: replyText.trim(), workId, parentId: comment._id,
      });
      setReplies(prev => [...prev, res.item]);
      setReplyText(""); setReplyOpen(false); setCollapsed(false);
    } catch (err) {
      setReplyError(err.status === 403 ? "Yorum yapma yetkiniz kısıtlanmış." : "Yanıt gönderilemedi. Lütfen tekrar dene.");
    } finally { setSubmit(false); }
  }

  /* ── Düzenle kaydet ── */
  async function saveEdit() {
    if (!editText.trim() || editSaving) return;
    if (editText.trim() === displayContent) { setEditOpen(false); return; }
    setEditError(""); setEditSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/comments/${comment._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: editText.trim() }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDisplayContent(data.item?.content ?? editText.trim());
      setEditOpen(false);
    } catch {
      setEditError("Kaydedilemedi, tekrar dene.");
    } finally {
      setEditSaving(false);
    }
  }

  /* ── Sil ── */
  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/comments/${comment._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      setDeleted(true);
      onDeleted?.(comment._id);
    } catch {
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  /* ── Şikayet ── */

  if (deleted) return null;

  if (comment.isDeleted) {
  return (
    <div className={`rd-comment-item ${isReply ? "rd-comment--reply" : ""}`}>
      <div className="rd-comment-left">
        <Avatar user={comment.author} size={isReply ? 26 : 32} />
      </div>

      <div className="rd-comment-right">
        <p className="rd-comment-text" style={{ opacity: .5, fontStyle: "italic" }}>
          [Bu yorum kaldırıldı]
        </p>

        {!isReply && replies.length > 0 && (
          <div className="rd-replies-list">
            {replies.map(reply => (
              <CommentItem
                key={reply._id}
                comment={reply}
                workId={workId}
                chapterId={chapterId}
                currentUser={currentUser}
                isReply
                onDeleted={id => setReplies(prev => prev.filter(r => r._id !== id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

  const replyCount = replies.length;

  return (
    <div className={`rd-comment-item ${isReply ? "rd-comment--reply" : ""}`}>
      <div className="rd-comment-left">
        <Avatar user={comment.author} size={isReply ? 26 : 32} />
        {!isReply && replyCount > 0 && !collapsed && <div className="rd-comment-thread" />}
      </div>

      <div className="rd-comment-right">
        {/* ── Başlık ── */}
        <div className="rd-comment-header">
          <span className="rd-comment-author">
            {comment.author?.kullaniciAdi || comment.author?.username || "Okuyucu"}
          </span>
          <span className="rd-comment-sep" aria-hidden="true">·</span>
          <time className="rd-comment-time">{timeAgo(comment.createdAt)}</time>
          {comment.isEdited && <span className="sdp-comment-edited">(düzenlendi)</span>}

          {/* ── Üç nokta menüsü ── */}
          {isLoggedIn && (
            <div className="rd-comment-menu">
              <button
                className="rd-ca-btn rd-menu-trigger"
                aria-label="Yorum seçenekleri"
                onClick={e => {
                  e.currentTarget.nextSibling.classList.toggle("rd-menu-dropdown--open");
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                </svg>
              </button>
              <div
                className="rd-menu-dropdown"
                onBlur={e => {
                  if (!e.currentTarget.contains(e.relatedTarget))
                    e.currentTarget.classList.remove("rd-menu-dropdown--open");
                }}
              >
                {isOwner && (
                  <>
                    <button className="rd-menu-item" onClick={() => {
                      setEditText(displayContent);
                      setEditOpen(true);
                      setEditError("");
                      document.activeElement?.blur();
                      e => e.currentTarget.closest(".rd-menu-dropdown")
                        ?.classList.remove("rd-menu-dropdown--open");
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Düzenle
                    </button>
                    <button className="rd-menu-item rd-menu-item--danger"
                      onClick={() => { setDeleteConfirm(true); }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                      </svg>
                      Sil
                    </button>
                  </>
                )}
                {!isOwner && (
                  <button className="rd-menu-item rd-menu-item--warn"
                    onClick={() => { setReportOpen(true); }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                      <line x1="4" y1="22" x2="4" y2="15"/>
                    </svg>
                    Şikayet Et
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── İçerik veya düzenleme formu ── */}
        {editOpen ? (
          <div className="rd-edit-form">
            <textarea
              ref={editRef}
              className="rd-textarea rd-textarea--reply"
              value={editText}
              onChange={e => setEditText(e.target.value.slice(0, 2000))}
              rows={3}
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) saveEdit(); if (e.key === "Escape") setEditOpen(false); }}
            />
            {editError && <p className="rd-form-error">{editError}</p>}
            <div className="rd-composer-actions">
              <span className="rd-composer-hint">{editText.length}/2000</span>
              <button className="rd-btn-ghost" onClick={() => { setEditOpen(false); setEditError(""); }}>İptal</button>
              <button className="rd-btn-primary" onClick={saveEdit} disabled={editSaving || !editText.trim()}>
                {editSaving ? <span className="rd-spinner rd-spinner--sm" /> : "Kaydet"}
              </button>
            </div>
          </div>
        ) : (
          <p className="rd-comment-text">{displayContent}</p>
        )}

        {/* ── Silme onayı ── */}
        {deleteConfirm && (
          <div className="rd-confirm-bar">
            <span>Bu yorumu silmek istediğine emin misin?</span>
            <button className="rd-btn-ghost" onClick={() => setDeleteConfirm(false)}>Vazgeç</button>
            <button className="rd-btn-danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? <span className="rd-spinner rd-spinner--sm" /> : "Evet, Sil"}
            </button>
          </div>
        )}

        {/* ── Şikayet formu ── */}
        <ReportModal
          isOpen={reportOpen}
          targetType="comment"
          targetId={comment._id}
          targetLabel={displayContent.slice(0, 60)}
          onClose={() => setReportOpen(false)}
        />
        
        {/* ── Aksiyon butonları ── */}
        {!editOpen && !deleteConfirm && !reportOpen && (
          <div className="rd-comment-actions">
            <button
              className={`rd-ca-btn rd-ca-like ${liked ? "rd-ca-like--active" : ""}`}
              onClick={handleLike} disabled={!isLoggedIn}
              aria-label={liked ? "Beğeniyi geri al" : "Beğen"}
            >
              <svg width="12" height="12" viewBox="0 0 24 24"
                fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <span>{likeCount > 0 ? likeCount : "Beğen"}</span>
            </button>

            {!isReply && isLoggedIn && (
              <button className="rd-ca-btn" onClick={() => setReplyOpen(v => !v)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span>Cevapla</span>
              </button>
            )}

            {!isReply && replyCount > 0 && (
              <button className="rd-ca-btn" onClick={() => setCollapsed(v => !v)} aria-expanded={!collapsed}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{ transform: collapsed ? "none" : "rotate(180deg)", transition: "transform .2s" }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
                <span>{collapsed ? `${replyCount} yanıt` : "Gizle"}</span>
              </button>
            )}
          </div>
        )}

        {/* ── Yanıt formu ── */}
        {replyOpen && (
          <div className="rd-reply-composer">
            <Avatar user={currentUser} size={24} />
            <div className="rd-reply-composer-inner">
              <textarea
                value={replyText} onChange={e => setReplyText(e.target.value)}
                placeholder="Cevabını yaz…" className="rd-textarea rd-textarea--reply"
                rows={2} autoFocus
                onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) submitReply(); }}
              />
              {replyError && <p className="rd-form-error">{replyError}</p>}
              <div className="rd-composer-actions">
                <button className="rd-btn-ghost" onClick={() => { setReplyOpen(false); setReplyText(""); setReplyError(""); }}>İptal</button>
                <button className="rd-btn-primary" onClick={submitReply} disabled={submitting || !replyText.trim()}>
                  {submitting ? <span className="rd-spinner rd-spinner--sm" aria-hidden="true" /> : "Gönder"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Yanıtlar ── */}
        {!isReply && !collapsed && replyCount > 0 && (
          <div className="rd-replies-list">
            {replies.map(reply => (
              <CommentItem key={reply._id} comment={reply} workId={workId}
                chapterId={chapterId} currentUser={currentUser} isReply
                onDeleted={id => setReplies(prev => prev.filter(r => r._id !== id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════
   YORUM BÖLÜMÜ
════════════════════════════ */
function CommentSection({ chapterId, workId }) {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const isLoggedIn  = !!currentUser;
  const [comments,  setComments]  = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [hasMore,   setHasMore]   = useState(false);
  const [text,      setText]      = useState("");
  const [submitting,setSubmitting]= useState(false);
  const [error,     setError]     = useState("");
  const LIMIT = 20;

  const load = useCallback(async (p = 1, reset = false) => {
    setLoading(true);
    try {
      const res   = await apiGet(`/comments/${chapterId}?page=${p}&limit=${LIMIT}`);
      const items = res.items ?? [];
      setComments(prev => reset ? items : [...prev, ...items]);
      setTotal(res.total ?? 0);
      setHasMore(items.length === LIMIT);
      setPage(p);
    } catch {
      // sessiz
    } finally {
      setLoading(false);
    }
  }, [chapterId]);

  useEffect(() => { load(1, true); }, [load]);

  async function submitComment() {
    if (!text.trim() || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await apiPost(`/comments/${chapterId}`, { content: text.trim(), workId });
      setComments(prev => [res.item, ...prev]);
      setTotal(t => t + 1); setText("");
    } catch (err) {
      setError(err.status === 403 ? "Yorum yapma yetkiniz kısıtlanmış." : "Yorum gönderilemedi. Tekrar dene.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rd-comments-section">
      <div className="rd-comments-header">
        <h3 className="rd-comments-title">
          Yorumlar {total > 0 && <span className="rd-comments-count">{total}</span>}
        </h3>
      </div>

      {isLoggedIn ? (
        <div className="rd-comment-composer">
          <Avatar user={currentUser} size={32} />
          <div className="rd-reply-composer-inner">
            <textarea
              value={text} onChange={e => setText(e.target.value.slice(0, 2000))}
              placeholder="Bu bölüm hakkında düşüncelerini yaz…"
              className="rd-textarea rd-textarea--main" rows={3}
              onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) submitComment(); }}
            />
            {error && <p className="rd-form-error">{error}</p>}
            {text.length > 0 && (
              <div className="rd-composer-actions">
                <span className="rd-composer-hint">Ctrl+Enter</span>
                <button className="rd-btn-ghost" onClick={() => { setText(""); setError(""); }}>Temizle</button>
                <button className="rd-btn-primary" onClick={submitComment} disabled={submitting || !text.trim()}>
                  {submitting ? <span className="rd-spinner rd-spinner--sm" aria-hidden="true" /> : "Gönder"}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="rd-login-prompt">Yorum yapmak için giriş yapmalısın.</p>
      )}

      {loading && comments.length === 0 ? (
        <div className="rd-comments-skeleton">
          {[1, 2, 3].map(i => (
            <div key={i} className="rd-comment-sk">
              <div className="rd-sk rd-sk-avatar" />
              <div className="rd-sk-lines">
                <div className="rd-sk rd-sk-name" />
                <div className="rd-sk rd-sk-text" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="rd-empty-comments">Henüz yorum yok. İlk yorumu sen yaz!</p>
      ) : (
        <>
          {comments.map(c => (
            <CommentItem key={c._id} comment={c} workId={workId}
              chapterId={chapterId} currentUser={currentUser}
              onDeleted={id => {
                setComments(prev => prev.filter(x => x._id !== id));
                setTotal(t => t - 1);
              }}
            />
          ))}
          {hasMore && (
            <button className="rd-load-more" onClick={() => load(page + 1)} disabled={loading}>
              {loading ? <span className="rd-spinner rd-spinner--sm" aria-hidden="true" /> : "Daha fazla yorum"}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/* ════════════════════════════
   BÖLÜM BEĞENİ
════════════════════════════ */
function ChapterLikeButton({ chapterId, workId }) {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const isLoggedIn  = !!currentUser;
  const [liked,     setLiked]     = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [fetching,  setFetching]  = useState(true);

  useEffect(() => {
    if (!chapterId || !isLoggedIn) { setFetching(false); return; }
    apiGet(`/chapters/${chapterId}/like/check`)
      .then(res => { setLiked(res.liked ?? false); setLikeCount(res.likeCount ?? 0); })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, [chapterId, isLoggedIn]);

  async function toggle() {
    if (!isLoggedIn || fetching) return;
    const next = !liked;
    setLiked(next); setLikeCount(c => c + (next ? 1 : -1));
    try {
      const res = await apiPost(`/chapters/${chapterId}/like`, { workId });
      if (typeof res.liked    === "boolean") setLiked(res.liked);
      if (typeof res.likeCount === "number") setLikeCount(res.likeCount);
    } catch {
      setLiked(!next); setLikeCount(c => c + (next ? -1 : 1));
    }
  }

  return (
    <div className="rd-like-wrapper">
      <button
        className={`rd-like-btn ${liked ? "rd-like-btn--active" : ""}`}
        onClick={toggle} disabled={!isLoggedIn || fetching}
        aria-label={liked ? "Beğeniyi geri al" : "Bölümü beğen"}
      >
        <svg width="17" height="17" viewBox="0 0 24 24"
          fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span>{liked ? "Beğenildi" : "Bölümü Beğen"}</span>
        {likeCount > 0 && <span className="rd-like-count">· {likeCount}</span>}
      </button>
    </div>
  );
}

const FONT_OPTIONS = [
  { scale: 0.9,  label: "A−"  },
  { scale: 1,    label: "A"   },
  { scale: 1.15, label: "A+"  },
  { scale: 1.3,  label: "A⁺⁺" },
];

/* ════════════════════════════
   ANA SAYFA
════════════════════════════ */
export default function ReadPage() {
  const { workId }     = useParams();
  const [searchParams] = useSearchParams();          // ← FIX: URL param okunuyor
  const navigate       = useNavigate();
  const currentUser    = useMemo(() => getCurrentUser(), []);

  const contentRef       = useRef(null);
  const tocRef           = useRef(null);
  const pendingScrollRef = useRef(undefined);

  const [work,        setWork]        = useState(null);
  const [chapters,    setChapters]    = useState([]);
  const [activeIdx,   setActiveIdx]   = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [progress,    setProgress]    = useState(0);
  const [tocOpen,     setTocOpen]     = useState(false);
  const [prefaceOpen, setPrefaceOpen] = useState(false);
  const [fontScale,   setFontScale]   = useState(1);
  const [theme,       setTheme]       = useState("dark");

  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [drawerParagraph,  setDrawerParagraph]  = useState(null);
  const [inlineCommentMap, setInlineCommentMap] = useState({});

  const handleInlineCommentAdded = useCallback((chapterId, paragraphIndex, newComment) => {
    setInlineCommentMap(prev => {
      const chMap = { ...(prev[chapterId] || {}) };
      chMap[paragraphIndex] = [...(chMap[paragraphIndex] || []), newComment];
      return { ...prev, [chapterId]: chMap };
    });
  }, []);

  const chapter    = chapters[activeIdx] ?? null;
  const authorName = work?.isAnonymous
    ? "Anonim Yazar"
    : (work?.author?.kullaniciAdi || work?.author?.username || "Yazar");

  useCopyProtection(work?.title ?? "", authorName, !!work);

  /* ─── Veri yükle + URL param önceliği ─── */
  useEffect(() => {
    if (!workId) return;
    let cancelled = false;

    const chapterFromUrl = searchParams.get("chapter");
    const restartFromUrl = searchParams.get("restart") === "true";

    (async () => {
      try {
        setLoading(true);
        const [workRes, chRes] = await Promise.all([
          apiGet(`/public/works/${workId}`),
          apiGet(`/public/works/${workId}/chapters`),
        ]);
        if (cancelled) return;

        const item      = workRes.item;
        const published = item.publishedChapterIds ?? [];
        const allChs    = chRes.items ?? [];
        const visible   = published.length > 0
          ? published.map(id => allChs.find(c => c._id === id)).filter(Boolean)
          : allChs;

        setWork(item);
        setChapters(visible);

        // Öncelik: ?chapter= > ?restart=true > kayıtlı ilerleme > baştan
        if (chapterFromUrl) {
          const idx = visible.findIndex(c => String(c._id) === String(chapterFromUrl));
          setActiveIdx(idx !== -1 ? idx : 0);
          setPrefaceOpen(false);
          return;
        }

        if (restartFromUrl) {
          setActiveIdx(0);
          setPrefaceOpen(false);
          return;
        }

        try {
          const saved    = await getProgressForStory(workId, currentUser);
          const savedId  = saved?.chapterId || saved?.chapter?._id || saved?.chapter;
          const savedIdx = savedId ? visible.findIndex(c => String(c._id) === String(savedId)) : -1;

          if (savedIdx !== -1) {
            setActiveIdx(savedIdx);
            setPrefaceOpen(false);
            const pct = saved.scrollPosition;
            if (typeof pct === "number" && pct > 2) pendingScrollRef.current = pct;
            return;
          }
        } catch {
          // kayıtlı ilerleme okunamadı
        }

        setActiveIdx(0);
        setPrefaceOpen(!!item.preface);

      } catch (e) {
        if (!cancelled) setError(e.message || "Eser yüklenemedi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [workId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Scroll → progress ─── */
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setProgress(0);
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const max = scrollHeight - clientHeight;
      setProgress(max > 0 ? Math.min(100, Math.round((scrollTop / max) * 100)) : 100);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeIdx, prefaceOpen]);

  useReadingProgress(workId, !loading ? chapter : null, contentRef, currentUser);

  /* ─── Kayıtlı scroll pozisyonu ─── */
  useEffect(() => {
    if (pendingScrollRef.current === undefined || pendingScrollRef.current === null) return;
    if (!chapter?._id) return;
    const pct = pendingScrollRef.current;
    pendingScrollRef.current = null;
    if (!pct || pct <= 0) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          const el = contentRef.current;
          if (!el) return;
          const max = el.scrollHeight - el.clientHeight;
          if (max > 0) el.scrollTo({ top: Math.round((pct / 100) * max), behavior: "smooth" });
        }, 250);
      });
    });
  }, [chapter?._id]);

  /* ─── Bölüme git ─── */
  const goToChapter = useCallback((idx) => {
    setActiveIdx(idx);
    setTocOpen(false);
    setPrefaceOpen(false);
    setProgress(0);
    requestAnimationFrame(() => { if (contentRef.current) contentRef.current.scrollTop = 0; });
  }, []);

  /* ─── Inline yorumları yükle ─── */
  useEffect(() => {
    if (!chapter?._id) return;
    fetch(`${API_BASE}/inline-comments?chapterId=${chapter._id}`)
      .then(r => r.json())
      .then(data => {
        const map = {};
        (data.items || []).forEach(c => {
          if (!map[c.paragraphIndex]) map[c.paragraphIndex] = [];
          map[c.paragraphIndex].push(c);
        });
        setInlineCommentMap(prev => ({ ...prev, [chapter._id]: map }));
      })
      .catch(() => {});
  }, [chapter?._id]);

  /* ─── Klavye kısayolları ─── */
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      if (e.key === "ArrowRight" && !prefaceOpen && activeIdx < chapters.length - 1) goToChapter(activeIdx + 1);
      if (e.key === "ArrowLeft"  && !prefaceOpen && activeIdx > 0) goToChapter(activeIdx - 1);
      if (e.key === "Escape") setTocOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx, chapters.length, prefaceOpen, goToChapter]);

  /* ─── TOC dışına tıklayınca kapat ─── */
  useEffect(() => {
    if (!tocOpen) return;
    const onDown = (e) => {
      if (tocRef.current && !tocRef.current.contains(e.target)) setTocOpen(false);
    };
    const id = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    return () => { clearTimeout(id); document.removeEventListener("mousedown", onDown); };
  }, [tocOpen]);

  /* ─── Early returns ─── */
  if (loading) return (
    <div className="rd-splash">
      <div className="rd-splash-spinner" aria-hidden="true" />
      <span>Eser açılıyor…</span>
    </div>
  );

  if (error) return (
    <div className="rd-splash rd-splash--error">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
      </svg>
      <span>{error}</span>
      <button className="rd-splash-btn" onClick={() => navigate(-1)}>Geri Dön</button>
    </div>
  );

  if (!work) return null;

  const customTitle  = work.customChapterTitles?.[chapter?._id];
  const displayTitle = customTitle || chapter?.title || `Bölüm ${activeIdx + 1}`;
  const totalWords   = chapters.reduce(
    (s, c) => s + (c.content?.trim().split(/\s+/).filter(Boolean).length ?? 0), 0
  );

  return (
    <div className={`rd-root rd-theme-${theme}`}>
      <TopBar />

      {/* Progress bar */}
      <div
        className="rd-progress-bar"
        style={{ width: `${progress}%` }}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      />

      {/* Alıntı balonu */}
      {!prefaceOpen && chapter && (
        <QuoteBubble
          workId={workId} workTitle={work.title}
          authorName={authorName} genre={work.genre}
          currentUser={currentUser}
        />
      )}

      {/* ── Toolbar ── */}
      <nav className="rd-toolbar" aria-label="Okuma araçları">
        <div className="rd-tb-left">
          <button className="rd-tb-btn" onClick={() => navigate(-1)} title="Geri">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            <span className="rd-tb-label">Geri</span>
          </button>

          <button
            className={`rd-tb-btn ${tocOpen ? "rd-tb-btn--active" : ""}`}
            onClick={() => setTocOpen(v => !v)}
            aria-expanded={tocOpen}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6"  x2="21" y2="6"/>
              <line x1="3" y1="12" x2="16" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
            <span className="rd-tb-label">İçindekiler</span>
          </button>
        </div>

        <div className="rd-tb-center">
          <span className="rd-tb-title">{work.title}</span>
          {!prefaceOpen && chapter && (
            <span className="rd-tb-chapter">{activeIdx + 1} / {chapters.length}</span>
          )}
        </div>

        <div className="rd-tb-right">
          <div className="rd-font-btns" role="group" aria-label="Yazı boyutu">
            {FONT_OPTIONS.map(({ scale, label }) => (
              <button key={scale}
                className={`rd-font-btn ${fontScale === scale ? "rd-font-btn--active" : ""}`}
                onClick={() => setFontScale(scale)}
                aria-pressed={fontScale === scale}
                style={{ fontSize: `${Math.max(10, scale * 11)}px` }}>
                {label}
              </button>
            ))}
          </div>

          <div className="rd-theme-btns" role="group" aria-label="Tema">
            {["dark", "sepia", "light"].map(t => (
              <button key={t}
                className={`rd-theme-dot rd-theme-dot--${t} ${theme === t ? "rd-theme-dot--active" : ""}`}
                onClick={() => setTheme(t)}
                title={t === "dark" ? "Koyu" : t === "sepia" ? "Sepya" : "Açık"}
                aria-pressed={theme === t}
              />
            ))}
          </div>
        </div>
      </nav>

      {/* ── TOC ── */}
      {tocOpen && (
        <div className="rd-toc-overlay" onClick={() => setTocOpen(false)} aria-hidden="true" />
      )}
      <aside ref={tocRef} className={`rd-toc-panel ${tocOpen ? "rd-toc-panel--open" : ""}`} aria-hidden={!tocOpen}>
        <div className="rd-toc-header">
          <h3>İçindekiler</h3>
          <button className="rd-toc-close" onClick={() => setTocOpen(false)} aria-label="Kapat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="rd-toc-meta">
          <span>{chapters.length} bölüm</span>
          <span className="rd-dot">·</span>
          <span>{totalWords.toLocaleString("tr-TR")} kelime</span>
        </div>

        {work.preface && (
          <button
            className={`rd-toc-item rd-toc-preface ${prefaceOpen ? "rd-toc-item--active" : ""}`}
            onClick={() => { setPrefaceOpen(true); setTocOpen(false); setProgress(0); requestAnimationFrame(() => { if (contentRef.current) contentRef.current.scrollTop = 0; }); }}
          >
            <span className="rd-toc-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </span>
            <span className="rd-toc-name">Önsöz</span>
          </button>
        )}

        {chapters.map((ch, idx) => {
          const ct       = work.customChapterTitles?.[ch._id] || ch.title;
          const isActive = !prefaceOpen && activeIdx === idx;
          return (
            <button key={ch._id}
              className={`rd-toc-item ${isActive ? "rd-toc-item--active" : ""}`}
              onClick={() => goToChapter(idx)}>
              <span className="rd-toc-num">{String(idx + 1).padStart(2, "0")}</span>
              <span className="rd-toc-name">{ct}</span>
              <span className="rd-toc-time">{readingTime(ch.content)}</span>
            </button>
          );
        })}
      </aside>

      {/* ── İçerik ── */}
      <main className="rd-main" ref={contentRef}>
        <div className="rd-content"
        style={{ "--rd-font-scale": fontScale }}>

          {(prefaceOpen || activeIdx === 0) && (
            <div className="rd-book-header">
              {work.coverImage && (
                <div className="rd-cover-wrap">
                  <img src={work.coverImage} alt={`${work.title} kapağı`} className="rd-cover-img" />
                  <div className="rd-cover-glow" aria-hidden="true" />
                </div>
              )}
              <div className="rd-book-meta">
                <p className="rd-book-author">{authorName}</p>
                <h1 className="rd-book-title">{work.title}</h1>
                {work.description && <p className="rd-book-desc">{work.description}</p>}
                <div className="rd-book-stats">
                  <span>{chapters.length} Bölüm</span>
                  <span className="rd-dot">·</span>
                  <span>{totalWords.toLocaleString("tr-TR")} kelime</span>
                </div>
              </div>
            </div>
          )}

          {prefaceOpen ? (
            <article className="rd-article">
              <header className="rd-article-header">
                <div className="rd-chapter-label">Önsöz</div>
                <h2 className="rd-chapter-title">Yazarın Notu</h2>
                <div className="rd-header-rule" />
              </header>
              <div className="rd-body">
                <p className="rd-paragraph">{work.preface}</p>
              </div>
              <div className="rd-next-wrap">
                <button className="rd-next-btn" onClick={() => goToChapter(0)}>
                  Okumaya Başla
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            </article>

          ) : chapter ? (
            <article className="rd-article">
              <header className="rd-article-header">
                <div className="rd-chapter-label">Bölüm {activeIdx + 1}</div>
                <h2 className="rd-chapter-title">{displayTitle}</h2>
                <div className="rd-header-meta">
                  <span>{readingTime(chapter.content)} okuma</span>
                  <span className="rd-dot">·</span>
                  <span>{(chapter.content?.trim().split(/\s+/).filter(Boolean).length ?? 0).toLocaleString("tr-TR")} kelime</span>
                </div>
                <div className="rd-header-rule" />
              </header>

              <div className="rd-body">
                <InlineParagraphs
                  text={chapter.content} chapterId={chapter._id} workId={workId}
                  commentMap={inlineCommentMap[chapter._id] || {}}
                  onOpenDrawer={(paragraphIndex, paragraphText) => {
                    setDrawerParagraph({ index: paragraphIndex, text: paragraphText });
                    setDrawerOpen(true);
                  }}
                />
              </div>

              <InlineCommentDrawer
                open={drawerOpen} onClose={() => setDrawerOpen(false)}
                paragraph={drawerParagraph} chapterId={chapter._id}
                workId={workId} currentUser={currentUser}
                comments={drawerParagraph ? (inlineCommentMap[chapter._id]?.[drawerParagraph.index] || []) : []}
                onCommentAdded={(c) => handleInlineCommentAdded(chapter._id, drawerParagraph.index, c)}
              onCommentUpdated={(id, newContent) =>
                setInlineCommentMap(prev => {
                  const chMap = { ...(prev[chapter._id] || {}) };
                  const idx   = drawerParagraph?.index;
                  if (idx == null) return prev;
                  chMap[idx] = (chMap[idx] || []).map(c =>
                    c._id === id ? { ...c, content: newContent } : c
                  );
                  return { ...prev, [chapter._id]: chMap };
                })
              }
              onCommentDeleted={(id) =>
                setInlineCommentMap(prev => {
                  const chMap = { ...(prev[chapter._id] || {}) };
                  const idx   = drawerParagraph?.index;
                  if (idx == null) return prev;
                  chMap[idx] = (chMap[idx] || []).filter(c => c._id !== id);
                  return { ...prev, [chapter._id]: chMap };
                })
              }
              />

              <div className="rd-chapter-end">
                <div className="rd-end-ornament" aria-hidden="true">
                  <span className="rd-ornament-line" />
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  <span className="rd-ornament-line" />
                </div>

                <p className="rd-copyright-notice">
                  © Bu eserin tüm hakları yazarına aittir. İzinsiz kopyalanamaz, dağıtılamaz.
                </p>

                <ChapterLikeButton chapterId={chapter._id} workId={workId} />
                <CommentSection chapterId={chapter._id} workId={workId} />

                <div className="rd-nav-btns">
                  {activeIdx > 0 && (
                    <button className="rd-nav-btn rd-nav-btn--prev" onClick={() => goToChapter(activeIdx - 1)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 5l-7 7 7 7"/>
                      </svg>
                      Önceki Bölüm
                    </button>
                  )}
                  {activeIdx < chapters.length - 1 ? (
                    <button className="rd-nav-btn rd-nav-btn--next" onClick={() => goToChapter(activeIdx + 1)}>
                      Sonraki Bölüm
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </button>
                  ) : (
                    <div className="rd-finished">
                      <div className="rd-finished-icon" aria-hidden="true">✦</div>
                      <p className="rd-finished-text">Son bölüme ulaştın. Hikâyeyi okuduğun için teşekkürler.</p>
                      <button className="rd-nav-btn rd-nav-btn--next" onClick={() => navigate("/keşfet")}>
                        Keşfetmeye Devam Et
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <p className="rd-keyboard-hint" aria-hidden="true">
                  ← → tuşlarıyla bölümler arasında geçiş yapabilirsin
                </p>
              </div>
            </article>

          ) : (
            <div className="rd-empty-state">
              <p>Bu eserde henüz yayınlanmış bölüm bulunmuyor.</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}